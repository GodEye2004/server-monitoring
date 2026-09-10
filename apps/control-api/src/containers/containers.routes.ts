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
    const { stdout, stderr } = await sshExec(
      server,
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.State}}"',
    );

    if (!stdout.trim()) {
      res.json({ containers: [], debug: stderr });
      return;
    }

    const containers = stdout.trim().split('\n').filter(Boolean).map((line) => {
      const [id, name, image, status, ports, state] = line.split('|');
      return { id, name, image, status, ports, state };
    });

    res.json({ containers });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list containers' });
  }
});

router.get('/:name', requireAuth, async (req: AuthRequest, res: Response) => {
  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const { name } = req.params;

  try {
    const { stdout, code } = await sshExec(server, `docker inspect ${name} 2>/dev/null`);
    if (code !== 0 || !stdout.trim().startsWith('[')) {
      res.status(404).json({ error: 'Container not found' });
      return;
    }

    const data = JSON.parse(stdout);
    const c = data[0];

    const stats = await sshExec(server, `docker stats ${name} --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}' 2>/dev/null`).catch(() => ({ stdout: '' }));
    const [cpu, memUsage, memPerc, netIO, blockIO] = stats.stdout.trim().split('|');

    res.json({
      container: {
        id: c.Id?.substring(0, 12),
        fullId: c.Id,
        name: c.Name?.replace('/', ''),
        image: c.Config?.Image,
        imageId: c.Image,
        status: c.State?.Status,
        running: c.State?.Running,
        startedAt: c.State?.StartedAt,
        finishedAt: c.State?.FinishedAt,
        exitCode: c.State?.ExitCode,
        oomKilled: c.State?.OOMKilled,
        restartCount: c.HostConfig?.RestartPolicy?.MaximumRetryCount || 0,
        restartPolicy: c.HostConfig?.RestartPolicy?.Name,
        ports: c.NetworkSettings?.Ports,
        mounts: c.Mounts?.map((m: any) => ({ type: m.Type, source: m.Source, destination: m.Destination, mode: m.Mode, rw: m.RW })),
        env: c.Config?.Env,
        cmd: c.Config?.Cmd,
        entrypoint: c.Config?.Entrypoint,
        labels: c.Config?.Labels,
        created: c.Created,
        platform: c.Platform,
        hostname: c.Config?.Hostname,
        networks: c.NetworkSettings?.Networks ? Object.entries(c.NetworkSettings.Networks).map(([name, n]: [string, any]) => ({
          name,
          ipAddress: n.IPAddress,
          gateway: n.Gateway,
          macAddress: n.MacAddress,
        })) : [],
        stats: {
          cpu: cpu?.trim(),
          memUsage: memUsage?.trim(),
          memPerc: memPerc?.trim(),
          netIO: netIO?.trim(),
          blockIO: blockIO?.trim(),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to inspect container' });
  }
});

router.get('/:name/logs', requireAuth, async (req: AuthRequest, res: Response) => {
  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const { name } = req.params;
  const tail = req.query.tail ? Number(req.query.tail) : 300;
  const since = req.query.since ? String(req.query.since) : '';

  try {
    const sinceFlag = since ? `--since ${since}` : '';
    const { stdout } = await sshExec(server, `docker logs --tail ${tail} ${sinceFlag} ${name} 2>&1`);
    res.json({ logs: stdout });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get logs' });
  }
});

router.post('/:name/restart', requireAuth, async (req: AuthRequest, res: Response) => {
  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    await sshExec(server, `docker restart ${req.params.name}`, 30000);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to restart' });
  }
});

router.post('/:name/stop', requireAuth, async (req: AuthRequest, res: Response) => {
  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    await sshExec(server, `docker stop ${req.params.name}`, 30000);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to stop' });
  }
});

router.post('/:name/start', requireAuth, async (req: AuthRequest, res: Response) => {
  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    await sshExec(server, `docker start ${req.params.name}`, 30000);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to start' });
  }
});

router.post('/:name/remove', requireAuth, async (req: AuthRequest, res: Response) => {
  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    await sshExec(server, `docker stop ${req.params.name} 2>/dev/null; docker rm ${req.params.name}`, 30000);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove' });
  }
});

export default router;
