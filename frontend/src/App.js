import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CourseRegistration from './pages/CourseRegistration';
import Attendance from './pages/Attendance';
import Marks from './pages/Marks';
import Fee from './pages/Fee';
import Requests from './pages/Requests';
import Admin from './pages/Admin';
import Timetable from './pages/Timetable';
import Reports from './pages/Reports';

const ICONS = {
  dashboard:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  courses:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  attendance: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  marks:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  timetable:  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  fee:        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  requests:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  reports:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="5" width="3" height="12"/></svg>,
  admin:      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
};

const HamburgerIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const NAV_BY_ROLE = {
  student: [
    { id: 'dashboard',  label: 'Dashboard' },
    { id: 'courses',    label: 'Course Registration' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'marks',      label: 'Marks & Grades' },
    { id: 'timetable',  label: 'Timetable' },
    { id: 'fee',        label: 'Fee & Finance' },
    { id: 'requests',   label: 'Student Requests' },
  ],
  faculty: [
    { id: 'dashboard',  label: 'Dashboard' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'marks',      label: 'Marks & Grades' },
    { id: 'timetable',  label: 'Timetable' },
    { id: 'reports',    label: 'Reports' },
  ],
  admin: [
    { id: 'dashboard',  label: 'Dashboard' },
    { id: 'courses',    label: 'Courses' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'timetable',  label: 'Timetable' },
    { id: 'fee',        label: 'Fee Management' },
    { id: 'requests',   label: 'Student Requests' },
    { id: 'reports',    label: 'Reports' },
    { id: 'admin',      label: 'Administration' },
  ],
  finance: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'fee',       label: 'Fee Management' },
    { id: 'reports',   label: 'Reports' },
  ],
  hod: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'courses',   label: 'Course Approvals' },
    { id: 'timetable', label: 'Timetable' },
    { id: 'requests',  label: 'Student Requests' },
    { id: 'reports',   label: 'Reports' },
  ],
};

const PAGES = {
  dashboard:  Dashboard,
  courses:    CourseRegistration,
  attendance: Attendance,
  marks:      Marks,
  fee:        Fee,
  requests:   Requests,
  timetable:  Timetable,
  reports:    Reports,
  admin:      Admin,
};

function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Sign out?</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 24 }}>
          Are you sure you want to sign out of FLEX UMS?
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm}>Yes, sign out</button>
        </div>
      </div>
    </div>
  );
}

function Layout({ children, page, setPage }) {
  const { user, logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = NAV_BY_ROLE[user.role] || NAV_BY_ROLE.admin;
  const currentLabel = nav.find(n => n.id === page)?.label || 'Dashboard';
  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const closeSidebar = () => setSidebarOpen(false);
  const handleNavClick = (id) => { setPage(id); closeSidebar(); };

  return (
    <div className="app">
      {showLogout && (
        <LogoutModal onConfirm={logout} onCancel={() => setShowLogout(false)} />
      )}

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>FLEX</h1>
          <p>University Management System</p>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Main</div>
          {nav.map(item => (
            <div key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}>
              {ICONS[item.id]} {item.label}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip" onClick={() => setShowLogout(true)} title="Click to logout">
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <div className="name">{user.name}</div>
              <div className="role">{user.role} · Logout</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
              <HamburgerIcon />
            </button>
            <div className="breadcrumb">FLEX / <span>{currentLabel}</span></div>
          </div>
          <div className="header-actions">
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Spring 2025</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('dashboard');

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0714',
      color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif',
    }}>
      Loading FLEX…
    </div>
  );

  if (!user) return <Login />;

  const PageComponent = PAGES[page] || Dashboard;
  return (
    <Layout page={page} setPage={setPage}>
      <PageComponent />
    </Layout>
  );
}
