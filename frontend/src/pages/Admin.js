import { useState, useEffect } from 'react';
import { api } from '../api';

const BLANK_USER = { name: '', username: '', password: '', role: 'student', email: '', department: '', program: 'BSCS', batch: '', semester: '' };

export default function Admin() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState([]);
  const [health, setHealth] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState(BLANK_USER);

  const load = () => {
    api.getUsers().then(r => setUsers(r.data)).catch(() => {});
    api.getAuditLogs().then(r => setLogs(r.data)).catch(() => {});
    api.getStats().then(r => setStats(r.data)).catch(() => {});
    api.getSettings().then(r => setSettings(r.data)).catch(() => {});
    api.getHealth().then(r => setHealth(r.data)).catch(() => {});
  };

  useEffect(load, []);

  const ROLE_COLOR = { student: 'blue', faculty: 'green', admin: 'orange', hod: 'yellow', finance: 'gray' };

  const updateSetting = (key, value) => {
    setSettings(settings.map(s => s.key === key ? { ...s, value } : s));
  };

  const saveSettings = async () => {
    const payload = Object.fromEntries(settings.map(s => [s.key, s.value]));
    try { await api.updateSettings(payload); setMsg({ type: 'success', text: 'Settings saved.' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const resetPassword = async (userId) => {
    const password = prompt('Temporary password:');
    if (!password) return;
    try {
      await api.resetUserPassword(userId, password);
      setMsg({ type: 'success', text: 'Password reset.' });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const createUser = async () => {
    try {
      await api.createUser(newUser);
      setMsg({ type: 'success', text: `User "${newUser.username}" created.` });
      setShowAddUser(false); setNewUser(BLANK_USER); load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete "${u.name}" (${u.username})? This cannot be undone.`)) return;
    try { await api.deleteUser(u.id); setMsg({ type: 'success', text: `User "${u.username}" deleted.` }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const toggleFeeBlock = async (u) => {
    try {
      await api.updateUserFlags(u.id, { feeBlock: !u.fee_block, probationStatus: u.probation_status, warningCount: u.warning_count });
      setMsg({ type: 'success', text: 'Student flag updated.' });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">System Administration</h2>
        <p className="page-subtitle">User management, RBAC, audit logs, semester configuration, backups, and system health</p>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {stats && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {[['Students', stats.totalStudents], ['Courses', stats.totalCourses], ['Registrations', stats.totalRegistrations], ['Pending Requests', stats.pendingRequests], ['Unpaid Challans', stats.unpaidChallans]].map(([l, v]) => (
            <div key={l} className="stat-card"><div className="stat-label">{l}</div><div className="stat-value">{v}</div></div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--surface)', borderRadius: 8, padding: 4, width: 'fit-content', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {[['users', 'Users'], ['audit', 'Audit Log'], ['settings', 'Configuration'], ['health', 'Health']].map(([t, l]) => (
          <button key={t} className="btn btn-sm" onClick={() => setTab(t)} style={{ background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? 'white' : 'var(--text-muted)' }}>{l}</button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">All Users</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddUser(true)}>+ Add User</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>CGPA</th><th>Status</th><th>Flags</th><th>Action</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><div style={{ fontWeight: 600 }}>{u.name}</div><div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</div></td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{u.username}</td>
                    <td><span className={`badge badge-${ROLE_COLOR[u.role] || 'gray'}`}>{u.role}</span></td>
                    <td>{u.role === 'student' ? Number(u.cgpa || 0).toFixed(2) : '-'}</td>
                    <td><span className={`badge badge-${u.locked ? 'red' : 'green'}`}>{u.locked ? 'Locked' : 'Active'}</span></td>
                    <td>
                      {u.role === 'student' ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span className={`badge badge-${u.fee_block ? 'red' : 'green'}`}>{u.fee_block ? 'Fee blocked' : 'Fee clear'}</span>
                          <span className={`badge badge-${u.probation_status === 'probation' ? 'red' : 'gray'}`}>{u.probation_status}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {u.role !== 'student' && <button className="btn btn-sm btn-secondary" onClick={() => resetPassword(u.id)}>Reset Password</button>}
                        {u.role === 'student' && <button className="btn btn-sm btn-secondary" onClick={() => toggleFeeBlock(u)}>{u.fee_block ? 'Clear Block' : 'Fee Block'}</button>}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u)}>Delete</button>
                      </div>
                    </td>
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
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Entity</th><th>Hash</th><th>IP</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{l.timestamp?.slice(0, 19).replace('T', ' ')}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{l.user_id || l.userId}</td>
                    <td><span className="badge badge-blue">{l.action}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{l.module}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-dim)' }}>{l.entity_id || l.entity}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>{l.tamper_hash || '-'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Academic Configuration</h3>
            <button className="btn btn-primary btn-sm" onClick={saveSettings}>Save Settings</button>
          </div>
          <div className="grid-2">
            {settings.map(s => (
              <div key={s.key} className="form-group">
                <label className="form-label">{s.key.replaceAll('_', ' ')}</label>
                <input className="form-input" value={s.value} onChange={e => updateSetting(s.key, e.target.value)} />
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const semester = prompt('New semester label:');
            if (semester) api.initializeSemester(semester).then(() => { setMsg({ type: 'success', text: 'Semester initialized.' }); load(); });
          }}>Initialize Semester</button>
        </div>
      )}

      {tab === 'health' && health && (
        <div className="card">
          <div className="grid-3">
            {Object.entries(health).map(([key, value]) => (
              <div key={key} className="stat-card">
                <div className="stat-label">{key.replace(/[A-Z]/g, m => ` ${m}`).toUpperCase()}</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {showAddUser && (
        <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">Add New User</h3>
              <button className="modal-close" onClick={() => setShowAddUser(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                {['student', 'faculty', 'admin', 'hod', 'finance'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" placeholder="e.g. Ali Hassan" value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input className="form-input" placeholder="e.g. ali.hassan" value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-input" type="password" placeholder="Temporary password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="optional" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Department</label>
              <input className="form-input" placeholder="e.g. Computer Science" value={newUser.department} onChange={e => setNewUser(u => ({ ...u, department: e.target.value }))} />
            </div>

            {newUser.role === 'student' && (
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Program</label>
                  <select className="form-select" value={newUser.program} onChange={e => setNewUser(u => ({ ...u, program: e.target.value }))}>
                    {['BSCS', 'BSSE', 'BSIT', 'BSAI', 'MSCS', 'MBA'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Batch</label>
                  <input className="form-input" placeholder="e.g. 2022" value={newUser.batch} onChange={e => setNewUser(u => ({ ...u, batch: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <input className="form-input" type="number" min="1" max="8" placeholder="1–8" value={newUser.semester} onChange={e => setNewUser(u => ({ ...u, semester: e.target.value }))} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddUser(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createUser} disabled={!newUser.name || !newUser.username || !newUser.password}>Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
