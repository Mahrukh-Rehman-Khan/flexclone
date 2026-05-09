const express = require('express');
const db      = require('../data/database');
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt  = require('bcryptjs');
const os      = require('os');

// ─── FEE ─────────────────────────────────────────────────────────────────────

const feeRouter = express.Router();

function audit(req, action, module, entity, entityId, oldValue, newValue) {
  db.prepare(`INSERT INTO audit_logs (id,user_id,action,module,entity,entity_id,timestamp,ip,old_value,new_value,tamper_hash)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(`al${Date.now()}${Math.random()}`, req.user?.id, action, module, entity, entityId,
      new Date().toISOString(), req.ip, oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null, `${Date.now()}-${action}-${entityId}`);
}

function notify(userId, title, message, type = 'info') {
  db.prepare(`INSERT INTO notifications (id,user_id,title,message,type,created_at) VALUES (?,?,?,?,?,?)`)
    .run(`n${Date.now()}${Math.random()}`, userId, title, message, type, new Date().toISOString());
}

function buildChallan(row) {
  const items = db.prepare('SELECT label, amount FROM challan_items WHERE challan_id = ?').all(row.id);
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const total    = subtotal + (row.fine || 0) - (row.scholarship_deduction || 0);
  return {
    id: row.id, studentId: row.student_id, semester: row.semester,
    status: row.status, dueDate: row.due_date,
    fine: row.fine || 0, scholarshipDeduction: row.scholarship_deduction || 0,
    bankRef: row.bank_ref, paymentMethod: row.payment_method, paidAt: row.paid_at,
    items, subtotal, total,
  };
}

feeRouter.get('/my', authenticate, authorize('student'), (req, res) => {
  const rows = db.prepare('SELECT * FROM challans WHERE student_id = ?').all(req.user.id);
  res.json({ success: true, data: rows.map(buildChallan) });
});

feeRouter.get('/all', authenticate, authorize('finance', 'admin'), (req, res) => {
  const rows = db.prepare('SELECT c.*, u.name AS student_name FROM challans c LEFT JOIN users u ON u.id = c.student_id').all();
  res.json({ success: true, data: rows.map(r => ({ ...buildChallan(r), studentName: r.student_name })) });
});

feeRouter.post('/challans', authenticate, authorize('finance', 'admin'), (req, res) => {
  const { studentId, semester, dueDate, items = [], scholarshipDeduction = 0, fine = 0 } = req.body;
  const student = db.prepare("SELECT id FROM users WHERE id = ? AND role='student'").get(studentId);
  if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
  if (!items.length) return res.status(400).json({ success: false, message: 'At least one challan item is required' });
  const id = `ch${Date.now()}`;
  db.prepare(`INSERT INTO challans (id,student_id,semester,status,due_date,fine,scholarship_deduction)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id, studentId, semester || 'Spring 2025', 'unpaid', dueDate || new Date().toISOString().slice(0,10), Number(fine) || 0, Number(scholarshipDeduction) || 0);
  items.forEach((item, index) => {
    db.prepare('INSERT INTO challan_items (id,challan_id,label,amount) VALUES (?,?,?,?)')
      .run(`ci${Date.now()}${index}`, id, item.label || 'Fee Item', Number(item.amount) || 0);
  });
  notify(studentId, 'Fee challan generated', `A new ${semester || 'semester'} challan is available.`, 'info');
  audit(req, 'CREATE_CHALLAN', 'Finance', 'challan', id, null, req.body);
  res.json({ success: true, message: 'Challan generated', data: { id } });
});

feeRouter.patch('/:id/pay', authenticate, authorize('finance', 'admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM challans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Challan not found' });
  db.prepare(`UPDATE challans SET status='paid', paid_at=?, bank_ref=?, payment_method=? WHERE id=?`)
    .run(new Date().toISOString(), req.body.bankRef || `REF-${Date.now()}`, req.body.paymentMethod || 'Manual', req.params.id);
  notify(row.student_id, 'Payment verified', `Your ${row.semester} challan has been marked paid.`, 'success');
  audit(req, 'MARK_CHALLAN_PAID', 'Finance', 'challan', req.params.id, row, { status: 'paid' });
  res.json({ success: true, message: 'Payment recorded' });
});

// ─── STUDENT REQUESTS ─────────────────────────────────────────────────────────

const requestsRouter = express.Router();

const REQUEST_TYPES = [
  'Freeze Semester','Course Withdrawal','Grade Change Request',
  'Official Transcript','Degree Issuance','Bonafide Certificate','Retake Exam',
];

requestsRouter.get('/types', (req, res) => res.json({ success: true, data: REQUEST_TYPES }));

requestsRouter.get('/my', authenticate, authorize('student'), (req, res) => {
  const rows = db.prepare('SELECT * FROM requests WHERE student_id = ? ORDER BY submitted_at DESC').all(req.user.id);
  res.json({ success: true, data: rows.map(r => ({ ...r, submittedAt: r.submitted_at, updatedAt: r.updated_at })) });
});

requestsRouter.post('/', authenticate, authorize('student'), (req, res) => {
  const { type, justification } = req.body;
  if (!REQUEST_TYPES.includes(type)) return res.status(400).json({ success: false, message: 'Invalid request type' });
  const id  = `req${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO requests (id,student_id,type,justification,status,submitted_at,updated_at,remarks)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, req.user.id, type, justification, 'submitted', now, now, '');
  db.prepare(`INSERT INTO request_events (id,request_id,actor_id,status,remarks,created_at) VALUES (?,?,?,?,?,?)`)
    .run(`re${Date.now()}`, id, req.user.id, 'submitted', justification || '', now);
  notify(req.user.id, 'Request submitted', `${type} request is now submitted.`, 'success');
  audit(req, 'SUBMIT_REQUEST', 'Requests', 'request', id, null, req.body);
  res.json({ success: true, message: 'Request submitted', data: { id } });
});

requestsRouter.get('/all', authenticate, authorize('admin', 'hod'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.name AS student_name, u.username AS student_username
    FROM requests r LEFT JOIN users u ON u.id = r.student_id
    ORDER BY r.submitted_at DESC
  `).all();
  res.json({ success: true, data: rows.map(r => ({
    ...r, submittedAt: r.submitted_at, updatedAt: r.updated_at,
    studentName: r.student_name, studentUsername: r.student_username,
  }))});
});

requestsRouter.patch('/:id/status', authenticate, authorize('admin', 'hod'), (req, res) => {
  const { status, remarks } = req.body;
  const valid = ['under_review','approved','rejected'];
  if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
  const old = db.prepare('SELECT * FROM requests WHERE id=?').get(req.params.id);
  if (!old) return res.status(404).json({ success: false, message: 'Request not found' });
  const info = db.prepare(`UPDATE requests SET status=?, remarks=?, updated_at=? WHERE id=?`)
    .run(status, remarks || '', new Date().toISOString(), req.params.id);
  if (info.changes === 0) return res.status(404).json({ success: false, message: 'Request not found' });
  db.prepare(`INSERT INTO request_events (id,request_id,actor_id,status,remarks,created_at) VALUES (?,?,?,?,?,?)`)
    .run(`re${Date.now()}`, req.params.id, req.user.id, status, remarks || '', new Date().toISOString());
  notify(old.student_id, 'Request status updated', `${old.type} is now ${status.replace('_', ' ')}.`, status === 'rejected' ? 'error' : 'success');
  audit(req, 'UPDATE_REQUEST_STATUS', 'Requests', 'request', req.params.id, old, { ...old, status, remarks });
  res.json({ success: true, message: 'Status updated' });
});

requestsRouter.get('/:id/events', authenticate, (req, res) => {
  const request = db.prepare('SELECT * FROM requests WHERE id=?').get(req.params.id);
  if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
  if (req.user.role === 'student' && request.student_id !== req.user.id) return res.status(403).json({ success: false, message: 'Access Denied' });
  const events = db.prepare(`
    SELECT e.*, u.name AS actor_name
    FROM request_events e LEFT JOIN users u ON u.id = e.actor_id
    WHERE e.request_id=?
    ORDER BY e.created_at
  `).all(req.params.id);
  res.json({ success: true, data: events.map(e => ({ ...e, actorName: e.actor_name })) });
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

const notifRouter = express.Router();

notifRouter.get('/', authenticate, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json({ success: true, data: rows });
});

notifRouter.patch('/:id/read', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?').run(new Date().toISOString(), req.params.id, req.user.id);
  res.json({ success: true, message: 'Notification read' });
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

const adminRouter = express.Router();

adminRouter.get('/users', authenticate, authorize('admin'), (req, res) => {
  const users = db.prepare('SELECT id, username, name, role, email, locked, locked_until, cgpa, warning_count, probation_status, fee_block FROM users ORDER BY role, name').all();
  res.json({ success: true, data: users });
});

adminRouter.get('/audit-logs', authenticate, authorize('admin'), (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200').all();
  res.json({ success: true, data: logs });
});

adminRouter.get('/stats', authenticate, (req, res) => {
  const totalStudents     = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='student'").get().n;
  const totalCourses      = db.prepare("SELECT COUNT(*) AS n FROM courses").get().n;
  const totalRegistrations= db.prepare("SELECT COUNT(*) AS n FROM registrations").get().n;
  const pendingRequests   = db.prepare("SELECT COUNT(*) AS n FROM requests WHERE status='submitted'").get().n;
  const unpaidChallans    = db.prepare("SELECT COUNT(*) AS n FROM challans WHERE status='unpaid'").get().n;
  res.json({ success: true, data: { totalStudents, totalCourses, totalRegistrations, pendingRequests, unpaidChallans } });
});

adminRouter.get('/settings', authenticate, authorize('admin'), (req, res) => {
  const rows = db.prepare('SELECT key, value FROM system_settings ORDER BY key').all();
  res.json({ success: true, data: rows });
});

adminRouter.patch('/settings', authenticate, authorize('admin'), (req, res) => {
  const updates = req.body || {};
  for (const [key, value] of Object.entries(updates)) {
    db.prepare('INSERT OR REPLACE INTO system_settings (key,value) VALUES (?,?)').run(key, String(value));
  }
  audit(req, 'UPDATE_SETTINGS', 'Admin', 'system_settings', 'settings', null, updates);
  res.json({ success: true, message: 'Settings updated' });
});

adminRouter.post('/users/:id/reset-password', authenticate, authorize('admin'), (req, res) => {
  const user = db.prepare('SELECT id, role, username FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.role === 'student') return res.status(400).json({ success: false, message: 'Students use self-service password reset' });
  const password = req.body.password || `${user.username}123`;
  db.prepare('UPDATE users SET password=?, failed_logins=0, locked=0, locked_until=NULL WHERE id=?')
    .run(bcrypt.hashSync(password, 12), user.id);
  audit(req, 'ADMIN_PASSWORD_RESET', 'Admin', 'user', user.id, null, { username: user.username });
  res.json({ success: true, message: 'Password reset', data: { temporaryPassword: password } });
});

adminRouter.patch('/users/:id/flags', authenticate, authorize('admin'), (req, res) => {
  const old = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!old) return res.status(404).json({ success: false, message: 'User not found' });
  const { feeBlock, probationStatus, warningCount } = req.body;
  db.prepare('UPDATE users SET fee_block=?, probation_status=?, warning_count=? WHERE id=?')
    .run(feeBlock ? 1 : 0, probationStatus || old.probation_status || 'clear', Number(warningCount ?? old.warning_count ?? 0), req.params.id);
  audit(req, 'UPDATE_USER_FLAGS', 'Admin', 'user', req.params.id, old, req.body);
  res.json({ success: true, message: 'User flags updated' });
});

adminRouter.get('/health', authenticate, authorize('admin'), (req, res) => {
  const mem = process.memoryUsage();
  res.json({ success: true, data: {
    uptimeSeconds: Math.round(process.uptime()),
    memoryMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    cpuLoad: os.loadavg()[0],
    platform: `${os.platform()} ${os.release()}`,
    activeSessions: 'JWT stateless',
    diskSpace: 'Managed by Railway volume/runtime',
  }});
});

adminRouter.post('/semester/initialize', authenticate, authorize('admin'), (req, res) => {
  const { semester } = req.body;
  if (!semester) return res.status(400).json({ success: false, message: 'Semester is required' });
  db.prepare('INSERT OR REPLACE INTO system_settings (key,value) VALUES (?,?)').run('current_semester', semester);
  db.prepare("UPDATE courses SET semester_label=? WHERE approval_status='approved'").run(semester);
  audit(req, 'INITIALIZE_SEMESTER', 'Admin', 'semester', semester, null, req.body);
  res.json({ success: true, message: 'Semester initialized' });
});

// Timetable is generated from locked/approved registrations and course schedules.
const timetableRouter = express.Router();

timetableRouter.get('/my', authenticate, (req, res) => {
  const targetUser = req.user.role === 'student' ? req.user.id : null;
  const rows = db.prepare(`
    SELECT c.id, c.code, c.title, c.section, c.room, c.schedule, u.name AS instructor_name
    FROM courses c
    LEFT JOIN users u ON u.id = c.instructor
    ${targetUser ? "JOIN registrations r ON r.course_id = c.id AND r.student_id = ? AND r.status IN ('advisor_approved','hod_approved','locked')" : 'WHERE c.instructor = ?'}
    ORDER BY c.code
  `).all(targetUser || req.user.id);
  res.json({ success: true, data: rows.map(r => ({ ...r, instructorName: r.instructor_name })) });
});

timetableRouter.get('/all', authenticate, authorize('admin', 'hod'), (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, u.name AS instructor_name
    FROM courses c LEFT JOIN users u ON u.id = c.instructor
    WHERE c.approval_status='approved'
    ORDER BY c.schedule, c.code
  `).all();
  res.json({ success: true, data: rows.map(r => ({ ...r, instructorName: r.instructor_name })) });
});

// Role-aware reports and export-friendly JSON.
const reportsRouter = express.Router();

reportsRouter.get('/summary', authenticate, (req, res) => {
  const enrollment = db.prepare(`
    SELECT c.code, c.title, c.section, c.enrolled, c.capacity
    FROM courses c ORDER BY c.code
  `).all();
  const finance = db.prepare(`
    SELECT status, COUNT(*) AS count, SUM(fine + IFNULL((SELECT SUM(amount) FROM challan_items i WHERE i.challan_id = challans.id),0) - scholarship_deduction) AS total
    FROM challans GROUP BY status
  `).all();
  const grades = db.prepare(`
    SELECT c.code, AVG(CASE
      WHEN m.obtained IS NULL THEN NULL
      ELSE (m.obtained * 100.0 / a.total_marks)
    END) AS average
    FROM assessments a
    JOIN courses c ON c.id = a.course_id
    LEFT JOIN marks m ON m.assessment_id = a.id
    GROUP BY c.code
  `).all();
  const students = db.prepare(`
    SELECT username, name, cgpa, warning_count, probation_status
    FROM users WHERE role='student'
    ORDER BY cgpa DESC
  `).all();
  res.json({ success: true, data: { enrollment, finance, grades, students } });
});

reportsRouter.get('/students', authenticate, authorize('admin', 'hod'), (req, res) => {
  const { minCgpa = 0, maxCgpa = 4, probation } = req.query;
  const rows = db.prepare(`
    SELECT username, name, email, cgpa, warning_count, probation_status
    FROM users
    WHERE role='student' AND cgpa BETWEEN ? AND ?
      AND (? = '' OR probation_status = ?)
    ORDER BY cgpa DESC
  `).all(Number(minCgpa), Number(maxCgpa), probation || '', probation || '');
  res.json({ success: true, data: rows });
});

reportsRouter.get('/export/:kind', authenticate, authorize('admin', 'hod', 'finance', 'faculty'), (req, res) => {
  const kind = req.params.kind;
  const data = kind === 'finance'
    ? db.prepare('SELECT * FROM challans ORDER BY due_date DESC').all()
    : kind === 'registrations'
      ? db.prepare(`SELECT r.*, u.username, u.name, c.code, c.title FROM registrations r JOIN users u ON u.id=r.student_id JOIN courses c ON c.id=r.course_id`).all()
      : db.prepare('SELECT username, name, email, cgpa, probation_status FROM users WHERE role="student"').all();
  res.json({ success: true, data: { kind, format: 'json-export-ready', rows: data } });
});

module.exports = { feeRouter, requestsRouter, notifRouter, adminRouter, timetableRouter, reportsRouter };
