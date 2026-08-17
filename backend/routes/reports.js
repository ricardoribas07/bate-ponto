const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/:roomId/:date', async (req, res) => {
  try {
    const { roomId, date } = req.params;
    const room = await db.get('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ ok: false, error: 'Sala não encontrada' });

    const weekday = new Date(`${date}T12:00:00`).getDay();
    const schedule = await db.get('SELECT * FROM schedules WHERE room_id = ? AND weekday = ?', [roomId, weekday]);

    if (!schedule) return res.json({ ok: true, room: room.name, date, subject: null, students: [] });

    const teacher = await db.get('SELECT name FROM people WHERE id = ?', [schedule.person_id]);
    const teacherAtt = await db.get(
      'SELECT * FROM attendance WHERE person_id = ? AND schedule_id = ? AND date = ?',
      [schedule.person_id, schedule.id, date]
    );

    const rows = await db.all(
      `SELECT p.name, p.registration, a.status, a.check_in_time
       FROM class_students cs
       JOIN people p ON p.id = cs.person_id
       LEFT JOIN attendance a ON a.person_id = p.id AND a.schedule_id = cs.schedule_id AND a.date = ?
       WHERE cs.schedule_id = ?
       ORDER BY p.name`,
      [date, schedule.id]
    );
    const students = rows.map((s) => ({ ...s, status: s.status || 'ausente' }));

    res.json({
      ok: true,
      room: room.name,
      date,
      subject: schedule.subject,
      teacher: teacher ? teacher.name : null,
      teacher_status: teacherAtt ? teacherAtt.status : 'ausente',
      presentes: students.filter((s) => s.status === 'presente').length,
      atrasados: students.filter((s) => s.status === 'atrasado').length,
      ausentes: students.filter((s) => s.status === 'ausente').length,
      students,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao gerar relatório: ' + e.message });
  }
});

module.exports = router;
