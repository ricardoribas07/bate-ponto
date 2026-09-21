const express = require('express');
const router = express.Router();
const { db, deletePersonCascade, deleteRoomCascade, deleteScheduleCascade } = require('../db');

router.get('/people', async (req, res) => {
  try {
    const people = await db.all('SELECT id, card_id, name, role, registration, login, active FROM people ORDER BY role, name');
    res.json({ ok: true, people });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao listar pessoas: ' + e.message });
  }
});

router.post('/people', async (req, res) => {
  try {
    const { card_id, name, role, registration, login, password } = req.body;

    if (!card_id || !name || !role) {
      return res.status(400).json({ ok: false, error: 'Preencha cartão, nome e papel.' });
    }
    if (!['aluno', 'professor', 'coordenacao'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'Papel inválido.' });
    }
    if (role !== 'aluno' && (!login || !password)) {
      return res.status(400).json({ ok: false, error: 'Professores e coordenação precisam de usuário e senha para acessar o site.' });
    }

    const result = await db.run(
      `INSERT INTO people (card_id, name, role, registration, login, password, active) VALUES (?,?,?,?,?,?,1)`,
      [card_id, name, role, registration || null, role === 'aluno' ? null : login, role === 'aluno' ? null : password]
    );
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'Já existe uma pessoa com esse cartão ou usuário de login.' });
    }
    res.status(500).json({ ok: false, error: 'Erro ao cadastrar: ' + e.message });
  }
});

router.put('/people/:id', async (req, res) => {
  try {
    const { card_id, name, role, registration, login, password } = req.body;
    const existing = await db.get('SELECT * FROM people WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ ok: false, error: 'Pessoa não encontrada.' });

    if (!card_id || !name || !role) {
      return res.status(400).json({ ok: false, error: 'Preencha cartão, nome e papel.' });
    }
    if (!['aluno', 'professor', 'coordenacao'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'Papel inválido.' });
    }
    if (role !== 'aluno' && !login) {
      return res.status(400).json({ ok: false, error: 'Professores e coordenação precisam de usuário de login.' });
    }
    if (role !== 'aluno' && !existing.password && !password) {
      return res.status(400).json({ ok: false, error: 'Defina uma senha para essa pessoa acessar o site.' });
    }

    const finalLogin = role === 'aluno' ? null : login;
    const finalPassword = role === 'aluno' ? null : (password ? password : existing.password);

    await db.run(
      `UPDATE people SET card_id = ?, name = ?, role = ?, registration = ?, login = ?, password = ? WHERE id = ?`,
      [card_id, name, role, registration || null, finalLogin, finalPassword, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'Já existe outra pessoa com esse cartão ou usuário de login.' });
    }
    res.status(500).json({ ok: false, error: 'Erro ao atualizar: ' + e.message });
  }
});

router.patch('/people/:id/active', async (req, res) => {
  try {
    const { active } = req.body;
    const existing = await db.get('SELECT * FROM people WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ ok: false, error: 'Pessoa não encontrada.' });

    if (Number(req.params.id) === req.user.id && !active) {
      return res.status(400).json({ ok: false, error: 'Você não pode bloquear o seu próprio login.' });
    }

    await db.run('UPDATE people SET active = ? WHERE id = ?', [active ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao atualizar: ' + e.message });
  }
});

router.delete('/people/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM people WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ ok: false, error: 'Pessoa não encontrada.' });

    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ ok: false, error: 'Você não pode excluir a si mesmo enquanto está logado com essa conta.' });
    }

    await deletePersonCascade(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao excluir: ' + e.message });
  }
});

router.get('/rooms', async (req, res) => {
  try {
    const rooms = await db.all('SELECT * FROM rooms ORDER BY name');
    res.json({ ok: true, rooms });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao listar salas: ' + e.message });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    const { name, device_token } = req.body;
    if (!name || !device_token) {
      return res.status(400).json({ ok: false, error: 'Preencha nome da sala e o token do dispositivo (ESP32).' });
    }
    const result = await db.run('INSERT INTO rooms (name, device_token) VALUES (?,?)', [name, device_token]);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'Já existe uma sala com esse token de dispositivo.' });
    }
    res.status(500).json({ ok: false, error: 'Erro ao cadastrar: ' + e.message });
  }
});

router.put('/rooms/:id', async (req, res) => {
  try {
    const { name, device_token } = req.body;
    if (!name || !device_token) {
      return res.status(400).json({ ok: false, error: 'Preencha nome da sala e o token do dispositivo (ESP32).' });
    }
    await db.run('UPDATE rooms SET name = ?, device_token = ? WHERE id = ?', [name, device_token, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ ok: false, error: 'Já existe outra sala com esse token de dispositivo.' });
    }
    res.status(500).json({ ok: false, error: 'Erro ao atualizar: ' + e.message });
  }
});

router.delete('/rooms/:id', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ ok: false, error: 'Sala não encontrada.' });

    await deleteRoomCascade(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao excluir: ' + e.message });
  }
});

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

router.get('/schedules', async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT s.*, r.name as room_name, p.name as teacher_name
       FROM schedules s
       JOIN rooms r ON r.id = s.room_id
       JOIN people p ON p.id = s.person_id
       ORDER BY s.weekday, s.start_time`
    );
    const schedules = rows.map((s) => ({ ...s, weekday_label: WEEKDAYS[s.weekday] }));
    res.json({ ok: true, schedules });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao listar aulas: ' + e.message });
  }
});

router.post('/schedules', async (req, res) => {
  try {
    const { room_id, person_id, subject, weekday, start_time, end_time, tolerance_minutes } = req.body;

    if (!room_id || !person_id || !subject || weekday === undefined || !start_time || !end_time) {
      return res.status(400).json({ ok: false, error: 'Preencha sala, professor, matéria, dia da semana e horários.' });
    }

    const teacher = await db.get("SELECT * FROM people WHERE id = ? AND role = 'professor'", [person_id]);
    if (!teacher) return res.status(400).json({ ok: false, error: 'Professor inválido.' });

    const result = await db.run(
      `INSERT INTO schedules (room_id, person_id, subject, weekday, start_time, end_time, tolerance_minutes)
       VALUES (?,?,?,?,?,?,?)`,
      [room_id, person_id, subject, weekday, start_time, end_time, tolerance_minutes || 10]
    );
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao cadastrar: ' + e.message });
  }
});

router.put('/schedules/:id', async (req, res) => {
  try {
    const { room_id, person_id, subject, weekday, start_time, end_time, tolerance_minutes } = req.body;

    if (!room_id || !person_id || !subject || weekday === undefined || !start_time || !end_time) {
      return res.status(400).json({ ok: false, error: 'Preencha sala, professor, matéria, dia da semana e horários.' });
    }

    const teacher = await db.get("SELECT * FROM people WHERE id = ? AND role = 'professor'", [person_id]);
    if (!teacher) return res.status(400).json({ ok: false, error: 'Professor inválido.' });

    await db.run(
      `UPDATE schedules SET room_id = ?, person_id = ?, subject = ?, weekday = ?, start_time = ?, end_time = ?, tolerance_minutes = ?
       WHERE id = ?`,
      [room_id, person_id, subject, weekday, start_time, end_time, tolerance_minutes || 10, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao atualizar: ' + e.message });
  }
});

router.delete('/schedules/:id', async (req, res) => {
  try {
    await deleteScheduleCascade(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao excluir: ' + e.message });
  }
});

router.get('/schedules/:id/students', async (req, res) => {
  try {
    const enrolled = await db.all(
      `SELECT p.id, p.name, p.registration FROM class_students cs
       JOIN people p ON p.id = cs.person_id
       WHERE cs.schedule_id = ? ORDER BY p.name`,
      [req.params.id]
    );

    const enrolledIds = enrolled.map((s) => s.id);
    const allStudents = await db.all("SELECT id, name, registration FROM people WHERE role = 'aluno' ORDER BY name");
    const available = allStudents.filter((s) => !enrolledIds.includes(s.id));

    res.json({ ok: true, enrolled, available });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao consultar matrícula: ' + e.message });
  }
});

router.post('/schedules/:id/students', async (req, res) => {
  try {
    const { person_id } = req.body;
    if (!person_id) return res.status(400).json({ ok: false, error: 'Selecione um aluno.' });

    const already = await db.get(
      'SELECT 1 as x FROM class_students WHERE schedule_id = ? AND person_id = ?',
      [req.params.id, person_id]
    );
    if (already) return res.status(409).json({ ok: false, error: 'Esse aluno já está matriculado nessa aula.' });

    await db.run('INSERT INTO class_students (schedule_id, person_id) VALUES (?,?)', [req.params.id, person_id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao matricular: ' + e.message });
  }
});

router.delete('/schedules/:id/students/:personId', async (req, res) => {
  try {
    await db.run('DELETE FROM class_students WHERE schedule_id = ? AND person_id = ?', [req.params.id, req.params.personId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao remover matrícula: ' + e.message });
  }
});

module.exports = router;
