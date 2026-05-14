const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../data/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const log = (userId, action, ip) =>
  db.prepare('INSERT INTO audit_logs (id,user_id,action,module,entity,timestamp,ip) VALUES (?,?,?,?,?,?,?)')
    .run(`al${Date.now()}${Math.random()}`, userId, action, 'Auth', 'user', new Date().toISOString(), ip);

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, message: 'Username and password required' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
  if (user.locked && (!user.locked_until || new Date(user.locked_until) <= new Date())) {
    db.prepare('UPDATE users SET locked = 0, failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id);
    user.locked = 0;
  }
  if (user.locked) return res.status(403).json({ success: false, message: 'Account locked for 15 minutes' });

  if (!bcrypt.compareSync(password, user.password)) {
    const fails = (user.failed_logins || 0) + 1;
    db.prepare('UPDATE users SET failed_logins = ? WHERE id = ?').run(fails, user.id);
    if (fails >= 5) {
      const lockedUntil = new Date(Date.now() + 15*60*1000).toISOString();
      db.prepare('UPDATE users SET locked = 1, locked_until = ? WHERE id = ?').run(lockedUntil, user.id);
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  db.prepare('UPDATE users SET failed_logins = 0, locked = 0, locked_until = NULL WHERE id = ?').run(user.id);
  const payload = { id: user.id, username: user.username, role: user.role, name: user.name };
  const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: '60m' });
  log(user.id, 'LOGIN', req.ip);

  res.json({ success: true, data: { token, user: { id: user.id, name: user.name, role: user.role, username: user.username, email: user.email, program: user.program, semester: user.semester, section: user.section } }, message: 'Login successful' });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const { password, ...safe } = user;
  res.json({ success: true, data: safe });
});

router.post('/logout', authenticate, (req, res) => {
  log(req.user.id, 'LOGOUT', req.ip);
  res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
