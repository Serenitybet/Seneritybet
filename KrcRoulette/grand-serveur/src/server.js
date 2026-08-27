const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const env = require('./config/env');
const prisma = require('./config/prisma');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const { initSocket } = require('./socket/index');
const roundScheduler = require('./services/roundScheduler');
const dailyReportScheduler = require('./services/dailyReportScheduler');

const app = express();
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin/users', require('./routes/users.routes'));
app.use('/api/admin/villes', require('./routes/villes.routes'));
app.use('/api/admin/shops', require('./routes/shops.routes'));
app.use('/api/admin/credit', require('./routes/credit.routes'));
app.use('/api/admin/games', require('./routes/games.routes'));
app.use('/api/admin/rtp', require('./routes/rtp.routes'));
app.use('/api/admin/reports', require('./routes/reports.routes'));
app.use('/api/tickets', require('./routes/tickets.routes'));

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: env.corsOrigin } });
initSocket(io);

async function seedRouletteGame() {
  await prisma.game.upsert({
    where: { key: 'roulette' },
    create: { key: 'roulette', name: 'Roulette européenne', isGlobalActive: true },
    update: {},
  });
}

async function bootstrap() {
  await seedRouletteGame();
  roundScheduler.start(io);
  dailyReportScheduler.start();

  httpServer.listen(env.port, () => {
    console.log(`KrcRoulette grand-serveur en écoute sur le port ${env.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Échec du démarrage du serveur:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  roundScheduler.stop();
  dailyReportScheduler.stop();
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
});

module.exports = { app, httpServer, io };
