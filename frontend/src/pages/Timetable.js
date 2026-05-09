import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function parseSchedule(schedule = '') {
  const [days = '', time = ''] = schedule.split(' ');
  return { days: days.split('/').filter(Boolean), time: time || 'TBA' };
}

export default function Timetable() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fn = ['admin', 'hod'].includes(user.role) ? api.getAllTimetable : api.getMyTimetable;
    fn().then(r => setRows(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [user.role]);

  const byDay = DAYS.map(day => ({
    day,
    classes: rows.filter(row => parseSchedule(row.schedule).days.includes(day)),
  }));

  if (loading) return <div className="page"><div className="empty"><p>Loading...</p></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Timetable</h2>
        <p className="page-subtitle">Weekly schedule generated from approved registrations and offerings</p>
      </div>

      <div className="grid-3">
        {byDay.map(group => (
          <div key={group.day} className="card">
            <div className="card-header">
              <h3 className="card-title">{group.day}</h3>
              <span className="badge badge-blue">{group.classes.length} classes</span>
            </div>
            {group.classes.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}><p>No classes</p></div>
            ) : group.classes.map(course => {
              const parsed = parseSchedule(course.schedule);
              return (
                <div key={`${group.day}-${course.id}`} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{course.code}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{course.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{parsed.time} / {course.room || 'Room TBA'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{course.instructorName || 'Instructor TBA'} / Section {course.section || '-'}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
