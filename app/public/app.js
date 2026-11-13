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

/* §7 carousel: render /api/menu with generated SVG placeholders */
(async function menuCarousel() {
  const track = document.getElementById('track');

  // Original SVG "plate" whose colours come from the image key, so no image files are needed.
  function dishSVG(key) {
    let h = 0;
    for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `<svg viewBox="0 0 200 130" role="img" aria-label="${String(key).replace(/[^a-z0-9 ]/gi, '')} illustration">
      <ellipse cx="100" cy="100" rx="78" ry="14" fill="hsl(${h} 30% 18%)"/>
      <rect x="45" y="55" width="110" height="42" rx="21" fill="#f4f1ea"/>
      <rect x="40" y="38" width="120" height="30" rx="15" fill="hsl(${h} 75% 62%)"/>
      <rect x="85" y="35" width="14" height="66" rx="3" fill="hsl(150 25% 14%)" opacity=".85"/>
    </svg>`;
  }

  try {
    const dishes = await window.PushPad.getJSON('/api/menu');
    track.textContent = '';
    dishes.forEach((d) => {
      const li = document.createElement('li');
      li.className = 'dish';
      li.innerHTML = dishSVG(d.image);
      const h3 = document.createElement('h3');
      h3.textContent = d.name;
      const row = document.createElement('div');
      row.className = 'row';
      const price = document.createElement('span');
      price.className = 'price';
      price.textContent = '₹' + Number(d.price).toLocaleString('en-IN');
      const veg = document.createElement('span');
      veg.className = 'veg' + (d.veg ? '' : ' non');
      veg.textContent = d.veg ? 'VEG' : 'NON-VEG';
      row.append(price, veg);
      li.append(h3, row);
      track.append(li);
    });
  } catch {
    track.innerHTML = '<li class="muted">Offline: could not load the menu.</li>';
  }

  // Arrow buttons scroll by roughly one card.
  const step = () => Math.max(240, track.clientWidth * 0.8);
  document.getElementById('car-prev').addEventListener('click', () => track.scrollBy({ left: -step() }));
  document.getElementById('car-next').addEventListener('click', () => track.scrollBy({ left: step() }));
})();

/* §8 FAQ accordion: keep only one answer open at a time */
(function faq() {
  const items = document.querySelectorAll('.faq details');
  items.forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) items.forEach((o) => { if (o !== d) o.open = false; });
  }));
})();

/* §9 footer: current year */
document.getElementById('year').textContent = new Date().getFullYear();
