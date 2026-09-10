import { Router, Response } from 'express';
import { getServers } from './ssh.gateway.js';
import { requireAuth, AuthRequest } from '../auth/auth.middleware.js';

const router = Router();

router.get('/', requireAuth, (_req: AuthRequest, res: Response) => {
  const servers = getServers().map(({ id, name, host, port, username }) => ({
    id,
    name,
    host,
    port,
    username,
  }));
  res.json({ servers });
});

export default router;
