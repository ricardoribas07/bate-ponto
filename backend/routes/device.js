const express = require('express');
const router = express.Router();
const { db, BREAK_LIMITS } = require('../db');
const {
  nowTimeStr,
  todayDateStr,
  timeToMinutes,
  nowMinutes,
  getActiveScheduleForRoom,
  findPersonByCard,
  getRoomByToken,
  logEvent,
} = require('../utils');

// Toda requisição do dispositivo deve trazer device_token (identifica a sala/ESP32)
async function requireRoom(req, res, next) {
  const room = await getRoomByToken(req.body.device_token);
  if (!room) return res.status(401).json({ ok: false, error: 'device_token inválido' });
  req.room = room;
  next();
}

// -------- CHECK-IN (cartão passado na entrada da sala) --------
router.post('/checkin', requireRoom, async (req, res) => {
  try {
    const { card_id } = req.body;
    const room = req.room;
    const person = await findPersonByCard(card_id);

    if (!person) {
      await logEvent(null, room.id, card_id, 'checkin_negado', 'cartão não cadastrado');
      return res.status(404).json({ ok: false, error: 'Cartão não cadastrado' });
    }

    if (!person.active) {
      await logEvent(person.id, room.id, card_id, 'checkin_negado', 'pessoa bloqueada pela coordenação');
      return res.status(403).json({ ok: false, error: `${person.name} está com o acesso bloqueado pela coordenação.` });
    }

    const schedule = await getActiveScheduleForRoom(room.id);
    if (!schedule) {
      await logEvent(person.id, room.id, card_id, 'checkin_negado', 'sem aula ativa nesta sala/horário');
      return res.status(409).json({ ok: false, error: 'Nenhuma aula ativa nesta sala agora' });
    }

    if (person.role === 'professor') {
      if (schedule.person_id !== person.id) {
        await logEvent(person.id, room.id, card_id, 'checkin_negado', 'professor sem aula nesta sala');
        return res.status(403).json({
          ok: false,
          authorized: false,
          error: `Professor ${person.name} não tem aula nesta sala agora. Acesso barrado.`,
        });
      }
    }

    if (person.role === 'aluno') {
      const enrolled = await db.get(
        'SELECT 1 as x FROM class_students WHERE schedule_id = ? AND person_id = ?',
        [schedule.id, person.id]
      );
      if (!enrolled) {
        await logEvent(person.id, room.id, card_id, 'checkin_negado', 'aluno não matriculado nesta turma');
        return res.status(403).json({ ok: false, error: `${person.name} não está matriculado nesta turma.` });
      }
    }

    const date = todayDateStr();
    const nm = nowMinutes();
    const start = timeToMinutes(schedule.start_time);
    const status = nm > start + schedule.tolerance_minutes ? 'atrasado' : 'presente';
    const time = nowTimeStr();

    await db.run(
      `INSERT INTO attendance (person_id, room_id, schedule_id, date, check_in_time, status)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(person_id, schedule_id, date)
       DO UPDATE SET check_in_time = excluded.check_in_time, status = excluded.status`,
      [person.id, room.id, schedule.id, date, time, status]
    );

    await logEvent(person.id, room.id, card_id, 'checkin', status);

    return res.json({
      ok: true,
      authorized: true,
      person: { name: person.name, role: person.role },
      status,
      message: status === 'atrasado' ? `Presença registrada com atraso às ${time}` : `Presença registrada às ${time}`,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro no check-in: ' + e.message });
  }
});

// -------- INÍCIO DE PAUSA (banheiro / água) --------
router.post('/break/start', requireRoom, async (req, res) => {
  try {
    const { card_id, type } = req.body;
    const room = req.room;

    if (!BREAK_LIMITS[type]) {
      return res.status(400).json({ ok: false, error: 'Tipo de pausa inválido. Use: urinar, defecar, agua, garrafa' });
    }
    const person = await findPersonByCard(card_id);
    if (!person) return res.status(404).json({ ok: false, error: 'Cartão não cadastrado' });
    if (!person.active) return res.status(403).json({ ok: false, error: `${person.name} está com o acesso bloqueado.` });

    const openBreak = await db.get('SELECT * FROM breaks WHERE person_id = ? AND end_time IS NULL', [person.id]);
    if (openBreak) {
      return res.status(409).json({ ok: false, error: `${person.name} já está em pausa (${openBreak.type})` });
    }

    const limit = BREAK_LIMITS[type];
    const time = nowTimeStr();
    const result = await db.run(
      `INSERT INTO breaks (person_id, room_id, type, start_time, limit_seconds) VALUES (?,?,?,?,?)`,
      [person.id, room.id, type, time, limit]
    );

    await logEvent(person.id, room.id, card_id, 'break_start', type);

    res.json({
      ok: true,
      break_id: result.lastInsertRowid,
      type,
      limit_seconds: limit,
      message: `${person.name} saiu para ${type}. Limite: ${Math.round(limit / 60)} min.`,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao iniciar pausa: ' + e.message });
  }
});

// -------- FIM DE PAUSA (retorno à sala) --------
router.post('/break/end', requireRoom, async (req, res) => {
  try {
    const { card_id } = req.body;
    const person = await findPersonByCard(card_id);
    if (!person) return res.status(404).json({ ok: false, error: 'Cartão não cadastrado' });

    const openBreak = await db.get('SELECT * FROM breaks WHERE person_id = ? AND end_time IS NULL', [person.id]);
    if (!openBreak) return res.status(404).json({ ok: false, error: 'Nenhuma pausa em aberto para essa pessoa' });

    const time = nowTimeStr();
    await db.run('UPDATE breaks SET end_time = ? WHERE id = ?', [time, openBreak.id]);

    const elapsed =
      (new Date(`1970-01-01T${time}`) - new Date(`1970-01-01T${openBreak.start_time}`)) / 1000;
    const exceeded = elapsed > openBreak.limit_seconds;

    await logEvent(person.id, openBreak.room_id, card_id, 'break_end', exceeded ? 'excedeu tempo' : 'dentro do tempo');

    res.json({
      ok: true,
      elapsed_seconds: Math.round(elapsed),
      limit_seconds: openBreak.limit_seconds,
      exceeded,
      message: exceeded
        ? `${person.name} excedeu o tempo de ${openBreak.type} (${Math.round(elapsed)}s de ${openBreak.limit_seconds}s).`
        : `${person.name} retornou dentro do tempo.`,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao encerrar pausa: ' + e.message });
  }
});

// -------- DADOS PARA IMPRESSÃO (botão do professor no dispositivo) --------
router.post('/print-data', requireRoom, async (req, res) => {
  try {
    const room = req.room;
    const schedule = await getActiveScheduleForRoom(room.id);
    if (!schedule) return res.status(409).json({ ok: false, error: 'Nenhuma aula ativa nesta sala agora' });

    const date = todayDateStr();
    const students = await db.all(
      `SELECT p.name, p.registration, a.status, a.check_in_time
       FROM class_students cs
       JOIN people p ON p.id = cs.person_id
       LEFT JOIN attendance a ON a.person_id = p.id AND a.schedule_id = cs.schedule_id AND a.date = ?
       WHERE cs.schedule_id = ?
       ORDER BY p.name`,
      [date, schedule.id]
    );

    const lines = students.map(
      (s) => `${(s.status || 'ausente').toUpperCase().padEnd(9)} ${s.check_in_time || '--:--:--'}  ${s.name}`
    );

    res.json({
      ok: true,
      room: room.name,
      subject: schedule.subject,
      date,
      total: students.length,
      presentes: students.filter((s) => s.status === 'presente').length,
      atrasados: students.filter((s) => s.status === 'atrasado').length,
      ausentes: students.filter((s) => !s.status || s.status === 'ausente').length,
      lines,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao gerar dados de impressão: ' + e.message });
  }
});

module.exports = router;
