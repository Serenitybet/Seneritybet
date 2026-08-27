function renderNav(active) {
  const user = KR.getUser();
  const items = [
    { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
    { key: 'villes', label: 'Villes', href: 'villes.html' },
    { key: 'shops', label: 'Shops', href: 'shops.html' },
    { key: 'users', label: 'Utilisateurs', href: 'users.html' },
    { key: 'credit', label: 'Crédit', href: 'credit.html' },
    { key: 'games', label: 'Jeux', href: 'games.html' },
    { key: 'rtp', label: 'RTP', href: 'rtp.html' },
    { key: 'reports', label: 'Rapports', href: 'reports.html' },
  ];

  const links = items
    .map(
      (it) =>
        `<a href="${it.href}" class="${it.key === active ? 'active' : ''}">${it.label}</a>`
    )
    .join('');

  document.getElementById('sidebar').innerHTML = `
    <div class="brand">KrcRoulette</div>
    ${links}
    <div class="logout" id="kr-logout">${user ? user.username + ' — Déconnexion' : 'Déconnexion'}</div>
  `;

  document.getElementById('kr-logout').addEventListener('click', () => KR.logout());
}
