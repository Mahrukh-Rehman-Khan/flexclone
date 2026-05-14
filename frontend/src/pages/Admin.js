import { useState, useEffect } from 'react';
import { api } from '../api';

const BLANK_USER = { name: '', username: '', password: '', role: 'student', email: '', department: '', program: 'BSCS', batch: '', semester: '', section: 'A' };
const PROGRAMS   = ['BSCS', 'BSSE', 'BSIT', 'BSAI', 'MSCS', 'MBA'];

export default function Admin() {
  const [tab, setTab]           = useState('users');
  const [users, setUsers]       = useState([]);
  const [courses, setCourses]   = useState([]);
  const [logs, setLogs]         = useState([]);
  const [stats, setStats]       = useState(null);
  const [settings, setSettings] = useState([]);
  const [health, setHealth]     = useState(null);
  const [curriculum, setCurriculum] = useState([]);
  const [msg, setMsg]           = useState(null);

  // Add user modal
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser]         = useState(BLANK_USER);

  // Semester rollover modal
  const [showRollover, setShowRollover]     = useState(false);
  const [rolloverStep, setRolloverStep]     = useState(1);
  const [rolloverSem, setRolloverSem]       = useState('');
  const [rolloverPreview, setRolloverPreview] = useState(null);
  const [rolloverConfirm, setRolloverConfirm] = useState(false);

  // Curriculum modal
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleForm, setRuleForm]       = useState({ program: 'BSCS', semester: '1', courseId: '', mandatory: false });
  const [currFilter, setCurrFilter]   = useState({ program: '', semester: '' });

  const ROLE_COLOR = { student: 'blue', faculty: 'green', admin: 'orange', hod: 'yellow', finance: 'gray' };

  const load = () => {
    api.getUsers().then(r => setUsers(r.data)).catch(() => {});
    api.getAuditLogs().then(r => setLogs(r.data)).catch(() => {});
    api.getStats().then(r => setStats(r.data)).catch(() => {});
    api.getSettings().then(r => setSettings(r.data)).catch(() => {});
    api.getHealth().then(r => setHealth(r.data)).catch(() => {});
    api.getCourses().then(r => setCourses(r.data)).catch(() => {});
    api.getCurriculumRules().then(r => setCurriculum(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const notify = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000); };

  const updateSetting = (key, value) => setSettings(settings.map(s => s.key === key ? { ...s, value } : s));

  const saveSettings = async () => {
    const payload = Object.fromEntries(settings.map(s => [s.key, s.value]));
    try { await api.updateSettings(payload); notify('success', 'Settings saved.'); load(); }
    catch (e) { notify('error', e.message); }
  };

  const resetPassword = async (userId) => {
    const password = prompt('Temporary password:');
    if (!password) return;
    try { await api.resetUserPassword(userId, password); notify('success', 'Password reset.'); }
    catch (e) { notify('error', e.message); }
  };

  const toggleFeeBlock = async (u) => {
    try {
      await api.updateUserFlags(u.id, { feeBlock: !u.fee_block, probationStatus: u.probation_status, warningCount: u.warning_count });
      notify('success', 'Student flag updated.'); load();
    } catch (e) { notify('error', e.message); }
  };

  const createUser = async () => {
    try {
      await api.createUser(newUser);
      notify('success', `User "${newUser.username}" created.`);
      setShowAddUser(false); setNewUser(BLANK_USER); load();
    } catch (e) { notify('error', e.message); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete "${u.name}" (${u.username})? This cannot be undone.`)) return;
    try { await api.deleteUser(u.id); notify('success', `User "${u.username}" deleted.`); load(); }
    catch (e) { notify('error', e.message); }
  };

  // ── Semester rollover ───────────────────────────────────────────────────────
  const openRollover = async () => {
    try {
      const r = await api.getRolloverPreview();
      setRolloverPreview(r.data); setRolloverStep(1); setRolloverSem(''); setRolloverConfirm(false);
      setShowRollover(true);
    } catch (e) { notify('error', e.message); }
  };

  const executeRollover = async () => {
    try {
      const r = await api.initializeSemester(rolloverSem, true);
      notify('success', r.message); setShowRollover(false); load();
    } catch (e) { notify('error', e.message); }
  };

  // ── Curriculum ──────────────────────────────────────────────────────────────
  const addRule = async () => {
    try {
      await api.addCurriculumRule(ruleForm.program, Number(ruleForm.semester), ruleForm.courseId, ruleForm.mandatory);
      notify('success', 'Rule added.'); setShowAddRule(false); setRuleForm({ program: 'BSCS', semester: '1', courseId: '', mandatory: false }); load();
    } catch (e) { notify('error', e.message); }
  };

  const toggleMandatory = async (rule) => {
    try { await api.updateCurriculumRule(rule.id, !rule.mandatory); load(); }
    catch (e) { notify('error', e.message); }
  };

  const deleteRule = async (id) => {
    try { await api.deleteCurriculumRule(id); load(); }
    catch (e) { notify('error', e.message); }
  };

  const setPassThreshold = async (courseId, current) => {
    const val = prompt('Pass threshold (0–100):', current ?? 50);
    if (val === null) return;
    try { await api.setPassThreshold(courseId, Number(val)); notify('success', 'Pass threshold updated.'); load(); }
    catch (e) { notify('error', e.message); }
  };

  const filteredCurriculum = curriculum.filter(r =>
    (!currFilter.program  || r.program  === currFilter.program) &&
    (!currFilter.semester || String(r.semester) === currFilter.semester)
  );

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">System Administration</h2>
        <p className="page-subtitle">User management, curriculum, audit logs, semester rollover, and system health</p>
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
        {[['users','Users'],['curriculum','Curriculum'],['audit','Audit Log'],['settings','Configuration'],['health','Health']].map(([t, l]) => (
          <button key={t} className="btn btn-sm" onClick={() => setTab(t)} style={{ background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? 'white' : 'var(--text-muted)' }}>{l}</button>
        ))}
      </div>

      {/* ── Users tab ── */}
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
                    <td>{u.role === 'student' ? Number(u.cgpa || 0).toFixed(2) : '—'}</td>
                    <td><span className={`badge badge-${u.locked ? 'red' : 'green'}`}>{u.locked ? 'Locked' : 'Active'}</span></td>
                    <td>
                      {u.role === 'student' ? (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span className={`badge badge-${u.fee_block ? 'red' : 'green'}`}>{u.fee_block ? 'Fee blocked' : 'Fee clear'}</span>
                          <span className={`badge badge-${u.probation_status === 'probation' ? 'red' : 'gray'}`}>{u.probation_status}</span>
                        </div>
                      ) : '—'}
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

      {/* ── Curriculum tab ── */}
      {tab === 'curriculum' && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3 className="card-title">Curriculum Rules</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddRule(true)}>+ Add Rule</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <select className="form-select" style={{ width: 160 }} value={currFilter.program} onChange={e => setCurrFilter(f => ({ ...f, program: e.target.value }))}>
                <option value="">All Programs</option>
                {PROGRAMS.map(p => <option key={p}>{p}</option>)}
              </select>
              <select className="form-select" style={{ width: 160 }} value={currFilter.semester} onChange={e => setCurrFilter(f => ({ ...f, semester: e.target.value }))}>
                <option value="">All Semesters</option>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Program</th><th>Sem</th><th>Course</th><th>Title</th><th>Mandatory</th><th>Pass %</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredCurriculum.length === 0
                    ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No rules match the current filter.</td></tr>
                    : filteredCurriculum.map(r => (
                      <tr key={r.id}>
                        <td><span className="badge badge-blue">{r.program}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.semester}</td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{r.code}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{r.title}</td>
                        <td>
                          <button
                            className={`badge badge-${r.mandatory ? 'red' : 'gray'}`}
                            onClick={() => toggleMandatory(r)}
                            style={{ cursor: 'pointer', border: 'none', background: 'none' }}
                            title="Click to toggle"
                          >{r.mandatory ? 'Mandatory' : 'Elective'}</button>
                        </td>
                        <td>
                          <button className="btn btn-sm btn-secondary" onClick={() => setPassThreshold(r.course_id, r.pass_threshold)}>
                            {r.pass_threshold ?? 50}%
                          </button>
                        </td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteRule(r.id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">All Course Pass Thresholds</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Set the minimum absolute score to pass each course</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Code</th><th>Title</th><th>Program</th><th>Pass Threshold</th></tr></thead>
                <tbody>
                  {courses.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{c.code}</td>
                      <td style={{ fontWeight: 500 }}>{c.title}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{c.program}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => setPassThreshold(c.id, c.pass_threshold)}>
                          {c.pass_threshold ?? 50}%
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Audit tab ── */}
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
                    <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>{l.tamper_hash || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Settings tab ── */}
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
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Semester Rollover</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Advances all students by one semester, archives current registrations, and updates the semester label. This cannot be undone.
            </p>
            <button className="btn btn-secondary" onClick={openRollover}>Initialize New Semester…</button>
          </div>
        </div>
      )}

      {/* ── Health tab ── */}
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

      {/* ── Add User Modal ── */}
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
                {['student','faculty','admin','hod','finance'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
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
                    {PROGRAMS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Section</label>
                  <select className="form-select" value={newUser.section} onChange={e => setNewUser(u => ({ ...u, section: e.target.value }))}>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
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

      {/* ── Semester Rollover Modal (two-step) ── */}
      {showRollover && (
        <div className="modal-overlay" onClick={() => setShowRollover(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">Initialize New Semester</h3>
              <button className="modal-close" onClick={() => setShowRollover(false)}>×</button>
            </div>

            {rolloverStep === 1 && rolloverPreview && (
              <>
                <div className="card" style={{ background: 'var(--surface2)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div><div className="stat-label">Current Semester</div><div style={{ fontWeight: 700 }}>{rolloverPreview.currentSemester}</div></div>
                    <div><div className="stat-label">Students to Advance</div><div style={{ fontWeight: 700, color: 'var(--accent)' }}>{rolloverPreview.studentCount}</div></div>
                    <div><div className="stat-label">Registrations to Archive</div><div style={{ fontWeight: 700, color: 'var(--yellow)' }}>{rolloverPreview.regCount}</div></div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">New Semester Label *</label>
                  <input className="form-input" placeholder="e.g. Fall 2025" value={rolloverSem} onChange={e => setRolloverSem(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setShowRollover(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={() => setRolloverStep(2)} disabled={!rolloverSem.trim()}>Next →</button>
                </div>
              </>
            )}

            {rolloverStep === 2 && (
              <>
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--red)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>⚠ This action cannot be undone</div>
                  <ul style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                    <li>All <strong>{rolloverPreview?.studentCount}</strong> students will advance one semester</li>
                    <li><strong>{rolloverPreview?.regCount}</strong> active registrations will be archived</li>
                    <li>Semester label will change to <strong>"{rolloverSem}"</strong></li>
                    <li>Attendance and marks history will be preserved</li>
                  </ul>
                </div>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={rolloverConfirm} onChange={e => setRolloverConfirm(e.target.checked)} />
                  I understand and confirm this semester rollover
                </label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setRolloverStep(1)}>← Back</button>
                  <button className="btn btn-danger" onClick={executeRollover} disabled={!rolloverConfirm}>Confirm Rollover</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Add Curriculum Rule Modal ── */}
      {showAddRule && (
        <div className="modal-overlay" onClick={() => setShowAddRule(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Curriculum Rule</h3>
              <button className="modal-close" onClick={() => setShowAddRule(false)}>×</button>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Program</label>
                <select className="form-select" value={ruleForm.program} onChange={e => setRuleForm(f => ({ ...f, program: e.target.value }))}>
                  {PROGRAMS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Semester</label>
                <select className="form-select" value={ruleForm.semester} onChange={e => setRuleForm(f => ({ ...f, semester: e.target.value }))}>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Course</label>
              <select className="form-select" value={ruleForm.courseId} onChange={e => setRuleForm(f => ({ ...f, courseId: e.target.value }))}>
                <option value="">— Select course —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={ruleForm.mandatory} onChange={e => setRuleForm(f => ({ ...f, mandatory: e.target.checked }))} />
              Mark as Mandatory
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddRule(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addRule} disabled={!ruleForm.courseId}>Add Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
