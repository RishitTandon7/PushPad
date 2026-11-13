// Entry point: start each feature module (one line per module).
import { initReveal } from './reveal.js';
import { initNavbar } from './navbar.js';
import { initCounters } from './counters.js';
import { initPipeline } from './pipeline.js';
import { initFaq } from './faq.js';
import { initGridLines } from './gridlines.js';
import { initScramble } from './scramble.js';
import { initCardFx } from './card-fx.js';
import { initScrollProgress } from './scroll-progress.js';
import { initPreloader } from './preloader.js';
import { initHeroAnim } from './hero-anim.js';

initReveal();
initNavbar();
initCounters();
initPipeline();
initFaq();
initHeroAnim();
initGridLines();
initScramble();
initCardFx();
initScrollProgress();
initPreloader();

// Footer year (set when the footer exists).
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
