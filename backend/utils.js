const { db } = require('./db');

function pad(n) { return String(n).padStart(2, '0'); }

function nowTimeStr(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function todayDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

// Retorna o horário (schedule) "ativo" da sala agora: considera de 15 min antes
// do início até o fim da aula.
async function getActiveScheduleForRoom(roomId) {
  const weekday = new Date().getDay();
  const nm = nowMinutes();
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
  nowTimeStr,
  todayDateStr,
  timeToMinutes,
  nowMinutes,
  getActiveScheduleForRoom,
  getScheduleById,
  findPersonByCard,
  getRoomByToken,
  logEvent,
};
