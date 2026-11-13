// Pipeline: steps light up one after another while an orange marker travels the line; loops gently while in view.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initPipeline() {
  const flow = document.getElementById('flow');
  if (!flow) return;
  const steps = [...flow.querySelectorAll('.fstep')];
  const dot = flow.querySelector('.flow-dot');
  const fill = flow.querySelector('.flow-fill');
  const vertical = matchMedia('(max-width: 860px)');

  // Centre of step k along the line, in px (x on desktop, y when stacked).
  const centre = (k) => {
    const s = steps[k];
    return vertical.matches ? s.offsetTop + s.offsetHeight / 2 : s.offsetLeft + s.offsetWidth / 2;
  };
  const place = (k) => {
    const pos = centre(k);
    const total = vertical.matches ? flow.offsetHeight : flow.offsetWidth;
    dot.style.transform = vertical.matches ? `translateY(${pos - 7}px)` : `translateX(${pos - 7}px)`;
    flow.style.setProperty('--p', (pos / total).toFixed(3));
  };

  if (reduce) {
    steps.forEach((s) => s.classList.add('on'));
    dot.style.display = 'none';
    flow.style.setProperty('--p', 1);
    return;
  }

  let timer = null;
  let k = -1;
  const reset = () => {
    steps.forEach((s) => s.classList.remove('on'));
    dot.classList.add('snap');
    fill.classList.add('snap');
    flow.style.setProperty('--p', 0);
    dot.style.transform = vertical.matches ? 'translateY(-7px)' : 'translateX(-7px)';
    void dot.offsetWidth;                      // flush so the snap back is instant
    dot.classList.remove('snap');
    fill.classList.remove('snap');
    k = -1;
  };
  const tick = () => {
    k += 1;
    if (k >= steps.length) {                   // all lit: hold, then loop
      timer = setTimeout(() => { reset(); timer = setTimeout(tick, 500); }, 1800);
      return;
    }
    steps[k].classList.add('on');
    place(k);
    timer = setTimeout(tick, 700);
  };

  reset();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && timer === null) timer = setTimeout(tick, 300);
      if (!e.isIntersecting && timer !== null) { clearTimeout(timer); timer = null; reset(); }
    });
  }, { threshold: 0.4 });
  io.observe(flow);
}
