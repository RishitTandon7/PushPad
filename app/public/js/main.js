// Entry point: start each feature module (one line per module).
import { initReveal } from './reveal.js';
import { initNavbar } from './navbar.js';
import { initLiveBuild } from './live-build.js';
import { initCounters } from './counters.js';
import { initPipeline } from './pipeline.js';
import { initCursorGlow } from './cursor-glow.js';

initReveal();
initNavbar();
initLiveBuild();
initCounters();
initPipeline();
initCursorGlow();

// Footer year (set when the footer exists).
