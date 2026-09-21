const { db } = require('./db');

// ============================================================================
// HORÁRIO DE BRASÍLIA — calculado manualmente, sem depender de nenhuma
// configuração do servidor (TZ, tzdata, etc). Muitos serviços de hospedagem
// (incluindo o Render) rodam em UTC por padrão, e a variável de ambiente TZ
// nem sempre funciona (alguns ambientes não têm o pacote de fuso horário
// instalado). Por isso, em vez de confiar nisso, pegamos o instante UTC atual
// e subtraímos 3 horas na mão — o Brasil não usa mais horário de verão desde
// 2019, então esse deslocamento é sempre fixo, o ano inteiro, sem exceção.
// ============================================================================
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000;

function agoraBrasilia() {
  return new Date(Date.now() - OFFSET_BRASILIA_MS);
}

function pad(n) { return String(n).padStart(2, '0'); }

function nowTimeStr(d = agoraBrasilia()) {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function todayDateStr(d = agoraBrasilia()) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function nowMinutes(d = agoraBrasilia()) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function weekdayOf(dateStr) {
  // dateStr no formato 'YYYY-MM-DD'. Extrai o dia da semana (0=domingo) sem
  // depender do fuso do servidor, tratando a data como um calendário puro.
  const [ano, mes, dia] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

// Converte uma data+hora "de parede" de Brasília (ex: 2026-08-19 14:30:00) no
// instante UTC real correspondente — necessário para comparar com Date.now()
// corretamente, não importa o fuso do servidor.
function brasiliaParaInstanteUTC(dateStr, timeStr) {
  const comoSeFosseUTC = new Date(`${dateStr}T${timeStr}Z`);
  return new Date(comoSeFosseUTC.getTime() + OFFSET_BRASILIA_MS);
}

async function getActiveScheduleForRoom(roomId) {
  const agora = agoraBrasilia();
  const weekday = agora.getUTCDay();
  const nm = nowMinutes(agora);
  const schedules = await db.all(`SELECT * FROM schedules WHERE room_id = ? AND weekday = ?`, [roomId, weekday]);

  for (const s of schedules) {
    const start = timeToMinutes(s.start_time);
    const end = timeToMinutes(s.end_time);
    if (nm >= start - 15 && nm <= end) return s;
  }
  return null;
}

async function getScheduleById(id) {
  return db.get('SELECT * FROM schedules WHERE id = ?', [id]);
}

async function findPersonByCard(cardId) {
  return db.get('SELECT * FROM people WHERE card_id = ?', [cardId]);
}

async function getRoomByToken(token) {
  return db.get('SELECT * FROM rooms WHERE device_token = ?', [token]);
}

async function logEvent(personId, roomId, cardId, event, detail) {
  await db.run(
    `INSERT INTO access_events (person_id, room_id, card_id, event, detail) VALUES (?,?,?,?,?)`,
    [personId || null, roomId || null, cardId || null, event, detail || null]
  );
}

module.exports = {
  agoraBrasilia,
  nowTimeStr,
  todayDateStr,
  timeToMinutes,
  nowMinutes,
  weekdayOf,
  brasiliaParaInstanteUTC,
  getActiveScheduleForRoom,
  getScheduleById,
  findPersonByCard,
  getRoomByToken,
  logEvent,
};
