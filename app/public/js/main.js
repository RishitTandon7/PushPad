// Entry point: start each feature module (one line per module).
import { initReveal } from './reveal.js';
import { initNavbar } from './navbar.js';
import { initLiveBuild } from './live-build.js';
import { initCounters } from './counters.js';
import { initPipeline } from './pipeline.js';
import { initCursorGlow } from './cursor-glow.js';
import { initCarousel } from './carousel.js';
import { initFaq } from './faq.js';

initReveal();
initNavbar();
initLiveBuild();
initCounters();
initPipeline();
initCursorGlow();
initCarousel();
initFaq();

// Footer year (set when the footer exists).
