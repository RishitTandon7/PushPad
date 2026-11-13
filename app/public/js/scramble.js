// Scramble: labels flick through random mono characters, then settle on their real text (once, when visible).
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLYPHS = '01#/<>_-+=*';

function run(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);             // screen readers always get the real text
  let frame = 0;
  const total = 14;
  const timer = setInterval(() => {
    frame += 1;
    const settled = Math.floor((frame / total) * text.length);
    el.textContent = [...text].map((ch, i) => (ch === ' ' || i < settled) ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('');
    if (frame >= total) { clearInterval(timer); el.textContent = text; }
  }, 32);
}

export function initScramble() {
  if (reduce || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-scramble]').forEach((el) => io.observe(el));
}
