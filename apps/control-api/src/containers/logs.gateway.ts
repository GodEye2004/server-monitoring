import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Client as SSHClient, ClientChannel } from 'ssh2';
import jwt from 'jsonwebtoken';
import * as cookie from 'cookie';
import { JwtPayload } from '../types.js';
import { getServerById } from '../ssh/ssh.gateway.js';

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

export function createLogsStream(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/logs' });

  wss.on('connection', (ws: WebSocket, req) => {
    const user = verifyToken(req.headers.cookie);
    if (!user) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const containerName = url.searchParams.get('name');
    if (!containerName) {
      ws.close(4002, 'Missing container name');
      return;
    }

    const serverConfig = getServerById('home');
    if (!serverConfig) {
      ws.close(4004, 'Server not configured');
      return;
    }

    const ssh = new SSHClient();

    ssh.on('ready', () => {
      const cmd = `docker logs -f --tail 100 ${containerName}`;
      ssh.exec(cmd, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          ws.close(4005, 'Exec error');
          ssh.end();
          return;
        }

        stream.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'log', data: data.toString('utf-8') }));
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'log', data: data.toString('utf-8') }));
          }
        });

        stream.on('close', () => {
          ws.send(JSON.stringify({ type: 'done' }));
          ws.close();
          ssh.end();
        });

        ws.on('message', (msg: Buffer) => {
          try {
            const parsed = JSON.parse(msg.toString());
            if (parsed.type === 'stop') {
              stream.close();
            }
          } catch {
            // ignore
          }
        });
      });
    });

    ssh.on('error', (err: Error) => {
      console.error('SSH error for logs:', err.message);
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
