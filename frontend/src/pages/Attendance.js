import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

// ─── shared helpers ──────────────────────────────────────────────────────────

const STATUS_META = {
  P: { label: 'Present', color: 'var(--green)',  bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)'  },
  A: { label: 'Absent',  color: 'var(--red)',    bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' },
  L: { label: 'Leave',   color: 'var(--yellow)', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.25)' },
};

function AttBar({ pct, alert }) {
  const color = alert === 'red' ? 'var(--red)' : alert === 'yellow' ? 'var(--yellow)' : 'var(--green)';
  return (
    <div style={{ height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
    </div>
  );
}

function StatusPill({ status }) {
  const m = STATUS_META[status];
  if (!m) return <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
    }}>{m.label}</span>
  );
}

// ─── QR IMAGE DECODER (student uploads screenshot) ───────────────────────────

function QrImageUpload({ onToken }) {
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview]   = useState(null);
  const [decodeMsg, setDecodeMsg] = useState('');

  async function loadZxing() {
    if (window.ZXing) return window.ZXing;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      // ZXing-js browser bundle — handles real-world screenshots reliably
      s.src = 'https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js';
      s.onload = () => resolve(window.ZXing);
      s.onerror = () => reject(new Error('Failed to load ZXing'));
      document.head.appendChild(s);
    });
  }

  async function decodeWithZxing(dataUrl) {
    const ZXing = await loadZxing();
    const hints = new Map();
    const formats = [ZXing.BarcodeFormat.QR_CODE];
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    const reader = new ZXing.MultiFormatReader();
    reader.setHints(hints);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');

        // Try multiple sizes — ZXing works best at the natural size
        const sizes = [1, 2, 0.5];
        for (const scale of sizes) {
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');

          // Try 1: as-is
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          try {
            const lum = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
            const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
            const result = reader.decode(bmp);
            resolve(result.getText()); return;
          } catch {}

          // Try 2: with white padding (quiet zone fix)
          const pad = Math.round(20 * scale);
          const padded = document.createElement('canvas');
          padded.width  = canvas.width  + pad * 2;
          padded.height = canvas.height + pad * 2;
          const pCtx = padded.getContext('2d');
          pCtx.fillStyle = '#ffffff';
          pCtx.fillRect(0, 0, padded.width, padded.height);
          pCtx.drawImage(img, pad, pad, canvas.width, canvas.height);
          try {
            const lum = new ZXing.HTMLCanvasElementLuminanceSource(padded);
            const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
            const result = reader.decode(bmp);
            resolve(result.getText()); return;
          } catch {}

          // Try 3: invert colours (light-on-dark QR)
          const inv = document.createElement('canvas');
          inv.width = canvas.width + pad * 2;
          inv.height = canvas.height + pad * 2;
          const iCtx = inv.getContext('2d');
          iCtx.fillStyle = '#000000';
          iCtx.fillRect(0, 0, inv.width, inv.height);
          iCtx.drawImage(img, pad, pad, canvas.width, canvas.height);
          const iData = iCtx.getImageData(0, 0, inv.width, inv.height);
          for (let i = 0; i < iData.data.length; i += 4) {
            iData.data[i]   = 255 - iData.data[i];
            iData.data[i+1] = 255 - iData.data[i+1];
            iData.data[i+2] = 255 - iData.data[i+2];
          }
          iCtx.putImageData(iData, 0, 0);
          try {
            const lum = new ZXing.HTMLCanvasElementLuminanceSource(inv);
            const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
            const result = reader.decode(bmp);
            resolve(result.getText()); return;
          } catch {}
        }

        resolve(null); // all attempts failed
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async function processFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    setDecodeMsg(''); setScanning(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      try {
        const text = await decodeWithZxing(dataUrl);
        if (text) {
          const token = text.startsWith('FLEX-ATT:') ? text.slice(9) : text;
          setDecodeMsg('✓ QR code read! Token filled in automatically.');
          onToken(token);
        } else {
          setDecodeMsg('✗ Could not read QR code from image. Copy the token text shown below the QR on the faculty screen and paste it in the box below.');
        }
      } catch (err) {
        setDecodeMsg('✗ QR reader failed to load. Paste the token manually below.');
      }
      setScanning(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 8,
          border: '2px dashed rgba(155,89,245,0.35)', borderRadius: 12,
          padding: preview ? '12px' : '28px 16px', cursor: 'pointer',
          background: 'rgba(155,89,245,0.04)', transition: 'border-color .2s',
          marginBottom: 10,
        }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); processFile(e.dataTransfer.files[0]); }}
      >
        <input type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => processFile(e.target.files[0])} />
        {preview
          ? <img src={preview} alt="QR" style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 8 }} />
          : <div style={{ fontSize: 36 }}>🖼️</div>
        }
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textAlign: 'center' }}>
          {scanning ? 'Reading QR code…' : preview ? 'Upload a different image' : 'Upload or drag a screenshot of the QR code'}
        </div>
        {!preview && <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>PNG, JPG, screenshot — any image</div>}
      </label>
      {decodeMsg && (
        <div style={{
          fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: 8,
          background: decodeMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: decodeMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)',
          border: `1px solid ${decodeMsg.startsWith('✓') ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
        }}>{decodeMsg}</div>
      )}
    </div>
  );
}

// ─── QR MARK BUTTON (fires the actual API call) ───────────────────────────────

function QrMarkButton({ token, onDone }) {
  const [status, setStatus] = useState('idle');
  const [msg, setMsg]       = useState('');

  async function mark() {
    setStatus('loading');
    try {
      const res = await api.scanQrCode(token);
      setStatus('success');
      setMsg(res.alreadyMarked ? 'You were already marked present.' : '✓ Marked present successfully!');
      onDone && onDone();
    } catch (e) {
      setStatus('error');
      const m = e.message || '';
      setMsg(
        m.includes('expired')          ? '✗ This QR code has expired. Ask your faculty to generate a new one.' :
        m.includes('not enrolled')     ? '✗ You are not enrolled in this course.' :
        m.includes('Network mismatch') ? `✗ Wrong network. Connect to the university WiFi and try again. (${m.split('(')[1]?.replace(')','') || ''})` :
        `✗ ${m || 'Failed. Please try again.'}`
      );
    }
  }

  if (status === 'success') return <div style={{ color: 'var(--green)', fontWeight: 600, fontSize: 14, padding: '10px 0' }}>{msg}</div>;
  if (status === 'error')   return <div style={{ color: 'var(--red)', fontSize: 13, padding: '10px 0' }}>{msg}</div>;

  return (
    <button className="btn btn-primary" onClick={mark} disabled={status === 'loading'}
      style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 4 }}>
      {status === 'loading' ? 'Marking attendance…' : '✓ Mark me present'}
    </button>
  );
}

// ─── STUDENT VIEW ────────────────────────────────────────────────────────────

function StudentAttendance() {
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrMode, setQrMode]   = useState(false);
  const [qrToken, setQrToken] = useState('');

  useEffect(() => {
    api.getMyAttendance()
      .then(r => { setCourses(r.data); if (r.data.length) setSelected(r.data[0].courseId); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const course = courses.find(c => c.courseId === selected);

  if (loading) return <div className="page"><div className="empty"><p>Loading…</p></div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 className="page-title">My Attendance</h2>
            <p className="page-subtitle">Spring 2024</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setQrMode(v => !v); setQrToken(''); }}>
            {qrMode ? '← Back to records' : '📷 Mark Attendance via QR'}
          </button>
        </div>
      </div>

      {/* ── QR MODE ── */}
      {qrMode && (
        <div className="card" style={{ maxWidth: 460, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Mark Attendance via QR</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
            Upload a screenshot of the QR code shown by your faculty, or paste the token below.
          </p>

          <QrImageUpload onToken={t => setQrToken(t)} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>or enter token manually</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <input className="form-input" placeholder="Paste full token here (e.g. 39f745650f7c38808f0e2a1b…)"
            value={qrToken} onChange={e => setQrToken(e.target.value.trim())}
            style={{ marginBottom: 8, fontFamily: 'monospace', fontSize: 12 }} />
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginBottom: 12 }}>
            ⚠️ Make sure you are logged in as a <strong style={{color:'var(--text-muted)'}}>student</strong> account and connected to the same WiFi as your faculty.
          </div>

          {qrToken && <QrMarkButton key={qrToken} token={qrToken} onDone={() => {}} />}
        </div>
      )}

      {/* ── RECORDS MODE ── */}
      {!qrMode && (
        <>
          {/* Summary strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
            {courses.map(c => (
              <div key={c.courseId} onClick={() => setSelected(c.courseId)} style={{
                background: selected === c.courseId ? 'var(--navy-light)' : 'var(--surface)',
                border: `1px solid ${selected === c.courseId ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 2 }}>{c.courseCode}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.courseTitle}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk',
                  color: c.alert === 'red' ? 'var(--red)' : c.alert === 'yellow' ? 'var(--yellow)' : 'var(--green)'
                }}>{c.percentage}%</div>
                <AttBar pct={c.percentage} alert={c.alert} />
              </div>
            ))}
          </div>

          {course && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 17, fontWeight: 700 }}>
                    {course.courseCode} — {course.courseTitle}
                  </h3>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>{course.schedule}</div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[['Total', course.total, 'var(--text)'], ['Present', course.present, 'var(--green)'],
                    ['Absent', course.absent, 'var(--red)'], ['Leave', course.leave, 'var(--yellow)']].map(([l, v, col]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk', color: col }}>{v}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Overall Attendance</span>
                  <span style={{ fontWeight: 700,
                    color: course.alert === 'red' ? 'var(--red)' : course.alert === 'yellow' ? 'var(--yellow)' : 'var(--green)'
                  }}>{course.percentage}%{course.alert !== 'green' && ` — ${course.alert === 'red' ? '⚠ Critical' : '⚠ Warning'}`}</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface3)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${course.percentage}%`, height: '100%', borderRadius: 4, transition: 'width .4s',
                    background: course.alert === 'red' ? 'var(--red)' : course.alert === 'yellow' ? 'var(--yellow)' : 'var(--green)'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
                  <span>0%</span><span style={{ color: 'var(--red)' }}>60%</span>
                  <span style={{ color: 'var(--yellow)' }}>75%</span><span>100%</span>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                Lecture-wise Record
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {course.lectureWise.map((l, i) => {
                  const m = STATUS_META[l.status];
                  return (
                    <div key={l.date} title={`${l.date} — ${m?.label || 'N/A'}`} style={{
                      width: 44, padding: '6px 4px', borderRadius: 6, textAlign: 'center', cursor: 'default',
                      background: m?.bg || 'var(--surface3)',
                      border: `1px solid ${m?.border || 'var(--border)'}`,
                    }}>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>#{i + 1}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: m?.color || 'var(--text-muted)' }}>{l.status}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>{l.date.slice(5)}</div>
                    </div>
                  );
                })}
                {course.lectureWise.length === 0 && (
                  <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No lectures recorded yet.</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── QR SESSION PANEL (Faculty) ───────────────────────────────────────────────

const QR_EXPIRY_MS = 10 * 60 * 1000;

function QrDisplay({ value }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(!!window.QRCode);

  useEffect(() => {
    if (window.QRCode) { render(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => { if (ready) render(); }, [ready, value]);

  function render() {
    if (!ref.current || !window.QRCode) return;
    ref.current.innerHTML = '';
    new window.QRCode(ref.current, {
      text: value, width: 220, height: 220,
      colorDark: '#000000', colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.H,
    });
  }

  return (
    <div ref={ref} style={{
      background: '#ffffff', padding: 14, borderRadius: 12,
      border: '2px solid var(--accent)', display: 'inline-block',
      minWidth: 244, minHeight: 244,
    }} />
  );
}

function CountdownBar({ expiresAt }) {
  const [left, setLeft] = useState(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, expiresAt - Date.now())), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const pct   = (left / QR_EXPIRY_MS) * 100;
  const mins  = Math.floor(left / 60000);
  const secs  = Math.floor((left % 60000) / 1000);
  const color = pct > 50 ? 'var(--green)' : pct > 20 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div style={{ marginTop: 10, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-muted)' }}>Expires in</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color }}>{mins}:{String(secs).padStart(2,'0')}</span>
      </div>
      <div style={{ height: 5, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 1s linear, background .5s' }} />
      </div>
    </div>
  );
}

function QrSessionPanel({ courseId, markDate, onSessionEnd, onMsg }) {
  const [session, setSession] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [creating, setCreating] = useState(false);
  const [ending, setEnding]     = useState(false);
  const pollRef = useRef(null);

  const stopPoll = () => { clearInterval(pollRef.current); pollRef.current = null; };
  useEffect(() => () => stopPoll(), []);

  const poll = useCallback(async (token) => {
    try {
      const r = await api.getQrStatus(token);
      setLiveData(r.data);
      if (r.data.expired) stopPoll();
    } catch { stopPoll(); }
  }, []);

  async function create() {
    setCreating(true); stopPoll();
    try {
      const r = await api.createQrSession(courseId, markDate);
      setSession(r.data); setLiveData(null);
      pollRef.current = setInterval(() => poll(r.data.token), 3000);
      poll(r.data.token);
      onMsg('success', `QR session started for ${markDate} — expires in 10 minutes`);
    } catch (e) { onMsg('error', e.message); }
    finally { setCreating(false); }
  }

  async function end() {
    if (!session) return;
    setEnding(true); stopPoll();
    try {
      const r = await api.endQrSession(session.token);
      onMsg('success', r.message);
      setSession(null); setLiveData(null);
      onSessionEnd?.();
    } catch (e) { onMsg('error', e.message); }
    finally { setEnding(false); }
  }

  const expired = liveData?.expired || (session && Date.now() > session.expiresAt);

  if (!session) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 52, marginBottom: 14 }}>📱</div>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 13.5, maxWidth: 360, margin: '0 auto 24px' }}>
          Generate a QR code for this class. Students scan it to mark themselves <strong style={{ color: 'var(--green)' }}>Present</strong>. Anyone who doesn't scan is marked <strong style={{ color: 'var(--red)' }}>Absent</strong> when you end the session.
        </p>
        <button className="btn btn-primary" onClick={create} disabled={creating} style={{ padding: '11px 32px', fontSize: 14 }}>
          {creating ? 'Generating…' : '⚡ Generate QR Code'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 28, alignItems: 'start' }}>
      {/* Left — QR */}
      <div style={{ textAlign: 'center' }}>
        {expired ? (
          <div style={{ padding: '32px 16px', border: '2px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⏱</div>
            <div style={{ fontWeight: 600 }}>QR Expired</div>
          </div>
        ) : (
          <QrDisplay value={`FLEX-ATT:${session.token}`} />
        )}
        <CountdownBar expiresAt={session.expiresAt} />
        <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'left' }}>Token (students can copy this):</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{ fontSize: 10, color: 'var(--text)', fontFamily: 'monospace', wordBreak: 'break-all', flex: 1, textAlign: 'left', userSelect: 'all' }}>
              {session.token}
            </code>
            <button onClick={() => { navigator.clipboard.writeText(session.token); }} style={{
              background: 'var(--accent-glow)', border: '1px solid var(--accent)', borderRadius: 5,
              color: 'var(--accent)', fontSize: 10, padding: '3px 7px', cursor: 'pointer', flexShrink: 0,
            }}>Copy</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={create} disabled={creating || ending}>
            {creating ? 'Regenerating…' : '🔄 New Code'}
          </button>
          <button className="btn btn-sm" onClick={end} disabled={ending}
            style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {ending ? 'Saving…' : '✓ End & Save'}
          </button>
        </div>
      </div>

      {/* Right — live roster */}
      <div>
        {liveData ? (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {[['Present', liveData.presentCount, 'var(--green)'],
                ['Absent', liveData.totalCount - liveData.presentCount, 'var(--red)'],
                ['Total', liveData.totalCount, 'var(--text)']].map(([l, v, col]) => (
                <div key={l} className="stat-card" style={{ flex: 1, padding: '10px 14px' }}>
                  <div className="stat-label">{l}</div>
                  <div className="stat-value" style={{ fontSize: 22, color: col }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', background: 'var(--surface2)', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Student</th>
                    <th style={{ padding: '8px 12px', background: 'var(--surface2)', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {liveData.students.map(s => (
                    <tr key={s.id}>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid rgba(155,89,245,0.06)' }}>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.username}</div>
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center', borderBottom: '1px solid rgba(155,89,245,0.06)' }}>
                        {s.present
                          ? <span style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--green)', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>P</span>
                          : <span style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--red)', padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Loading roster…</div>}
      </div>
    </div>
  );
}

// ─── FACULTY VIEW ────────────────────────────────────────────────────────────

const MOCK_COURSES_FOR_FACULTY = [
  { id: 'c001', code: 'CS-301', section: 'B', title: 'Database Systems' },
  { id: 'c002', code: 'CS-302', section: 'B', title: 'Software Engineering' },
  { id: 'c003', code: 'CS-303', section: 'B', title: 'Computer Networks' },
  { id: 'c004', code: 'CS-304', section: 'B', title: 'Operating Systems' },
  { id: 'c005', code: 'CS-305', section: 'B', title: 'Artificial Intelligence' },
];

function FacultyAttendance() {
  const [courseId, setCourseId]       = useState('');
  const [attData, setAttData]         = useState(null);
  const [markDate, setMarkDate]       = useState(new Date().toISOString().slice(0, 10));
  const [records, setRecords]         = useState({});
  const [tab, setTab]                 = useState('qr');
  const [editingDate, setEditingDate] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [deleting, setDeleting]       = useState(null);
  const [msg, setMsg]                 = useState(null);
  const [filter, setFilter]           = useState('all');

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000); };

  const loadCourse = useCallback((id) => {
    if (!id) return;
    setCourseId(id); setAttData(null);
    api.getCourseAttendance(id).then(r => {
      setAttData(r.data);
      const init = {};
      r.data.students.forEach(s => { init[s.id] = 'P'; });
      setRecords(init);
    }).catch(e => showMsg('error', e.message));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.markAttendance(courseId, markDate, records);
      showMsg('success', res.message);
      loadCourse(courseId);
      setEditingDate(null);
    } catch (e) { showMsg('error', e.message); }
    finally { setSaving(false); }
  };

  const startEdit = (date) => {
    setEditingDate(date); setMarkDate(date);
    const existing = {};
    attData.students.forEach(s => {
      const lec = s.lectureWise.find(l => l.date === date);
      existing[s.id] = lec?.status || 'P';
    });
    setRecords(existing);
    setTab('mark');
  };

  const deleteDateAtt = async (date) => {
    if (!window.confirm(`Delete attendance for ${date}?`)) return;
    setDeleting(date);
    try {
      await api.deleteAttendance(courseId, date);
      showMsg('success', `Attendance for ${date} deleted`);
      loadCourse(courseId);
    } catch (e) { showMsg('error', e.message); }
    finally { setDeleting(null); }
  };

  const markAll = (status) => {
    if (!attData) return;
    const bulk = {};
    attData.students.forEach(s => { bulk[s.id] = status; });
    setRecords(bulk);
  };

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const res = await api.exportAttendance(courseId);
      const { header, rows, courseName, dates } = res.data;
      if (!window.XLSX) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet([header, ...rows]);
      ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 28 }, { wch: 6 }, ...dates.map(() => ({ wch: 12 }))];
      window.XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      window.XLSX.writeFile(wb, `attendance_${courseId}.xlsx`);
      showMsg('success', `Exported for ${courseName}`);
    } catch (e) { showMsg('error', 'Export failed: ' + e.message); }
    finally { setExporting(false); }
  };

  const filteredStudents = attData?.students.filter(s =>
    filter === 'all' ? true : s.alert === filter
  ) || [];

  const existingRecord = attData?.dates.includes(markDate);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Attendance Management</h2>
        <p className="page-subtitle">Mark, edit, and review student attendance</p>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ cursor: 'pointer' }} onClick={() => setMsg(null)}>
          {msg.text}
        </div>
      )}

      {/* Top controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 260 }}>
          <label className="form-label">Course</label>
          <select className="form-select" value={courseId} onChange={e => loadCourse(e.target.value)}>
            <option value="">— Select course —</option>
            {MOCK_COURSES_FOR_FACULTY.map(c => (
              <option key={c.id} value={c.id}>{c.code}-{c.section} · {c.title}</option>
            ))}
          </select>
        </div>

        {attData && (
          <>
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
              {[['qr', '📱 QR'], ['mark', '✏️ Manual'], ['history', '📋 History']].map(([t, l]) => (
                <button key={t} className="btn btn-sm" onClick={() => setTab(t)} style={{
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? 'white' : 'var(--text-muted)',
                }}>{l}</button>
              ))}
            </div>
            <button className="btn btn-sm" onClick={exportXlsx} disabled={exporting} style={{
              marginLeft: 'auto', background: 'rgba(34,197,94,0.12)', color: 'var(--green)',
              border: '1px solid rgba(34,197,94,0.3)', fontWeight: 700,
            }}>
              {exporting ? 'Exporting…' : '⬇ Export .xlsx'}
            </button>
          </>
        )}
      </div>

      {/* Class summary strip */}
      {attData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            ['Total Lectures', attData.classSummary.totalLectures, 'var(--text)'],
            ['Avg Attendance', attData.classSummary.avgAttendance + '%', 'var(--accent)'],
            ['Below 75%', attData.classSummary.belowThreshold, 'var(--yellow)'],
            ['Critical <60%', attData.classSummary.critical, 'var(--red)'],
          ].map(([l, v, col]) => (
            <div key={l} className="stat-card" style={{ padding: '12px 16px' }}>
              <div className="stat-label">{l}</div>
              <div className="stat-value" style={{ fontSize: 24, color: col }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── QR TAB ── */}
      {attData && tab === 'qr' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <label className="form-label">Session date</label>
              <input className="form-input" type="date" value={markDate} style={{ maxWidth: 180 }}
                onChange={e => setMarkDate(e.target.value)} />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', paddingTop: 20 }}>
              Students open FLEX on their device, click <strong>Mark Attendance via QR</strong>, and upload a screenshot of this code.
            </p>
          </div>
          <QrSessionPanel courseId={courseId} markDate={markDate}
            onSessionEnd={() => loadCourse(courseId)} onMsg={showMsg} />
        </div>
      )}

      {/* ── MARK TAB ── */}
      {attData && tab === 'mark' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={markDate}
                onChange={e => { setMarkDate(e.target.value); setEditingDate(null); }} />
            </div>
            {existingRecord && !editingDate && (
              <div className="alert alert-info" style={{ margin: 0, padding: '8px 14px', fontSize: 12.5 }}>
                Attendance already recorded for this date.{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => startEdit(markDate)}>Edit it →</span>
              </div>
            )}
            {editingDate && (
              <div className="alert alert-info" style={{ margin: 0, padding: '8px 14px', fontSize: 12.5 }}>
                Editing attendance for <strong>{editingDate}</strong>.{' '}
                <span style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => { setEditingDate(null); const init = {}; attData.students.forEach(s => { init[s.id] = 'P'; }); setRecords(init); }}>
                  Cancel edit
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Mark all:</span>
              {['P', 'A', 'L'].map(s => {
                const m = STATUS_META[s];
                return (
                  <button key={s} className="btn btn-sm" onClick={() => markAll(s)} style={{
                    background: m.bg, color: m.color, border: `1px solid ${m.border}`, fontWeight: 700,
                  }}>{m.label}</button>
                );
              })}
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Roll No.</th><th>Student Name</th>
                  <th>Overall %</th><th>P</th><th>A</th><th>L</th>
                  <th style={{ minWidth: 200 }}>Today's Status</th>
                </tr>
              </thead>
              <tbody>
                {attData.students.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text-dim)', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12.5, color: 'var(--text-muted)' }}>{s.username}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          color: s.alert === 'red' ? 'var(--red)' : s.alert === 'yellow' ? 'var(--yellow)' : 'var(--green)',
                        }}>{s.percentage}%</span>
                        <div style={{ flex: 1, height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden', minWidth: 48 }}>
                          <div style={{
                            width: `${s.percentage}%`, height: '100%', borderRadius: 2,
                            background: s.alert === 'red' ? 'var(--red)' : s.alert === 'yellow' ? 'var(--yellow)' : 'var(--green)',
                          }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--green)', fontWeight: 600, fontSize: 13 }}>{s.present}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>{s.absent}</td>
                    <td style={{ color: 'var(--yellow)', fontWeight: 600, fontSize: 13 }}>{s.leave}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        {['P', 'A', 'L'].map(st => {
                          const m = STATUS_META[st];
                          const active = records[s.id] === st;
                          return (
                            <button key={st} onClick={() => setRecords({ ...records, [s.id]: st })}
                              style={{
                                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', border: `1px solid ${active ? m.border : 'transparent'}`,
                                background: active ? m.bg : 'var(--surface3)',
                                color: active ? m.color : 'var(--text-muted)',
                                transition: 'all .1s',
                              }}>{st}</button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : editingDate ? '💾 Update Attendance' : '💾 Save Attendance'}
            </button>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {attData && tab === 'history' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 className="card-title">Student Attendance History</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['all', 'All'], ['green', '✓ Good'], ['yellow', '⚠ Warning'], ['red', '✕ Critical']].map(([f, l]) => (
                <button key={f} className="btn btn-sm" onClick={() => setFilter(f)} style={{
                  background: filter === f
                    ? (f === 'green' ? 'rgba(34,197,94,0.2)' : f === 'yellow' ? 'rgba(234,179,8,0.2)' : f === 'red' ? 'rgba(239,68,68,0.2)' : 'var(--accent)')
                    : 'var(--surface3)',
                  color: filter === f
                    ? (f === 'green' ? 'var(--green)' : f === 'yellow' ? 'var(--yellow)' : f === 'red' ? 'var(--red)' : 'white')
                    : 'var(--text-muted)',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {attData.dates.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 140 }}>Student</th>
                    <th>%</th>
                    {attData.dates.map(d => (
                      <th key={d} style={{ minWidth: 70, textAlign: 'center', fontSize: 10.5 }}>
                        <div>{d.slice(5)}</div>
                        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 4 }}>
                          <button title="Edit" onClick={() => startEdit(d)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, padding: '1px 3px',
                          }}>✏️</button>
                          <button title="Delete" onClick={() => deleteDateAtt(d)} disabled={deleting === d} style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 11, padding: '1px 3px',
                          }}>{deleting === d ? '…' : '🗑'}</button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.username}</div>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          color: s.alert === 'red' ? 'var(--red)' : s.alert === 'yellow' ? 'var(--yellow)' : 'var(--green)',
                        }}>{s.percentage}%</span>
                      </td>
                      {attData.dates.map(d => {
                        const lec = s.lectureWise.find(l => l.date === d);
                        const st  = lec?.status || 'N/A';
                        const m   = STATUS_META[st];
                        return (
                          <td key={d} style={{ textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block', width: 28, lineHeight: '28px', borderRadius: 5,
                              fontSize: 11, fontWeight: 700,
                              background: m?.bg || 'transparent',
                              color: m?.color || 'var(--text-dim)',
                            }}>{st}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr><td colSpan={attData.dates.length + 2} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No students match this filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {attData.dates.length === 0 && (
            <div className="empty"><p>No attendance recorded yet. Use the Mark tab to start.</p></div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ROOT ────────────────────────────────────────────────────────────────────

export default function Attendance() {
  const { user } = useAuth();
  return user.role === 'student' ? <StudentAttendance /> : <FacultyAttendance />;
}
