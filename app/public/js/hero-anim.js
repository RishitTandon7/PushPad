// Hero entrance: split the headline into letters, then slide them in (and blink the corner squares) when the preloader opens.
const root = document.documentElement;

function splitTitle() {
  const title = document.getElementById('hero-title');
  if (!title || title.dataset.split) return;
  title.dataset.split = '1';
  title.setAttribute('aria-label', 'Push branch');
  let i = 0;
  // Wrap every letter outside the orange underscore in clip + slide spans.
  [...title.childNodes].forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) { node.setAttribute('aria-hidden', 'true'); return; }
    const frag = document.createDocumentFragment();
    for (const ch of node.textContent) {
      const clip = document.createElement('span');
      clip.className = 'ch';
      clip.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.className = 'ci';
      inner.style.setProperty('--i', i++);
      inner.textContent = ch;
      clip.append(inner);
      frag.append(clip);
    }
    node.replaceWith(frag);
  });
}

export function initHeroAnim() {
  splitTitle();
  const play = () => root.classList.add('hero-in');
  // The preloader fires this when it starts to open; with no preloader we play at once.
  if (!root.classList.contains('preload')) play();
  else document.addEventListener('pp:hero', play, { once: true });
  setTimeout(play, 6000);   // safety: never leave the headline hidden
}
