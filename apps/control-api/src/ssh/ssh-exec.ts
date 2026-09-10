import { Client as SSHClient, ClientChannel } from 'ssh2';
import { ServerConfig } from './ssh.gateway.js';

export function sshExec(server: ServerConfig, command: string, timeout = 30000): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const ssh = new SSHClient();
    let stdout = '';
    let stderr = '';
    let code = 1;
    const timer = setTimeout(() => {
      ssh.end();
      reject(new Error('SSH command timed out'));
    }, timeout);

    ssh.on('ready', () => {
      ssh.exec(command, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          clearTimeout(timer);
          ssh.end();
          reject(err);
          return;
        }

        stream.on('data', (data: Buffer) => {
          stdout += data.toString('utf-8');
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString('utf-8');
        });

        stream.on('close', (exitCode: number | null) => {
          code = exitCode ?? 1;
          clearTimeout(timer);
          ssh.end();
          resolve({ stdout, stderr, code });
        });
      });
    });

    ssh.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });

    ssh.connect({
      host: server.host,
      port: server.port,
      username: server.username,
      password: '13134343A',
    });
  });
}
