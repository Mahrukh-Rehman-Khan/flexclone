// seed.js — populates the SQLite database
// Run once: node src/data/seed.js
// Safe to re-run: uses INSERT OR IGNORE

const bcrypt = require('bcryptjs');
const db     = require('./database');

async function seed() {
  await db.initDb();
  console.log('✓ Database initialised');

  const HASH = (p) => bcrypt.hashSync(p, 6);
  const STUDENT_PWD = HASH('student123');
  const FACULTY_PWD = HASH('faculty123');
  const ADMIN_PWD   = HASH('admin123');
  const HOD_PWD     = HASH('hod123');
  const FINANCE_PWD = HASH('finance123');

  // ── Users ──────────────────────────────────────────────────────────────────
  const insertUser = (u) => db.prepare(`
    INSERT OR IGNORE INTO users
      (id,username,password,role,name,email,department,program,batch,semester,cgpa)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(u.id,u.username,u.password,u.role,u.name,u.email,u.department||null,u.program||null,u.batch||null,u.semester||null,u.cgpa||0);

  const staff = [
    { id:'u002', username:'f001',     password:FACULTY_PWD, role:'faculty',  name:'Dr. Ayesha Khan',     email:'ayesha@nu.edu.pk',  department:'CS' },
    { id:'u003', username:'admin001', password:ADMIN_PWD,   role:'admin',    name:'Rao Usman',           email:'admin@nu.edu.pk' },
    { id:'u004', username:'hod001',   password:HOD_PWD,     role:'hod',      name:'Prof. Tariq Mehmood', email:'hod@nu.edu.pk',     department:'CS' },
    { id:'u005', username:'fin001',   password:FINANCE_PWD, role:'finance',  name:'Sana Malik',          email:'finance@nu.edu.pk' },
  ];
  const students = [
    { id:'s001', username:'23L-3007', name:'Muhammad Abdullah Haider',  email:'23l3007@lhr.nu.edu.pk', batch:'2023', semester:3, cgpa:3.50 },
    { id:'s002', username:'23L-3077', name:'Muhammad Manan',            email:'23l3077@lhr.nu.edu.pk', batch:'2023', semester:3, cgpa:3.20 },
    { id:'s003', username:'23L-3094', name:'Muhammad Ahmad',            email:'23l3094@lhr.nu.edu.pk', batch:'2023', semester:3, cgpa:3.10 },
    { id:'s004', username:'23L-3097', name:'Abdul Muiz',                email:'23l3097@lhr.nu.edu.pk', batch:'2023', semester:3, cgpa:3.30 },
    { id:'s005', username:'23L-3102', name:'Muhammad Hassan',           email:'23l3102@lhr.nu.edu.pk', batch:'2023', semester:3, cgpa:3.60 },
    { id:'s006', username:'24I-3023', name:'Ali Saad',                  email:'24i3023@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.30 },
    { id:'s007', username:'24I-3078', name:'Muhammad Umar Ashraf',      email:'24i3078@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.00 },
    { id:'s008', username:'24L-2551', name:'Hamna Faisal',              email:'24l2551@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.90 },
    { id:'s009', username:'24L-3003', name:'Adina Saqib',               email:'24l3003@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.40 },
    { id:'s010', username:'24L-3008', name:'Eman Fatima',               email:'24l3008@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.40 },
    { id:'s011', username:'24L-3010', name:'Ahmad Abrar',               email:'24l3010@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.50 },
    { id:'s012', username:'24L-3011', name:'Muhammad Moiz Dil',         email:'24l3011@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.80 },
    { id:'s013', username:'24L-3012', name:'Abdul Moez',                email:'24l3012@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.20 },
    { id:'s014', username:'24L-3018', name:'Muhammad Talha Hamid',      email:'24l3018@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s015', username:'24L-3027', name:'Fatima Kamran',             email:'24l3027@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s016', username:'24L-3031', name:'Ahmed Akhtar',              email:'24l3031@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.90 },
    { id:'s017', username:'24L-3034', name:'Muhammad Hammad Mushtaq',   email:'24l3034@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.50 },
    { id:'s018', username:'24L-3035', name:'Muhammad Waleed',           email:'24l3035@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.50 },
    { id:'s019', username:'24L-3036', name:'Bilal Kashif',              email:'24l3036@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s020', username:'24L-3037', name:'Mahrukh Rehman',            email:'24l3037@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s021', username:'24L-3049', name:'Ahmad Ali Khan',            email:'24l3049@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.40 },
    { id:'s022', username:'24L-3050', name:'Saad Mehmood Athar',        email:'24l3050@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.90 },
    { id:'s023', username:'24L-3051', name:'Mustafa Salman Ahmed',      email:'24l3051@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.40 },
    { id:'s024', username:'24L-3052', name:'Ramsha Khalid',             email:'24l3052@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.90 },
    { id:'s025', username:'24L-3054', name:'Muhammad Hanzala Siddique', email:'24l3054@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.90 },
    { id:'s026', username:'24L-3057', name:'Muhammad Shahzaib Zia',     email:'24l3057@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s027', username:'24L-3060', name:'Muhammad Moeed Amir',       email:'24l3060@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.90 },
    { id:'s028', username:'24L-3061', name:'Abdullah Tahir',            email:'24l3061@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s029', username:'24L-3067', name:'Sheikh Muhammad Ammar Arif',email:'24l3067@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.90 },
    { id:'s030', username:'24L-3068', name:'Zuhar Faisal',              email:'24l3068@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.80 },
    { id:'s031', username:'24L-3072', name:'Suleman Ahmed',             email:'24l3072@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.40 },
    { id:'s032', username:'24L-3078', name:'Zainab Sharif',             email:'24l3078@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s033', username:'24L-3079', name:'Maryam Bint E Ashfaq',      email:'24l3079@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s034', username:'24L-3081', name:'Shahzaib Saeed',            email:'24l3081@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s035', username:'24L-3083', name:'Areeba Iqbal',              email:'24l3083@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s036', username:'24L-3088', name:'Kashif Abbas',              email:'24l3088@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.30 },
    { id:'s037', username:'24L-3089', name:'Asadullah Nasir',           email:'24l3089@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:2.90 },
    { id:'s038', username:'24L-3090', name:'Bilal Ahmad',               email:'24l3090@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.30 },
    { id:'s039', username:'24L-3093', name:'Rabia',                     email:'24l3093@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s040', username:'24L-3096', name:'Anoosha Rizwan Vohra',      email:'24l3096@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
    { id:'s041', username:'24L-3097', name:'Manumha Nadeem',            email:'24l3097@lhr.nu.edu.pk', batch:'2024', semester:2, cgpa:3.10 },
  ];

  for (const u of staff) insertUser(u);
  for (const s of students) insertUser({ ...s, password: STUDENT_PWD, role: 'student', program: 'BSCS' });
  console.log('✓ Users seeded');

  // ── Courses ────────────────────────────────────────────────────────────────
  const courses = [
    { id:'c001', code:'CS-301', title:'Database Systems',        credits:3, instructor:'u002', section:'B', room:'CS-201', schedule:'Mon/Wed 09:00-10:30', enrolled:41, capacity:45, status:'active' },
    { id:'c002', code:'CS-302', title:'Software Engineering',    credits:3, instructor:'u002', section:'B', room:'CS-301', schedule:'Tue/Thu 11:00-12:30', enrolled:41, capacity:45, status:'active' },
    { id:'c003', code:'CS-303', title:'Computer Networks',       credits:3, instructor:'u002', section:'B', room:'CS-105', schedule:'Mon/Wed 13:00-14:30', enrolled:41, capacity:45, status:'active' },
    { id:'c004', code:'CS-304', title:'Operating Systems',       credits:3, instructor:'u002', section:'B', room:'CS-102', schedule:'Fri 09:00-12:00',     enrolled:41, capacity:45, status:'active' },
    { id:'c005', code:'CS-305', title:'Artificial Intelligence', credits:3, instructor:'u002', section:'B', room:'CS-205', schedule:'Tue/Thu 14:00-15:30', enrolled:41, capacity:45, status:'active' },
  ];
  for (const c of courses)
    db.prepare(`INSERT OR IGNORE INTO courses (id,code,title,credits,instructor,section,room,schedule,enrolled,capacity,status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(c.id,c.code,c.title,c.credits,c.instructor,c.section,c.room,c.schedule,c.enrolled,c.capacity,c.status);
  console.log('✓ Courses seeded');

  // ── Registrations ──────────────────────────────────────────────────────────
  const STUDENT_IDS = students.map(s => s.id);
  const COURSE_IDS  = ['c001','c002','c003','c004','c005'];
  let ri = 0;
  for (const sid of STUDENT_IDS) {
    for (const cid of COURSE_IDS) {
      db.prepare(`INSERT OR IGNORE INTO registrations (id,student_id,course_id,semester,status,submitted_at,approved_at)
                  VALUES (?,?,?,?,?,?,?)`)
        .run(`r${String(ri++).padStart(4,'0')}`, sid, cid, '2024-Spring', 'locked', '2024-01-10', '2024-01-12');
    }
  }
  console.log('✓ Registrations seeded');

  // ── Historical Attendance ──────────────────────────────────────────────────
  const ABSENCES = {
    's001':25,'s002':6,'s003':2,'s004':5,'s005':8,'s006':5,'s007':3,'s008':1,
    's009':3,'s010':3,'s011':6,'s012':0,'s013':4,'s014':2,'s015':2,'s016':1,
    's017':5,'s018':5,'s019':2,'s020':2,'s021':3,'s022':1,'s023':3,'s024':1,
    's025':1,'s026':2,'s027':1,'s028':2,'s029':1,'s030':0,'s031':3,'s032':2,
    's033':2,'s034':2,'s035':2,'s036':4,'s037':1,'s038':4,'s039':2,'s040':2,'s041':2,
  };
  function genDates(n) {
    const dates = []; const d = new Date('2026-04-30');
    while (dates.length < n) {
      if ([1,3].includes(d.getDay())) dates.unshift(d.toISOString().slice(0,10));
      d.setDate(d.getDate()-1);
    }
    return dates;
  }
  const maxAbs = Math.max(...STUDENT_IDS.map(sid => ABSENCES[sid]||0));
  const dates  = genDates(maxAbs + 10);
  let ai = 0;
  for (const cid of COURSE_IDS) {
    for (const sid of STUDENT_IDS) {
      const absCount = ABSENCES[sid]||0;
      for (let di = 0; di < dates.length; di++) {
        db.prepare(`INSERT OR IGNORE INTO attendance (id,course_id,student_id,date,status) VALUES (?,?,?,?,?)`)
          .run(`att${ai++}`, cid, sid, dates[di], di < absCount ? 'A' : 'P');
      }
    }
  }
  console.log('✓ Attendance seeded');

  // ── Assessments ────────────────────────────────────────────────────────────
  const assessments = [
    { id:'a001', cid:'c001', type:'Quiz 1',       marks:10, w:5,  due:'2024-02-15', st:'published' },
    { id:'a002', cid:'c001', type:'Assignment 1', marks:20, w:10, due:'2024-03-01', st:'published' },
    { id:'a003', cid:'c001', type:'Mid Exam',     marks:30, w:30, due:'2024-03-20', st:'published' },
    { id:'a004', cid:'c001', type:'Final Exam',   marks:50, w:40, due:'2024-05-15', st:'pending'   },
    { id:'a005', cid:'c002', type:'Quiz 1',       marks:10, w:5,  due:'2024-02-20', st:'published' },
    { id:'a006', cid:'c002', type:'Mid Exam',     marks:30, w:30, due:'2024-03-22', st:'published' },
  ];
  for (const a of assessments)
    db.prepare(`INSERT OR IGNORE INTO assessments (id,course_id,type,total_marks,weightage,due_date,status)
                VALUES (?,?,?,?,?,?,?)`)
      .run(a.id, a.cid, a.type, a.marks, a.w, a.due, a.st);
  console.log('✓ Assessments seeded');

  // ── Challans ───────────────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const sid = STUDENT_IDS[i];
    const cid = `ch${String(i+1).padStart(3,'0')}`;
    db.prepare(`INSERT OR IGNORE INTO challans (id,student_id,semester,status,due_date,fine,scholarship_deduction)
                VALUES (?,?,?,?,?,?,?)`)
      .run(cid, sid, 'Spring 2025', 'unpaid', '2025-02-28', 0, 0);
    db.prepare(`INSERT OR IGNORE INTO challan_items (id,challan_id,label,amount) VALUES (?,?,?,?)`)
      .run(`ci${i}a`, cid, 'Tuition Fee', 35000);
    db.prepare(`INSERT OR IGNORE INTO challan_items (id,challan_id,label,amount) VALUES (?,?,?,?)`)
      .run(`ci${i}b`, cid, 'Library Fee', 500);
    db.prepare(`INSERT OR IGNORE INTO challan_items (id,challan_id,label,amount) VALUES (?,?,?,?)`)
      .run(`ci${i}c`, cid, 'Sports Fee', 300);
  }
  console.log('✓ Challans seeded');

  db.prepare(`INSERT OR IGNORE INTO audit_logs (id,user_id,action,module,entity,timestamp,ip) VALUES (?,?,?,?,?,?,?)`)
    .run('al001','u002','SEED','System','all',new Date().toISOString(),'127.0.0.1');

  console.log('\n✅ Database seeded successfully →', require('path').resolve(__dirname,'../../flex_ums.sqlite'));
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
