// Deploy flow: validate the repo URL, start a deployment, then show the real pipeline (polled every 2s) until the URL is live.
import { getPlatform, createDeployment, getDeployment, deleteDeployment } from './api.js';
import { copyWithFeedback } from './clipboard.js';
import { pulseFrom } from './fx.js';

const $ = (id) => document.getElementById(id);
const STAGES = [['clone', 'Clone'], ['detect', 'Detect'], ['package', 'Package'], ['upload', 'Upload'], ['apply', 'Terraform apply'], ['health', 'Health check']];
const REPO_RE = /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}(\.git)?\/?$/;
const STATE_TEXT = { pending: 'waiting', running: 'running', done: 'done', failed: 'failed' };
const MESSAGES = {
  invalid_repo_url: 'Use a public repo URL like https://github.com/owner/repo',
  invalid_branch: 'That branch name is not valid.',
  invalid_subdir: 'That folder name is not valid.',
  invalid_access_code: 'That access code is not valid.',
  platform_full: 'All free slots are in use right now. Try again in a few minutes.',
  ip_active_limit: 'You already have a deployment running. Delete it or wait for it to expire.',
  rate_limited: 'You have used your deployments for this hour. Try again later.',
  build_unavailable: 'The build system is not reachable right now. Try again shortly.',
  bad_json: 'Something was wrong with the request.',
  internal_error: 'Something went wrong on our side. Try again.',
};

let platform = { ttlMinutes: 10, requireAccessCode: false };
let active = null;        // { id, token }
let pollTimer = null;
let tickTimer = null;
let last = null;          // latest deployment from the API
let wentLive = false;

const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
const saveActive = () => { try { sessionStorage.setItem('pp-active', JSON.stringify(active)); } catch { /* ignore */ } };
const loadActive = () => { try { return JSON.parse(sessionStorage.getItem('pp-active') || 'null'); } catch { return null; } };
const clearActive = () => { active = null; try { sessionStorage.removeItem('pp-active'); } catch { /* ignore */ } };

function showError(text) { $('form-error').textContent = text || ''; }

function setView(view) {
  $('deploy-form').hidden = view !== 'form';
  $('runview').hidden = view !== 'run';
  $('deploy-zone').dataset.view = view;
}

// ---------- the live pipeline view ----------
function buildStages() {
  $('stages').innerHTML = '';
  STAGES.forEach(([key, label], i) => {
    const li = document.createElement('li');
    li.className = 'stage';
    li.dataset.stage = key;
    li.dataset.state = 'pending';
    const n = document.createElement('span'); n.className = 'sn'; n.textContent = String(i + 1).padStart(2, '0');
    const l = document.createElement('span'); l.className = 'sl'; l.textContent = label;
    const s = document.createElement('span'); s.className = 'ss'; s.textContent = STATE_TEXT.pending;
    li.append(n, l, s);
    $('stages').append(li);
  });
}

function renderLog(d) {
  const log = $('run-log');
  log.textContent = '';
  const lines = [`> deploy ${d.repo} (${d.branch}${d.subdir ? ', ' + d.subdir : ''})`, ...(d.logs || [])];
  lines.forEach((line) => {
    const div = document.createElement('div');
    div.textContent = line;                           // repo-derived text is never inserted as HTML
    if (/^ERROR/i.test(line)) div.className = 'err';
    log.append(div);
  });
  if (d.status === 'queued' || d.status === 'running') {
    const cur = document.createElement('span');
    cur.className = 'cur';
    log.append(cur);
  }
  log.scrollTop = log.scrollHeight;
}

function render(d) {
  last = d;
  $('run-repo').textContent = d.repo;
  $('run-branch').textContent = d.branch;
  (d.stages || []).forEach((s) => {
    const li = $('stages').querySelector(`[data-stage="${s.name}"]`);
    if (!li) return;
    li.dataset.state = s.status;
    li.querySelector('.ss').textContent = STATE_TEXT[s.status] || s.status;
  });
  renderLog(d);

  const live = d.status === 'live';
  const card = $('live-card');
  card.hidden = !live;
  if (live) {
    const a = $('live-url');
    const ok = /^https?:\/\//.test(d.url || '');
    a.textContent = d.url || '';
    if (ok) { a.href = d.url; $('open-url').href = d.url; }
    if (!wentLive) {
      wentLive = true;
      requestAnimationFrame(() => pulseFrom(card));
    }
  }

  const failed = d.status === 'failed';
  const err = $('run-error');
  err.hidden = !failed;
  if (failed) {
    const stage = STAGES.find(([k]) => k === d.stage);
    $('err-title').textContent = stage ? `The ${stage[1]} stage failed.` : 'The deployment failed.';
    $('err-why').textContent = d.error || '';
  }

  const ended = ['expired', 'destroyed', 'destroying'].includes(d.status);
  $('run-ended').hidden = !(ended || failed);
  $('run-ended-text').textContent = d.status === 'destroying' ? 'Deleting the server...' : d.status === 'failed' ? '' : 'This deployment has ended and its server is gone.';
  $('delete-btn').hidden = !live;
}

function stopTimers() { clearInterval(pollTimer); clearInterval(tickTimer); pollTimer = null; tickTimer = null; }

// Timer and countdown ring tick once a second.
function tick() {
  if (!last) return;
  const now = Date.now();
  const running = last.status === 'queued' || last.status === 'running';
  const end = running ? now : new Date(last.liveAt || last.createdAt).getTime();
  $('run-timer').textContent = running ? fmt(now - new Date(last.createdAt).getTime()) : $('run-timer').textContent;
  if (last.status === 'live') {
    const total = (platform.ttlMinutes || 10) * 60 * 1000;
    const remaining = Math.max(0, new Date(last.expiresAt).getTime() - now);
    $('ring-text').textContent = fmt(remaining);
    const circ = 2 * Math.PI * 50;
    $('ring-prog').style.strokeDashoffset = String(circ * (1 - remaining / total));
    if (remaining === 0) refresh();
  } else if (!running && end) {
    $('run-timer').textContent = fmt(end - new Date(last.createdAt).getTime());
  }
}

async function refresh() {
  if (!active) return;
  const res = await getDeployment(active.id);
  if (res.status === 404) { stopTimers(); clearActive(); setView('form'); return; }
  if (!res.ok) {                                       // offline or server error: keep the last state and retry
    $('run-offline').hidden = false;
    return;
  }
  $('run-offline').hidden = true;
  render(res.data);
  if (['failed', 'destroyed', 'expired'].includes(res.data.status)) { clearInterval(pollTimer); pollTimer = null; }
}

function startRun(d) {
  wentLive = false;
  last = d;
  buildStages();
  setView('run');
  render(d);
  stopTimers();
  tick();
  tickTimer = setInterval(tick, 1000);
  pollTimer = setInterval(refresh, 2000);
  setTimeout(refresh, 600);                              // first update quickly, then every 2s
}

function reset() {
  stopTimers();
  clearActive();
  last = null;
  setView('form');
  showError('');
  $('repo-url').focus();
}

// ---------- the form ----------
async function submit(e) {
  e.preventDefault();
  showError('');
  const repoUrl = $('repo-url').value.trim();
  if (!REPO_RE.test(repoUrl)) { showError(MESSAGES.invalid_repo_url); $('repo-url').focus(); return; }
  const payload = { repoUrl, branch: $('branch').value.trim() || 'main' };
  const subdir = $('subdir').value.trim();
  if (subdir) payload.subdir = subdir;
  if (platform.requireAccessCode) payload.accessCode = $('access-code').value;

  const btn = $('deploy-btn');
  btn.disabled = true;
  btn.textContent = 'Starting...';
  const res = await createDeployment(payload);
  btn.disabled = false;
  btn.textContent = 'Deploy';

  if (res.status === 0) { showError('Cannot reach PushPad right now. Check your connection and try again.'); return; }
  if (!res.ok) {
    const code = res.data && res.data.error;
    let msg = MESSAGES[code] || (res.data && res.data.message) || MESSAGES.internal_error;
    if (code === 'rate_limited' && res.data.retryAfterSeconds) msg += ` (about ${Math.ceil(res.data.retryAfterSeconds / 60)} min)`;
    showError(msg);
    return;
  }
  active = { id: res.data.deployment.id, token: res.data.manageToken };
  saveActive();
  startRun(res.data.deployment);
}

async function removeNow() {
  if (!active || !last) return;
  const btn = $('delete-btn');
  btn.disabled = true;
  const res = await deleteDeployment(active.id, active.token);
  btn.disabled = false;
  if (res.ok) {
    if (!pollTimer) pollTimer = setInterval(refresh, 2000);
    render(res.data);
  }
}

async function shareUrl() {
  if (!last || !last.url) return;
  if (navigator.share) {
    try { await navigator.share({ title: last.repo + ' on PushPad', url: last.url }); return; } catch { /* cancelled: fall back to copy */ }
  }
  copyWithFeedback($('share-url'), last.url);
}

export async function initDeploy() {
  const form = $('deploy-form');
  if (!form) return;
  buildStages();

  getPlatform().then((r) => {
    if (r.ok) {
      platform = r.data;
      $('access-code-row').hidden = !platform.requireAccessCode;
    }
  });

  form.addEventListener('submit', submit);
  $('opt-toggle').addEventListener('click', () => {
    const open = $('opt-toggle').getAttribute('aria-expanded') !== 'true';
    $('opt-toggle').setAttribute('aria-expanded', String(open));
    $('bar-options').hidden = !open;
  });

  // Example chips fill the form.
  document.querySelectorAll('.example-chip').forEach((chip) => chip.addEventListener('click', () => {
    $('repo-url').value = chip.dataset.repo;
    $('branch').value = chip.dataset.branch || 'main';
    $('subdir').value = chip.dataset.subdir || '';
    if (chip.dataset.subdir) { $('opt-toggle').setAttribute('aria-expanded', 'true'); $('bar-options').hidden = false; }
    showError('');
    $('repo-url').focus();
  }));

  // Navbar "Deploy" button and any [data-focus-deploy] element jump to the input.
  document.querySelectorAll('[data-focus-deploy]').forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    if (!$('deploy-form').hidden) {
      scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => $('repo-url').focus({ preventScroll: true }), 250);
    } else scrollTo({ top: 0, behavior: 'smooth' });
  }));

  $('copy-url').addEventListener('click', () => last && last.url && copyWithFeedback($('copy-url'), last.url));
  $('share-url').addEventListener('click', shareUrl);
  $('delete-btn').addEventListener('click', removeNow);
  document.querySelectorAll('[data-new-deploy]').forEach((el) => el.addEventListener('click', reset));

  // Resume a deployment started earlier in this browser session.
  active = loadActive();
  if (active && active.id) {
    const res = await getDeployment(active.id);
    if (res.ok) {
      startRun(res.data);
      if (['failed', 'destroyed', 'expired'].includes(res.data.status)) { clearInterval(pollTimer); pollTimer = null; }
    } else if (res.status === 404) clearActive();
  }
}
