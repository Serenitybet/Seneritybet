(function () {
  const setupScreen = document.getElementById('setup-screen');
  const mainScreen = document.getElementById('main-screen');
  const statusDot = document.getElementById('status-dot');
  const timerEl = document.getElementById('timer');
  const roundLabel = document.getElementById('round-label');
  const shopNameEl = document.getElementById('shop-name');
  const displayArea = document.getElementById('display-area');

  let countdownTimer = null;

  function getStoredConfig() {
    try {
      return JSON.parse(localStorage.getItem('krms_config') || 'null');
    } catch {
      return null;
    }
  }

  function saveConfig(config) {
    localStorage.setItem('krms_config', JSON.stringify(config));
  }

  function colorClass(color) {
    return { rouge: 'color-rouge', noir: 'color-noir', vert: 'color-vert' }[color] || 'color-noir';
  }

  function renderTimer(seconds) {
    displayArea.innerHTML = `<div class="timer" id="timer">${seconds}</div>`;
  }

  function startCountdown(closesAt) {
    if (countdownTimer) clearInterval(countdownTimer);
    function tick() {
      const remaining = Math.max(0, Math.round((new Date(closesAt).getTime() - Date.now()) / 1000));
      renderTimer(remaining);
      const timerNode = document.getElementById('timer');
      if (timerNode && remaining <= 5) timerNode.classList.add('closing');
      if (remaining <= 0) clearInterval(countdownTimer);
    }
    tick();
    countdownTimer = setInterval(tick, 250);
  }

  function showSpinning() {
    if (countdownTimer) clearInterval(countdownTimer);
    displayArea.innerHTML = `<div class="result-wheel spinning color-noir">•</div>`;
  }

  function showResult(winningNumber, winningColor) {
    displayArea.innerHTML = `<div class="result-wheel ${colorClass(winningColor)}">${winningNumber}</div>`;
  }

  function connect(config) {
    setupScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    shopNameEl.textContent = 'Connexion...';

    const socket = io(config.serverUrl, {
      auth: { workCode: config.workCode, role: 'display' },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => statusDot.classList.add('online'));
    socket.on('disconnect', () => statusDot.classList.remove('online'));

    socket.on('connected', ({ shopName }) => {
      shopNameEl.textContent = shopName;
      roundLabel.textContent = 'En attente du prochain tirage';
    });

    socket.on('error', ({ message }) => {
      shopNameEl.textContent = 'Erreur';
      roundLabel.textContent = message;
      localStorage.removeItem('krms_config');
      setTimeout(() => window.location.reload(), 4000);
    });

    socket.on('round:opened', ({ roundNumber, closesAt }) => {
      roundLabel.textContent = `Partie #${roundNumber} — Placez vos mises`;
      startCountdown(closesAt);
    });

    socket.on('round:closing', () => {
      roundLabel.textContent = 'Mises fermées — tirage en cours';
      showSpinning();
    });

    socket.on('round:result', ({ roundNumber, winningNumber, winningColor }) => {
      roundLabel.textContent = `Partie #${roundNumber} — Résultat`;
      showResult(winningNumber, winningColor);
    });
  }

  document.getElementById('btn-connect')?.addEventListener('click', () => {
    const workCode = document.getElementById('work-code').value.trim().toUpperCase();
    const serverUrl = document.getElementById('server-url').value.trim();
    const errorEl = document.getElementById('setup-error');

    if (!workCode || !serverUrl) {
      errorEl.textContent = 'Code de travail et adresse serveur requis';
      return;
    }

    const config = { workCode, serverUrl };
    saveConfig(config);
    connect(config);
  });

  const existing = getStoredConfig();
  if (existing) {
    connect(existing);
  } else {
    setupScreen.classList.remove('hidden');
  }
})();
