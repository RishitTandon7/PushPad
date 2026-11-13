// FAQ accordion: each question is a button with aria-expanded; one answer open at a time.
export function initFaq() {
  const qs = [...document.querySelectorAll('.faq-q')];
  qs.forEach((q) => q.addEventListener('click', () => {
    const open = q.getAttribute('aria-expanded') === 'true';
    qs.forEach((o) => o.setAttribute('aria-expanded', 'false'));
    q.setAttribute('aria-expanded', String(!open));
  }));
}
