// Live build: poll /version every 10s, update the hero status cell and the terminal panel, type out a pipeline log.
import { getVersion } from './api.js';

const $ = (id) => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastCommit = '';
let typed = false;

// "5m ago" style text for the deploy time.
function ago(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(s)) return 'unknown';
  if (s < 60) return Math.max(0, s) + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function setOffline() {
  const status = $('status-cell');
  status.classList.remove('live');
  status.classList.add('offline');
  $('status-text').textContent = 'OFFLINE';
  $('status-detail').textContent = 'Cannot reach /version';
  $('terminal').classList.add('offline');
  const badge = $('env-badge');
  badge.textContent = 'OFFLINE';
  badge.className = 'env-badge offline';
  $('lv-foot').textContent = 'Server unreachable. Retrying in 10s.';
}

function render(v) {
  const env = String(v.env).toLowerCase();
  const status = $('status-cell');
  status.classList.remove('offline');
  status.classList.add('live');
  $('status-text').textContent = 'LIVE · ' + env.toUpperCase();
  $('status-detail').textContent = `branch ${v.branch} · build #${v.build}`;
  $('terminal').classList.remove('offline');
  $('lv-branch').textContent = v.branch;
  $('lv-build').textContent = '#' + v.build;
  lastCommit = String(v.commit);
  $('lv-commit-text').textContent = lastCommit.slice(0, 7);
  $('lv-deployed').textContent = ago(v.deployedAt);
  const badge = $('env-badge');
  badge.textContent = env.toUpperCase();
  badge.className = 'env-badge' + (env === 'prod' ? ' prod' : env === 'preview' ? ' preview' : '');
  $('lv-foot').textContent = 'Last checked ' + new Date().toLocaleTimeString() + ' · refreshes every 10s';
}

// Typed-out fake log of the pipeline stages, filled with the real branch/build numbers.
function typeLog(v) {
  if (typed) return;
  typed = true;
  const ws = String(v.branch).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'local';
  const lines = [
    ['Checkout', `branch ${v.branch}`],
    ['Install and Lint', 'npm ci, eslint clean'],
    ['Test', 'jest passed, menu.json valid'],
    ['Package', `app-${ws}-${v.build}.zip`],
    ['Upload to S3', 'artifact stored'],
    ['Terraform Init', `workspace ${ws}`],
    ['Terraform Apply', 'EC2 replaced'],
    ['Health Check', `/version reports build #${v.build}`],
    ['Notify', 'URL published'],
  ];
  const log = $('lv-log');
  const row = ([a, b]) => `${a.padEnd(17)} ${b}`;
  if (reduce) {
    log.innerHTML = lines.map((l) => `<span class="ok">✓</span> ${row(l)}`).join('\n');
    return;
  }
  let li = 0;
  let ci = 0;
  let done = '';
  const step = () => {
    if (li >= lines.length) { log.innerHTML = done; return; }
    const text = row(lines[li]);
    ci++;
    log.innerHTML = done + `<span class="ok">✓</span> ${text.slice(0, ci)}<span class="cur"></span>`;
    if (ci >= text.length) {
      done += `<span class="ok">✓</span> ${text}\n`;
      li++;
      ci = 0;
      setTimeout(step, 140);
    } else {
      setTimeout(step, 14);
    }
  };
  step();
}

async function poll() {
  const v = await getVersion();
  if (!v) { setOffline(); return; }
  render(v);
  typeLog(v);
}

// Copy the full commit hash to the clipboard.
function initCopy() {
  const btn = $('copy-commit');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(lastCommit);
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
  });
}

export function initLiveBuild() {
  initCopy();
  poll();
  setInterval(poll, 10000);
}
