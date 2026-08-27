(function () {
  // ── Stockage local ────────────────────────────────────────────
  function getApiBase() { return localStorage.getItem('kc_api_base') || 'http://localhost:4100'; }
  function setApiBase(u) { localStorage.setItem('kc_api_base', u.replace(/\/+$/, '')); }
  function getToken() { return localStorage.getItem('kc_token'); }
  function setToken(t) { localStorage.setItem('kc_token', t); }
  function getUser() { try { return JSON.parse(localStorage.getItem('kc_user') || 'null'); } catch { return null; } }
  function setUser(u) { localStorage.setItem('kc_user', JSON.stringify(u)); }
  function logout() {
    localStorage.removeItem('kc_token');
    localStorage.removeItem('kc_user');
    window.location.reload();
  }

  async function api(path, { method = 'GET', body } = {}) {
    const token = getToken();
    const res = await fetch(getApiBase() + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  }

  function fmtFcfa(n) { return new Intl.NumberFormat('fr-FR').format(n || 0) + ' FCFA'; }

  // ── Écrans ────────────────────────────────────────────────────
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');

  document.getElementById('api-base').value = getApiBase();

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    const apiBase = document.getElementById('api-base').value.trim();
    if (apiBase) setApiBase(apiBase);

    try {
      const { token, user } = await api('/api/auth/login', {
        method: 'POST',
        body: {
          username: document.getElementById('username').value.trim(),
          password: document.getElementById('password').value,
        },
      });
      if (user.role !== 'CAISSIER') {
        errorEl.textContent = "Ce compte n'est pas un compte caissier";
        return;
      }
      setToken(token);
      setUser(user);
      boot();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  document.getElementById('btn-logout').addEventListener('click', logout);

  // ── Onglets ───────────────────────────────────────────────────
  document.querySelectorAll('.tabs button').forEach((btn) =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-bet').classList.toggle('hidden', btn.dataset.tab !== 'bet');
      document.getElementById('tab-validate').classList.toggle('hidden', btn.dataset.tab !== 'validate');
    })
  );

  // ── Formulaire de mise ───────────────────────────────────────
  const betsList = document.getElementById('bets-list');

  function valueControlHtml(betType, rowId) {
    if (betType === 'NUMBER') {
      return `<input type="number" min="0" max="36" placeholder="0-36" data-value="${rowId}">`;
    }
    if (betType === 'COLOR') {
      return `<select data-value="${rowId}"><option value="rouge">Rouge</option><option value="noir">Noir</option></select>`;
    }
    if (betType === 'PARITY') {
      return `<select data-value="${rowId}"><option value="pair">Pair</option><option value="impair">Impair</option></select>`;
    }
    return `<select data-value="${rowId}"><option value="1-12">1-12</option><option value="13-24">13-24</option><option value="25-36">25-36</option></select>`;
  }

  let rowCounter = 0;

  function addBetRow() {
    const rowId = ++rowCounter;
    const row = document.createElement('div');
    row.className = 'bet-row';
    row.dataset.row = rowId;
    row.innerHTML = `
      <select data-type="${rowId}">
        <option value="NUMBER">Numéro</option>
        <option value="COLOR">Couleur</option>
        <option value="PARITY">Pair/Impair</option>
        <option value="DOZEN">Douzaine</option>
      </select>
      <span class="value-slot">${valueControlHtml('NUMBER', rowId)}</span>
      <input type="number" min="1" placeholder="Mise (FCFA)" data-stake="${rowId}" style="max-width:140px">
      <button type="button" class="remove" data-remove="${rowId}">✕</button>
    `;
    betsList.appendChild(row);

    row.querySelector(`[data-type="${rowId}"]`).addEventListener('change', (e) => {
      row.querySelector('.value-slot').innerHTML = valueControlHtml(e.target.value, rowId);
      updateTotal();
    });
    row.querySelector(`[data-stake="${rowId}"]`).addEventListener('input', updateTotal);
    row.querySelector(`[data-remove="${rowId}"]`).addEventListener('click', () => {
      row.remove();
      updateTotal();
    });
    updateTotal();
  }

  function updateTotal() {
    let total = 0;
    document.querySelectorAll('[data-stake]').forEach((input) => {
      total += parseInt(input.value, 10) || 0;
    });
    document.getElementById('total-stake').textContent = fmtFcfa(total);
  }

  document.getElementById('btn-add-bet').addEventListener('click', addBetRow);

  function collectBets() {
    const bets = [];
    document.querySelectorAll('.bet-row').forEach((row) => {
      const rowId = row.dataset.row;
      const betType = row.querySelector(`[data-type="${rowId}"]`).value;
      const betValue = row.querySelector(`[data-value="${rowId}"]`).value;
      const stake = parseInt(row.querySelector(`[data-stake="${rowId}"]`).value, 10);
      if (stake > 0) bets.push({ betType, betValue: String(betValue), stake });
    });
    return bets;
  }

  document.getElementById('btn-submit-ticket').addEventListener('click', async () => {
    const errorEl = document.getElementById('bet-error');
    errorEl.textContent = '';
    const bets = collectBets();
    if (bets.length === 0) {
      errorEl.textContent = 'Ajoutez au moins une mise valide';
      return;
    }

    try {
      const ticket = await api('/api/tickets', { method: 'POST', body: { bets } });
      await printTicket(ticket);
      betsList.innerHTML = '';
      addBetRow();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  const betTypeLabels = { NUMBER: 'Numéro', COLOR: '', PARITY: '', DOZEN: 'Douzaine' };
  function betLabel(bet) {
    if (bet.betType === 'NUMBER') return `Numéro ${bet.betValue}`;
    if (bet.betType === 'COLOR') return bet.betValue === 'rouge' ? 'Rouge' : 'Noir';
    if (bet.betType === 'PARITY') return bet.betValue === 'pair' ? 'Pair' : 'Impair';
    return `Douzaine ${bet.betValue}`;
  }

  async function printTicket(ticket) {
    const user = getUser();
    const printArea = document.getElementById('print-area');
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, ticket.ticketCode, { width: 140, margin: 1 });

    const linesHtml = ticket.bets
      .map((b) => `<div class="line"><span>${betLabel(b)}</span><span>${fmtFcfa(b.stake)}</span></div>`)
      .join('');

    printArea.innerHTML = `
      <div class="ticket">
        <div class="shop">${ticket.shop.name} — Partie</div>
        <hr>
        ${linesHtml}
        <hr>
        <div class="line"><strong>TOTAL MISÉ</strong><strong>${fmtFcfa(ticket.totalStake)}</strong></div>
        <hr>
        <div class="qr">${qrCanvas.outerHTML}</div>
        <div class="code">ID: ${ticket.ticketCode}</div>
      </div>
    `;
    printArea.classList.remove('hidden');
    window.print();
    printArea.classList.add('hidden');
  }

  // ── Validation de ticket ─────────────────────────────────────
  const resultCard = document.getElementById('ticket-result-card');
  let currentTicketCode = null;

  async function lookupTicket(code) {
    const errorEl = document.getElementById('bet-error');
    try {
      const ticket = await api('/api/tickets/' + encodeURIComponent(code));
      currentTicketCode = ticket.ticketCode;
      document.getElementById('rt-code').textContent = ticket.ticketCode;
      const statusEl = document.getElementById('rt-status');
      statusEl.textContent = ticket.status;
      statusEl.className = 'status-badge ' + ticket.status;
      document.getElementById('rt-stake').textContent = fmtFcfa(ticket.totalStake);
      document.getElementById('rt-payout').textContent = fmtFcfa(ticket.totalPayout);
      document.getElementById('btn-pay').classList.toggle('hidden', ticket.status !== 'WON');
      resultCard.classList.remove('hidden');
    } catch (err) {
      alert(err.message);
    }
  }

  document.getElementById('btn-lookup').addEventListener('click', () => {
    const code = document.getElementById('manual-code').value.trim();
    if (code) lookupTicket(code);
  });

  document.getElementById('btn-pay').addEventListener('click', async () => {
    if (!currentTicketCode) return;
    try {
      await api(`/api/tickets/${encodeURIComponent(currentTicketCode)}/pay`, { method: 'POST' });
      lookupTicket(currentTicketCode);
    } catch (err) {
      alert(err.message);
    }
  });

  // ── Scan caméra (jsQR) ────────────────────────────────────────
  let scanning = false;
  let stream = null;
  const video = document.getElementById('scanner-video');
  const canvas = document.getElementById('scanner-canvas');
  const ctx = canvas.getContext('2d');

  async function toggleScan() {
    const btn = document.getElementById('btn-toggle-scan');
    if (scanning) {
      scanning = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      video.classList.add('hidden');
      btn.textContent = 'Activer la caméra';
      return;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      video.classList.remove('hidden');
      await video.play();
      scanning = true;
      btn.textContent = 'Désactiver la caméra';
      requestAnimationFrame(scanFrame);
    } catch (err) {
      alert("Impossible d'accéder à la caméra: " + err.message);
    }
  }

  function scanFrame() {
    if (!scanning) return;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        scanning = false;
        if (stream) stream.getTracks().forEach((t) => t.stop());
        video.classList.add('hidden');
        document.getElementById('btn-toggle-scan').textContent = 'Activer la caméra';
        lookupTicket(code.data);
        return;
      }
    }
    requestAnimationFrame(scanFrame);
  }

  document.getElementById('btn-toggle-scan').addEventListener('click', toggleScan);

  // ── Démarrage ─────────────────────────────────────────────────
  async function boot() {
    const user = getUser();
    if (!getToken() || !user) {
      loginScreen.classList.remove('hidden');
      appScreen.classList.add('hidden');
      return;
    }
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    if (betsList.children.length === 0) addBetRow();

    if (user.shopId) {
      try {
        const shop = await api('/api/admin/shops/' + user.shopId);
        document.getElementById('shop-name').textContent = shop.name;
      } catch {
        document.getElementById('shop-name').textContent = '';
      }
    }
  }

  boot();
})();
