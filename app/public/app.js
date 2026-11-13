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

