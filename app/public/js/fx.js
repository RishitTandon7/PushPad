// Accent moment: when a deployment goes live, an orange pulse travels along the grid lines out from the URL card.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function line(style, cls) {
  const el = document.createElement('i');
  el.className = 'pulse ' + cls;
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, style);
  document.body.append(el);
  setTimeout(() => el.remove(), 1400);
}

export function pulseFrom(card) {
  if (reduce || !card) return;
  const r = card.getBoundingClientRect();
  const shell = document.querySelector('.shell').getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  // Horizontal rules: the top and bottom edges of the card, running out to both sides of the shell.
  [r.top, r.bottom].forEach((y) => line({ top: y + 'px', left: shell.left + 'px', width: shell.width + 'px', transformOrigin: (cx - shell.left) + 'px 50%' }, 'ph'));
  // Vertical guide lines at 25% and 75% of the shell, running up and down from the card.
  [0.25, 0.75].forEach((f) => line({ left: (shell.left + shell.width * f) + 'px', top: '0', height: '100vh', transformOrigin: '50% ' + cy + 'px' }, 'pv'));
}
