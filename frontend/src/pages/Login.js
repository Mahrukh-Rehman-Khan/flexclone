import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [form, setForm]       = useState({ username: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await login(form.username, form.password); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <style>{`
        .login-split {
          display: flex;
          min-height: 100vh;
          background: #0a0714;
        }
        .login-left {
          width: 50%;
          min-height: 100vh;
          background: linear-gradient(160deg, #140d2e 0%, #0a0714 100%);
          border-right: 1px solid rgba(155,89,245,0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 56px;
        }
        .login-right {
          width: 50%;
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #1e1245 0%, #0a0714 60%, #140d2e 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
        }
        .login-form-box {
          width: 100%;
          max-width: 400px;
          background: rgba(26,21,48,0.7);
          border: 1px solid rgba(155,89,245,0.15);
          border-radius: 16px;
          padding: 36px 32px;
          backdrop-filter: blur(12px);
        }
        .login-course-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 40px;
          width: 100%;
          max-width: 420px;
          opacity: 0.85;
        }
        .login-course-tile {
          border-radius: 8px;
          padding: 18px 10px;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Space Grotesk', sans-serif;
        }

        @media (max-width: 680px) {
          .login-split { flex-direction: column; }
          .login-left {
            width: 100%;
            min-height: auto;
            padding: 40px 24px 32px;
            border-right: none;
            border-bottom: 1px solid rgba(155,89,245,0.15);
          }
          .login-right {
            width: 100%;
            min-height: auto;
            padding: 32px 24px 40px;
          }
          .login-form-box { padding: 24px 20px; }
          .login-course-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 28px;
          }
          .login-course-tile { padding: 12px 6px; font-size: 11px; }
        }

        @media (max-width: 380px) {
          .login-left { padding: 32px 16px 24px; }
          .login-right { padding: 24px 16px 32px; }
          .login-course-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      <div className="login-split">

        {/* ── Left panel (form) ── */}
        <div className="login-left">
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #9b59f5, #6a1fd0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 26, fontWeight: 900, color: 'white',
              fontFamily: 'Space Grotesk, sans-serif', boxShadow: '0 8px 32px rgba(155,89,245,0.4)',
            }}>F</div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#9b59f5', fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-1px' }}>FLEX</h1>
            <p style={{ fontSize: 13, color: '#8b7fb0', marginTop: 4 }}>University Management System</p>
            <p style={{ fontSize: 11, color: '#4e4470', marginTop: 2 }}>FAST National University · Lahore</p>
          </div>

          {/* Form box */}
          <div className="login-form-box">
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 20, fontWeight: 700, marginBottom: 24, color: '#ede8f8' }}>Sign In</h2>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 18 }}>
                <label className="form-label">Roll No. / Username</label>
                <input className="form-input"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  placeholder="e.g. 24L-3067"
                  required
                />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="form-label">Password</label>
                <input className="form-input" type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, fontWeight: 600 }}
                disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
            </form>

            <p style={{ fontSize: 11.5, color: '#4e4470', marginTop: 20, textAlign: 'center' }}>
              For password assistance contact your Academic Officer
            </p>
          </div>
        </div>

        {/* ── Right panel (branding) ── */}
        <div className="login-right">
          {/* Decorative orbs */}
          <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,89,245,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(155,89,245,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Grid of course tiles */}
          <div className="login-course-grid">
            {[
              ['CS', '#9b59f5','#1e1245'], ['DB', '#6a1fd0','#140d2e'], ['AI', '#c084fc','#2e1f5e'], ['OS', '#7c3aed','#1a1530'],
              ['SE', '#a855f7','#231c40'], ['CN', '#8b5cf6','#1e1245'], ['DS', '#9333ea','#140d2e'], ['ML', '#c084fc','#2e1f5e'],
              ['NW', '#7c3aed','#1a1530'], ['WD', '#a855f7','#231c40'], ['HCI','#8b5cf6','#1e1245'], ['DM', '#9333ea','#140d2e'],
            ].map(([label, border, bg]) => (
              <div key={label} className="login-course-tile" style={{
                background: bg, border: `1px solid ${border}40`, color: border,
              }}>{label}</div>
            ))}
          </div>

          <div style={{ textAlign: 'center', position: 'relative' }}>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 28, fontWeight: 800, color: '#ede8f8', marginBottom: 12 }}>
              Welcome to FLEX
            </h2>
            <p style={{ color: '#8b7fb0', fontSize: 14, lineHeight: 1.7, maxWidth: 320 }}>
              Your academic portal for attendance, marks, fee, and more — all in one place.
            </p>
            <p style={{ color: '#4e4470', fontSize: 12, marginTop: 16 }}>
              FAST National University of Computer and Emerging Sciences
            </p>
          </div>
        </div>

      </div>
    </>
  );
}