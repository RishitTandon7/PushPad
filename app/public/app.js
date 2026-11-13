/* §0 base: shared fetch helper, scroll reveal, footer year */
window.PushPad = {
  // Fetch JSON with a timeout; throws on any failure so callers can show "offline".
  async getJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  },
};

(function revealOnScroll() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach((el) => io.observe(el));
})();

/* §1 navbar: mobile hamburger */
(function hamburger() {
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  // Close the menu after choosing a link.
  menu.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      menu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    }
  });
})();

/* §2 hero: live status pill from /version */
(async function statusPill() {
  const pill = document.getElementById('status-pill');
  const text = document.getElementById('status-text');
  try {
    const v = await window.PushPad.getJSON('/version');
    pill.classList.add('live');
    text.textContent = `LIVE · branch ${v.branch} · build #${v.build} · ${String(v.env).toUpperCase()}`;
  } catch {
    pill.classList.add('offline');
    text.textContent = 'OFFLINE · cannot reach /version';
  }
})();

/* §6 live build panel: poll /version every 10 seconds */
(function liveBuild() {
  const $ = (id) => document.getElementById(id);
  const term = $('terminal');
  const badge = $('env-badge');

  // "5 minutes ago" style text for the deploy time.
  function ago(iso) {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (Number.isNaN(s)) return 'unknown';
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  async function poll() {
    try {
      const v = await window.PushPad.getJSON('/version');
      term.classList.remove('offline');
      $('lv-branch').textContent = v.branch;
      $('lv-build').textContent = '#' + v.build;
      $('lv-commit').textContent = String(v.commit).slice(0, 7);
      $('lv-deployed').textContent = ago(v.deployedAt);
      badge.textContent = String(v.env).toUpperCase();
      badge.className = 'badge ' + (v.env === 'prod' ? 'prod' : v.env === 'preview' ? 'preview' : '');
      $('lv-foot').textContent = 'Last checked ' + new Date().toLocaleTimeString();
    } catch {
      term.classList.add('offline');
      badge.textContent = 'OFFLINE';
      badge.className = 'badge offline';
      $('lv-foot').textContent = 'Server unreachable. Retrying in 10s…';
    }
  }
  poll();
  setInterval(poll, 10000);
})();

