// Cursor light: a very faint orange glow eases toward the pointer; multiply blending tints the grid lines it passes over.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initLight() {
  const el = document.querySelector('.light');
  if (!el || reduce || matchMedia('(hover: none)').matches) return;
  let tx = innerWidth / 2;
  let ty = innerHeight / 3;
  let x = tx;
  let y = ty;
  let running = false;

  const frame = () => {
    x += (tx - x) * 0.14;
    y += (ty - y) * 0.14;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    if (Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5) requestAnimationFrame(frame);
    else running = false;
  };

  addEventListener('pointermove', (e) => {
    tx = e.clientX;
    ty = e.clientY;
    el.classList.add('on');
    if (!running) { running = true; requestAnimationFrame(frame); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => el.classList.remove('on'));
}
