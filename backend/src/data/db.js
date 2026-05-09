// FLEX UMS — In-Memory Mock Database
const bcrypt = require('bcryptjs');

const HASH = (p) => bcrypt.hashSync(p, 6);

const STUDENT_PWD = HASH('student123');
const FACULTY_PWD = HASH('faculty123');
const ADMIN_PWD   = HASH('admin123');
const HOD_PWD     = HASH('hod123');
const FINANCE_PWD = HASH('finance123');

// ── Absence counts from the attendance sheet (column A) ───────────────────────
// Each unit = 1.5 lecture-hours. We convert to whole absences by dividing by 1.5.
// These are seeded as historical absent records across past dates.
const ABSENCES = {
  's001': 25,  // 37.5 / 1.5
  's002': 6,   // 9
  's003': 2,   // 3
  's004': 5,   // 7.5
  's005': 8,   // 12
  's006': 5,   // 7.5
  's007': 3,   // 4.5
  's008': 1,   // 1.5
  's009': 3,   // 4.5
  's010': 3,   // 4.5
  's011': 6,   // 9
  's012': 0,   // 0
  's013': 4,   // 6
  's014': 2,   // 3
  's015': 2,   // 3
  's016': 1,   // 1.5
  's017': 5,   // 7.5
  's018': 5,   // 7.5
  's019': 2,   // 3
  's020': 2,   // 3
  's021': 3,   // 4.5
  's022': 1,   // 1.5
  's023': 3,   // 4.5
  's024': 1,   // 1.5
  's025': 1,   // 1.5
  's026': 2,   // 3
  's027': 1,   // 1.5
  's028': 2,   // 3
  's029': 1,   // 1.5
  's030': 0,   // 0
  's031': 3,   // 4.5
  's032': 2,   // 3
  's033': 2,   // 3
  's034': 2,   // 3
  's035': 2,   // 3
  's036': 4,   // 6
  's037': 1,   // 1.5
  's038': 4,   // 6
  's039': 2,   // 3
  's040': 2,   // 3
  's041': 2,   // 3
};

// Generate past attendance dates (Mon/Wed pattern, going back enough weeks)
function generatePastDates(totalLectures) {
  const dates = [];
  const d = new Date('2026-04-30'); // end date
  while (dates.length < totalLectures) {
    const dow = d.getDay();
    if (dow === 1 || dow === 3) { // Mon or Wed
      dates.unshift(d.toISOString().slice(0, 10));
    }
    d.setDate(d.getDate() - 1);
  }
  return dates;
}

// Build attendance object for a given course from absence counts
function buildAttendance(courseStudentIds) {
  const maxAbsences = Math.max(...courseStudentIds.map(sid => ABSENCES[sid] || 0));
  const totalLectures = maxAbsences + 10; // always have more lectures than max absences
  const dates = generatePastDates(totalLectures);

  const attendance = {};
  dates.forEach(date => { attendance[date] = {}; });

  // For each student, distribute their absences across the earliest dates
  courseStudentIds.forEach(sid => {
    const absCount = ABSENCES[sid] || 0;
    dates.forEach((date, idx) => {
      attendance[date][sid] = idx < absCount ? 'A' : 'P';
    });
  });

  return attendance;
}

const STUDENT_IDS = [
  's001','s002','s003','s004','s005','s006','s007','s008','s009','s010',
  's011','s012','s013','s014','s015','s016','s017','s018','s019','s020',
  's021','s022','s023','s024','s025','s026','s027','s028','s029','s030',
  's031','s032','s033','s034','s035','s036','s037','s038','s039','s040',
  's041',
];

const db = {
  users: [
    // ── Staff ──────────────────────────────────────────────────────────────
    { id: 'u002', username: 'f001',     password: FACULTY_PWD, role: 'faculty', name: 'Dr. Ayesha Khan',     email: 'ayesha@nu.edu.pk',  department: 'CS', failedLogins: 0, locked: false },
    { id: 'u003', username: 'admin001', password: ADMIN_PWD,   role: 'admin',   name: 'Rao Usman',           email: 'admin@nu.edu.pk',   failedLogins: 0, locked: false },
    { id: 'u004', username: 'hod001',   password: HOD_PWD,     role: 'hod',     name: 'Prof. Tariq Mehmood', email: 'hod@nu.edu.pk',     department: 'CS', failedLogins: 0, locked: false },
    { id: 'u005', username: 'fin001',   password: FINANCE_PWD, role: 'finance', name: 'Sana Malik',          email: 'finance@nu.edu.pk', failedLogins: 0, locked: false },

    // ── Students (41) — Section BCS-4B ─────────────────────────────────────
    { id: 's001', username: '23L-3007', password: STUDENT_PWD, role: 'student', name: 'Muhammad Abdullah Haider',  email: '23l3007@lhr.nu.edu.pk', program: 'BSCS', batch: '2023', semester: 3, cgpa: 3.50, failedLogins: 0, locked: false },
    { id: 's002', username: '23L-3077', password: STUDENT_PWD, role: 'student', name: 'Muhammad Manan',            email: '23l3077@lhr.nu.edu.pk', program: 'BSCS', batch: '2023', semester: 3, cgpa: 3.20, failedLogins: 0, locked: false },
    { id: 's003', username: '23L-3094', password: STUDENT_PWD, role: 'student', name: 'Muhammad Ahmad',            email: '23l3094@lhr.nu.edu.pk', program: 'BSCS', batch: '2023', semester: 3, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's004', username: '23L-3097', password: STUDENT_PWD, role: 'student', name: 'Abdul Muiz',                email: '23l3097@lhr.nu.edu.pk', program: 'BSCS', batch: '2023', semester: 3, cgpa: 3.30, failedLogins: 0, locked: false },
    { id: 's005', username: '23L-3102', password: STUDENT_PWD, role: 'student', name: 'Muhammad Hassan',           email: '23l3102@lhr.nu.edu.pk', program: 'BSCS', batch: '2023', semester: 3, cgpa: 3.60, failedLogins: 0, locked: false },
    { id: 's006', username: '24I-3023', password: STUDENT_PWD, role: 'student', name: 'Ali Saad',                  email: '24i3023@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.30, failedLogins: 0, locked: false },
    { id: 's007', username: '24I-3078', password: STUDENT_PWD, role: 'student', name: 'Muhammad Umar Ashraf',      email: '24i3078@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.00, failedLogins: 0, locked: false },
    { id: 's008', username: '24L-2551', password: STUDENT_PWD, role: 'student', name: 'Hamna Faisal',              email: '24l2551@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.90, failedLogins: 0, locked: false },
    { id: 's009', username: '24L-3003', password: STUDENT_PWD, role: 'student', name: 'Adina Saqib',               email: '24l3003@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.40, failedLogins: 0, locked: false },
    { id: 's010', username: '24L-3008', password: STUDENT_PWD, role: 'student', name: 'Eman Fatima',               email: '24l3008@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.40, failedLogins: 0, locked: false },
    { id: 's011', username: '24L-3010', password: STUDENT_PWD, role: 'student', name: 'Ahmad Abrar',               email: '24l3010@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.50, failedLogins: 0, locked: false },
    { id: 's012', username: '24L-3011', password: STUDENT_PWD, role: 'student', name: 'Muhammad Moiz Dil',         email: '24l3011@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.80, failedLogins: 0, locked: false },
    { id: 's013', username: '24L-3012', password: STUDENT_PWD, role: 'student', name: 'Abdul Moez',                email: '24l3012@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.20, failedLogins: 0, locked: false },
    { id: 's014', username: '24L-3018', password: STUDENT_PWD, role: 'student', name: 'Muhammad Talha Hamid',      email: '24l3018@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's015', username: '24L-3027', password: STUDENT_PWD, role: 'student', name: 'Fatima Kamran',             email: '24l3027@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's016', username: '24L-3031', password: STUDENT_PWD, role: 'student', name: 'Ahmed Akhtar',              email: '24l3031@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.90, failedLogins: 0, locked: false },
    { id: 's017', username: '24L-3034', password: STUDENT_PWD, role: 'student', name: 'Muhammad Hammad Mushtaq',   email: '24l3034@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.50, failedLogins: 0, locked: false },
    { id: 's018', username: '24L-3035', password: STUDENT_PWD, role: 'student', name: 'Muhammad Waleed',           email: '24l3035@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.50, failedLogins: 0, locked: false },
    { id: 's019', username: '24L-3036', password: STUDENT_PWD, role: 'student', name: 'Bilal Kashif',              email: '24l3036@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's020', username: '24L-3037', password: STUDENT_PWD, role: 'student', name: 'Mahrukh Rehman',            email: '24l3037@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's021', username: '24L-3049', password: STUDENT_PWD, role: 'student', name: 'Ahmad Ali Khan',            email: '24l3049@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.40, failedLogins: 0, locked: false },
    { id: 's022', username: '24L-3050', password: STUDENT_PWD, role: 'student', name: 'Saad Mehmood Athar',        email: '24l3050@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.90, failedLogins: 0, locked: false },
    { id: 's023', username: '24L-3051', password: STUDENT_PWD, role: 'student', name: 'Mustafa Salman Ahmed',      email: '24l3051@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.40, failedLogins: 0, locked: false },
    { id: 's024', username: '24L-3052', password: STUDENT_PWD, role: 'student', name: 'Ramsha Khalid',             email: '24l3052@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.90, failedLogins: 0, locked: false },
    { id: 's025', username: '24L-3054', password: STUDENT_PWD, role: 'student', name: 'Muhammad Hanzala Siddique', email: '24l3054@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.90, failedLogins: 0, locked: false },
    { id: 's026', username: '24L-3057', password: STUDENT_PWD, role: 'student', name: 'Muhammad Shahzaib Zia',     email: '24l3057@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's027', username: '24L-3060', password: STUDENT_PWD, role: 'student', name: 'Muhammad Moeed Amir',       email: '24l3060@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.90, failedLogins: 0, locked: false },
    { id: 's028', username: '24L-3061', password: STUDENT_PWD, role: 'student', name: 'Abdullah Tahir',            email: '24l3061@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's029', username: '24L-3067', password: STUDENT_PWD, role: 'student', name: 'Sheikh Muhammad Ammar Arif',email: '24l3067@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.90, failedLogins: 0, locked: false },
    { id: 's030', username: '24L-3068', password: STUDENT_PWD, role: 'student', name: 'Zuhar Faisal',              email: '24l3068@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.80, failedLogins: 0, locked: false },
    { id: 's031', username: '24L-3072', password: STUDENT_PWD, role: 'student', name: 'Suleman Ahmed',             email: '24l3072@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.40, failedLogins: 0, locked: false },
    { id: 's032', username: '24L-3078', password: STUDENT_PWD, role: 'student', name: 'Zainab Sharif',             email: '24l3078@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's033', username: '24L-3079', password: STUDENT_PWD, role: 'student', name: 'Maryam Bint E Ashfaq',      email: '24l3079@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's034', username: '24L-3081', password: STUDENT_PWD, role: 'student', name: 'Shahzaib Saeed',            email: '24l3081@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's035', username: '24L-3083', password: STUDENT_PWD, role: 'student', name: 'Areeba Iqbal',              email: '24l3083@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's036', username: '24L-3088', password: STUDENT_PWD, role: 'student', name: 'Kashif Abbas',              email: '24l3088@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.30, failedLogins: 0, locked: false },
    { id: 's037', username: '24L-3089', password: STUDENT_PWD, role: 'student', name: 'Asadullah Nasir',           email: '24l3089@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 2.90, failedLogins: 0, locked: false },
    { id: 's038', username: '24L-3090', password: STUDENT_PWD, role: 'student', name: 'Bilal Ahmad',               email: '24l3090@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.30, failedLogins: 0, locked: false },
    { id: 's039', username: '24L-3093', password: STUDENT_PWD, role: 'student', name: 'Rabia',                     email: '24l3093@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's040', username: '24L-3096', password: STUDENT_PWD, role: 'student', name: 'Anoosha Rizwan Vohra',       email: '24l3096@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
    { id: 's041', username: '24L-3097', password: STUDENT_PWD, role: 'student', name: 'Manumha Nadeem',             email: '24l3097@lhr.nu.edu.pk', program: 'BSCS', batch: '2024', semester: 2, cgpa: 3.10, failedLogins: 0, locked: false },
  ],

  courses: [
    { id: 'c001', code: 'CS-301', title: 'Database Systems',        credits: 3, instructor: 'u002', section: 'B', room: 'CS-201', schedule: 'Mon/Wed 09:00-10:30', enrolled: 41, capacity: 45, prerequisites: ['CS-201'], status: 'active' },
    { id: 'c002', code: 'CS-302', title: 'Software Engineering',    credits: 3, instructor: 'u002', section: 'B', room: 'CS-301', schedule: 'Tue/Thu 11:00-12:30', enrolled: 41, capacity: 45, prerequisites: [], status: 'active' },
    { id: 'c003', code: 'CS-303', title: 'Computer Networks',       credits: 3, instructor: 'u002', section: 'B', room: 'CS-105', schedule: 'Mon/Wed 13:00-14:30', enrolled: 41, capacity: 45, prerequisites: ['CS-201'], status: 'active' },
    { id: 'c004', code: 'CS-304', title: 'Operating Systems',       credits: 3, instructor: 'u002', section: 'B', room: 'CS-102', schedule: 'Fri 09:00-12:00',     enrolled: 41, capacity: 45, prerequisites: [], status: 'active' },
    { id: 'c005', code: 'CS-305', title: 'Artificial Intelligence', credits: 3, instructor: 'u002', section: 'B', room: 'CS-205', schedule: 'Tue/Thu 14:00-15:30', enrolled: 41, capacity: 45, prerequisites: ['CS-201', 'MATH-201'], status: 'active' },
  ],

  registrations: [
    ...STUDENT_IDS.flatMap((sid, i) =>
      ['c001','c002','c003','c004','c005'].map((cid, j) => ({
        id: `r${String(i * 5 + j + 1).padStart(4, '0')}`,
        studentId: sid, courseId: cid,
        semester: '2024-Spring', status: 'locked',
        submittedAt: '2024-01-10', approvedAt: '2024-01-12',
      }))
    ),
  ],

  // Seeded from attendance sheet — all 5 courses get the same historical record
  attendance: {
    'c001': buildAttendance(STUDENT_IDS),
    'c002': buildAttendance(STUDENT_IDS),
    'c003': buildAttendance(STUDENT_IDS),
    'c004': buildAttendance(STUDENT_IDS),
    'c005': buildAttendance(STUDENT_IDS),
  },

  assessments: [
    { id: 'a001', courseId: 'c001', type: 'Quiz 1',       totalMarks: 10, weightage: 5,  dueDate: '2024-02-15' },
    { id: 'a002', courseId: 'c001', type: 'Assignment 1', totalMarks: 20, weightage: 10, dueDate: '2024-03-01' },
    { id: 'a003', courseId: 'c001', type: 'Mid Exam',     totalMarks: 30, weightage: 30, dueDate: '2024-03-20' },
    { id: 'a004', courseId: 'c001', type: 'Final Exam',   totalMarks: 50, weightage: 40, dueDate: '2024-05-15' },
    { id: 'a005', courseId: 'c002', type: 'Quiz 1',       totalMarks: 10, weightage: 5,  dueDate: '2024-02-20' },
    { id: 'a006', courseId: 'c002', type: 'Mid Exam',     totalMarks: 30, weightage: 30, dueDate: '2024-03-22' },
  ],

  marks: [],
  challans: [],
  requests: [],
  auditLogs: [
    { id: 'al001', userId: 'u002', action: 'LOGIN', module: 'Auth', entity: 'user', timestamp: new Date().toISOString(), ip: '192.168.1.1' },
  ],
  notifications: {},
  sessions: new Map(),
};

module.exports = db;
