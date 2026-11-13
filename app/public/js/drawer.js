// FAQ drawer: slides in from the right. Focus is trapped inside; Esc or a click on the backdrop closes it; focus returns to the opener.
const root = document.documentElement;
const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

export function initDrawer() {
  const drawer = document.getElementById('faq-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const closeBtn = document.getElementById('drawer-close');
  const openers = [...document.querySelectorAll('[data-open-faq]')];
  if (!drawer || !backdrop || !closeBtn) return;
  const background = [document.querySelector('.shell'), document.querySelector('.progress')].filter(Boolean);
  let opener = null;

  const isOpen = () => root.classList.contains('drawer-open');

  function open(from) {
    if (isOpen()) return;
    opener = from || document.activeElement;
    root.classList.add('drawer-open');
    drawer.setAttribute('aria-hidden', 'false');
    openers.forEach((o) => o.setAttribute('aria-expanded', 'true'));
    background.forEach((el) => el.setAttribute('inert', ''));    // nothing behind the drawer can be reached
    closeBtn.focus();
  }

  function close() {
    if (!isOpen()) return;
    root.classList.remove('drawer-open');
    drawer.setAttribute('aria-hidden', 'true');
    openers.forEach((o) => o.setAttribute('aria-expanded', 'false'));
    background.forEach((el) => el.removeAttribute('inert'));
    if (opener && opener.focus) opener.focus();
  }

  openers.forEach((o) => o.addEventListener('click', () => open(o)));
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    // Focus trap: wrap Tab / Shift+Tab inside the drawer.
    const items = [...drawer.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const lastItem = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastItem.focus(); }
    else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); first.focus(); }
  });
}
