const ExcelJS = require('exceljs');
const prisma = require('../config/prisma');

function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

async function generateDailyReport(shopId, date = new Date()) {
  const date0 = dayStart(date);
  const nextDay = new Date(date0);
  nextDay.setDate(nextDay.getDate() + 1);

  const stat = await prisma.rtpDailyStat.findUnique({ where: { shopId_date: { shopId, date: date0 } } });
  const ticketsCount = await prisma.ticket.count({
    where: { shopId, createdAt: { gte: date0, lt: nextDay } },
  });

  const totalWagered = stat?.totalWagered || 0;
  const totalPaid = stat?.totalPaid || 0;
  const rtp = totalWagered > 0 ? (totalPaid / totalWagered) * 100 : 0;

  return prisma.dailyReport.upsert({
    where: { shopId_date: { shopId, date: date0 } },
    create: { shopId, date: date0, totalWagered, totalPaid, ticketsCount, rtp },
    update: { totalWagered, totalPaid, ticketsCount, rtp },
  });
}

async function generateAllDailyReports(date = new Date()) {
  const shops = await prisma.shop.findMany({ where: { isActive: true } });
  const results = [];
  for (const shop of shops) {
    results.push(await generateDailyReport(shop.id, date));
  }
  return results;
}

async function getReports({ shopId, villeId, from, to }) {
  const where = {};
  if (shopId) where.shopId = shopId;
  if (villeId) where.shop = { villeId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  return prisma.dailyReport.findMany({
    where,
    include: { shop: { include: { ville: true } } },
    orderBy: { date: 'desc' },
  });
}

async function buildWorkbook(reports) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rapports');

  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Shop', key: 'shop', width: 22 },
    { header: 'Ville', key: 'ville', width: 18 },
    { header: 'Total misé (FCFA)', key: 'wagered', width: 20 },
    { header: 'Total payé (FCFA)', key: 'paid', width: 20 },
    { header: 'Nb tickets', key: 'tickets', width: 12 },
    { header: 'RTP (%)', key: 'rtp', width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };

  reports.forEach((r) => {
    sheet.addRow({
      date: r.date.toISOString().slice(0, 10),
      shop: r.shop.name,
      ville: r.shop.ville?.name || '',
      wagered: r.totalWagered,
      paid: r.totalPaid,
      tickets: r.ticketsCount,
      rtp: Number(r.rtp.toFixed(2)),
    });
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { generateDailyReport, generateAllDailyReports, getReports, buildWorkbook };
