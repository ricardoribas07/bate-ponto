const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { db } = require('../db');

const SECRET = process.env.JWT_SECRET || 'tcc-bate-ponto-secret-dev';

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    const person = await db.get('SELECT * FROM people WHERE login = ? AND password = ?', [login, password]);

    if (!person) return res.status(401).json({ ok: false, error: 'Login ou senha inválidos' });

    if (!person.active) {
      return res.status(403).json({ ok: false, error: 'Este login está bloqueado pela coordenação.' });
    }

    const token = jwt.sign(
      { id: person.id, name: person.name, role: person.role },
      SECRET,
      { expiresIn: '12h' }
    );

    res.json({ ok: true, token, user: { id: person.id, name: person.name, role: person.role } });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao autenticar: ' + e.message });
  }
});

module.exports = { router, SECRET };
