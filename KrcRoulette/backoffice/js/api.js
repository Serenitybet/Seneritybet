const KR = (function () {
  function getApiBase() {
    return localStorage.getItem('kr_api_base') || 'http://localhost:4100';
  }
  function setApiBase(url) {
    localStorage.setItem('kr_api_base', url.replace(/\/+$/, ''));
  }
  function getToken() {
    return localStorage.getItem('kr_token');
  }
  function setToken(t) {
    localStorage.setItem('kr_token', t);
  }
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('kr_user') || 'null');
    } catch {
      return null;
    }
  }
  function setUser(u) {
    localStorage.setItem('kr_user', JSON.stringify(u));
  }
  function logout() {
    localStorage.removeItem('kr_token');
    localStorage.removeItem('kr_user');
    window.location.href = pathTo('index.html');
  }

  function pathTo(target) {
    const depth = window.location.pathname.includes('/pages/') ? '../' : '';
    return depth + target;
  }

  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const token = getToken();
    const res = await fetch(getApiBase() + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      logout();
      throw new Error('Session expirée');
    }

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.blob();

    if (!res.ok) {
      throw new Error((isJson && data && data.error) || 'Erreur serveur');
    }
    return data;
  }

  function requireAuth() {
    if (!getToken()) window.location.href = pathTo('index.html');
  }

  function requireRole(...roles) {
    const u = getUser();
    if (!u || !roles.includes(u.role)) {
      window.location.href = pathTo('pages/dashboard.html');
    }
  }

  function fmtFcfa(n) {
    return new Intl.NumberFormat('fr-FR').format(n || 0) + ' FCFA';
  }

  function fmtDate(d) {
    return new Date(d).toLocaleString('fr-FR');
  }

  return {
    getApiBase,
    setApiBase,
    getToken,
    setToken,
    getUser,
    setUser,
    logout,
    request,
    requireAuth,
    requireRole,
    pathTo,
    fmtFcfa,
    fmtDate,
  };
})();
