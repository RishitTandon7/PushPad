// Tilt: raised elements lean 2-3 degrees toward the cursor, with a hairline highlight that follows the pointer.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAX = 2.5;   // degrees

export function initTilt() {
  if (reduce || matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    const hl = document.createElement('i');
    hl.className = 'hl';
    hl.setAttribute('aria-hidden', 'true');
    el.append(hl);
    let queued = false;
    let ev = null;

    const apply = () => {
      queued = false;
      if (!ev) return;
      const r = el.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
      el.style.transform = `perspective(1100px) rotateX(${((0.5 - py) * 2 * MAX).toFixed(2)}deg) rotateY(${((px - 0.5) * 2 * MAX).toFixed(2)}deg)`;
      hl.style.transform = `translateX(${(px * r.width).toFixed(1)}px)`;
    };

    el.addEventListener('pointermove', (e) => {
      ev = e;
      el.classList.add('tilting');
      if (!queued) { queued = true; requestAnimationFrame(apply); }
    });
    el.addEventListener('pointerleave', () => {
      ev = null;
      el.classList.remove('tilting');
      el.style.transform = '';
    });
  });
}
