import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer } from 'http';

import authRoutes from './auth/auth.routes.js';
import sshRoutes from './ssh/ssh.routes.js';
import projectRoutes from './projects/projects.routes.js';
import containerRoutes from './containers/containers.routes.js';
import statsRoutes from './stats/stats.routes.js';
import { createSSHTunnel } from './ssh/ssh.gateway.js';
import { createLogsStream } from './containers/logs.gateway.js';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/', (_req, res) => {
  res.json({ message: 'Hello API' });
});

app.use('/auth', authRoutes);
app.use('/api/servers', sshRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/containers', containerRoutes);
app.use('/api/stats', statsRoutes);

const server = createServer(app);
createSSHTunnel(server);
createLogsStream(server);

server.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
