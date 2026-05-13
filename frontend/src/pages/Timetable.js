import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_FULL = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };

function parseSchedule(schedule = '') {
  const [days = '', time = ''] = schedule.split(' ');
  const [start = '', end = ''] = time.split('-');
  return {
    days: days.split('/').filter(Boolean),
    time: time || 'TBA',
    start,
    end,
  };
}

function to24h(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export default function Timetable() {
  const { user } = useAuth();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fn = ['admin', 'hod'].includes(user.role) ? api.getAllTimetable : api.getMyTimetable;
    fn().then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [user.role]);

  const isPersonal = !['admin', 'hod'].includes(user.role);

  const byDay = DAYS.map(day => {
    const classes = rows
      .filter(row => parseSchedule(row.schedule).days.includes(day))
      .sort((a, b) => to24h(parseSchedule(a.schedule).start) - to24h(parseSchedule(b.schedule).start));
    return { day, classes };
  });

  const totalClasses = byDay.reduce((s, d) => s + d.classes.length, 0);
  const activeDays   = byDay.filter(d => d.classes.length > 0).length;

  if (loading) return <div className="page"><div className="empty"><p>Loading...</p></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Timetable</h2>
        <p className="page-subtitle">
          {isPersonal
            ? user.role === 'student'
              ? 'Your registered courses for this semester'
              : 'Courses you are teaching this semester'
            : 'All approved course offerings'}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <p>{isPersonal ? 'No schedule found. Check that your courses are registered and approved.' : 'No active courses.'}</p>
        </div>
      ) : (
        <>
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">Courses</div>
              <div className="stat-value">{rows.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Classes / Week</div>
              <div className="stat-value">{totalClasses}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active Days</div>
              <div className="stat-value">{activeDays}</div>
            </div>
          </div>

          <div className="grid-3">
            {byDay.map(group => (
              <div key={group.day} className="card">
                <div className="card-header">
                  <h3 className="card-title">{DAY_FULL[group.day]}</h3>
                  {group.classes.length > 0
                    ? <span className="badge badge-blue">{group.classes.length} class{group.classes.length > 1 ? 'es' : ''}</span>
                    : <span className="badge badge-gray">Free</span>}
                </div>

                {group.classes.length === 0 ? (
                  <div className="empty" style={{ padding: '20px 0' }}><p>No classes</p></div>
                ) : (
                  group.classes.map(course => {
                    const { time } = parseSchedule(course.schedule);
                    const [start, end] = time.split('-');
                    return (
                      <div key={`${group.day}-${course.id}`} style={{
                        padding: '14px 0',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{
                            flexShrink: 0, textAlign: 'center',
                            minWidth: 54, background: 'var(--surface2)',
                            borderRadius: 8, padding: '6px 8px',
                            border: '1px solid var(--border)',
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{start || 'TBA'}</div>
                            {end && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{end}</div>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace', fontSize: 13 }}>{course.code}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1, lineHeight: 1.3 }}>{course.title}</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {course.room || 'Room TBA'}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>§ {course.section || '-'}</span>
                            </div>
                            {user.role === 'student' && course.instructorName && (
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{course.instructorName}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
