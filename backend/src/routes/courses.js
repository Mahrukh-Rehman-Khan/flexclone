const express = require('express');
const router  = express.Router();
const db      = require('../data/database');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, (req, res) => {
  const courses = db.prepare(`
    SELECT c.*, u.name AS instructor_name
    FROM courses c LEFT JOIN users u ON c.instructor = u.id
  `).all();
  res.json({ success: true, data: courses.map(c => ({ ...c, instructorName: c.instructor_name })) });
});

router.get('/my', authenticate, authorize('student'), (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, r.status AS registration_status, r.id AS registration_id, u.name AS instructor_name
    FROM registrations r
    JOIN courses c ON r.course_id = c.id
    LEFT JOIN users u ON c.instructor = u.id
    WHERE r.student_id = ?
  `).all(req.user.id);
  res.json({ success: true, data: rows.map(r => ({ ...r, registrationStatus: r.registration_status, instructorName: r.instructor_name })) });
});

router.post('/register', authenticate, authorize('student'), (req, res) => {
  const { courseId } = req.body;
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

  const exists = db.prepare('SELECT id FROM registrations WHERE student_id = ? AND course_id = ?').get(req.user.id, courseId);
  if (exists) return res.status(400).json({ success: false, message: 'Already registered' });
  if (course.enrolled >= course.capacity) return res.status(400).json({ success: false, message: 'Section full' });

  const id = `r${Date.now()}`;
  db.prepare('INSERT INTO registrations (id,student_id,course_id,semester,status,submitted_at) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, courseId, '2025-Spring', 'submitted', new Date().toISOString());
  db.prepare('UPDATE courses SET enrolled = enrolled + 1 WHERE id = ?').run(courseId);
  res.json({ success: true, message: 'Registration submitted', data: { id } });
});

router.delete('/register/:courseId', authenticate, authorize('student'), (req, res) => {
  const reg = db.prepare('SELECT * FROM registrations WHERE student_id = ? AND course_id = ?').get(req.user.id, req.params.courseId);
  if (!reg) return res.status(404).json({ success: false, message: 'Not registered' });
  if (reg.status === 'locked') return res.status(400).json({ success: false, message: 'Registration is locked' });
  db.prepare('DELETE FROM registrations WHERE id = ?').run(reg.id);
  db.prepare('UPDATE courses SET enrolled = MAX(0, enrolled - 1) WHERE id = ?').run(req.params.courseId);
  res.json({ success: true, message: 'Course dropped' });
});

module.exports = router;
