const express = require('express');
const router  = express.Router();
const db      = require('../data/database');
const { authenticate, authorize } = require('../middleware/auth');

function getSetting(key, fallback) {
  return db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key)?.value ?? fallback;
}

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

function parseSchedule(schedule = '') {
  const [days = '', time = ''] = schedule.split(' ');
  const [start, end] = time.split('-');
  if (!start || !end) return null;
  return { days: days.split('/'), start, end };
}

function hasTimeClash(a, b) {
  const x = parseSchedule(a);
  const y = parseSchedule(b);
  if (!x || !y) return false;
  const sameDay = x.days.some(d => y.days.includes(d));
  return sameDay && x.start < y.end && y.start < x.end;
}

router.get('/', authenticate, (req, res) => {
  let courses;
  if (req.user.role === 'student') {
    const student = db.prepare('SELECT section FROM users WHERE id = ?').get(req.user.id);
    const section = student?.section || 'A';
    courses = db.prepare(`
      SELECT c.*, u.name AS instructor_name
      FROM courses c LEFT JOIN users u ON c.instructor = u.id
      WHERE c.section = ?
    `).all(section);
  } else {
    courses = db.prepare(`
      SELECT c.*, u.name AS instructor_name
      FROM courses c LEFT JOIN users u ON c.instructor = u.id
    `).all();
  }
  res.json({ success: true, data: courses.map(c => ({ ...c, instructorName: c.instructor_name, approvalStatus: c.approval_status, semesterLabel: c.semester_label })) });
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
  if (course.approval_status !== 'approved' || course.status !== 'active') return res.status(400).json({ success: false, message: 'Course offering is not active for registration' });
  if (getSetting('registration_window_open', 'true') !== 'true') return res.status(400).json({ success: false, message: 'Registration window is closed' });

  const exists = db.prepare('SELECT id FROM registrations WHERE student_id = ? AND course_id = ?').get(req.user.id, courseId);
  if (exists) return res.status(400).json({ success: false, message: 'Already registered' });
  if (course.enrolled >= course.capacity) return res.status(400).json({ success: false, message: 'Section full' });
  const student = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (getSetting('fee_block_enabled', 'true') === 'true') {
    const unpaid = db.prepare("SELECT id FROM challans WHERE student_id = ? AND status != 'paid'").get(req.user.id);
    if (student.fee_block || unpaid) return res.status(400).json({ success: false, message: 'Outstanding fee dues block registration' });
  }
  const prereqs = db.prepare('SELECT prerequisite_code FROM course_prerequisites WHERE course_id = ?').all(courseId);
  if (prereqs.length) {
    return res.status(400).json({ success: false, message: `Prerequisite not passed: ${prereqs.map(p => p.prerequisite_code).join(', ')}` });
  }
  const current = db.prepare(`
    SELECT c.* FROM registrations r JOIN courses c ON c.id = r.course_id
    WHERE r.student_id = ? AND r.status != 'rejected'
  `).all(req.user.id);
  const clash = current.find(c => hasTimeClash(c.schedule, course.schedule));
  if (clash) return res.status(400).json({ success: false, message: `Timetable conflict with ${clash.code}` });
  const selectedCredits = current.reduce((s, c) => s + (c.credits || 0), 0);
  const maxCredits = Number(student.probation_status === 'probation' ? getSetting('probation_credit_hours', '15') : getSetting('max_credit_hours', '21'));
  if (selectedCredits + (course.credits || 0) > maxCredits) return res.status(400).json({ success: false, message: `Credit limit exceeded (${maxCredits} max)` });

  const id = `r${Date.now()}`;
  db.prepare('INSERT INTO registrations (id,student_id,course_id,semester,status,submitted_at) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, courseId, getSetting('current_semester', 'Spring 2025'), 'submitted', new Date().toISOString());
  db.prepare('UPDATE courses SET enrolled = enrolled + 1 WHERE id = ?').run(courseId);

  // Auto-generate fee challan for this course registration
  const feePerCredit = Number(getSetting('fee_per_credit', '3500'));
  const courseAmt    = (course.credits || 3) * feePerCredit;
  const challanId    = `ch${Date.now()}`;
  const dueDate      = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const semester     = getSetting('current_semester', 'Spring 2025');
  db.prepare('INSERT INTO challans (id,student_id,semester,status,due_date,fine,scholarship_deduction) VALUES (?,?,?,?,?,?,?)')
    .run(challanId, req.user.id, semester, 'unpaid', dueDate, 0, 0);
  db.prepare('INSERT INTO challan_items (id,challan_id,label,amount) VALUES (?,?,?,?)')
    .run(`${challanId}_item`, challanId, `Course Fee — ${course.code}: ${course.title} (${course.credits} cr)`, courseAmt);
  notify(req.user.id, 'Fee challan generated', `PKR ${courseAmt.toLocaleString()} due for ${course.code} by ${dueDate}.`, 'info');

  notify(req.user.id, 'Registration submitted', `${course.code} is pending advisor approval.`, 'success');
  audit(req, 'REGISTER_COURSE', 'Courses', 'registration', id, null, { courseId });
  res.json({ success: true, message: 'Registration submitted', data: { id } });
});

router.delete('/register/:courseId', authenticate, authorize('student'), (req, res) => {
  const reg = db.prepare('SELECT * FROM registrations WHERE student_id = ? AND course_id = ?').get(req.user.id, req.params.courseId);
  if (!reg) return res.status(404).json({ success: false, message: 'Not registered' });
  if (reg.status === 'locked') return res.status(400).json({ success: false, message: 'Registration is locked' });
  if (new Date().toISOString().slice(0, 10) > getSetting('drop_deadline', '2025-03-15')) return res.status(400).json({ success: false, message: 'Drop deadline has passed' });
  db.prepare('DELETE FROM registrations WHERE id = ?').run(reg.id);
  db.prepare('UPDATE courses SET enrolled = MAX(0, enrolled - 1) WHERE id = ?').run(req.params.courseId);
  audit(req, 'DROP_COURSE', 'Courses', 'registration', reg.id, reg, null);
  res.json({ success: true, message: 'Course dropped' });
});

router.get('/approvals', authenticate, authorize('faculty', 'hod', 'admin'), (req, res) => {
  const rows = req.user.role === 'faculty'
    ? db.prepare(`
        SELECT r.*, s.name AS student_name, s.username AS student_username, c.code, c.title, c.credits, c.schedule
        FROM registrations r
        JOIN users s ON s.id = r.student_id
        JOIN courses c ON c.id = r.course_id
        WHERE r.status IN ('submitted','advisor_approved','hod_approved')
          AND c.instructor = ?
        ORDER BY r.submitted_at DESC
      `).all(req.user.id)
    : db.prepare(`
        SELECT r.*, s.name AS student_name, s.username AS student_username, c.code, c.title, c.credits, c.schedule
        FROM registrations r
        JOIN users s ON s.id = r.student_id
        JOIN courses c ON c.id = r.course_id
        WHERE r.status IN ('submitted','advisor_approved','hod_approved')
        ORDER BY r.submitted_at DESC
      `).all();
  res.json({ success: true, data: rows.map(r => ({ ...r, studentName: r.student_name, studentUsername: r.student_username })) });
});

router.patch('/registrations/:id/status', authenticate, authorize('faculty', 'hod', 'admin'), (req, res) => {
  const { status, remarks } = req.body;
  const valid = ['advisor_approved', 'hod_approved', 'locked', 'rejected'];
  if (!valid.includes(status)) return res.status(400).json({ success: false, message: 'Invalid registration status' });
  const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);
  if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
  if (status === 'advisor_approved' && !['faculty','admin'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Advisor approval requires faculty/admin role' });
  if ((status === 'hod_approved' || status === 'locked') && !['hod','admin'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'HOD approval requires HOD/admin role' });
  const finalStatus = status === 'hod_approved' && getSetting('hod_approval_required', 'true') === 'true' ? 'locked' : status;
  db.prepare(`UPDATE registrations SET status=?, remarks=?, advisor_id=COALESCE(advisor_id, ?),
              hod_id=CASE WHEN ? IN ('hod_approved','locked') THEN ? ELSE hod_id END,
              approved_at=CASE WHEN ? IN ('hod_approved','locked') THEN ? ELSE approved_at END
              WHERE id=?`)
    .run(finalStatus, remarks || '', req.user.id, status, req.user.id, status, new Date().toISOString(), req.params.id);
  const updated = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);
  notify(reg.student_id, 'Registration updated', `Your registration is now ${finalStatus.replace('_', ' ')}.`, finalStatus === 'rejected' ? 'error' : 'success');
  audit(req, 'UPDATE_REGISTRATION_STATUS', 'Courses', 'registration', req.params.id, reg, updated);
  res.json({ success: true, message: 'Registration updated' });
});

router.post('/', authenticate, authorize('admin'), (req, res) => {
  const { code, title, credits, instructor, section, room, schedule, capacity, program, batch } = req.body;
  if (!code || !title) return res.status(400).json({ success: false, message: 'Course code and title are required' });
  const id = `c${Date.now()}`;
  db.prepare(`INSERT INTO courses (id,code,title,credits,instructor,section,room,schedule,capacity,enrolled,status,program,batch,semester_label,approval_status)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, code, title, Number(credits) || 3, instructor || null, section || 'A', room || '', schedule || '', Number(capacity) || 40,
      0, 'active', program || 'BSCS', batch || null, getSetting('current_semester', 'Spring 2025'), 'pending_hod');
  audit(req, 'CREATE_COURSE_OFFERING', 'Courses', 'course', id, null, req.body);
  res.json({ success: true, message: 'Course offering created for HOD approval', data: { id } });
});

router.patch('/:id', authenticate, authorize('admin', 'hod'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  const { code, title, credits, instructor, section, room, schedule, capacity, program, batch } = req.body;
  db.prepare(`UPDATE courses SET
    code      = COALESCE(?, code),
    title     = COALESCE(?, title),
    credits   = COALESCE(?, credits),
    instructor= COALESCE(?, instructor),
    section   = COALESCE(?, section),
    room      = COALESCE(?, room),
    schedule  = COALESCE(?, schedule),
    capacity  = COALESCE(?, capacity),
    program   = COALESCE(?, program),
    batch     = COALESCE(?, batch)
    WHERE id  = ?`)
    .run(code || null, title || null, credits ? Number(credits) : null,
      instructor || null, section || null, room || null, schedule || null,
      capacity ? Number(capacity) : null, program || null, batch || null,
      req.params.id);
  audit(req, 'EDIT_COURSE', 'Courses', 'course', req.params.id, course, req.body);
  res.json({ success: true, message: 'Course updated' });
});

router.patch('/:id/approve', authenticate, authorize('hod', 'admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  db.prepare(`UPDATE courses SET approval_status='approved', approved_by=?, approved_at=? WHERE id=?`)
    .run(req.user.id, new Date().toISOString(), req.params.id);
  audit(req, 'APPROVE_COURSE_OFFERING', 'Courses', 'course', req.params.id, course, { ...course, approval_status: 'approved' });
  res.json({ success: true, message: 'Course offering approved' });
});

module.exports = router;
