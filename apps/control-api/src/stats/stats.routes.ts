import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../auth/auth.middleware.js';
import { sshExec } from '../ssh/ssh-exec.js';
import { getServerById } from '../ssh/ssh.gateway.js';

const router = Router();

router.get('/', requireAuth, async (_req: AuthRequest, res: Response) => {
  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    const [{ stdout: cpu }, { stdout: mem }, { stdout: disk }, { stdout: uptime }, { stdout: load }, { stdout: containers }, { stdout: dockerDisk }] = await Promise.all([
      sshExec(server, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}'"),
      sshExec(server, "free -m | awk 'NR==2{printf \"%s/%s\", $3, $2}'"),
      sshExec(server, "df -h / | tail -1 | awk '{print $2,$3,$4,$5}'"),
      sshExec(server, "uptime -p 2>/dev/null || uptime"),
      sshExec(server, "cat /proc/loadavg | awk '{print $1, $2, $3}'"),
      sshExec(server, 'docker ps -a --format "{{.State}}" | sort | uniq -c | sort -rn'),
      sshExec(server, "docker system df --format '{{.Type}}|{{.TotalCount}}|{{.Size}}|{{.Reclaimable}}' 2>/dev/null"),
    ]);

    const cpuUsage = parseFloat(cpu.trim()) || 0;
    const [memUsed, memTotal] = mem.trim().split('/');
    const [diskTotal, diskUsed, diskFree, diskPercent] = disk.trim().split(' ');
    const [load1, load5, load15] = load.trim().split(' ');

    const containerStats = containers.trim().split('\n').filter(Boolean).reduce((acc: Record<string, number>, line) => {
      const match = line.match(/^\s*(\d+)\s+(.+)$/);
      if (match) acc[match[2].trim()] = parseInt(match[1]);
      return acc;
    }, {});

    const dockerDiskUsage = dockerDisk.trim().split('\n').filter(Boolean).map((line) => {
      const [type, count, size, reclaimable] = line.split('|');
      return { type, count: parseInt(count) || 0, size: size?.trim() || '0B', reclaimable: reclaimable?.trim() || '0B' };
    });

    res.json({
      cpu: cpuUsage,
      memory: { used: memUsed?.trim() || '0MiB', total: memTotal?.trim() || '0MiB' },
      disk: { total: diskTotal, used: diskUsed, free: diskFree, percent: diskPercent },
      uptime: uptime.trim(),
      load: { '1m': load1, '5m': load5, '15m': load15 },
      containers: {
        total: Object.values(containerStats).reduce((a: number, b: number) => a + b, 0),
        running: containerStats['running'] || 0,
        stopped: containerStats['exited'] || 0,
        restarting: containerStats['restarting'] || 0,
        paused: containerStats['paused'] || 0,
      },
      dockerDisk: dockerDiskUsage,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get server stats' });
  }
});

export default router;
