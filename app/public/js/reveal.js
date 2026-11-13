// Scroll reveal: fade elements in once, staggering siblings with --i.
export function initReveal() {
  const items = [...document.querySelectorAll('.reveal')];
  items.forEach((el) => {
    const idx = [...el.parentElement.children].filter((c) => c.classList.contains('reveal')).indexOf(el);
    el.style.setProperty('--i', Math.min(idx, 6));
  });
  if (!('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.1 });
  items.forEach((el) => io.observe(el));
}
