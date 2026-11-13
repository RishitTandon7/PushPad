// PushPad sample app: static site + 3 small JSON endpoints.
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Read version.json (written by the pipeline); fall back to local dev values.
function readVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
  } catch {
    return { branch: 'local', build: 0, commit: 'dev', deployedAt: new Date().toISOString(), env: 'local' };
  }
}

app.use(express.static(path.join(__dirname, 'public')));

// Health endpoint used by the pipeline health check.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Version endpoint: everything the pipeline knows about this deploy.
app.get('/version', (req, res) => {
  const { branch, build, commit, deployedAt, env } = readVersion();
  res.json({ branch, build, commit, deployedAt, env });
});

// Menu endpoint: re-read on each request so the data is always what shipped.
app.get('/api/menu', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'menu.json'), 'utf8')));
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`PushPad app listening on ${port}`));
}

module.exports = app;
