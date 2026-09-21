const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const url = process.env.TURSO_DATABASE_URL || `file:${path.join(dataDir, 'bateponto.db')}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

if (process.env.TURSO_DATABASE_URL) {
  console.log(`[banco] Usando Turso (nuvem): ${process.env.TURSO_DATABASE_URL}`);
} else {
  console.log('[banco] TURSO_DATABASE_URL não foi definido — usando arquivo LOCAL (não persiste em hospedagem free).');
}

const client = createClient(authToken ? { url, authToken } : { url });

const db = {
  async get(sql, args = []) {
    const rs = await client.execute({ sql, args });
    return rs.rows[0];
  },
  async all(sql, args = []) {
    const rs = await client.execute({ sql, args });
    return rs.rows;
  },
  async run(sql, args = []) {
    const rs = await client.execute({ sql, args });
    return { lastInsertRowid: Number(rs.lastInsertRowid), changes: rs.rowsAffected };
  },
};

const BREAK_LIMITS = {
  urinar: 5 * 60,
  defecar: 12 * 60,
  garrafa: 5 * 60,
  agua: 4 * 60,
};

async function createSchema() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      device_token TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('aluno','professor','coordenacao')),
      registration TEXT,
      login TEXT UNIQUE,
      password TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      person_id INTEGER NOT NULL REFERENCES people(id),
      subject TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      tolerance_minutes INTEGER NOT NULL DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS class_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES schedules(id),
      person_id INTEGER NOT NULL REFERENCES people(id)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id),
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      schedule_id INTEGER REFERENCES schedules(id),
      date TEXT NOT NULL,
      check_in_time TEXT,
      status TEXT NOT NULL DEFAULT 'ausente' CHECK(status IN ('presente','atrasado','ausente')),
      UNIQUE(person_id, schedule_id, date)
    );

    CREATE TABLE IF NOT EXISTS breaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id),
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      type TEXT NOT NULL CHECK(type IN ('urinar','defecar','agua','garrafa')),
      date TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      limit_seconds INTEGER NOT NULL,
      falta_aplicada INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS access_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER,
      room_id INTEGER,
      card_id TEXT,
      event TEXT,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Migrações (para bancos criados antes destas colunas existirem)
  const migracoes = [
    "ALTER TABLE people ADD COLUMN active INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE breaks ADD COLUMN date TEXT;",
    "ALTER TABLE breaks ADD COLUMN falta_aplicada INTEGER NOT NULL DEFAULT 0;",
  ];
  for (const sql of migracoes) {
    try { await client.execute(sql); } catch (e) { /* coluna já existe — ignora */ }
  }
}

async function seedIfEmpty() {
  const countRow = await db.get('SELECT COUNT(*) AS c FROM people');
  if (Number(countRow.c) > 0) return;

  const coord = await db.run(
    `INSERT INTO people (card_id, name, role, registration, login, password) VALUES (?,?,?,?,?,?)`,
    ['C0001', 'Coordenação', 'coordenacao', null, 'coordenacao', 'admin123']
  );
  const profMaria = await db.run(
    `INSERT INTO people (card_id, name, role, registration, login, password) VALUES (?,?,?,?,?,?)`,
    ['P1001', 'Maria Silva', 'professor', 'PROF-01', 'maria', '123456']
  );
  const profJoao = await db.run(
    `INSERT INTO people (card_id, name, role, registration, login, password) VALUES (?,?,?,?,?,?)`,
    ['P1002', 'João Pereira', 'professor', 'PROF-02', 'joao', '123456']
  );

  const room101 = await db.run(`INSERT INTO rooms (name, device_token) VALUES (?,?)`, ['Sala 101', 'ESP32-SALA101-TOKEN']);
  const room102 = await db.run(`INSERT INTO rooms (name, device_token) VALUES (?,?)`, ['Sala 102', 'ESP32-SALA102-TOKEN']);

  const students = [
    ['A2001', 'Ana Costa'],
    ['A2002', 'Bruno Souza'],
    ['A2003', 'Carla Lima'],
    ['A2004', 'Diego Alves'],
    ['A2005', 'Eduarda Rocha'],
  ];
  const studentIds = [];
  for (const [card, name] of students) {
    const r = await db.run(
      `INSERT INTO people (card_id, name, role, registration, login, password) VALUES (?,?,?,?,?,?)`,
      [card, name, 'aluno', null, null, null]
    );
    studentIds.push(r.lastInsertRowid);
  }

  // Calcula o dia da semana de hoje em Brasília (sem importar utils.js aqui,
  // pra evitar referência circular entre os dois arquivos)
  const agoraBrasiliaSeed = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const weekday = agoraBrasiliaSeed.getUTCDay();

  const sched101 = await db.run(
    `INSERT INTO schedules (room_id, person_id, subject, weekday, start_time, end_time, tolerance_minutes) VALUES (?,?,?,?,?,?,?)`,
    [room101.lastInsertRowid, profMaria.lastInsertRowid, 'Matemática', weekday, '08:00', '09:40', 10]
  );
  const sched102 = await db.run(
    `INSERT INTO schedules (room_id, person_id, subject, weekday, start_time, end_time, tolerance_minutes) VALUES (?,?,?,?,?,?,?)`,
    [room102.lastInsertRowid, profJoao.lastInsertRowid, 'História', weekday, '08:00', '09:40', 10]
  );

  for (const sid of studentIds) {
    await db.run(`INSERT INTO class_students (schedule_id, person_id) VALUES (?,?)`, [sched101.lastInsertRowid, sid]);
  }
  await db.run(`INSERT INTO class_students (schedule_id, person_id) VALUES (?,?)`, [sched102.lastInsertRowid, studentIds[1]]);
  await db.run(`INSERT INTO class_students (schedule_id, person_id) VALUES (?,?)`, [sched102.lastInsertRowid, studentIds[3]]);

  console.log('Banco de dados criado e populado com dados de exemplo.');
}

async function initDb() {
  await createSchema();
  await seedIfEmpty();
}

async function deletePersonCascade(id) {
  await client.batch(
    [
      { sql: 'DELETE FROM attendance WHERE person_id = ?', args: [id] },
      { sql: 'DELETE FROM breaks WHERE person_id = ?', args: [id] },
      { sql: 'DELETE FROM access_events WHERE person_id = ?', args: [id] },
      { sql: 'DELETE FROM class_students WHERE person_id = ?', args: [id] },
    ],
    'write'
  );

  const schedules = await db.all('SELECT id FROM schedules WHERE person_id = ?', [id]);
  const stmts = [];
  for (const s of schedules) {
    stmts.push({ sql: 'DELETE FROM class_students WHERE schedule_id = ?', args: [s.id] });
    stmts.push({ sql: 'DELETE FROM attendance WHERE schedule_id = ?', args: [s.id] });
  }
  stmts.push({ sql: 'DELETE FROM schedules WHERE person_id = ?', args: [id] });
  stmts.push({ sql: 'DELETE FROM people WHERE id = ?', args: [id] });
  await client.batch(stmts, 'write');
}

async function deleteRoomCascade(id) {
  const schedules = await db.all('SELECT id FROM schedules WHERE room_id = ?', [id]);
  const stmts = [];
  for (const s of schedules) {
    stmts.push({ sql: 'DELETE FROM class_students WHERE schedule_id = ?', args: [s.id] });
    stmts.push({ sql: 'DELETE FROM attendance WHERE schedule_id = ?', args: [s.id] });
  }
  stmts.push({ sql: 'DELETE FROM schedules WHERE room_id = ?', args: [id] });
  stmts.push({ sql: 'DELETE FROM attendance WHERE room_id = ?', args: [id] });
  stmts.push({ sql: 'DELETE FROM breaks WHERE room_id = ?', args: [id] });
  stmts.push({ sql: 'DELETE FROM access_events WHERE room_id = ?', args: [id] });
  stmts.push({ sql: 'DELETE FROM rooms WHERE id = ?', args: [id] });
  await client.batch(stmts, 'write');
}

async function deleteScheduleCascade(id) {
  await client.batch(
    [
      { sql: 'DELETE FROM class_students WHERE schedule_id = ?', args: [id] },
      { sql: 'DELETE FROM attendance WHERE schedule_id = ?', args: [id] },
      { sql: 'DELETE FROM schedules WHERE id = ?', args: [id] },
    ],
    'write'
  );
}

module.exports = {
  db,
  BREAK_LIMITS,
  initDb,
  deletePersonCascade,
  deleteRoomCascade,
  deleteScheduleCascade,
};
