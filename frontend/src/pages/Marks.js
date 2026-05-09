import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

function StudentMarks({ data }) {
  const validCourses = data.filter(c => c.gradePoints !== null && c.credits);
  const totalCredits = validCourses.reduce((s, c) => s + c.credits, 0);
  const overallGPA = totalCredits > 0
    ? (validCourses.reduce((s, c) => s + c.gradePoints * c.credits, 0) / totalCredits).toFixed(2)
    : null;

  return (
    <>
      {overallGPA && (
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg,var(--navy-light),var(--surface))' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div><div className="stat-label">Semester GPA</div><div style={{ fontSize: 40, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--accent)' }}>{overallGPA}</div></div>
            <div style={{ height: 48, width: 1, background: 'var(--border)' }} />
            <div><div className="stat-label">Total Credits</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{totalCredits}</div></div>
            <div style={{ height: 48, width: 1, background: 'var(--border)' }} />
            <div><div className="stat-label">Courses</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{data.length}</div></div>
          </div>
        </div>
      )}

      {data.map(course => (
        <div key={course.courseId} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">{course.courseCode} - {course.courseTitle}</h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{course.credits} Credit Hours</div>
            </div>
            {course.grade && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Space Grotesk', color: course.grade.startsWith('A') ? 'var(--green)' : course.grade.startsWith('B') ? 'var(--accent)' : course.grade.startsWith('C') ? 'var(--yellow)' : 'var(--red)' }}>{course.grade}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>GP: {course.gradePoints?.toFixed(1)}</div>
              </div>
            )}
          </div>

          {course.overallPercentage !== null && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12.5 }}>
                <span style={{ color: 'var(--text-muted)' }}>Overall</span>
                <span style={{ fontWeight: 600 }}>{course.overallPercentage}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${course.overallPercentage}%`, height: '100%', borderRadius: 3, background: course.overallPercentage >= 80 ? 'var(--green)' : course.overallPercentage >= 60 ? 'var(--yellow)' : 'var(--red)' }} />
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead><tr><th>Assessment</th><th>Total</th><th>Obtained</th><th>%</th><th>Wt%</th><th>Status</th></tr></thead>
              <tbody>
                {course.assessments.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.type}</td>
                    <td>{a.totalMarks}</td>
                    <td style={{ fontWeight: 600 }}>{a.obtained ?? '-'}</td>
                    <td>{a.percentage !== null ? <span style={{ color: a.percentage >= 80 ? 'var(--green)' : a.percentage >= 60 ? 'var(--yellow)' : 'var(--red)', fontWeight: 600 }}>{a.percentage}%</span> : '-'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{a.weightage}%</td>
                    <td><span className={`badge badge-${a.status === 'published' ? 'green' : 'gray'}`}>{a.status || 'pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}

function FacultyMarks({ data, onSave }) {
  const [selectedCourseId, setSelectedCourseId] = useState(data[0]?.courseId || '');
  const [draft, setDraft] = useState({});
  const [msg, setMsg] = useState(null);
  const course = data.find(c => c.courseId === selectedCourseId) || data[0];

  useEffect(() => {
    setSelectedCourseId(data[0]?.courseId || '');
  }, [data]);

  if (!course) return <div className="empty"><p>No assigned courses found.</p></div>;

  const valueFor = (studentId, assessmentId) => {
    const key = `${studentId}:${assessmentId}`;
    if (draft[key] !== undefined) return draft[key];
    return course.students.find(s => s.id === studentId)?.marks?.[assessmentId] ?? '';
  };

  const save = async (studentId, assessmentId) => {
    const obtained = valueFor(studentId, assessmentId);
    try {
      await onSave({ studentId, assessmentId, obtained });
      setMsg({ type: 'success', text: 'Mark saved.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  };

  return (
    <>
      {msg && <div className={`alert alert-${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Faculty Marks Entry</h3>
          <select className="form-select" style={{ width: 320 }} value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}>
            {data.map(c => <option key={c.courseId} value={c.courseId}>{c.courseCode} - {c.courseTitle}</option>)}
          </select>
        </div>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <div className="stat-card"><div className="stat-label">Students</div><div className="stat-value">{course.students.length}</div></div>
          <div className="stat-card"><div className="stat-label">Assessments</div><div className="stat-value">{course.assessments.length}</div></div>
          <div className="stat-card"><div className="stat-label">Section</div><div className="stat-value">{course.section || '-'}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Student</th>
                {course.assessments.map(a => <th key={a.id}>{a.type}<br /><span style={{ color: 'var(--text-dim)' }}>/{a.totalMarks}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {course.students.map(student => (
                <tr key={student.id}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{student.username}</td>
                  <td style={{ fontWeight: 600 }}>{student.name}</td>
                  {course.assessments.map(a => {
                    const key = `${student.id}:${a.id}`;
                    return (
                      <td key={a.id} style={{ minWidth: 130 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            max={a.totalMarks}
                            value={valueFor(student.id, a.id)}
                            onChange={e => setDraft({ ...draft, [key]: e.target.value })}
                            style={{ width: 78, padding: '5px 8px' }}
                          />
                          <button className="btn btn-primary btn-sm" onClick={() => save(student.id, a.id)}>Save</button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function Marks() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const fn = user.role === 'student' ? api.getMyMarks : api.getFacultyMarks;
    fn().then(r => setData(r.data)).catch(() => setData([])).finally(() => setLoading(false));
  };

  useEffect(load, [user.role]);

  const saveMark = async (payload) => {
    await api.saveMark(payload);
    await api.getFacultyMarks().then(r => setData(r.data));
  };

  if (loading) return <div className="page"><div className="empty"><p>Loading...</p></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Marks &amp; Grades</h2>
        <p className="page-subtitle">Spring 2025</p>
      </div>

      {user.role === 'student'
        ? <StudentMarks data={data} />
        : <FacultyMarks data={data} onSave={saveMark} />
      }
    </div>
  );
}
