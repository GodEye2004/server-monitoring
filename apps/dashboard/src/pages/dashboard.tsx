import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../lib/auth-context';
import { getServers } from '../lib/api';

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) getServers().then((d) => setServers(d.servers)).catch(console.error);
  }, [user]);

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
          <button onClick={() => router.push(`/terminal/home`)} className="btn btn-ghost btn-sm">
            Dashboard
          </button>
          <span className="username">{user.username}</span>
          <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
        </div>
      </header>

      <main className="main">
        <div className="section">
          <div className="section-header">
            <h2 className="section-title">Your Servers</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {servers.map((server) => (
              <div key={server.id} className="server-card">
                <div className="server-icon">
                  <svg width="22" height="22" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                </div>
                <div className="server-info">
                  <h3 className="server-name">{server.name}</h3>
                  <p className="server-host">{server.username}@{server.host}:{server.port}</p>
                </div>
                <button onClick={() => router.push(`/terminal/${server.id}`)} className="btn btn-primary">
                  Manage
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
