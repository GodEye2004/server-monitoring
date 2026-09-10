import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../lib/auth-context';
import {
  getServerStats,
  getAllContainers,
  getProjects,
  DockerContainer,
  Project,
} from '../../lib/api';

interface ServerStats {
  cpu: number;
  memory: { used: string; total: string };
  disk: { total: string; used: string; free: string; percent: string };
  uptime: string;
  load: { '1m': string; '5m': string; '15m': string };
  containers: { total: number; running: number; stopped: number; restarting: number; paused: number };
  dockerDisk: { type: string; count: number; size: string; reclaimable: string }[];
}

export default function HomePage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  const loadData = () => {
    if (!user) return;
    Promise.all([
      getServerStats(),
      getAllContainers(),
      getProjects(),
    ]).then(([statsData, containersData, projectsData]) => {
      setStats(statsData);
      setContainers(containersData.containers);
      setProjects(projectsData.projects);
    }).catch(console.error).finally(() => setLoadingData(false));
  };

  useEffect(() => {
    loadData();
    if (!autoRefresh) return;
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [user, autoRefresh]);

  const getCpuColor = (cpu: number) => {
    if (cpu < 50) return '#22c55e';
    if (cpu < 80) return '#eab308';
    return '#ef4444';
  };

  const getMemPercent = () => {
    if (!stats) return 0;
    const used = parseInt(stats.memory.used);
    const total = parseInt(stats.memory.total);
    return total > 0 ? Math.round((used / total) * 100) : 0;
  };

  if (loading || !user) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="18" height="18" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          Dashboard
        </div>
        <div className="header-right">
          <button onClick={() => setAutoRefresh(!autoRefresh)} className={`btn btn-sm ${autoRefresh ? 'btn-success' : 'btn-ghost'}`}>
            {autoRefresh ? '● Live' : '○ Paused'}
          </button>
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-sm">
            Servers
          </button>
          <span className="username">{user.username}</span>
          <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
        </div>
      </header>

      <main className="main">
        {loadingData ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : (
          <>
            {stats && (
              <div className="stats-grid">
                <div className="stat-card large">
                  <div className="stat-header">
                    <span className="stat-label">CPU Usage</span>
                    <span className="stat-value" style={{ color: getCpuColor(stats.cpu) }}>{stats.cpu}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${stats.cpu}%`, background: getCpuColor(stats.cpu) }} />
                  </div>
                  <div className="stat-sub">Load: {stats.load['1m']} / {stats.load['5m']} / {stats.load['15m']}</div>
                </div>

                <div className="stat-card large">
                  <div className="stat-header">
                    <span className="stat-label">Memory</span>
                    <span className="stat-value" style={{ color: getMemPercent() < 80 ? '#22c55e' : '#eab308' }}>{getMemPercent()}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${getMemPercent()}%`, background: getMemPercent() < 80 ? '#22c55e' : '#eab308' }} />
                  </div>
                  <div className="stat-sub">{stats.memory.used} / {stats.memory.total}</div>
                </div>

                <div className="stat-card large">
                  <div className="stat-header">
                    <span className="stat-label">Disk</span>
                    <span className="stat-value">{stats.disk.percent}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: stats.disk.percent, background: '#3b82f6' }} />
                  </div>
                  <div className="stat-sub">{stats.disk.used} / {stats.disk.total} ({stats.disk.free} free)</div>
                </div>

                <div className="stat-card">
                  <span className="stat-label">Uptime</span>
                  <span className="stat-value small">{stats.uptime}</span>
                </div>
              </div>
            )}

            <div className="overview-grid">
              <div className="overview-section">
                <div className="section-header">
                  <h2 className="section-title">Containers</h2>
                  <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-sm">View All</button>
                </div>
                {stats && (
                  <div className="container-stats">
                    <div className="container-stat running">
                      <span className="count">{stats.containers.running}</span>
                      <span className="label">Running</span>
                    </div>
                    <div className="container-stat stopped">
                      <span className="count">{stats.containers.stopped}</span>
                      <span className="label">Stopped</span>
                    </div>
                    <div className="container-stat restarting">
                      <span className="count">{stats.containers.restarting}</span>
                      <span className="label">Restarting</span>
                    </div>
                    <div className="container-stat total">
                      <span className="count">{stats.containers.total}</span>
                      <span className="label">Total</span>
                    </div>
                  </div>
                )}
                <div className="recent-containers">
                  {containers.slice(0, 8).map((c) => (
                    <div key={c.id} className="recent-item" onClick={() => router.push(`/container/${c.name}`)}>
                      <span className={`container-dot ${c.state === 'running' ? 'running' : c.state === 'restarting' ? 'restarting' : 'stopped'}`} />
                      <span className="item-name">{c.name}</span>
                      <span className="item-status">{c.status}</span>
                    </div>
                  ))}
                  {containers.length > 8 && (
                    <div className="recent-more" onClick={() => router.push('/dashboard')}>
                      +{containers.length - 8} more containers
                    </div>
                  )}
                </div>
              </div>

              <div className="overview-section">
                <div className="section-header">
                  <h2 className="section-title">Projects</h2>
                  <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-sm">Manage</button>
                </div>
                <div className="recent-containers">
                  {projects.length === 0 ? (
                    <div className="empty-state small">
                      No projects yet. Create one from the server panel.
                    </div>
                  ) : (
                    projects.slice(0, 6).map((p) => (
                      <div key={p.id} className="recent-item" onClick={() => router.push(`/project/${p.id}`)}>
                        <span className={`container-dot ${p.status === 'running' ? 'running' : 'stopped'}`} />
                        <span className="item-name">{p.name}</span>
                        <span className={`badge badge-${p.status}`}>{p.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {stats && stats.dockerDisk.length > 0 && (
              <div className="overview-section full-width">
                <div className="section-header">
                  <h2 className="section-title">Docker Disk Usage</h2>
                </div>
                <div className="docker-disk-grid">
                  {stats.dockerDisk.map((d, i) => (
                    <div key={i} className="docker-disk-card">
                      <span className="disk-type">{d.type}</span>
                      <span className="disk-count">{d.count} items</span>
                      <span className="disk-size">{d.size}</span>
                      <span className="disk-reclaimable">Reclaimable: {d.reclaimable}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
