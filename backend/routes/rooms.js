const express = require('express');
const router = express.Router();
const { db } = require('../db');
const {
  todayDateStr,
  timeToMinutes,
  nowMinutes,
  getActiveScheduleForRoom,
} = require('../utils');
const { reconciliarPausasVencidas } = require('../reconciliacao');

async function buildRoomSummary(room) {
  const schedule = await getActiveScheduleForRoom(room.id);
  const date = todayDateStr();

  if (!schedule) {
    return {
      id: room.id,
      name: room.name,
      has_class_now: false,
      subject: null,
      teacher: null,
      teacher_status: null,
      presentes: 0,
      atrasados: 0,
      ausentes: 0,
      total: 0,
    };
  }

  const teacher = await db.get('SELECT * FROM people WHERE id = ?', [schedule.person_id]);
  const teacherAttendance = await db.get(
    'SELECT * FROM attendance WHERE person_id = ? AND schedule_id = ? AND date = ?',
    [teacher.id, schedule.id, date]
  );

  const nm = nowMinutes();
  const start = timeToMinutes(schedule.start_time);
  let teacherStatus = 'ausente';
  if (teacherAttendance) teacherStatus = teacherAttendance.status;
  else if (nm <= start + schedule.tolerance_minutes) teacherStatus = 'aguardando';

  const students = await db.all(
    `SELECT p.id, p.name, p.registration, a.status, a.check_in_time
     FROM class_students cs
     JOIN people p ON p.id = cs.person_id
     LEFT JOIN attendance a ON a.person_id = p.id AND a.schedule_id = cs.schedule_id AND a.date = ?
     WHERE cs.schedule_id = ?
     ORDER BY p.name`,
    [date, schedule.id]
  );

  return {
    id: room.id,
    name: room.name,
    has_class_now: true,
    schedule_id: schedule.id,
    subject: schedule.subject,
    start_time: schedule.start_time,
    end_time: schedule.end_time,
    teacher: teacher.name,
    teacher_status: teacherStatus,
    presentes: students.filter((s) => s.status === 'presente').length,
    atrasados: students.filter((s) => s.status === 'atrasado').length,
    ausentes: students.filter((s) => !s.status || s.status === 'ausente').length,
    total: students.length,
  };
}

router.get('/', async (req, res) => {
  try {
    await reconciliarPausasVencidas();
    const rooms = await db.all('SELECT * FROM rooms ORDER BY name');
    const summaries = await Promise.all(rooms.map(buildRoomSummary));
    res.json({ ok: true, rooms: summaries });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao listar salas: ' + e.message });
  }
});

router.get('/:id/status', async (req, res) => {
  try {
    await reconciliarPausasVencidas();

    const room = await db.get('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ ok: false, error: 'Sala não encontrada' });

    const summary = await buildRoomSummary(room);
    const date = todayDateStr();

    let students = [];
    if (summary.has_class_now) {
      const rowsData = await db.all(
        `SELECT p.id, p.name, p.registration, a.status, a.check_in_time
         FROM class_students cs
         JOIN people p ON p.id = cs.person_id
         LEFT JOIN attendance a ON a.person_id = p.id AND a.schedule_id = cs.schedule_id AND a.date = ?
         WHERE cs.schedule_id = ?
         ORDER BY p.name`,
        [date, summary.schedule_id]
      );
      students = rowsData.map((s) => ({ ...s, status: s.status || 'ausente' }));
    }

    const openBreaks = await db.all(
      `SELECT b.*, p.name FROM breaks b JOIN people p ON p.id = b.person_id
       WHERE b.room_id = ? AND b.end_time IS NULL`,
      [room.id]
    );

    res.json({ ok: true, room: summary, students, breaks_in_progress: openBreaks });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao consultar sala: ' + e.message });
  }
});

module.exports = router;
