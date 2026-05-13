const express = require('express');
const router  = express.Router();
const db      = require('../data/database');
const { authenticate, authorize } = require('../middleware/auth');

function gradeFromPct(pct) {
  if (pct === null || pct === undefined) return { grade: null, gradePoints: null };
  if (pct >= 90) return { grade: 'A',  gradePoints: 4.0 };
  if (pct >= 85) return { grade: 'A-', gradePoints: 3.7 };
  if (pct >= 80) return { grade: 'B+', gradePoints: 3.3 };
  if (pct >= 75) return { grade: 'B',  gradePoints: 3.0 };
  if (pct >= 70) return { grade: 'B-', gradePoints: 2.7 };
  if (pct >= 65) return { grade: 'C+', gradePoints: 2.3 };
  if (pct >= 60) return { grade: 'C',  gradePoints: 2.0 };
  if (pct >= 55) return { grade: 'C-', gradePoints: 1.7 };
  if (pct >= 50) return { grade: 'D',  gradePoints: 1.0 };
  return { grade: 'F', gradePoints: 0.0 };
}

// ── Student: GET /marks/my ────────────────────────────────────────────────────
router.get('/my', authenticate, authorize('student'), (req, res) => {
  const regs = db.prepare(
    "SELECT course_id FROM registrations WHERE student_id = ? AND status != 'rejected'"
  ).all(req.user.id);

  const data = regs.map(r => {
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(r.course_id);
    if (!course) return null;

    const groups        = db.prepare('SELECT * FROM assessment_groups WHERE course_id = ?').all(r.course_id);
    const totalWeightage = Number(groups.reduce((s, g) => s + g.weightage, 0).toFixed(2));
    const complete       = Math.abs(totalWeightage - 100) < 0.01;

    const groupsWithData = groups.map(group => {
      const components = db.prepare('SELECT * FROM assessment_components WHERE group_id = ?').all(group.id);
      const compsWithMarks = components.map(comp => {
        const mark     = db.prepare('SELECT obtained FROM component_marks WHERE component_id = ? AND student_id = ?').get(comp.id, req.user.id);
        const obtained = mark?.obtained ?? null;
        const pct      = obtained !== null ? Math.round((obtained / comp.total_marks) * 100) : null;
        return { ...comp, obtained, pct };
      });

      const entered  = compsWithMarks.filter(c => c.obtained !== null);
      let groupAbs   = null;
      if (entered.length > 0) {
        const sumObt   = entered.reduce((x, c) => x + c.obtained, 0);
        const sumTotal = entered.reduce((x, c) => x + c.total_marks, 0);
        groupAbs = Number(((sumObt / sumTotal) * group.weightage).toFixed(2));
      }
      return { ...group, components: compsWithMarks, groupAbs };
    });

    const totalAbsolutes = Number(groupsWithData.reduce((s, g) => s + (g.groupAbs || 0), 0).toFixed(2));
    const { grade, gradePoints } = complete ? gradeFromPct(totalAbsolutes) : { grade: null, gradePoints: null };

    return {
      courseId: course.id, courseCode: course.code, courseTitle: course.title,
      credits: course.credits, totalWeightage, complete, grade, gradePoints,
      totalAbsolutes, groups: groupsWithData,
    };
  }).filter(Boolean);

  res.json({ success: true, data });
});

// ── Faculty: GET /marks/faculty-courses ──────────────────────────────────────
router.get('/faculty-courses', authenticate, authorize('faculty', 'admin', 'hod'), (req, res) => {
  const courses = db.prepare(`
    SELECT id, code, section FROM courses
    WHERE (? IN ('admin','hod') OR instructor = ?) AND status = 'active'
    ORDER BY code
  `).all(req.user.role, req.user.id);
  res.json({ success: true, data: courses });
});

// ── Faculty: GET /marks/course/:courseId ─────────────────────────────────────
router.get('/course/:courseId', authenticate, authorize('faculty', 'admin', 'hod'), (req, res) => {
  const { courseId } = req.params;
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  if (!['admin','hod'].includes(req.user.role) && course.instructor !== req.user.id)
    return res.status(403).json({ success: false, message: 'Access denied' });

  const groups         = db.prepare('SELECT * FROM assessment_groups WHERE course_id = ?').all(courseId);
  const totalWeightage = Number(groups.reduce((s, g) => s + g.weightage, 0).toFixed(2));

  const students = db.prepare(`
    SELECT u.id, u.username, u.name
    FROM registrations r JOIN users u ON u.id = r.student_id
    WHERE r.course_id = ? AND r.status != 'rejected'
    ORDER BY u.username
  `).all(courseId);

  const groupsWithComponents = groups.map(group => {
    const components = db.prepare('SELECT * FROM assessment_components WHERE group_id = ?').all(group.id);
    const compsWithMarks = components.map(comp => {
      const rows = db.prepare('SELECT student_id, obtained FROM component_marks WHERE component_id = ?').all(comp.id);
      const marks = {};
      rows.forEach(m => { marks[m.student_id] = m.obtained; });
      return { ...comp, marks };
    });
    return { ...group, components: compsWithMarks };
  });

  res.json({
    success: true,
    data: { courseId: course.id, courseCode: course.code, courseTitle: course.title, totalWeightage, groups: groupsWithComponents, students },
  });
});

// ── Faculty: POST /marks/groups ───────────────────────────────────────────────
router.post('/groups', authenticate, authorize('faculty', 'admin', 'hod'), (req, res) => {
  const { courseId, category, label, weightage } = req.body;
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  if (!['admin','hod'].includes(req.user.role) && course.instructor !== req.user.id)
    return res.status(403).json({ success: false, message: 'Access denied' });

  const row  = db.prepare('SELECT SUM(weightage) as total FROM assessment_groups WHERE course_id = ?').get(courseId);
  const used = row?.total || 0;
  if (used + weightage > 100.01)
    return res.status(400).json({ success: false, message: `Cannot exceed 100 absolutes (${used} already assigned).` });

  const id = `ag${Date.now()}`;
  db.prepare('INSERT INTO assessment_groups (id, course_id, category, label, weightage) VALUES (?,?,?,?,?)').run(id, courseId, category, label, weightage);
  res.json({ success: true, id });
});

// ── Faculty: PATCH /marks/groups/:id ─────────────────────────────────────────
router.patch('/groups/:id', authenticate, authorize('faculty', 'admin', 'hod'), (req, res) => {
  const { label, weightage } = req.body;
  const group = db.prepare(`
    SELECT ag.*, c.instructor FROM assessment_groups ag
    JOIN courses c ON c.id = ag.course_id WHERE ag.id = ?
  `).get(req.params.id);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
  if (!['admin','hod'].includes(req.user.role) && group.instructor !== req.user.id)
    return res.status(403).json({ success: false, message: 'Access denied' });

  const row        = db.prepare('SELECT SUM(weightage) as total FROM assessment_groups WHERE course_id = ? AND id != ?').get(group.course_id, req.params.id);
  const otherTotal = row?.total || 0;
  if (otherTotal + weightage > 100.01)
    return res.status(400).json({ success: false, message: 'Cannot exceed 100 absolutes.' });

  db.prepare('UPDATE assessment_groups SET label = ?, weightage = ? WHERE id = ?').run(label, weightage, req.params.id);
  res.json({ success: true });
});

// ── Faculty: DELETE /marks/groups/:id ────────────────────────────────────────
router.delete('/groups/:id', authenticate, authorize('faculty', 'admin', 'hod'), (req, res) => {
  const group = db.prepare(`
    SELECT ag.*, c.instructor FROM assessment_groups ag
    JOIN courses c ON c.id = ag.course_id WHERE ag.id = ?
  `).get(req.params.id);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
  if (!['admin','hod'].includes(req.user.role) && group.instructor !== req.user.id)
    return res.status(403).json({ success: false, message: 'Access denied' });

  const comps = db.prepare('SELECT id FROM assessment_components WHERE group_id = ?').all(req.params.id);
  comps.forEach(c => {
    db.prepare('DELETE FROM component_marks WHERE component_id = ?').run(c.id);
    db.prepare('DELETE FROM assessment_components WHERE id = ?').run(c.id);
  });
  db.prepare('DELETE FROM assessment_groups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Faculty: POST /marks/components ──────────────────────────────────────────
router.post('/components', authenticate, authorize('faculty', 'admin', 'hod'), (req, res) => {
  const { groupId, label, totalMarks } = req.body;
  const group = db.prepare(`
    SELECT ag.*, c.instructor FROM assessment_groups ag
    JOIN courses c ON c.id = ag.course_id WHERE ag.id = ?
  `).get(groupId);
  if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
  if (!['admin','hod'].includes(req.user.role) && group.instructor !== req.user.id)
    return res.status(403).json({ success: false, message: 'Access denied' });

  const id = `ac${Date.now()}`;
  db.prepare('INSERT INTO assessment_components (id, group_id, label, total_marks) VALUES (?,?,?,?)').run(id, groupId, label, totalMarks);
  res.json({ success: true, id });
});

// ── Faculty: PATCH /marks/components/:id ─────────────────────────────────────
router.patch('/components/:id', authenticate, authorize('faculty', 'admin', 'hod'), (req, res) => {
  const { label, totalMarks } = req.body;
  const comp = db.prepare(`
    SELECT ac.*, c.instructor FROM assessment_components ac
    JOIN assessment_groups ag ON ag.id = ac.group_id
    JOIN courses c ON c.id = ag.course_id WHERE ac.id = ?
  `).get(req.params.id);
  if (!comp) return res.status(404).json({ success: false, message: 'Component not found' });
  if (!['admin','hod'].includes(req.user.role) && comp.instructor !== req.user.id)
    return res.status(403).json({ success: false, message: 'Access denied' });

  db.prepare('UPDATE assessment_components SET label = ?, total_marks = ? WHERE id = ?').run(label, totalMarks, req.params.id);
  res.json({ success: true });
});

// ── Faculty: DELETE /marks/components/:id ────────────────────────────────────
router.delete('/components/:id', authenticate, authorize('faculty', 'admin', 'hod'), (req, res) => {
  const comp = db.prepare(`
    SELECT ac.*, c.instructor FROM assessment_components ac
    JOIN assessment_groups ag ON ag.id = ac.group_id
    JOIN courses c ON c.id = ag.course_id WHERE ac.id = ?
  `).get(req.params.id);
  if (!comp) return res.status(404).json({ success: false, message: 'Component not found' });
  if (!['admin','hod'].includes(req.user.role) && comp.instructor !== req.user.id)
    return res.status(403).json({ success: false, message: 'Access denied' });

  db.prepare('DELETE FROM component_marks WHERE component_id = ?').run(req.params.id);
  db.prepare('DELETE FROM assessment_components WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Faculty: POST /marks/components/:id/marks ────────────────────────────────
router.post('/components/:id/marks', authenticate, authorize('faculty', 'admin', 'hod'), (req, res) => {
  const { marks } = req.body;
  const comp = db.prepare(`
    SELECT ac.*, c.instructor FROM assessment_components ac
    JOIN assessment_groups ag ON ag.id = ac.group_id
    JOIN courses c ON c.id = ag.course_id WHERE ac.id = ?
  `).get(req.params.id);
  if (!comp) return res.status(404).json({ success: false, message: 'Component not found' });
  if (!['admin','hod'].includes(req.user.role) && comp.instructor !== req.user.id)
    return res.status(403).json({ success: false, message: 'Access denied' });

  for (const [studentId, obtained] of Object.entries(marks)) {
    const val = (obtained === '' || obtained === null || obtained === undefined) ? null : Number(obtained);
    if (val !== null && (val < 0 || val > comp.total_marks))
      return res.status(400).json({ success: false, message: `Mark ${val} exceeds total ${comp.total_marks} for ${comp.label}` });
    const id = `cm${Date.now()}_${studentId}`;
    db.prepare('INSERT OR REPLACE INTO component_marks (id, component_id, student_id, obtained) VALUES (?,?,?,?)').run(id, req.params.id, studentId, val);
  }
  res.json({ success: true });
});

module.exports = router;
