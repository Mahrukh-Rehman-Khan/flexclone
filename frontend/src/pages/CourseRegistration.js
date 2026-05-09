import { useState, useEffect } from 'react';
import { api } from '../api';

export default function CourseRegistration() {
  const [courses, setCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const load = () => {
    Promise.all([api.getCourses(), api.getMyCourses()])
      .then(([all, my]) => { setCourses(all.data); setMyCourses(my.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const register = async (courseId) => {
    try { await api.registerCourse(courseId); setMsg({ type: 'success', text: 'Course added! Pending advisor approval.' }); load(); }
    catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  const drop = async (courseId) => {
    try { await api.dropCourse(courseId); setMsg({ type: 'success', text: 'Course dropped.' }); load(); }
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

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="stat-label">Registered Credits</div>
          <div className="stat-value">{totalCredits} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ 21 max</span></div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="stat-label">Courses Selected</div>
          <div className="stat-value">{myCourses.length} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>courses</span></div>
        </div>
      </div>

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
                        {reg
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
