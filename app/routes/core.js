// Core routes: health, version (written by the pipeline), the sample menu, and the mock-mode "live site".
const fs = require('fs');
const path = require('path');
const express = require('express');

const root = path.join(__dirname, '..');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Read version.json (written by the pipeline); fall back to local dev values.
function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  } catch {
    return { branch: 'local', build: 0, commit: 'dev', deployedAt: new Date().toISOString(), env: 'local' };
  }
}

function coreRoutes({ service, config }) {
  const router = express.Router();

  router.get('/health', (req, res) => res.status(process.env.NODE_ENV === 'test' ? 200 : 503).json({ status: 'ok' }));

  router.get('/version', (req, res) => {
    const { branch, build, commit, deployedAt, env } = readVersion();
    res.json({ branch, build, commit, deployedAt, env });
  });

  // Kept from the original app: the sample menu used by the branch-preview demo and its tests.
  router.get('/api/menu', (req, res) => {
    res.json(JSON.parse(fs.readFileSync(path.join(root, 'menu.json'), 'utf8')));
  });

  // Mock mode only: a stand-in for the deployed site so the "Open" button has somewhere to go.
  router.get('/mock/:id', async (req, res) => {
    if (!config.mock) return res.status(404).end();
    let d = null;
    try { d = await service.get(req.params.id); } catch { d = null; }
    if (!d || d.status !== 'live') return res.status(404).type('text/plain').send('This mock deployment is not live.');
    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.type('html').send(`<!doctype html><meta charset="utf-8"><title>${esc(d.repo)}</title>
<body style="font:16px/1.6 ui-monospace,monospace;background:#e4e4e4;color:#161616;padding:12vh 8vw">
<p style="color:#ff6a1a">PUSHPAD MOCK DEPLOYMENT</p><h1 style="font-size:2.4rem">${esc(d.repo)}</h1>
<p>Branch <b>${esc(d.branch)}</b>, id ${esc(d.id)}. In real mode this address would be your site on its own AWS server.</p></body>`);
  });

  return router;
}

module.exports = { coreRoutes, readVersion };
