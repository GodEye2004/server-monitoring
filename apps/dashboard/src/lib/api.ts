const API_BASE = '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server returned HTML instead of JSON (status ${res.status}). Is the backend running on port 3000?`);
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data as T;
}

export async function login(username: string, password: string) {
  return request<{ ok: boolean; user: { id: number; username: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function signup(username: string, password: string) {
  return request<{ ok: boolean; user: { id: number; username: string } }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe() {
  return request<{ user: { id: number; username: string } }>('/auth/me');
}

export async function logout() {
  return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

export async function getServers() {
  return request<{ servers: { id: string; name: string; host: string; port: number; username: string }[] }>('/api/servers');
}

export async function getProjects() {
  return request<{ projects: Project[] }>('/api/projects');
}

export async function createProject(data: { name: string; gitUrl: string; dockerPath?: string; port?: number }) {
  return request<{ project: Project }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: number) {
  return request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' });
}

export async function deployProject(id: number) {
  return request<{ ok: boolean; status: string }>(`/api/projects/${id}/deploy`, { method: 'POST' });
}

export async function stopProject(id: number) {
  return request<{ ok: boolean; status: string }>(`/api/projects/${id}/stop`, { method: 'POST' });
}

export async function getProjectLogs(id: number, tail = 200) {
  return request<{ logs: string }>(`/api/projects/${id}/logs?tail=${tail}`);
}

export async function getProject(id: number) {
  return request<{ project: Project }>(`/api/projects/${id}`);
}

export async function getProjectContainer(id: number) {
  return request<{ container: ContainerInfo | null }>(`/api/projects/${id}/container`);
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  running: boolean;
  startedAt: string;
  finishedAt: string;
  restartCount: number;
  ports: Record<string, { HostIp: string; HostPort: string }[]>;
  mounts: { type: string; source: string; destination: string }[];
  env: string[];
  cmd: string[];
  imageId: string;
  created: string;
  sizeRw: number;
  sizeRootFs: number;
}

export async function getServerStatus() {
  return request<{
    containers: { name: string; status: string; ports: string }[];
    disk: { total: string; used: string; free: string; percent: string };
    uptime: string;
  }>('/api/projects/server-status');
}

export async function getServerStats() {
  return request<{
    cpu: number;
    memory: { used: string; total: string };
    disk: { total: string; used: string; free: string; percent: string };
    uptime: string;
    load: { '1m': string; '5m': string; '15m': string };
    containers: { total: number; running: number; stopped: number; restarting: number; paused: number };
    dockerDisk: { type: string; count: number; size: string; reclaimable: string }[];
  }>('/api/stats');
}

export async function getAllContainers() {
  return request<{ containers: DockerContainer[] }>('/api/containers');
}

export async function getContainer(name: string) {
  return request<{ container: DockerContainerDetail }>(`/api/containers/${name}`);
}

export async function getContainerLogs(name: string, tail = 300) {
  return request<{ logs: string }>(`/api/containers/${name}/logs?tail=${tail}`);
}

export async function restartContainer(name: string) {
  return request<{ ok: boolean }>(`/api/containers/${name}/restart`, { method: 'POST' });
}

export async function stopContainer(name: string) {
  return request<{ ok: boolean }>(`/api/containers/${name}/stop`, { method: 'POST' });
}

export async function startContainer(name: string) {
  return request<{ ok: boolean }>(`/api/containers/${name}/start`, { method: 'POST' });
}

export async function removeContainer(name: string) {
  return request<{ ok: boolean }>(`/api/containers/${name}/remove`, { method: 'POST' });
}

export function connectContainerLogs(name: string): WebSocket {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${proto}//${window.location.host}/ws/logs?name=${name}`);
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  state: string;
  size: string;
  created: string;
}

export interface DockerContainerDetail {
  id: string;
  fullId: string;
  name: string;
  image: string;
  imageId: string;
  status: string;
  running: boolean;
  startedAt: string;
  finishedAt: string;
  exitCode: number;
  oomKilled: boolean;
  restartCount: number;
  restartPolicy: string;
  ports: Record<string, { HostIp: string; HostPort: string }[]>;
  mounts: { type: string; source: string; destination: string; mode?: string; rw: boolean }[];
  env: string[];
  cmd: string[];
  entrypoint: string[];
  labels: Record<string, string>;
  created: string;
  platform: string;
  hostname: string;
  networks: { name: string; ipAddress: string; gateway: string; macAddress: string }[];
  stats: { cpu: string; memUsage: string; memPerc: string; netIO: string; blockIO: string };
}

export interface Project {
  id: number;
  name: string;
  gitUrl: string;
  dockerPath: string | null;
  containerName: string | null;
  status: string;
  port: number | null;
  createdAt: string;
}
