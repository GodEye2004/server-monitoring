import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context';
import {
  getContainer,
  getContainerLogs,
  connectContainerLogs,
  restartContainer,
  stopContainer,
  startContainer,
  removeContainer,
  DockerContainerDetail,
} from '../../lib/api';

type Tab = 'logs' | 'live' | 'info' | 'mounts' | 'env' | 'networks';

export default function ContainerDetailPage() {
  const router = useRouter();
  const { name } = router.query;
  const { user, loading } = useAuth();
  const [container, setContainer] = useState<DockerContainerDetail | null>(null);
  const [logs, setLogs] = useState('');
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('logs');
  const [logsTail, setLogsTail] = useState(300);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const liveEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (!name || typeof name !== 'string') return;
    setLoadingData(true);
    setError('');
    getContainer(name)
      .then((data) => setContainer(data.container))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingData(false));
  }, [name]);

  useEffect(() => {
    if (!name || typeof name !== 'string') return;
    getContainerLogs(name, logsTail).then((data) => setLogs(data.logs));
  }, [name, logsTail]);

  useEffect(() => {
    if (!name || typeof name !== 'string') return;
    if (tab !== 'live') {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      return;
    }

    setLiveLogs([]);
    const ws = connectContainerLogs(name);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'log') {
        setLiveLogs((prev) => [...prev.slice(-1000), msg.data]);
      }
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [name, tab]);

  useEffect(() => {
    if (tab === 'live') liveEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveLogs, tab]);

  useEffect(() => {
    if (tab === 'logs') logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, tab]);

  const doAction = async (action: string, fn: () => Promise<{ ok: boolean }>) => {
    setActionLoading(action);
    try {
      await fn();
      if (name && typeof name === 'string') {
        const data = await getContainer(name);
        setContainer(data.container);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setActionLoading('');
  };

  if (loading || !user) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="terminal-page">
      <div className="sidebar">
        <div className="sidebar-header">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-back">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="logo">Container</div>
        </div>

        <div className="server-section">
          <div className="section-header"><h2 className="section-title">Info</h2></div>
          <div className="sidebar-info">
            <div className="info-row"><span className="info-label">Name</span><span className="info-value">{container?.name || '...'}</span></div>
            <div className="info-row"><span className="info-label">ID</span><span className="info-value mono">{container?.id || '...'}</span></div>
            <div className="info-row"><span className="info-label">Image</span><span className="info-value mono">{container?.image || '...'}</span></div>
            <div className="info-row">
              <span className="info-label">Status</span>
              <span className="info-value"><span className={`badge badge-${container?.running ? 'running' : 'stopped'}`}>{container?.status || '...'}</span></span>
            </div>
            <div className="info-row"><span className="info-label">Uptime</span><span className="info-value">{container?.startedAt ? new Date(container.startedAt).toLocaleString() : '-'}</span></div>
          </div>

          {container && (
            <div className="action-buttons">
              {container.running ? (
                <>
                  <button onClick={() => doAction('restart', () => restartContainer(container.name))} disabled={actionLoading === 'restart'} className="btn btn-warning">
                    {actionLoading === 'restart' ? 'Restarting...' : 'Restart'}
                  </button>
                  <button onClick={() => doAction('stop', () => stopContainer(container.name))} disabled={actionLoading === 'stop'} className="btn btn-danger">
                    {actionLoading === 'stop' ? 'Stopping...' : 'Stop'}
                  </button>
                </>
              ) : (
                <button onClick={() => doAction('start', () => startContainer(container.name))} disabled={actionLoading === 'start'} className="btn btn-success">
                  {actionLoading === 'start' ? 'Starting...' : 'Start'}
                </button>
              )}
              <button onClick={() => { if (confirm('Delete this container?')) doAction('remove', () => removeContainer(container.name)).then(() => router.push('/panel/home')); }} disabled={actionLoading === 'remove'} className="btn btn-danger-outline">
                {actionLoading === 'remove' ? 'Removing...' : 'Remove'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="main-content">
        <div className="terminal-header">
          <div className="terminal-tabs">
            {(['logs', 'live', 'info', 'mounts', 'env', 'networks'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? 'active' : ''}`}>{t === 'live' ? 'Live Logs' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
        </div>

        {error && <div className="toast toast-error">{error}<button onClick={() => setError('')}>×</button></div>}

        {loadingData ? <div className="loading-screen"><div className="spinner" /></div> : (
          <div className="terminal-output">
            {tab === 'logs' && (
              <div className="logs-viewer">
                <div className="logs-toolbar">
                  <select value={logsTail} onChange={(e) => setLogsTail(Number(e.target.value))} className="select">
                    <option value={50}>50 lines</option>
                    <option value={100}>100 lines</option>
                    <option value={200}>200 lines</option>
                    <option value={500}>500 lines</option>
                    <option value={1000}>1000 lines</option>
                  </select>
                </div>
                <pre className="logs-content">{logs || 'No logs available.'}</pre>
                <div ref={logsEndRef} />
              </div>
            )}

            {tab === 'live' && (
              <div className="logs-viewer live">
                <div className="logs-toolbar">
                  <span className="live-indicator">● LIVE</span>
                </div>
                <pre className="logs-content">{liveLogs.join('') || 'Waiting for logs...'}</pre>
                <div ref={liveEndRef} />
              </div>
            )}

            {tab === 'info' && container && (
              <div className="info-grid">
                <div className="info-card">
                  <h3>General</h3>
                  <div className="info-table">
                    <div className="info-row"><span>Container ID</span><span className="mono">{container.fullId}</span></div>
                    <div className="info-row"><span>Name</span><span>{container.name}</span></div>
                    <div className="info-row"><span>Hostname</span><span>{container.hostname}</span></div>
                    <div className="info-row"><span>Platform</span><span>{container.platform}</span></div>
                    <div className="info-row"><span>Created</span><span>{new Date(container.created).toLocaleString()}</span></div>
                  </div>
                </div>
                <div className="info-card">
                  <h3>State</h3>
                  <div className="info-table">
                    <div className="info-row"><span>Status</span><span className={`badge badge-${container.running ? 'running' : 'stopped'}`}>{container.status}</span></div>
                    <div className="info-row"><span>Running</span><span>{container.running ? 'Yes' : 'No'}</span></div>
                    <div className="info-row"><span>Started</span><span>{container.startedAt ? new Date(container.startedAt).toLocaleString() : '-'}</span></div>
                    <div className="info-row"><span>Finished</span><span>{container.finishedAt ? new Date(container.finishedAt).toLocaleString() : '-'}</span></div>
                    <div className="info-row"><span>Exit Code</span><span>{container.exitCode}</span></div>
                    <div className="info-row"><span>OOM Killed</span><span>{container.oomKilled ? 'Yes' : 'No'}</span></div>
                    <div className="info-row"><span>Restart Count</span><span>{container.restartCount}</span></div>
                    <div className="info-row"><span>Restart Policy</span><span>{container.restartPolicy}</span></div>
                  </div>
                </div>
                <div className="info-card">
                  <h3>Image</h3>
                  <div className="info-table">
                    <div className="info-row"><span>Image</span><span className="mono">{container.image}</span></div>
                    <div className="info-row"><span>Image ID</span><span className="mono">{container.imageId}</span></div>
                    <div className="info-row"><span>Command</span><span className="mono">{container.cmd?.join(' ')}</span></div>
                    <div className="info-row"><span>Entrypoint</span><span className="mono">{container.entrypoint?.join(' ')}</span></div>
                  </div>
                </div>
                {container.stats && (
                  <div className="info-card">
                    <h3>Resources</h3>
                    <div className="info-table">
                      <div className="info-row"><span>CPU</span><span>{container.stats.cpu}</span></div>
                      <div className="info-row"><span>Memory</span><span>{container.stats.memUsage} ({container.stats.memPerc})</span></div>
                      <div className="info-row"><span>Network I/O</span><span>{container.stats.netIO}</span></div>
                      <div className="info-row"><span>Block I/O</span><span>{container.stats.blockIO}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'mounts' && container && (
              <div className="info-card">
                <h3>Mounts</h3>
                {(!container.mounts || container.mounts.length === 0) ? (
                  <p className="muted">No mounts</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Type</th><th>Source</th><th>Destination</th><th>Mode</th><th>R/W</th></tr></thead>
                      <tbody>
                        {container.mounts.map((m, i) => (
                          <tr key={i}><td><span className="badge">{m.type}</span></td><td className="mono">{m.source}</td><td className="mono">{m.destination}</td><td>{m.mode || '-'}</td><td>{m.rw ? 'R/W' : 'R/O'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'env' && container && (
              <div className="info-card">
                <h3>Environment Variables</h3>
                {(!container.env || container.env.length === 0) ? (
                  <p className="muted">No environment variables</p>
                ) : (
                  <div className="env-list">
                    {container.env.map((e, i) => {
                      const idx = e.indexOf('=');
                      const key = idx > -1 ? e.substring(0, idx) : e;
                      const val = idx > -1 ? e.substring(idx + 1) : '';
                      return (
                        <div key={i} className="env-row">
                          <span className="env-key">{key}</span>
                          <span className="env-value">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'networks' && container && (
              <div className="info-card">
                <h3>Networks</h3>
                {(!container.networks || container.networks.length === 0) ? (
                  <p className="muted">No networks</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Network</th><th>IP Address</th><th>Gateway</th><th>MAC Address</th></tr></thead>
                      <tbody>
                        {container.networks.map((n, i) => (
                          <tr key={i}><td><span className="badge">{n.name}</span></td><td className="mono">{n.ipAddress}</td><td className="mono">{n.gateway}</td><td className="mono">{n.macAddress}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
