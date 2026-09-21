require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');

const { router: authRouter } = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');
const { requireCoordenacao } = require('./middleware/requireCoordenacao');
const deviceRoutes = require('./routes/device');
const roomsRoutes = require('./routes/rooms');
const alertsRoutes = require('./routes/alerts');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/device', deviceRoutes);
app.use('/api/rooms', requireAuth, roomsRoutes);
app.use('/api/alerts', requireAuth, alertsRoutes);
app.use('/api/reports', requireAuth, reportsRoutes);
app.use('/api/admin', requireAuth, requireCoordenacao, adminRoutes);

const BACKEND_VERSION = '1.5.0'; // atualize este número a cada nova versão entregue

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'bate-ponto-api', version: BACKEND_VERSION }));

const PORT = process.env.PORT || 3001;

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`API do Bate-Ponto (v${BACKEND_VERSION}) rodando em http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Erro ao iniciar o servidor:', err);
  process.exit(1);
});
