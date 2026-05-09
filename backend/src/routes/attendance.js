const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../data/database');
const { authenticate, authorize } = require('../middleware/auth');

// ── In-memory QR sessions (token → { courseId, date, expiresAt, facultyIp }) ──
// Stored in RAM only — they expire in 10 min and don't need to survive restarts.
const qrSessions = new Map();

function purgeExpired() {
  const now = Date.now();
  // 5s grace so a session freshly created in the same request cycle isn't purged
  for (const [t, s] of qrSessions) if (s.expiresAt < now - 5000) qrSessions.delete(t);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function calcStats(courseId, studentId) {
  const rows = db.prepare(
    'SELECT status FROM attendance WHERE course_id = ? AND student_id = ?'
  ).all(courseId, studentId);
  const total = rows.length;
  if (!total) return { total: 0, present: 0, absent: 0, leave: 0, percentage: 100 };
  let present = 0, absent = 0, leave = 0;
  for (const r of rows) {
    if (r.status === 'P') present++;
    else if (r.status === 'A') absent++;
    else if (r.status === 'L') leave++;
  }
  const percentage = Math.round(((present + leave) / total) * 100);
  return { total, present, absent, leave, percentage };
}

function alertLevel(pct) {
  return pct < 60 ? 'red' : pct < 75 ? 'yellow' : 'green';
}

// Extract the client's real IP, stripping IPv6 prefix if needed
function clientIp(req) {
  const raw = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '');
}

// Return the /24 subnet of an IP (e.g. "192.168.1" for "192.168.1.42")
function subnet24(ip) {
  const parts = ip.split('.');
  return parts.length === 4 ? parts.slice(0, 3).join('.') : ip;
}

function log(userId, action, entity, ip) {
  db.prepare(`INSERT INTO audit_logs (id,user_id,action,module,entity,timestamp,ip)
              VALUES (?,?,?,?,?,?,?)`)
    .run(`al${Date.now()}${Math.random().toString(36).slice(2)}`,
         userId, action, 'Attendance', entity, new Date().toISOString(), ip);
}

// ── Student: view own attendance ──────────────────────────────────────────────

router.get('/my', authenticate, authorize('student'), (req, res) => {
  const regs = db.prepare('SELECT course_id FROM registrations WHERE student_id = ?').all(req.user.id);
  const data = regs.map(r => {
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(r.course_id);
    const stats  = calcStats(r.course_id, req.user.id);
    const rows   = db.prepare(
      'SELECT date, status FROM attendance WHERE course_id = ? AND student_id = ? ORDER BY date'
    ).all(r.course_id, req.user.id);
    return {
      courseId: r.course_id,
      courseCode: course?.code,
      courseTitle: course?.title,
      schedule: course?.schedule,
      ...stats,
      alert: alertLevel(stats.percentage),
      lectureWise: rows,
    };
  });
  res.json({ success: true, data });
});

// ── Faculty: full attendance grid ─────────────────────────────────────────────

router.get('/course/:courseId', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const { courseId } = req.params;
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  const regs = db.prepare(
    'SELECT r.student_id, u.name, u.username FROM registrations r JOIN users u ON u.id = r.student_id WHERE r.course_id = ?'
  ).all(courseId);

  const dates = db.prepare(
    'SELECT DISTINCT date FROM attendance WHERE course_id = ? ORDER BY date'
  ).all(courseId).map(r => r.date);

  const students = regs.map(s => {
    const stats = calcStats(courseId, s.student_id);
    const lectureWise = db.prepare(
      'SELECT date, status FROM attendance WHERE course_id = ? AND student_id = ? ORDER BY date'
    ).all(courseId, s.student_id);
    return {
      id: s.student_id, name: s.name, username: s.username,
      ...stats, alert: alertLevel(stats.percentage), lectureWise,
    };
  });

  const classSummary = {
    totalLectures:  dates.length,
    avgAttendance:  students.length
      ? Math.round(students.reduce((s, st) => s + st.percentage, 0) / students.length) : 0,
    belowThreshold: students.filter(s => s.percentage < 75).length,
    critical:       students.filter(s => s.percentage < 60).length,
  };

  res.json({ success: true, data: { course, dates, students, classSummary } });
});

// ── Faculty: manual mark / edit ───────────────────────────────────────────────

router.post('/mark', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const { courseId, date, records } = req.body;
  if (!courseId || !date || !records)
    return res.status(400).json({ success: false, message: 'courseId, date, and records required' });
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  const valid = new Set(['P','A','L']);
  for (const v of Object.values(records))
    if (!valid.has(v)) return res.status(400).json({ success: false, message: `Invalid status "${v}"` });

  const existing = db.prepare(
    'SELECT id FROM attendance WHERE course_id = ? AND date = ? LIMIT 1'
  ).get(courseId, date);

  const upsert = db.prepare(`
    INSERT INTO attendance (id, course_id, student_id, date, status)
    VALUES (@id, @courseId, @studentId, @date, @status)
    ON CONFLICT(course_id, student_id, date) DO UPDATE SET status = excluded.status
  `);
  const saveAll = db.transaction(() => {
    for (const [studentId, status] of Object.entries(records)) {
      upsert.run({ id: `att${Date.now()}${Math.random().toString(36).slice(2)}`, courseId, studentId, date, status });
    }
  });
  saveAll();
  log(req.user.id, existing ? 'EDIT_ATTENDANCE' : 'MARK_ATTENDANCE', `${courseId}/${date}`, clientIp(req));
  res.json({ success: true, message: existing ? 'Attendance updated' : 'Attendance saved' });
});

// ── Faculty: delete a date ────────────────────────────────────────────────────

router.delete('/:courseId/:date', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const { courseId, date } = req.params;
  const info = db.prepare('DELETE FROM attendance WHERE course_id = ? AND date = ?').run(courseId, date);
  if (info.changes === 0)
    return res.status(404).json({ success: false, message: 'No records found for this date' });
  res.json({ success: true, message: `Attendance for ${date} deleted` });
});

// ── Export ────────────────────────────────────────────────────────────────────

router.get('/export/:courseId', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const { courseId } = req.params;
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  const regs = db.prepare(
    'SELECT r.student_id, u.name, u.username FROM registrations r JOIN users u ON u.id = r.student_id WHERE r.course_id = ?'
  ).all(courseId);

  const dates = db.prepare(
    'SELECT DISTINCT date FROM attendance WHERE course_id = ? ORDER BY date'
  ).all(courseId).map(r => r.date);

  const fmtDate = d => { const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; };
  const header = ['S#', 'Roll No.', 'Student Name', 'L', ...dates.map(fmtDate)];
  const rows = regs.map((s, i) => {
    const row = [i + 1, s.username, s.name, 0];
    for (const d of dates) {
      const r = db.prepare('SELECT status FROM attendance WHERE course_id=? AND student_id=? AND date=?').get(courseId, s.student_id, d);
      row.push(r?.status || 'A');
    }
    return row;
  });

  res.json({ success: true, data: { header, rows, courseName: `${course.code}-${course.section} ${course.title}`, dates } });
});

// ── QR: create session ────────────────────────────────────────────────────────

router.post('/qr/create', authenticate, authorize('faculty', 'admin'), (req, res) => {
  purgeExpired();
  const { courseId, date } = req.body;
  if (!courseId || !date)
    return res.status(400).json({ success: false, message: 'courseId and date required' });
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  // Invalidate existing session for same course+date
  for (const [t, s] of qrSessions)
    if (s.courseId === courseId && s.date === date) qrSessions.delete(t);

  const token     = crypto.randomBytes(20).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const facultyIp = clientIp(req);

  qrSessions.set(token, { courseId, date, expiresAt, facultyIp, createdBy: req.user.id });
  log(req.user.id, 'QR_CREATED', `${courseId}/${date}`, facultyIp);

  res.json({ success: true, data: { token, expiresAt, courseId, date } });
});

// ── QR: poll status ───────────────────────────────────────────────────────────

router.get('/qr/status/:token', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const session = qrSessions.get(req.params.token);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found or expired' });

  const regs = db.prepare(
    'SELECT r.student_id, u.name, u.username FROM registrations r JOIN users u ON u.id = r.student_id WHERE r.course_id = ?'
  ).all(session.courseId);

  const presentSet = session.presentIds || new Set();

  res.json({
    success: true,
    data: {
      token: req.params.token,
      courseId: session.courseId,
      date: session.date,
      expiresAt: session.expiresAt,
      expired: Date.now() > session.expiresAt,
      presentCount: presentSet.size,
      totalCount: regs.length,
      students: regs.map(s => ({ id: s.student_id, name: s.name, username: s.username, present: presentSet.has(s.student_id) })),
    },
  });
});

// ── QR: student scans ─────────────────────────────────────────────────────────

router.post('/qr/scan', authenticate, authorize('student'), (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: 'token required' });

  const session = qrSessions.get(token);
  if (!session)           return res.status(404).json({ success: false, message: 'QR code not found or expired' });
  if (Date.now() > session.expiresAt) return res.status(410).json({ success: false, message: 'QR code has expired' });

  // ── WiFi check: student must be on the same /24 subnet as the faculty ─────
  const studentIp = clientIp(req);
  const facultySubnet  = subnet24(session.facultyIp);
  const studentSubnet  = subnet24(studentIp);

  // Allow localhost / 127.x for local dev (both sides on same machine)
  const bothLocal = ['127', '::1'].some(p => session.facultyIp.startsWith(p) || studentIp.startsWith(p));

  if (!bothLocal && facultySubnet !== studentSubnet) {
    return res.status(403).json({
      success: false,
      message: `Not on the same network. Connect to the classroom WiFi and try again.`,
    });
  }

  // Verify enrolment
  const enrolled = db.prepare(
    'SELECT id FROM registrations WHERE student_id = ? AND course_id = ?'
  ).get(req.user.id, session.courseId);
  if (!enrolled) return res.status(403).json({ success: false, message: 'You are not enrolled in this course' });

  if (!session.presentIds) session.presentIds = new Set();
  const alreadyMarked = session.presentIds.has(req.user.id);
  if (!alreadyMarked) session.presentIds.add(req.user.id);

  log(req.user.id, alreadyMarked ? 'QR_DUPLICATE_SCAN' : 'QR_SCANNED', token.slice(0,8), studentIp);
  res.json({ success: true, message: alreadyMarked ? 'Already marked present' : 'Marked present successfully', alreadyMarked });
});

// ── QR: end session → commit to DB ───────────────────────────────────────────

router.post('/qr/end', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: 'token required' });

  const session = qrSessions.get(token);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  const { courseId, date } = session;
  const presentIds = session.presentIds || new Set();

  const enrolledIds = db.prepare(
    'SELECT student_id FROM registrations WHERE course_id = ?'
  ).all(courseId).map(r => r.student_id);

  const upsert = db.prepare(`
    INSERT INTO attendance (id, course_id, student_id, date, status)
    VALUES (@id, @courseId, @studentId, @date, @status)
    ON CONFLICT(course_id, student_id, date) DO UPDATE SET status = excluded.status
  `);

  const commitAll = db.transaction(() => {
    for (const sid of enrolledIds) {
      upsert.run({
        id: `att${Date.now()}${Math.random().toString(36).slice(2)}`,
        courseId, studentId: sid, date,
        status: presentIds.has(sid) ? 'P' : 'A',
      });
    }
  });
  commitAll();
  qrSessions.delete(token);
  log(req.user.id, 'QR_ATTENDANCE_SAVED', `${courseId}/${date}`, clientIp(req));

  res.json({
    success: true,
    message: `Attendance saved — ${presentIds.size} present, ${enrolledIds.length - presentIds.size} absent`,
  });
});

module.exports = router;
