/**
 * database.js — sql.js wrapper compatible with better-sqlite3's API
 * sql.js is pure JavaScript (zero native compilation).
 * Data is persisted to flex_ums.sqlite after every committed write.
 */

const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'flex_ums.sqlite');

let _db    = null;
let _ready = false;
let _inTx  = false;   // true while inside a transaction — suppresses mid-tx saves

// ── Public init ───────────────────────────────────────────────────────────────
async function initDb() {
  if (_ready) return;
  const SqlJs = await require('sql.js')();
  if (fs.existsSync(DB_PATH)) {
    _db = new SqlJs.Database(fs.readFileSync(DB_PATH));
  } else {
    _db = new SqlJs.Database();
  }
  applySchema();
  _ready = true;
}

// ── Persist ───────────────────────────────────────────────────────────────────
function save() {
  if (!_db || _inTx) return;   // never export mid-transaction
  fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
}

function ensureReady() {
  if (!_ready) throw new Error('Call await db.initDb() before using the database.');
}

// ── Schema ────────────────────────────────────────────────────────────────────
function applySchema() {
  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
      role TEXT NOT NULL, name TEXT NOT NULL, email TEXT, department TEXT,
      program TEXT, batch TEXT, semester INTEGER, cgpa REAL DEFAULT 0,
      failed_logins INTEGER DEFAULT 0, locked INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY, code TEXT NOT NULL, title TEXT NOT NULL,
      credits INTEGER DEFAULT 3, instructor TEXT, section TEXT, room TEXT,
      schedule TEXT, enrolled INTEGER DEFAULT 0, capacity INTEGER DEFAULT 40,
      status TEXT DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, course_id TEXT NOT NULL,
      semester TEXT, status TEXT DEFAULT 'submitted',
      submitted_at TEXT, approved_at TEXT,
      UNIQUE(student_id, course_id)
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY, course_id TEXT NOT NULL, student_id TEXT NOT NULL,
      date TEXT NOT NULL, status TEXT NOT NULL,
      UNIQUE(course_id, student_id, date)
    );
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY, course_id TEXT NOT NULL, type TEXT NOT NULL,
      total_marks INTEGER NOT NULL, weightage REAL NOT NULL,
      due_date TEXT, status TEXT DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS marks (
      id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, student_id TEXT NOT NULL,
      obtained REAL, UNIQUE(assessment_id, student_id)
    );
    CREATE TABLE IF NOT EXISTS challans (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, semester TEXT,
      status TEXT DEFAULT 'unpaid', due_date TEXT, fine REAL DEFAULT 0,
      scholarship_deduction REAL DEFAULT 0, bank_ref TEXT,
      payment_method TEXT, paid_at TEXT
    );
    CREATE TABLE IF NOT EXISTS challan_items (
      id TEXT PRIMARY KEY, challan_id TEXT NOT NULL,
      label TEXT NOT NULL, amount REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL, type TEXT NOT NULL,
      justification TEXT, status TEXT DEFAULT 'submitted',
      submitted_at TEXT, updated_at TEXT, remarks TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, user_id TEXT, action TEXT, module TEXT,
      entity TEXT, timestamp TEXT, ip TEXT
    );
  `);
  save();
}

// ── SQL normalisation ─────────────────────────────────────────────────────────
// Convert @name and :name placeholders → $name (sql.js style)
function normaliseSql(sql) {
  return sql.replace(/[@:](\w+)/g, '$$$1');
}

// Convert better-sqlite3 named-param objects {name: val} → {$name: val}
// Also handles already-prefixed keys (@name, :name, $name)
function normaliseParams(args) {
  if (args.length === 0) return [];

  if (args.length === 1 && args[0] !== null
      && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const out = {};
    for (const [k, v] of Object.entries(args[0])) {
      const bare = k.replace(/^[@$:]/, '');
      out['$' + bare] = v === undefined ? null : v;
    }
    return out;
  }

  return args.map(v => (v === undefined ? null : v));
}

function rowToObj(cols, vals) {
  const obj = {};
  cols.forEach((c, i) => { obj[c] = vals[i]; });
  return obj;
}

// ── Statement wrapper ─────────────────────────────────────────────────────────
class Statement {
  constructor(sql) { this._sql = normaliseSql(sql); }

  get(...args) {
    ensureReady();
    const stmt = _db.prepare(this._sql);
    stmt.bind(normaliseParams(args));
    const cols = stmt.getColumnNames();
    const row  = stmt.step() ? rowToObj(cols, stmt.get()) : undefined;
    stmt.free();
    return row;
  }

  all(...args) {
    ensureReady();
    const stmt = _db.prepare(this._sql);
    stmt.bind(normaliseParams(args));
    const cols = stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) rows.push(rowToObj(cols, stmt.get()));
    stmt.free();
    return rows;
  }

  run(...args) {
    ensureReady();
    const stmt = _db.prepare(this._sql);
    stmt.bind(normaliseParams(args));
    stmt.step();
    stmt.free();
    const changes = _db.getRowsModified();
    save();   // no-op if _inTx is true
    return { changes };
  }
}

// ── Public db object ──────────────────────────────────────────────────────────
const db = {
  prepare: (sql) => new Statement(sql),

  exec: (sql) => {
    ensureReady();
    _db.run(normaliseSql(sql));
    save();
  },

  pragma: (_) => {},

  transaction: (fn) => {
    return (...args) => {
      ensureReady();
      _inTx = true;
      _db.run('BEGIN');
      try {
        fn(...args);
        _db.run('COMMIT');
        _inTx = false;
        save();          // single save after the whole transaction commits
      } catch (e) {
        try { _db.run('ROLLBACK'); } catch {}
        _inTx = false;
        throw e;
      }
    };
  },

  initDb,
};

module.exports = db;
