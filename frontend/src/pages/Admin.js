import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Admin() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.getUsers().then(r => setUsers(r.data)).catch(() => {});
    api.getAuditLogs().then(r => setLogs(r.data)).catch(() => {});
    api.getStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  const ROLE_COLOR = { student: 'blue', faculty: 'green', admin: 'orange', hod: 'yellow', finance: 'gray' };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">System Administration</h2>
        <p className="page-subtitle">User management, audit logs, and system health</p>
      </div>

      {stats && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {[['Students', stats.totalStudents], ['Courses', stats.totalCourses], ['Registrations', stats.totalRegistrations], ['Pending Requests', stats.pendingRequests], ['Unpaid Challans', stats.unpaidChallans]].map(([l, v]) => (
            <div key={l} className="stat-card"><div className="stat-label">{l}</div><div className="stat-value">{v}</div></div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', borderRadius: 8, padding: 4, width: 'fit-content', border: '1px solid var(--border)' }}>
        {[['users', '👥 Users'], ['audit', '📋 Audit Log']].map(([t, l]) => (
          <button key={t} className="btn btn-sm" onClick={() => setTab(t)} style={{ background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? 'white' : 'var(--text-muted)' }}>{l}</button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Email</th><th>Status</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{u.username}</td>
                    <td><span className={`badge badge-${ROLE_COLOR[u.role] || 'gray'}`}>{u.role}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</td>
                    <td><span className={`badge badge-${u.locked ? 'red' : 'green'}`}>{u.locked ? 'Locked' : 'Active'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Entity</th><th>IP</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{l.timestamp?.slice(0, 19).replace('T', ' ')}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.userId}</td>
                    <td><span className="badge badge-blue">{l.action}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{l.module}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-dim)' }}>{l.entity}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
