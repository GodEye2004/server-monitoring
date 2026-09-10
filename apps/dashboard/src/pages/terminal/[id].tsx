import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context';
import {
  getProjects,
  createProject,
  deleteProject,
  deployProject,
  stopProject,
  getProjectLogs,
  getServerStatus,
  getAllContainers,
  DockerContainer,
  Project,
} from '../../lib/api';

interface ServerStatus {
  disk: { total: string; used: string; free: string; percent: string };
  uptime: string;
}

export default function PanelPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', gitUrl: '', dockerPath: '', port: '' });
  const [deploying, setDeploying] = useState<number | null>(null);
  const [logs, setLogs] = useState<{ id: number; text: string } | null>(null);
  const [error, setError] = useState('');
  const [containerFilter, setContainerFilter] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  const load = () => {
    if (!user) return;
    getProjects().then((d) => setProjects(d.projects)).catch(console.error);
    getServerStatus().then(setServerStatus).catch(console.error);
    getAllContainers().then((d) => setContainers(d.containers)).catch(console.error);
  };

  useEffect(() => { load(); }, [user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await createProject({
        name: form.name,
        gitUrl: form.gitUrl,
        dockerPath: form.dockerPath || undefined,
        port: form.port ? Number(form.port) : undefined,
      });
      setForm({ name: '', gitUrl: '', dockerPath: '', port: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function handleDeploy(id: number) {
    setDeploying(id);
    try {
      await deployProject(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeploying(null);
    }
  }

  async function handleStop(id: number) {
    try {
      await stopProject(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stop failed');
    }
  }

  async function handleLogs(id: number) {
    try {
      const data = await getProjectLogs(id);
      setLogs({ id, text: data.logs });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get logs');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this project?')) return;
    try {
      await deleteProject(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  const filteredContainers = containers.filter((c) =>
    c.name.toLowerCase().includes(containerFilter.toLowerCase()) ||
    c.image.toLowerCase().includes(containerFilter.toLowerCase())
  );

  if (loading || !user) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="18" height="18" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          Server Panel
        </div>
        <div className="header-right">
          <button onClick={() => router.push('/terminal/home')} className="btn btn-ghost btn-sm">
            Dashboard
          </button>
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-sm">
            Servers
          </button>
          <span className="username">{user.username}</span>
          <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error-banner">
            {error}
            <button className="error-close" onClick={() => setError('')}>x</button>
          </div>
        )}

        {serverStatus && (
          <div className="status-bar">
            <div className="stat-card">
              <span className="stat-label">Uptime</span>
              <span className="stat-value">{serverStatus.uptime}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Disk Usage</span>
              <span className="stat-value">
                {serverStatus.disk.used}
                <span style={{ fontSize: 14, color: '#71717a', fontWeight: 400 }}> / {serverStatus.disk.total}</span>
                <span style={{ fontSize: 14, color: '#60a5fa', fontWeight: 400 }}> ({serverStatus.disk.percent})</span>
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Docker Containers</span>
              <span className="stat-value green">{containers.length}</span>
            </div>
          </div>
        )}

        {containers.length > 0 && (
          <div className="section">
            <div className="section-header">
              <h2 className="section-title">Docker Containers ({filteredContainers.length}/{containers.length})</h2>
              <input
                type="text"
                placeholder="Search containers..."
                value={containerFilter}
                onChange={(e) => setContainerFilter(e.target.value)}
                className="form-input"
                style={{ width: 200 }}
              />
            </div>
            <div className="container-grid">
              {filteredContainers.map((c) => (
                <div key={c.id} className="container-card" style={{ cursor: 'pointer' }} onClick={() => router.push(`/container/${c.name}`)}>
                  <span className={`container-dot ${c.state === 'running' ? 'running' : c.state === 'restarting' ? 'restarting' : 'stopped'}`} />
                  <span className="container-name">{c.name}</span>
                  <span className="container-status">{c.status}</span>
                  {c.ports && <span className="container-ports">{c.ports}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Projects</h2>
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
              {showForm ? 'Cancel' : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Project
                </>
              )}
            </button>
          </div>

          {showForm && (
            <div className="form-card">
              <form onSubmit={handleCreate}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Project Name</label>
                    <input
                      placeholder="my-app"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expose Port</label>
                    <input
                      placeholder="3000"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: e.target.value })}
                      className="form-input"
                      type="number"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Git Repository URL</label>
                    <input
                      placeholder="https://github.com/user/repo.git"
                      value={form.gitUrl}
                      onChange={(e) => setForm({ ...form, gitUrl: e.target.value })}
                      className="form-input"
                      required
                    />
                  </div>
                  <div className="form-group full-width">
                    <label className="form-label">Dockerfile Path <span style={{ color: '#52525b' }}>(optional, default: root)</span></label>
                    <input
                      placeholder="docker or ."
                      value={form.dockerPath}
                      onChange={(e) => setForm({ ...form, dockerPath: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-actions">
                    <button type="button" onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
                    <button type="submit" className="btn btn-success">Create Project</button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {projects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="40" height="40" fill="none" stroke="#3f3f46" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              No projects yet. Click &quot;Add Project&quot; to deploy your first app.
            </div>
          ) : (
            <div className="project-list">
              {projects.map((p) => (
                <div key={p.id} className="project-card">
                  <div className="project-info">
                    <h3 className="project-name" style={{ cursor: 'pointer' }} onClick={() => router.push(`/project/${p.id}`)}>
                      {p.name}
                    </h3>
                    <p className="project-url" style={{ cursor: 'pointer' }} onClick={() => router.push(`/project/${p.id}`)}>{p.gitUrl}</p>
                    <div className="project-meta">
                      <span className={`badge badge-${p.status}`}>{p.status}</span>
                      {p.port && <span className="badge badge-port">:{p.port}</span>}
                    </div>
                  </div>
                  <div className="project-actions">
                    {p.status !== 'running' ? (
                      <button onClick={() => handleDeploy(p.id)} disabled={deploying === p.id} className="btn btn-success btn-sm">
                        {deploying === p.id ? (
                          <>
                            <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                            Deploying...
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Deploy
                          </>
                        )}
                      </button>
                    ) : (
                      <button onClick={() => handleStop(p.id)} className="btn btn-danger btn-sm">
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        Stop
                      </button>
                    )}
                    <button onClick={() => handleLogs(p.id)} className="btn btn-ghost btn-sm">
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Logs
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="btn btn-ghost btn-sm" style={{ color: '#f87171' }}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {logs && (
          <div className="modal-overlay" onClick={() => setLogs(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Logs — {projects.find((p) => p.id === logs.id)?.name}</h3>
                <button className="modal-close" onClick={() => setLogs(null)}>x</button>
              </div>
              <pre className="log-output">{logs.text || 'No logs available'}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
