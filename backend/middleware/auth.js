const jwt = require('jsonwebtoken');
const { SECRET } = require('../routes/auth');
const { db } = require('../db');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ ok: false, error: 'Token ausente' });
  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, SECRET);

    const person = await db.get('SELECT active FROM people WHERE id = ?', [payload.id]);
    if (!person || !person.active) {
      return res.status(403).json({ ok: false, error: 'Este login foi bloqueado pela coordenação.' });
    }

    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Token inválido ou expirado' });
  }
}

module.exports = { requireAuth };
