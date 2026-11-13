// API helpers. Every call resolves to { ok, status, data }; network failures resolve to { ok: false, status: 0 } so the UI can show "offline".
async function call(method, url, { body, headers } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      method,
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

// Share one in-flight/recent /version request between modules (the preloader waits on it too).
let cached = null;
let cachedAt = 0;
export async function getVersion() {
  if (cached && Date.now() - cachedAt < 3000) return cached;
  cachedAt = Date.now();
  cached = call('GET', '/version').then((r) => (r.ok ? r.data : null));
  return cached;
}

export const getPlatform = () => call('GET', '/api/platform');
export const createDeployment = (payload) => call('POST', '/api/deployments', { body: payload });
export const getDeployment = (id) => call('GET', '/api/deployments/' + encodeURIComponent(id));
export const listDeployments = () => call('GET', '/api/deployments');
export const deleteDeployment = (id, token) => call('DELETE', '/api/deployments/' + encodeURIComponent(id), { headers: { Authorization: 'Bearer ' + token } });
