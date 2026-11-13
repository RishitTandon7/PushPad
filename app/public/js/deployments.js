// Deployments strip: recent deployments (public fields only) refreshed every 10s, with a live time-left countdown.
import { listDeployments } from './api.js';

const strip = () => document.getElementById('dep-strip');
let items = [];

const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

function timeText(d) {
  if (d.status === 'live') return fmt(new Date(d.expiresAt).getTime() - Date.now()) + ' left';
  if (d.status === 'queued' || d.status === 'running') return 'building';
  return 'ended';
}

function message(text) {
  const el = strip();
  el.textContent = '';
  const p = document.createElement('p');
  p.className = 'dep-empty';
  p.textContent = text;
  el.append(p);
}

function render() {
  const el = strip();
  if (!items.length) { message('No deployments yet. Yours will show up here.'); return; }
  el.textContent = '';
  items.slice(0, 4).forEach((d) => {
    const box = document.createElement('div');
    box.className = 'dep';
    box.dataset.id = d.id;
    const repo = document.createElement('div');
    repo.className = 'repo';
    repo.textContent = d.repo;                           // escaped: it came from a repo URL
    const meta = document.createElement('div');
    meta.className = 'meta';
    const badge = document.createElement('span');
    badge.className = 'badge ' + String(d.status).replace(/[^a-z]/g, '');
    badge.textContent = d.status;
    const left = document.createElement('span');
    left.className = 'left';
    left.textContent = timeText(d);
    meta.append(badge, left);
    box.append(repo, meta);
    el.append(box);
  });
}

async function load() {
  const res = await listDeployments();
  if (!res.ok) { message('Offline: cannot load recent deployments.'); return; }
  items = res.data.deployments || [];
  render();
}

export function initDeployments() {
  if (!strip()) return;
  load();
  setInterval(load, 10000);
  // Update only the time text each second (no re-render, so nothing flickers).
  setInterval(() => {
    items.slice(0, 4).forEach((d) => {
      const left = strip().querySelector(`[data-id="${d.id}"] .left`);
      if (left) left.textContent = timeText(d);
    });
  }, 1000);
}
