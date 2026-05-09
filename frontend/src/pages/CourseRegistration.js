import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function CourseRegistration() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [offer, setOffer] = useState({ code: '', title: '', credits: 3, section: 'A', room: '', schedule: '', capacity: 40 });

  const load = () => {
    const calls = [api.getCourses()];
    if (user.role === 'student') calls.push(api.getMyCourses());
    if (['faculty', 'hod', 'admin'].includes(user.role)) calls.push(api.getCourseApprovals());
    Promise.all(calls)
      .then(([all, second]) => {
        setCourses(all.data);
        if (user.role === 'student') setMyCourses(second.data);
        if (['faculty', 'hod', 'admin'].includes(user.role)) setApprovals(second.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [user.role]);

  const register = async (courseId) => {
    try { await api.registerCourse(courseId); setMsg({ type: 'success', text: 'Course added! Pending advisor approval.' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const drop = async (courseId) => {
    try { await api.dropCourse(courseId); setMsg({ type: 'success', text: 'Course dropped.' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const createOffering = async () => {
    try {
      await api.createCourse(offer);
      setMsg({ type: 'success', text: 'Course offering sent for HOD approval.' });
      setOffer({ code: '', title: '', credits: 3, section: 'A', room: '', schedule: '', capacity: 40 });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const approveOffering = async (id) => {
    try { await api.approveCourse(id); setMsg({ type: 'success', text: 'Course offering approved.' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const updateReg = async (id, status) => {
    const remarks = status === 'rejected' ? prompt('Enter rejection remarks:') : '';
    try { await api.updateRegistrationStatus(id, status, remarks || ''); setMsg({ type: 'success', text: 'Registration workflow updated.' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );
  const totalCredits = myCourses.reduce((s, c) => s + (c.credits || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Course Registration</h2>
        <p className="page-subtitle">Spring 2025 — Registration Window Open</p>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {user.role === 'admin' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3 className="card-title">Offer New Course</h3><span className="badge badge-yellow">HOD approval required</span></div>
          <div className="grid-3">
            <input className="form-input" placeholder="Code" value={offer.code} onChange={e => setOffer({ ...offer, code: e.target.value })} />
            <input className="form-input" placeholder="Title" value={offer.title} onChange={e => setOffer({ ...offer, title: e.target.value })} />
            <input className="form-input" placeholder="Schedule, e.g. Mon/Wed 09:00-10:30" value={offer.schedule} onChange={e => setOffer({ ...offer, schedule: e.target.value })} />
            <input className="form-input" placeholder="Room" value={offer.room} onChange={e => setOffer({ ...offer, room: e.target.value })} />
            <input className="form-input" placeholder="Section" value={offer.section} onChange={e => setOffer({ ...offer, section: e.target.value })} />
            <input className="form-input" type="number" placeholder="Capacity" value={offer.capacity} onChange={e => setOffer({ ...offer, capacity: e.target.value })} />
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={createOffering} disabled={!offer.code || !offer.title}>Create Offering</button>
        </div>
      )}

      {['faculty', 'hod', 'admin'].includes(user.role) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3 className="card-title">Registration Approvals</h3><span className="badge badge-blue">{approvals.length} pending</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Student</th><th>Course</th><th>Schedule</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {approvals.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No pending approvals</td></tr> : approvals.map(r => (
                  <tr key={r.id}>
                    <td><div style={{ fontWeight: 600 }}>{r.studentName}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.studentUsername}</div></td>
                    <td>{r.code} - {r.title}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.schedule}</td>
                    <td><span className="badge badge-yellow">{r.status.replace('_', ' ')}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {(user.role === 'faculty' || user.role === 'admin') && r.status === 'submitted' && <button className="btn btn-sm btn-primary" onClick={() => updateReg(r.id, 'advisor_approved')}>Advisor Approve</button>}
                        {(user.role === 'hod' || user.role === 'admin') && r.status !== 'locked' && <button className="btn btn-sm btn-primary" onClick={() => updateReg(r.id, 'hod_approved')}>HOD Approve</button>}
                        <button className="btn btn-sm btn-danger" onClick={() => updateReg(r.id, 'rejected')}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user.role === 'student' && <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="stat-label">Registered Credits</div>
          <div className="stat-value">{totalCredits} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ 21 max</span></div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="stat-label">Courses Selected</div>
          <div className="stat-value">{myCourses.length} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>courses</span></div>
        </div>
      </div>}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Available Courses</h3>
          <input className="form-input" style={{ width: 240 }} placeholder="Search course…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? <div className="empty"><p>Loading…</p></div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Title</th><th>Credits</th><th>Instructor</th><th>Schedule</th><th>Room</th><th>Seats</th><th>Action</th></tr></thead>
              <tbody>
                {filtered.map(c => {
                  const reg = myCourses.find(m => m.id === c.id);
                  const full = c.enrolled >= c.capacity;
                  return (
                    <tr key={c.id}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{c.code}</span></td>
                      <td style={{ fontWeight: 500 }}>{c.title}</td>
                      <td>{c.credits}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{c.instructorName}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.schedule}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.room}</td>
                      <td><span style={{ color: full ? 'var(--red)' : 'var(--green)', fontWeight: 600, fontSize: 12 }}>{c.enrolled}/{c.capacity}</span></td>
                      <td>
                        {user.role === 'hod' && c.approvalStatus === 'pending_hod'
                          ? <button className="btn btn-primary btn-sm" onClick={() => approveOffering(c.id)}>Approve Offering</button>
                          : user.role !== 'student'
                            ? <span className={`badge badge-${c.approvalStatus === 'approved' ? 'green' : 'yellow'}`}>{c.approvalStatus?.replace('_', ' ')}</span>
                            : reg
                          ? <button className="btn btn-danger btn-sm" onClick={() => drop(c.id)} disabled={reg.registrationStatus === 'locked'}>{reg.registrationStatus === 'locked' ? 'Locked' : 'Drop'}</button>
                          : <button className="btn btn-primary btn-sm" onClick={() => register(c.id)} disabled={full}>{full ? 'Full' : 'Add'}</button>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
