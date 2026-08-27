const prisma = require('../config/prisma');

function monthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

async function getMonthlyStats(shopId, date = new Date()) {
  const { start, end } = monthRange(date);
  const agg = await prisma.rtpDailyStat.aggregate({
    where: { shopId, date: { gte: start, lt: end } },
    _sum: { totalWagered: true, totalPaid: true },
  });

  const totalWagered = agg._sum.totalWagered || 0;
  const totalPaid = agg._sum.totalPaid || 0;
  const rtp = totalWagered > 0 ? (totalPaid / totalWagered) * 100 : 0;

  return { totalWagered, totalPaid, rtp };
}

async function getProjection(shopId, date = new Date()) {
  const stats = await getMonthlyStats(shopId, date);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const dayOfMonth = date.getDate();

  const projectedWagered = dayOfMonth > 0 ? (stats.totalWagered / dayOfMonth) * daysInMonth : 0;
  const projectedPaid = dayOfMonth > 0 ? (stats.totalPaid / dayOfMonth) * daysInMonth : 0;
  const projectedRtp = projectedWagered > 0 ? (projectedPaid / projectedWagered) * 100 : 0;

  return { ...stats, projectedWagered, projectedPaid, projectedRtp, daysInMonth, dayOfMonth };
}

// Incrémente les cumuls du jour pour un shop (appelé au règlement de chaque round)
async function recordDailyDelta({ shopId, wagered, paid, tx = prisma }) {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return tx.rtpDailyStat.upsert({
    where: { shopId_date: { shopId, date } },
    create: { shopId, date, totalWagered: wagered, totalPaid: paid },
    update: { totalWagered: { increment: wagered }, totalPaid: { increment: paid } },
  });
}

module.exports = { monthRange, getMonthlyStats, getProjection, recordDailyDelta };
