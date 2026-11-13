// Preloader: boot log + progress counter, ends when fonts and /version are ready (3s hard cap), then splits open.
import { getVersion } from './api.js';

const LINES = ['git push', 'webhook received', 'tests passed', 'terraform apply', 'health check ok'];
const MIN_MS = 1100;   // shortest time the animation plays
const CAP_MS = 2100;   // stop waiting for readiness here, so the whole preloader ends by about 3s
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const root = document.documentElement;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Tell the hero to play its entrance (it listens for this event).
const openHero = () => document.dispatchEvent(new Event('pp:hero'));

// Remove the overlay and unlock scrolling.
function done(el) {
  root.classList.remove('preload');
  el.remove();
}

export async function initPreloader() {
  const el = document.getElementById('preloader');
  if (!root.classList.contains('preload') || !el) { if (el) el.remove(); openHero(); return; }
  try { sessionStorage.setItem('pp-seen', '1'); } catch { /* storage blocked: fine */ }

  // Real readiness: fonts decoded and /version answered (null on failure still counts as answered).
  let ready = false;
  Promise.all([document.fonts ? document.fonts.ready : null, getVersion()]).then(() => { ready = true; });
  setTimeout(() => { ready = true; }, CAP_MS);

  if (reduce) {
    el.classList.add('pl-reduced');
    await wait(Math.min(600, CAP_MS));
    el.classList.add('out');
    openHero();
    await wait(350);
    done(el);
    return;
  }

  const log = document.getElementById('pl-log');
  const fill = document.getElementById('pl-fill');
  const count = document.getElementById('pl-count');
  const full = LINES.map((l) => '> ' + l);
  const total = full.join('').length;

  // Show the first n characters of the boot log, with an orange prompt and a blinking cursor.
  const draw = (n) => {
    let left = n;
    const rows = full.map((line) => {
      const part = line.slice(0, Math.max(0, left));
      left -= line.length;
      return part ? '<b>&gt;</b>' + part.slice(1).replace(/&/g, '&amp;').replace(/</g, '&lt;') : '';
    }).filter(Boolean);
    log.innerHTML = rows.join('\n') + '<span class="cur"></span>';
  };

  const t0 = performance.now();
  let shown = 0;
  let finished = false;

  const finish = async () => {
    if (finished) return;
    finished = true;
    draw(total);
    fill.style.transform = 'scaleX(1)';
    count.textContent = '100';
    await wait(150);
    el.classList.add('out');
    openHero();
    await wait(800);
    done(el);
  };

  const frame = (now) => {
    if (finished) return;
    const elapsed = now - t0;
    let p = Math.min(1, elapsed / MIN_MS);
    if (!ready) p = Math.min(p, 0.9);               // hold at 90% until the page is really ready
    shown += (p - shown) * 0.25;                     // ease the counter toward the target
    draw(Math.floor(Math.min(1, shown / 0.9) * total));
    fill.style.transform = 'scaleX(' + shown.toFixed(3) + ')';
    count.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    if (p >= 1 && shown > 0.985) { finish(); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // Absolute safety net, even if animation frames are throttled (background tab).
  setTimeout(finish, 2600);
}
