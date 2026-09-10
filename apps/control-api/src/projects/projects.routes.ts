import { Router, Response } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, AuthRequest } from '../auth/auth.middleware.js';
import { sshExec } from '../ssh/ssh-exec.js';
import { getServerById } from '../ssh/ssh.gateway.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ projects });
});

router.get('/server-status', requireAuth, async (_req: AuthRequest, res: Response) => {
  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    const [{ stdout: containers }, { stdout: disk }, { stdout: uptime }] = await Promise.all([
      sshExec(server, 'docker ps -a --format "{{.Names}}|{{.Status}}|{{.Ports}}" 2>/dev/null || echo "Docker not available"'),
      sshExec(server, 'df -h / | tail -1 | awk \'{print $2,$3,$4,$5}\''),
      sshExec(server, 'uptime -p 2>/dev/null || uptime'),
    ]);

    const containerList = containers.trim().split('\n').filter(Boolean).map((line) => {
      const [name, status, ports] = line.split('|');
      return { name, status, ports };
    });

    const [total, used, free, percent] = disk.trim().split(' ');

    res.json({
      containers: containerList,
      disk: { total, used, free, percent },
      uptime: uptime.trim(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get server status' });
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { name, gitUrl, dockerPath, port } = req.body;
  if (!name || !gitUrl) {
    res.status(400).json({ error: 'Name and git URL are required' });
    return;
  }

  const containerName = `proj-${Date.now()}`;

  const project = await prisma.project.create({
    data: {
      name,
      gitUrl,
      dockerPath: dockerPath || null,
      containerName,
      port: port || null,
      userId: req.user!.id,
    },
  });

  res.status(201).json({ project });
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: Number(req.params.id), userId: req.user!.id },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ project });
});

router.get('/:id/container', requireAuth, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: Number(req.params.id), userId: req.user!.id },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    const { stdout } = await sshExec(server, `docker inspect ${project.containerName} 2>/dev/null || echo "NOT_RUNNING"`);
    if (stdout.includes('NOT_RUNNING')) {
      res.json({ container: null });
      return;
    }
    const data = JSON.parse(stdout);
    const c = data[0];
    res.json({
      container: {
        id: c.Id?.substring(0, 12),
        name: c.Name?.replace('/', ''),
        image: c.Config?.Image,
        status: c.State?.Status,
        running: c.State?.Running,
        startedAt: c.State?.StartedAt,
        finishedAt: c.State?.FinishedAt,
        restartCount: c.RestartPolicy?.MaximumRetryCount,
        ports: c.NetworkSettings?.Ports,
        mounts: c.Mounts?.map((m: any) => ({ type: m.Type, source: m.Source, destination: m.Destination })),
        env: c.Config?.Env,
        cmd: c.Config?.Cmd,
        imageId: c.Image?.substring(0, 19),
        created: c.Created,
        sizeRw: c.SizeRw,
        sizeRootFs: c.SizeRootFs,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to inspect container' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: Number(req.params.id), userId: req.user!.id },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const server = getServerById('home');
  if (server && project.containerName) {
    try {
      await sshExec(server, `docker stop ${project.containerName} 2>/dev/null; docker rm ${project.containerName} 2>/dev/null; rm -rf /tmp/${project.containerName}`);
    } catch { /* ignore cleanup errors */ }
  }

  await prisma.project.delete({ where: { id: project.id } });
  res.json({ ok: true });
});

router.post('/:id/deploy', requireAuth, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: Number(req.params.id), userId: req.user!.id },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    await prisma.project.update({ where: { id: project.id }, data: { status: 'deploying' } });

    const dir = `/tmp/${project.containerName}`;
    const buildDir = project.dockerPath ? `${dir}/${project.dockerPath}` : dir;

    await sshExec(server, `rm -rf ${dir} && git clone ${project.gitUrl} ${dir}`, 60000);

    const { stdout: dockerCheck } = await sshExec(server, `test -f ${buildDir}/Dockerfile && echo EXISTS`);
    if (!dockerCheck.includes('EXISTS')) {
      await prisma.project.update({ where: { id: project.id }, data: { status: 'error' } });
      res.status(400).json({ error: 'No Dockerfile found' });
      return;
    }

    await sshExec(server, `cd ${buildDir} && docker build -t ${project.containerName} .`, 120000);

    await sshExec(server, `docker stop ${project.containerName} 2>/dev/null; docker rm ${project.containerName} 2>/dev/null`);

    const portFlag = project.port ? `-p ${project.port}:80` : '';
    await sshExec(server, `docker run -d --name ${project.containerName} ${portFlag} ${project.containerName}`, 30000);

    await prisma.project.update({ where: { id: project.id }, data: { status: 'running' } });
    res.json({ ok: true, status: 'running' });
  } catch (err) {
    await prisma.project.update({ where: { id: project.id }, data: { status: 'error' } });
    res.status(500).json({ error: err instanceof Error ? err.message : 'Deploy failed' });
  }
});

router.post('/:id/stop', requireAuth, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: Number(req.params.id), userId: req.user!.id },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const server = getServerById('home');
  if (server && project.containerName) {
    await sshExec(server, `docker stop ${project.containerName} 2>/dev/null`);
  }

  await prisma.project.update({ where: { id: project.id }, data: { status: 'stopped' } });
  res.json({ ok: true, status: 'stopped' });
});

router.get('/:id/logs', requireAuth, async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findFirst({
    where: { id: Number(req.params.id), userId: req.user!.id },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const server = getServerById('home');
  if (!server) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  const tail = req.query.tail ? Number(req.query.tail) : 200;
  const { stdout } = await sshExec(server, `docker logs --tail ${tail} ${project.containerName} 2>&1`);
  res.json({ logs: stdout });
});

export default router;
