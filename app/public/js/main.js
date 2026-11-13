// Entry point: start each feature module (one line per module).
import { initReveal } from './reveal.js';
import { initNavbar } from './navbar.js';
import { initLiveBuild } from './live-build.js';
import { initCounters } from './counters.js';
import { initPipeline } from './pipeline.js';
import { initCursorGlow } from './cursor-glow.js';
import { initCarousel } from './carousel.js';
import { initFaq } from './faq.js';
import { initPreloader } from './preloader.js';
import { initHeroAnim } from './hero-anim.js';

initReveal();
initNavbar();
initLiveBuild();
initCounters();
initPipeline();
initCursorGlow();
initCarousel();
initFaq();
initHeroAnim();
initPreloader();

// Footer year (set when the footer exists).
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
