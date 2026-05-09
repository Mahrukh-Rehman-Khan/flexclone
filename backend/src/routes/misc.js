const express = require('express');
const db      = require('../data/database');
const { authenticate, authorize } = require('../middleware/auth');

// ─── FEE ─────────────────────────────────────────────────────────────────────

const feeRouter = express.Router();

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

feeRouter.patch('/:id/pay', authenticate, authorize('finance', 'admin'), (req, res) => {
  const row = db.prepare('SELECT id FROM challans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: 'Challan not found' });
  db.prepare(`UPDATE challans SET status='paid', paid_at=?, bank_ref=?, payment_method=? WHERE id=?`)
    .run(new Date().toISOString(), req.body.bankRef || `REF-${Date.now()}`, req.body.paymentMethod || 'Manual', req.params.id);
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
  const info = db.prepare(`UPDATE requests SET status=?, remarks=?, updated_at=? WHERE id=?`)
    .run(status, remarks || '', new Date().toISOString(), req.params.id);
  if (info.changes === 0) return res.status(404).json({ success: false, message: 'Request not found' });
  res.json({ success: true, message: 'Status updated' });
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

const notifRouter = express.Router();

notifRouter.get('/', authenticate, (req, res) => {
  res.json({ success: true, data: [] });
});

// ─── ADMIN ────────────────────────────────────────────────────────────────────

const adminRouter = express.Router();

adminRouter.get('/users', authenticate, authorize('admin'), (req, res) => {
  const users = db.prepare('SELECT id, username, name, role, email, locked FROM users ORDER BY role, name').all();
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

module.exports = { feeRouter, requestsRouter, notifRouter, adminRouter };
