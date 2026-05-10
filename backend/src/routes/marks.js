const express = require('express');
const router  = express.Router();
const db      = require('../data/database');
const { authenticate, authorize } = require('../middleware/auth');

function gradeFromPct(pct) {
  if (pct === null) return { grade: null, gradePoints: null };
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

function assessmentStats(assessment, marks) {
  const values = marks
    .filter(m => m.obtained !== null && m.obtained !== undefined && m.obtained !== '')
    .map(m => Number(m.obtained));
  if (!values.length) return { average: null, min: null, max: null, count: 0 };
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    average: Number(average.toFixed(2)),
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
    averageAbsolute: Number(((average / assessment.total_marks) * assessment.weightage).toFixed(2)),
    minAbsolute: Number(((Math.min(...values) / assessment.total_marks) * assessment.weightage).toFixed(2)),
    maxAbsolute: Number(((Math.max(...values) / assessment.total_marks) * assessment.weightage).toFixed(2)),
  };
}

router.get('/my', authenticate, authorize('student'), (req, res) => {
  const regs = db.prepare('SELECT course_id FROM registrations WHERE student_id = ?').all(req.user.id);
  const data = regs.map(r => {
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(r.course_id);
    const assessments = db.prepare('SELECT * FROM assessments WHERE course_id = ?').all(r.course_id);
    const result = assessments.map(a => {
      const mark = db.prepare('SELECT obtained FROM marks WHERE assessment_id = ? AND student_id = ?').get(a.id, req.user.id);
      const obtained = mark?.obtained ?? null;
      const percentage = obtained !== null ? Math.round((obtained / a.total_marks) * 100) : null;
      const absolute = obtained !== null ? Number(((obtained / a.total_marks) * a.weightage).toFixed(2)) : null;
      return { ...a, totalMarks: a.total_marks, absoluteMarks: a.weightage, obtained, percentage, absolute, status: a.status };
    });
    const published = result.filter(a => a.obtained !== null);
    let overallPercentage = null;
    if (published.length) {
      const totalWeight = published.reduce((s, a) => s + a.weightage, 0);
      overallPercentage = totalWeight > 0
        ? Math.round(published.reduce((s, a) => s + (a.percentage * a.weightage), 0) / totalWeight) : null;
    }
    const { grade, gradePoints } = gradeFromPct(overallPercentage);
    const totalAbsolute = published.length ? Number(published.reduce((s, a) => s + (a.absolute || 0), 0).toFixed(2)) : null;
    return { courseId: course.id, courseCode: course.code, courseTitle: course.title, credits: course.credits, assessments: result, overallPercentage, totalAbsolute, grade, gradePoints };
  });
  res.json({ success: true, data });
});

router.get('/faculty', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const courses = db.prepare(`
    SELECT c.*, u.name AS instructor_name
    FROM courses c
    LEFT JOIN users u ON u.id = c.instructor
    WHERE (? = 'admin' OR c.instructor = ?)
    ORDER BY c.code
  `).all(req.user.role, req.user.id);

  const data = courses.map(course => {
    const assessments = db.prepare(`
      SELECT id, type, total_marks, weightage, due_date, status
      FROM assessments
      WHERE course_id = ?
      ORDER BY due_date, type
    `).all(course.id);

    const students = db.prepare(`
      SELECT u.id, u.username, u.name
      FROM registrations r
      JOIN users u ON u.id = r.student_id
      WHERE r.course_id = ? AND r.status != 'rejected'
      ORDER BY u.username
    `).all(course.id);

    const marks = db.prepare(`
      SELECT m.assessment_id, m.student_id, m.obtained
      FROM marks m
      JOIN assessments a ON a.id = m.assessment_id
      WHERE a.course_id = ?
    `).all(course.id);

    const marksByAssessment = assessments.reduce((acc, assessment) => {
      acc[assessment.id] = marks.filter(m => m.assessment_id === assessment.id);
      return acc;
    }, {});
    const byKey = Object.fromEntries(marks.map(m => [`${m.assessment_id}:${m.student_id}`, m.obtained]));

    return {
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      section: course.section,
      instructorName: course.instructor_name,
      assessments: assessments.map(a => ({
        id: a.id,
        type: a.type,
        totalMarks: a.total_marks,
        weightage: a.weightage,
        absoluteMarks: a.weightage,
        dueDate: a.due_date,
        status: a.status,
        stats: assessmentStats(a, marksByAssessment[a.id] || []),
      })),
      students: students.map(s => ({
        id: s.id,
        username: s.username,
        name: s.name,
        marks: Object.fromEntries(assessments.map(a => {
          const obtained = byKey[`${a.id}:${s.id}`] ?? '';
          const absolute = obtained === '' || obtained === null ? '' : Number(((Number(obtained) / a.total_marks) * a.weightage).toFixed(2));
          return [a.id, { obtained, absolute }];
        })),
      })),
    };
  });

  res.json({ success: true, data });
});

router.post('/assessments', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const { courseId, type, totalMarks, absoluteMarks, dueDate, status } = req.body;
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
  if (req.user.role !== 'admin' && course.instructor !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Access Denied' });
  }
  if (!type || Number(totalMarks) <= 0 || Number(absoluteMarks) <= 0) {
    return res.status(400).json({ success: false, message: 'Name, total marks, and absolutes are required' });
  }
  const id = `a${Date.now()}`;
  db.prepare(`INSERT INTO assessments (id, course_id, type, total_marks, weightage, due_date, status)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id, courseId, type.trim(), Number(totalMarks), Number(absoluteMarks), dueDate || null, status || 'published');
  res.json({ success: true, message: 'Assessment component added', data: { id } });
});

router.post('/', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const { assessmentId, studentId, obtained } = req.body;
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
  if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(assessment.course_id);
  if (req.user.role !== 'admin' && course?.instructor !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Access Denied' });
  }
  if (obtained !== '' && obtained !== null && (Number(obtained) < 0 || Number(obtained) > assessment.total_marks)) {
    return res.status(400).json({ success: false, message: `Marks must be between 0 and ${assessment.total_marks}` });
  }
  const id = `mk${Date.now()}`;
  db.prepare('INSERT OR REPLACE INTO marks (id, assessment_id, student_id, obtained) VALUES (?,?,?,?)').run(id, assessmentId, studentId, obtained === '' ? null : Number(obtained));
  res.json({ success: true, message: 'Mark saved' });
});

module.exports = router;
