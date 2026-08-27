const prisma = require('../config/prisma');

function roomForWorkCode(workCode) {
  return `shop:${workCode}`;
}

function initSocket(io) {
  io.on('connection', async (socket) => {
    const { workCode, role } = socket.handshake.auth || {};

    if (!workCode || !['display', 'cashier'].includes(role)) {
      socket.emit('error', { message: 'workCode et role (display|cashier) requis' });
      socket.disconnect(true);
      return;
    }

    // Le serveur central est la SEULE autorité de validation — jamais de communication
    // directe entre mini-serveurs ou entre caisses de shops différents.
    const shop = await prisma.shop.findUnique({ where: { workCode } });
    if (!shop || !shop.isActive) {
      socket.emit('error', { message: 'Code de travail invalide ou shop inactif' });
      socket.disconnect(true);
      return;
    }

    socket.data.shopId = shop.id;
    socket.data.workCode = workCode;
    socket.data.role = role;
    socket.join(roomForWorkCode(workCode));

    socket.emit('connected', { shopId: shop.id, shopName: shop.name });

    // Renvoie l'état du round en cours à la connexion (utile en cas de rechargement d'écran)
    const openRound = await prisma.rouletteRound.findFirst({
      where: { shopId: shop.id, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });
    if (openRound) {
      socket.emit('round:opened', {
        roundId: openRound.id,
        roundNumber: openRound.roundNumber,
        closesAt: openRound.closesAt,
      });
    }
  });
}

function emitToShop(io, workCode, event, payload) {
  io.to(roomForWorkCode(workCode)).emit(event, payload);
}

module.exports = { initSocket, emitToShop, roomForWorkCode };
