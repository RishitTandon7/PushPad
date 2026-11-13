// Pipeline: the vertical line fills with scroll progress and each step lights up when the line reaches it.
export function initPipeline() {
  const wrap = document.querySelector('.steps');
  if (!wrap) return;
  const steps = [...wrap.querySelectorAll('.step')];
  const update = () => {
    const r = wrap.getBoundingClientRect();
    const focus = window.innerHeight * 0.6;       // the "reading line" on screen
    const p = Math.min(1, Math.max(0, (focus - r.top) / r.height));
    wrap.style.setProperty('--p', p.toFixed(3));
    steps.forEach((s) => {
      const sr = s.getBoundingClientRect();
      s.classList.toggle('on', sr.top + sr.height / 2 < focus);
    });
  };
  update();
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
}
