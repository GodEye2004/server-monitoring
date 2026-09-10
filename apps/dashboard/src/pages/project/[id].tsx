import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context';
import {
  getProject,
  getProjectContainer,
  getProjectLogs,
  deployProject,
  stopProject,
  deleteProject,
  Project,
  ContainerInfo,
} from '../../lib/api';

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading, logout } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [container, setContainer] = useState<ContainerInfo | null>(null);
  const [logs, setLogs] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [logLines, setLogLines] = useState(200);
  const [activeTab, setActiveTab] = useState<'logs' | 'container' | 'settings'>('logs');
  const logsRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  const load = useCallback(() => {
    if (!id || !user) return;
    const projectId = Number(id);
    getProject(projectId).then((d) => setProject(d.project)).catch(console.error);
    getProjectContainer(projectId).then((d) => setContainer(d.container)).catch(console.error);
    getProjectLogs(projectId, logLines).then((d) => setLogs(d.logs)).catch(console.error);
  }, [id, user, logLines]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  async function handleDeploy() {
    if (!id) return;
    setDeploying(true);
    setError('');
    try {
      await deployProject(Number(id));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  }

  async function handleStop() {
    if (!id) return;
    setActionLoading('stop');
    try {
      await stopProject(Number(id));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stop failed');
    } finally {
      setActionLoading('');
    }
  }

  async function handleDelete() {
    if (!id || !confirm('Delete this project permanently?')) return;
    setActionLoading('delete');
    try {
      await deleteProject(Number(id));
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setActionLoading('');
    }
  }

  async function handleRefreshLogs() {
    if (!id) return;
    try {
      const d = await getProjectLogs(Number(id), logLines);
      setLogs(d.logs);
    } catch { /* ignore */ }
  }

  if (loading || !user || !project) {
    return <div className="loading-page"><div className="spinner" /></div>;
  }

  const isRunning = project.status === 'running';
  const isDeploying = project.status === 'deploying';

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
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-sm">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
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

        {/* Project Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: isRunning ? 'rgba(34,197,94,0.1)' : isDeploying ? 'rgba(234,179,8,0.1)' : 'rgba(113,113,122,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="28" height="28" fill="none" stroke={isRunning ? '#22c55e' : isDeploying ? '#eab308' : '#71717a'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>{project.name}</h1>
              <span className={`badge badge-${project.status}`}>{project.status}</span>
            </div>
            <p style={{ fontSize: 13, color: '#71717a', margin: '4px 0 0', fontFamily: 'monospace' }}>{project.gitUrl}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isRunning ? (
              <button onClick={handleDeploy} disabled={deploying || isDeploying} className="btn btn-success">
                {deploying || isDeploying ? (
                  <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Deploying...</>
                ) : (
                  <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Deploy</>
                )}
              </button>
            ) : (
              <button onClick={handleStop} disabled={actionLoading === 'stop'} className="btn btn-danger btn-sm">
                {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
              </button>
            )}
            <button onClick={handleDelete} disabled={actionLoading === 'delete'} className="btn btn-ghost btn-sm" style={{ color: '#f87171' }}>
              Delete
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #27272a', marginBottom: 24 }}>
          {(['logs', 'container', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? '#3b82f6' : 'transparent'}`,
                color: activeTab === tab ? '#fff' : '#71717a', fontSize: 13, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Container Logs</span>
                <select
                  value={logLines}
                  onChange={(e) => setLogLines(Number(e.target.value))}
                  style={{ background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6, padding: '4px 8px', color: '#a1a1aa', fontSize: 12 }}
                >
                  <option value={50}>Last 50 lines</option>
                  <option value={100}>Last 100 lines</option>
                  <option value={200}>Last 200 lines</option>
                  <option value={500}>Last 500 lines</option>
                  <option value={1000}>Last 1000 lines</option>
                </select>
              </div>
              <button onClick={handleRefreshLogs} className="btn btn-ghost btn-sm">
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
            <div style={{ background: '#0f1117', border: '1px solid #27272a', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '8px 16px', background: '#18181b', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: isRunning ? '#22c55e' : '#ef4444' }} />
                <span style={{ fontSize: 12, color: '#71717a', fontFamily: 'monospace' }}>docker logs --tail {logLines} {project.containerName}</span>
              </div>
              <pre ref={logsRef} className="log-output" style={{ height: 500, minHeight: 400 }}>
                {logs || (isRunning ? 'Waiting for output...' : 'Container is not running. Deploy it first to see logs.')}
              </pre>
            </div>
          </div>
        )}

        {/* Container Tab */}
        {activeTab === 'container' && (
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'block', marginBottom: 16 }}>Container Details</span>
            {!container ? (
              <div className="empty-state" style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12 }}>
                <div className="empty-state-icon">
                  <svg width="40" height="40" fill="none" stroke="#3f3f46" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                No container found. Deploy the project first.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Info Card */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 0.5 }}>General</h3>
                  <InfoRow label="Container ID" value={container.id} />
                  <InfoRow label="Name" value={container.name} />
                  <InfoRow label="Image" value={container.image} />
                  <InfoRow label="Status" value={container.status} color={container.running ? '#22c55e' : '#ef4444'} />
                  <InfoRow label="Created" value={new Date(container.created).toLocaleString()} />
                  <InfoRow label="Started" value={container.startedAt !== '0001-01-01T00:00:00Z' ? new Date(container.startedAt).toLocaleString() : 'N/A'} />
                  {container.finishedAt !== '0001-01-01T00:00:00Z' && (
                    <InfoRow label="Finished" value={new Date(container.finishedAt).toLocaleString()} />
                  )}
                </div>

                {/* Resources Card */}
                <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Resources</h3>
                  <InfoRow label="Image ID" value={container.imageId} />
                  <InfoRow label="Restart Count" value={String(container.restartCount)} />
                  <InfoRow label="Size (R/W)" value={container.sizeRw ? `${(container.sizeRw / 1024 / 1024).toFixed(2)} MB` : 'N/A'} />
                  <InfoRow label="Size (Root FS)" value={container.sizeRootFs ? `${(container.sizeRootFs / 1024 / 1024).toFixed(2)} MB` : 'N/A'} />
                  <InfoRow label="Command" value={container.cmd?.join(' ') || 'N/A'} mono />
                </div>

                {/* Mounts Card */}
                {container.mounts && container.mounts.length > 0 && (
                  <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20, gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Mounts</h3>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {container.mounts.map((m, i) => (
                        <div key={i} style={{ display: 'flex', gap: 16, fontSize: 13, fontFamily: 'monospace', padding: '8px 12px', background: '#0f1117', borderRadius: 8 }}>
                          <span style={{ color: '#60a5fa', minWidth: 60 }}>{m.type}</span>
                          <span style={{ color: '#e4e4e7', flex: 1 }}>{m.source}</span>
                          <span style={{ color: '#71717a' }}>{'->'} {m.destination}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Env Card */}
                {container.env && container.env.length > 0 && (
                  <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20, gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Environment Variables</h3>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {container.env.map((e, i) => {
                        const [key, ...rest] = e.split('=');
                        return (
                          <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', padding: '6px 12px', background: '#0f1117', borderRadius: 6 }}>
                            <span style={{ color: '#eab308' }}>{key}</span>
                            <span style={{ color: '#52525b' }}>=</span>
                            <span style={{ color: '#a1a1aa' }}>{rest.join('=')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Ports Card */}
                {container.ports && Object.keys(container.ports).length > 0 && (
                  <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 20, gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Ports</h3>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {Object.entries(container.ports).map(([containerPort, hostPorts]) => (
                        <div key={containerPort} style={{ display: 'flex', gap: 16, fontSize: 13, fontFamily: 'monospace', padding: '8px 12px', background: '#0f1117', borderRadius: 8 }}>
                          <span style={{ color: '#60a5fa' }}>{containerPort}</span>
                          <span style={{ color: '#71717a' }}>{'->'}</span>
                          <span style={{ color: '#e4e4e7' }}>
                            {hostPorts?.map((p) => `${p.HostIp || '0.0.0.0'}:${p.HostPort}`).join(', ') || 'N/A'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'block', marginBottom: 16 }}>Project Settings</span>
            <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 24, maxWidth: 600 }}>
              <InfoRow label="Project ID" value={String(project.id)} />
              <InfoRow label="Name" value={project.name} />
              <InfoRow label="Git URL" value={project.gitUrl} mono />
              <InfoRow label="Dockerfile Path" value={project.dockerPath || '/ (root)'} />
              <InfoRow label="Container Name" value={project.containerName || 'N/A'} mono />
              <InfoRow label="Expose Port" value={project.port ? `:${project.port}` : 'None'} />
              <InfoRow label="Status" value={project.status} color={isRunning ? '#22c55e' : '#71717a'} />
              <InfoRow label="Created" value={new Date(project.createdAt).toLocaleString()} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function InfoRow({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #27272a' }}>
      <span style={{ fontSize: 13, color: '#71717a' }}>{label}</span>
      <span style={{ fontSize: 13, color: color || '#e4e4e7', fontFamily: mono ? 'monospace' : 'inherit', fontWeight: 500, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
