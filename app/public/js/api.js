// API helpers: fetch /version and /api/menu with a timeout; failures resolve to null so the UI can show "offline".
async function getJSON(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Share one in-flight/recent /version request between all modules.
let cached = null;
let cachedAt = 0;
export async function getVersion() {
  if (cached && Date.now() - cachedAt < 3000) return cached;
  cached = getJSON('/version');
  cachedAt = Date.now();
  return cached;
}

export const getMenu = () => getJSON('/api/menu');

// Indian number formatting for rupee prices, e.g. 1040 -> ₹1,040.
export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');
