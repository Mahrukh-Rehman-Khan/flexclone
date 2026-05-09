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

router.get('/my', authenticate, authorize('student'), (req, res) => {
  const regs = db.prepare('SELECT course_id FROM registrations WHERE student_id = ?').all(req.user.id);
  const data = regs.map(r => {
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(r.course_id);
    const assessments = db.prepare('SELECT * FROM assessments WHERE course_id = ?').all(r.course_id);
    const result = assessments.map(a => {
      const mark = db.prepare('SELECT obtained FROM marks WHERE assessment_id = ? AND student_id = ?').get(a.id, req.user.id);
      const obtained = mark?.obtained ?? null;
      const percentage = obtained !== null ? Math.round((obtained / a.total_marks) * 100) : null;
      return { ...a, totalMarks: a.total_marks, obtained, percentage, status: a.status };
    });
    const published = result.filter(a => a.obtained !== null);
    let overallPercentage = null;
    if (published.length) {
      const totalWeight = published.reduce((s, a) => s + a.weightage, 0);
      overallPercentage = totalWeight > 0
        ? Math.round(published.reduce((s, a) => s + (a.percentage * a.weightage), 0) / totalWeight) : null;
    }
    const { grade, gradePoints } = gradeFromPct(overallPercentage);
    return { courseId: course.id, courseCode: course.code, courseTitle: course.title, credits: course.credits, assessments: result, overallPercentage, grade, gradePoints };
  });
  res.json({ success: true, data });
});

router.post('/', authenticate, authorize('faculty', 'admin'), (req, res) => {
  const { assessmentId, studentId, obtained } = req.body;
  const id = `mk${Date.now()}`;
  db.prepare('INSERT OR REPLACE INTO marks (id, assessment_id, student_id, obtained) VALUES (?,?,?,?)').run(id, assessmentId, studentId, obtained);
  res.json({ success: true, message: 'Mark saved' });
});

module.exports = router;
