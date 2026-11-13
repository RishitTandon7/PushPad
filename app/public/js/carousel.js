// Carousel: render /api/menu as stat cards; arrows, drag/swipe and keyboard scrolling.
import { getMenu, rupees } from './api.js';

// Original SVG "plate" whose colours come from the image key, so no image files are needed.
function dishSVG(key) {
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<svg viewBox="0 0 200 120" aria-hidden="true">
    <ellipse cx="100" cy="92" rx="70" ry="12" fill="#cfcfcf"/>
    <rect x="45" y="52" width="110" height="38" rx="6" fill="#ffffff" stroke="#161616" stroke-width="2"/>
    <rect x="40" y="36" width="120" height="26" rx="6" fill="hsl(${h} 85% 58%)" stroke="#161616" stroke-width="2"/>
    <rect x="94" y="34" width="12" height="58" fill="#161616"/>
  </svg>`;
}

const cell = (value, label) => {
  const d = document.createElement('div');
  d.className = 'cell';
  const b = document.createElement('b');
  b.textContent = value;
  const s = document.createElement('span');
  s.textContent = label;
  d.append(b, s);
  return d;
};

function buildCard(d) {
  const li = document.createElement('li');
  li.className = 'card';
  const tag = document.createElement('span');
  tag.className = 'tag' + (d.veg ? '' : ' dark');
  tag.textContent = d.veg ? 'Veg' : 'Non-veg';
  const art = document.createElement('div');
  art.className = 'dish-art';
  art.innerHTML = dishSVG(d.image);
  const name = document.createElement('div');
  name.className = 'card-name';
  const h3 = document.createElement('h3');
  h3.textContent = d.name;
  name.append(h3);
  const stats = document.createElement('div');
  stats.className = 'card-stats';
  const arrow = document.createElement('a');
  arrow.className = 'arrow-cell';
  arrow.href = '#live';
  arrow.setAttribute('aria-label', 'Back to the live build panel');
  arrow.innerHTML = '<img src="assets/icons/arrow.svg" alt="">';
  stats.append(cell(rupees(d.price), 'Price'), cell(d.veg ? 'Veg' : 'Non-veg', 'Diet'),
    cell('#' + String(d.id).padStart(2, '0'), 'Item no.'), cell('menu.json', 'Source'), arrow);
  li.append(tag, art, name, stats);
  return li;
}

export async function initCarousel() {
  const track = document.getElementById('track');
  if (!track) return;
  const dishes = await getMenu();
  track.textContent = '';
  if (!dishes || !dishes.length) {
    const li = document.createElement('li');
    li.className = 'car-msg';
    li.textContent = 'OFFLINE: could not load the menu from /api/menu.';
    track.append(li);
  } else {
    dishes.forEach((d) => track.append(buildCard(d)));
  }

  const step = () => Math.max(260, track.clientWidth * 0.8);
  document.getElementById('car-prev').addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  document.getElementById('car-next').addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

  // Keyboard: arrow keys scroll when the track is focused.
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step() / 2, behavior: 'smooth' }); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); track.scrollBy({ left: -step() / 2, behavior: 'smooth' }); }
  });

  // Mouse drag; touch already swipes natively.
  let down = false;
  let startX = 0;
  let startLeft = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = true;
    startX = e.clientX;
    startLeft = track.scrollLeft;
  });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    if (Math.abs(e.clientX - startX) > 4) track.classList.add('dragging');
    track.scrollLeft = startLeft - (e.clientX - startX);
  });
  addEventListener('pointerup', () => {
    down = false;
    track.classList.remove('dragging');
  });
}
