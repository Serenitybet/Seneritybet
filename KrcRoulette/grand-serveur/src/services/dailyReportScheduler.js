const reportService = require('./report.service');

const CHECK_MS = 60 * 1000;
let lastRunDate = null;
let timer = null;

async function checkAndRun() {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  if (now.getHours() !== 0) return;
  if (lastRunDate === todayKey) return;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  try {
    await reportService.generateAllDailyReports(yesterday);
    lastRunDate = todayKey;
    console.log(`[dailyReportScheduler] Rapports générés pour ${yesterday.toISOString().slice(0, 10)}`);
  } catch (err) {
    console.error('[dailyReportScheduler] échec génération rapports:', err);
  }
}

function start() {
  if (timer) return;
  timer = setInterval(() => checkAndRun(), CHECK_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop };
