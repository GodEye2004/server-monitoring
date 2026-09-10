import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Client as SSHClient, ClientChannel } from 'ssh2';
import jwt from 'jsonwebtoken';
import * as cookie from 'cookie';
import { JwtPayload } from '../types.js';

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
}

const servers: ServerConfig[] = [
  {
    id: 'home',
    name: 'Home Server',
    host: '46.167.136.122',
    port: 22,
    username: 'homeenger',
  },
];

export function getServers(): ServerConfig[] {
  return servers;
}

export function getServerById(id: string): ServerConfig | undefined {
  return servers.find((s) => s.id === id);
}

function verifyToken(cookieHeader: string | undefined): JwtPayload | null {
  if (!cookieHeader) return null;
  const parsed = cookie.parse(cookieHeader);
  const token = parsed.token;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  } catch {
    return null;
  }
}

export function createSSHTunnel(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ssh' });

  wss.on('connection', (ws: WebSocket, req) => {
    const user = verifyToken(req.headers.cookie);
    if (!user) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const serverId = url.searchParams.get('serverId') || '';

    const serverConfig = getServerById(serverId);
    if (!serverConfig) {
      ws.close(4004, 'Server not found');
      return;
    }

    const ssh = new SSHClient();

    ssh.on('ready', () => {
      ssh.shell({ term: 'xterm-256color' }, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          ws.close(4005, 'Shell error');
          return;
        }

        stream.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: data.toString('utf-8') }));
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'output', data: data.toString('utf-8') }));
          }
        });

        ws.on('message', (msg: Buffer) => {
          try {
            const parsed = JSON.parse(msg.toString());
            if (parsed.type === 'input') {
              stream.write(parsed.data);
            } else if (parsed.type === 'resize') {
              stream.setWindow(parsed.rows, parsed.cols, 0, 0);
            }
          } catch {
            stream.write(msg.toString());
          }
        });

        stream.on('close', () => {
          ws.close();
          ssh.end();
        });
      });
    });

    ssh.on('error', (err: Error) => {
      console.error('SSH error:', err.message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', data: err.message }));
        ws.close(4006, 'SSH connection failed');
      }
    });

    ws.on('close', () => {
      ssh.end();
    });

    ssh.connect({
      host: serverConfig.host,
      port: serverConfig.port,
      username: serverConfig.username,
      password: '13134343A',
    });
  });
}
