const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { todayDateStr, timeToMinutes, nowMinutes, getActiveScheduleForRoom, brasiliaParaInstanteUTC } = require('../utils');
const { reconciliarPausasVencidas } = require('../reconciliacao');

router.get('/', async (req, res) => {
  try {
    await reconciliarPausasVencidas();

    const alerts = [];
    const date = todayDateStr();
    const nm = nowMinutes();
    const rooms = await db.all('SELECT * FROM rooms');

    for (const room of rooms) {
      const schedule = await getActiveScheduleForRoom(room.id);
      if (!schedule) continue;
      const start = timeToMinutes(schedule.start_time);
      if (nm <= start + schedule.tolerance_minutes) continue;

      const teacher = await db.get('SELECT * FROM people WHERE id = ?', [schedule.person_id]);
      const att = await db.get(
        'SELECT * FROM attendance WHERE person_id = ? AND schedule_id = ? AND date = ?',
        [teacher.id, schedule.id, date]
      );

      if (!att) {
        alerts.push({
          type: 'professor_ausente',
          severity: 'alta',
          room: room.name,
          message: `Professor(a) ${teacher.name} não bateu ponto na ${room.name} (${schedule.subject}, início ${schedule.start_time}).`,
        });
      }
    }

    // Pausas estouradas (ainda em aberto agora, além do tempo limite) — a
    // reconciliação já fechou as que "sobraram" de aulas que já terminaram,
    // então o que aparece aqui são pausas de aulas que AINDA estão rolando.
    const openBreaks = await db.all(
      `SELECT b.*, p.name, r.name as room_name FROM breaks b
       JOIN people p ON p.id = b.person_id
       JOIN rooms r ON r.id = b.room_id
       WHERE b.end_time IS NULL`
    );

    for (const b of openBreaks) {
      const start = brasiliaParaInstanteUTC(b.date, b.start_time);
      const elapsed = (Date.now() - start.getTime()) / 1000;
      if (elapsed > b.limit_seconds) {
        alerts.push({
          type: 'pausa_excedida',
          severity: 'media',
          room: b.room_name,
          message: `${b.name} está fora da sala (${b.type}) há ${Math.round(elapsed / 60)} min — limite era ${Math.round(b.limit_seconds / 60)} min.`,
        });
      }
    }

    res.json({ ok: true, alerts });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Erro ao calcular alertas: ' + e.message });
  }
});

module.exports = router;
