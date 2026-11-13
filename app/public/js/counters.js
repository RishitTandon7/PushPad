// Counters: animate numbers up when visible. data-count is the target; data-source="build" reads /version.
import { getVersion } from './api.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function animate(el, target) {
  if (reduce) { el.textContent = target; return; }
  const start = performance.now();
  const dur = 1200;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function initCounters() {
  // Wait for the preloader to open so the numbers count up where people can see them.
  if (document.documentElement.classList.contains('preload')) {
    document.addEventListener('pp:hero', () => start(), { once: true });
    setTimeout(start, 6000);
  } else start();
}

let started = false;
function start() {
  if (started) return;
  started = true;
  const els = document.querySelectorAll('[data-count]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(async (e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target;
      if (el.dataset.source === 'build') {
        const v = await getVersion();
        if (v) animate(el, Number(v.build)); else el.textContent = '--';
      } else {
        animate(el, Number(el.dataset.count));
      }
    });
  }, { threshold: 0.4 });
  els.forEach((el) => io.observe(el));
}
