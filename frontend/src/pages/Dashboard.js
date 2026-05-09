import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

function StatCard({ label, value, meta, color }) {
  return (
    <div className="stat-card" style={color ? { '--accent': color } : {}}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {meta && <div className="stat-meta">{meta}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [myCourses, setMyCourses] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [myMarks, setMyMarks] = useState([]);

  useEffect(() => {
    api.getStats().then(r => setStats(r.data)).catch(() => {});
    if (user.role === 'student') {
      api.getMyCourses().then(r => setMyCourses(r.data)).catch(() => {});
      api.getMyAttendance().then(r => setMyAttendance(r.data)).catch(() => {});
      api.getMyMarks().then(r => setMyMarks(r.data)).catch(() => {});
    }
  }, [user.role]);

  const validMarks = myMarks.filter(c => c.gradePoints !== null && c.credits);
  const totalCredits = validMarks.reduce((s, c) => s + c.credits, 0);
  const cgpa = totalCredits > 0
    ? (validMarks.reduce((s, c) => s + c.gradePoints * c.credits, 0) / totalCredits).toFixed(2)
    : null;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Welcome back, {user.name.split(' ')[0]} 👋</h2>
        <p className="page-subtitle">
          {user.role === 'student' ? `${user.program || 'BSCS'} · Semester ${user.semester || 2}` : `Role: ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`}
          {' · Spring 2025'}
        </p>
      </div>

      {user.role === 'student' && (
        <div className="stats-grid">
          <StatCard label="Enrolled Courses" value={myCourses.length} meta="Spring 2025" />
          <StatCard label="Current CGPA" value={cgpa || '—'} meta="Credit-weighted" color="#22c55e" />
          <StatCard label="Avg Attendance" value={myAttendance.length ? Math.round(myAttendance.reduce((s, a) => s + a.percentage, 0) / myAttendance.length) + '%' : '—'} meta="Across all courses" color="#eab308" />
          <StatCard label="Pending Fees" value="1" meta="Check fee section" color="#ef4444" />
        </div>
      )}

      {user.role !== 'student' && stats && (
        <div className="stats-grid">
          <StatCard label="Total Students" value={stats.totalStudents} meta="Enrolled" />
          <StatCard label="Total Courses" value={stats.totalCourses} meta="Active sections" />
          <StatCard label="Registrations" value={stats.totalRegistrations} meta="This semester" color="#22c55e" />
          <StatCard label="Pending Requests" value={stats.pendingRequests} meta="Awaiting action" color="#ef4444" />
        </div>
      )}

      {user.role === 'student' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><h3 className="card-title">My Courses</h3></div>
            {myCourses.length === 0 ? <div className="empty"><p>No courses registered</p></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {myCourses.map(c => (
                  <div key={c.id} style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.code} — {c.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.schedule} · {c.room}</div>
                      </div>
                      <span className={`badge badge-${c.registrationStatus === 'locked' ? 'green' : 'yellow'}`}>{c.registrationStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">Attendance Overview</h3></div>
            {myAttendance.length === 0 ? <div className="empty"><p>No attendance data</p></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {myAttendance.map(a => (
                  <div key={a.courseId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{a.courseCode}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: a.alert === 'red' ? 'var(--red)' : a.alert === 'yellow' ? 'var(--yellow)' : 'var(--green)' }}>{a.percentage}%</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${a.percentage}%`, height: '100%', background: a.alert === 'red' ? 'var(--red)' : a.alert === 'yellow' ? 'var(--yellow)' : 'var(--green)', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
