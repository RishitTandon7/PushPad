// Grid lines: each ruled band gets .in-view when it enters the viewport, so CSS can draw its lines in.
export function initGridLines() {
  const bands = document.querySelectorAll('.band');
  if (!('IntersectionObserver' in window)) { bands.forEach((b) => b.classList.add('in-view')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
  }, { threshold: 0.08 });
  bands.forEach((b) => io.observe(b));
}
