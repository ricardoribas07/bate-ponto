const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { weekdayOf } = require('../utils');
const { reconciliarPausasVencidas } = require('../reconciliacao');

function duracaoSegundos(startTime, endTime) {
  if (!endTime) return null; // ainda em aberto (não deveria acontecer após a reconciliação, mas por segurança)
  const segundos = Math.round((new Date(`1970-01-01T${endTime}`) - new Date(`1970-01-01T${startTime}`)) / 1000);
  // O horário de fim de uma aula só tem "hora:minuto" (sem segundos), então uma
  // pausa fechada automaticamente pelo sistema (quando a pessoa não volta) pode
  // dar uma diferença de poucos segundos negativa por causa desse arredondamento.
  // Nesse caso, mostramos 0 em vez de um número negativo confuso no relatório.
  return Math.max(0, segundos);
}

router.get('/:roomId/:date', async (req, res) => {
  try {
    await reconciliarPausasVencidas();

    const { roomId, date } = req.params;
    const room = await db.get('SELECT * FROM rooms WHERE id = ?', [roomId]);
    if (!room) return res.status(404).json({ ok: false, error: 'Sala não encontrada' });

    const weekday = weekdayOf(date);
    const schedule = await db.get('SELECT * FROM schedules WHERE room_id = ? AND weekday = ?', [roomId, weekday]);

    if (!schedule) return res.json({ ok: true, room: room.name, date, subject: null, students: [] });

    const teacher = await db.get('SELECT name FROM people WHERE id = ?', [schedule.person_id]);
    const teacherAtt = await db.get(
      'SELECT * FROM attendance WHERE person_id = ? AND schedule_id = ? AND date = ?',
      [schedule.person_id, schedule.id, date]
    );

    const rows = await db.all(
      `SELECT p.id, p.name, p.registration, a.status, a.check_in_time
       FROM class_students cs
       JOIN people p ON p.id = cs.person_id
       LEFT JOIN attendance a ON a.person_id = p.id AND a.schedule_id = cs.schedule_id AND a.date = ?
       WHERE cs.schedule_id = ?
       ORDER BY p.name`,
      [date, schedule.id]
    );

    // Busca todas as pausas do dia, nesta sala, pra anexar em cada aluno
    const pausasRows = await db.all(
      `SELECT b.person_id, b.type, b.start_time, b.end_time, b.limit_seconds, b.falta_aplicada
       FROM breaks b WHERE b.room_id = ? AND b.date = ?
       ORDER BY b.start_time`,
      [roomId, date]
    );

    const students = rows.map((s) => {
      const pausasDoAluno = pausasRows
        .filter((p) => p.person_id === s.id)
        .map((p) => {
          const naoRetornou = !!p.falta_aplicada;
          const duracao = duracaoSegundos(p.start_time, p.end_time);
          return {
            type: p.type,
            start_time: p.start_time,
            end_time: p.end_time, // null só pode acontecer se a pausa ainda está rolando agora mesmo
            duration_seconds: duracao,
            limit_seconds: p.limit_seconds,
            // "não retornou" (a pausa foi fechada sozinha pelo sistema porque a
            // aula terminou e a pessoa nunca voltou) conta sempre como excedido,
            // independente da conta exata de segundos.
            exceeded: naoRetornou || (p.end_time ? duracao > p.limit_seconds : false),
            nao_retornou: naoRetornou,
          };
        });

      return {
        ...s,
        status: s.status || 'ausente',
        pausas: pausasDoAluno,
      };
    });

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
