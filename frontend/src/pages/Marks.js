import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Marks() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyMarks().then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="empty"><p>Loading…</p></div></div>;

  const validCourses = data.filter(c => c.gradePoints !== null && c.credits);
  const totalCredits = validCourses.reduce((s, c) => s + c.credits, 0);
  const overallGPA = totalCredits > 0
    ? (validCourses.reduce((s, c) => s + c.gradePoints * c.credits, 0) / totalCredits).toFixed(2)
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Marks &amp; Grades</h2>
        <p className="page-subtitle">Spring 2025</p>
      </div>

      {overallGPA && (
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg,var(--navy-light),var(--surface))' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="stat-label">Semester GPA</div>
              <div style={{ fontSize: 40, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--accent)' }}>{overallGPA}</div>
            </div>
            <div style={{ height: 48, width: 1, background: 'var(--border)' }} />
            <div>
              <div className="stat-label">Total Credits</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{totalCredits}</div>
            </div>
            <div style={{ height: 48, width: 1, background: 'var(--border)' }} />
            <div>
              <div className="stat-label">Courses</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{data.length}</div>
            </div>
          </div>
        </div>
      )}

      {data.map(course => (
        <div key={course.courseId} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">{course.courseCode} — {course.courseTitle}</h3>
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
                    <td style={{ fontWeight: 600 }}>{a.obtained ?? '—'}</td>
                    <td>{a.percentage !== null ? <span style={{ color: a.percentage >= 80 ? 'var(--green)' : a.percentage >= 60 ? 'var(--yellow)' : 'var(--red)', fontWeight: 600 }}>{a.percentage}%</span> : '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{a.weightage}%</td>
                    <td><span className={`badge badge-${a.status === 'published' ? 'green' : 'gray'}`}>{a.status || 'pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}