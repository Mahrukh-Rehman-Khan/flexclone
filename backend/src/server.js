const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const db         = require('./data/database');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

// Mount routes after DB is ready
async function start() {
  await db.initDb();
  console.log('✓ Database ready');

  // Auto-seed on every startup — safe because seed uses INSERT OR IGNORE
  const seed = require('./data/seed');
  await seed();

  const authRoutes       = require('./routes/auth');
  const attendanceRoutes = require('./routes/attendance');
  const marksRoutes      = require('./routes/marks');
  const coursesRoutes    = require('./routes/courses');
  const { feeRouter, requestsRouter, notifRouter, adminRouter, timetableRouter, reportsRouter } = require('./routes/misc');

  app.use('/api/auth',          authRoutes);
  app.use('/api/attendance',    attendanceRoutes);
  app.use('/api/marks',         marksRoutes);
  app.use('/api/courses',       coursesRoutes);
  app.use('/api/fee',           feeRouter);
  app.use('/api/requests',      requestsRouter);
  app.use('/api/notifications', notifRouter);
  app.use('/api/admin',         adminRouter);
  app.use('/api/timetable',     timetableRouter);
  app.use('/api/reports',       reportsRouter);

  app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
  app.use((err, req, res, next) => { console.error(err); res.status(500).json({ success: false, message: 'Internal server error' }); });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`✓ FLEX UMS running on http://localhost:${PORT}`));
}

start().catch(err => { console.error('Startup failed:', err); process.exit(1); });