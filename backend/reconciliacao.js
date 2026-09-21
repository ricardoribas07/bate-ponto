const { db } = require('./db');
const { todayDateStr, timeToMinutes, nowMinutes, weekdayOf } = require('./utils');

// ============================================================================
// Quando alguém sai pra pausa (banheiro/água) e a aula termina antes de essa
// pessoa voltar, duas coisas precisam acontecer:
//   1) A pausa em aberto precisa ser "fechada" (não pode ficar em aberto pra
//      sempre) — fechamos no horário em que a aula terminou.
//   2) A pessoa recebe falta automática nessa aula, mesmo que tivesse batido
//      presença antes de sair.
//
// Essa função roda de forma "preguiçosa": é chamada toda vez que alguém
// consulta o painel, os alertas ou um relatório — não precisa de nenhum job
// agendado rodando em segundo plano (o que seria complicado num servidor que
// "dorme" sozinho por inatividade, como o plano gratuito do Render).
// ============================================================================
async function reconciliarPausasVencidas() {
  const abertas = await db.all(
    `SELECT * FROM breaks WHERE end_time IS NULL AND date IS NOT NULL`
  );
  if (abertas.length === 0) return;

  const hoje = todayDateStr();
  const nm = nowMinutes();

  for (const b of abertas) {
    const weekday = weekdayOf(b.date);
    const schedules = await db.all(
      `SELECT * FROM schedules WHERE room_id = ? AND weekday = ?`,
      [b.room_id, weekday]
    );

    const inicioPausaMin = timeToMinutes(b.start_time);

    for (const s of schedules) {
      const inicioAulaMin = timeToMinutes(s.start_time);
      const fimAulaMin = timeToMinutes(s.end_time);

      // Essa pausa pertence a esta aula? (começou dentro da janela da aula,
      // com uma pequena tolerância de 15 min antes do início, igual usamos
      // pra achar a "aula ativa" em outros lugares do sistema)
      if (inicioPausaMin < inicioAulaMin - 15 || inicioPausaMin > fimAulaMin) continue;

      const aulaJaTerminou = b.date < hoje || (b.date === hoje && nm > fimAulaMin);
      if (!aulaJaTerminou) continue; // aula ainda rolando, não mexe ainda

      // Fecha a pausa no horário de fim da aula (pra não ficar em aberto pra sempre)
      await db.run('UPDATE breaks SET end_time = ?, falta_aplicada = 1 WHERE id = ?', [s.end_time, b.id]);

      // Aplica falta automática nessa aula, mesmo que já tivesse presença marcada
      await db.run(
        `INSERT INTO attendance (person_id, room_id, schedule_id, date, check_in_time, status)
         VALUES (?,?,?,?,?, 'ausente')
         ON CONFLICT(person_id, schedule_id, date)
         DO UPDATE SET status = 'ausente'`,
        [b.person_id, b.room_id, s.id, b.date, null]
      );

      break; // achou a aula certa dessa pausa, não precisa olhar as outras
    }
  }
}

module.exports = { reconciliarPausasVencidas };
