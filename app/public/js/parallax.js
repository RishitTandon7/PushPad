// Parallax: the fine sub-grid drifts slower than the page, foreground details (.fg) a little faster, and the headline copy shifts.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PERIOD = 14;   // the sub-grid repeats every 14px, so wrapping the offset keeps it seamless

export function initParallax() {
  if (reduce) return;
  const sub = document.querySelector('.subgrid');
  const title = document.getElementById('hero-title');
  const fgs = [...document.querySelectorAll('.fg')];
  let queued = false;

  const update = () => {
    queued = false;
    const y = scrollY;
    if (sub) sub.style.transform = `translate3d(0, ${(-((y * 0.12) % PERIOD)).toFixed(1)}px, 0)`;
    fgs.forEach((el) => {
      const speed = Number(el.dataset.speed || 0.06);
      el.style.transform = `translate3d(0, ${(-y * speed).toFixed(1)}px, 0)`;
    });
    if (title) {
      title.style.setProperty('--hx', (-y * 0.03).toFixed(1) + 'px');
      title.style.setProperty('--hy', (y * 0.05).toFixed(1) + 'px');
    }
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}
