// Builds the Express app from its parts (service, config, settings) so tests can inject fakes.
const path = require('path');
const express = require('express');
const { coreRoutes } = require('../routes/core');
const { deploymentRoutes } = require('../routes/deployments');
const { internalRoutes } = require('../routes/internal');
const { platformRoutes } = require('../routes/platform');

function buildApp({ service, config, settings }) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '10kb' }));

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(coreRoutes({ service, config }));
  app.use('/api/platform', platformRoutes({ config }));
  app.use('/api/deployments', deploymentRoutes({ service }));
  app.use('/api/internal', internalRoutes({ service, settings }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found', message: 'Not found.' }));

  // Only safe, stable error codes leave the server. Anything unexpected becomes a generic 500.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && err.status && err.code && err.message) {
      if (err.extra && err.extra.retryAfterSeconds) res.set('Retry-After', String(err.extra.retryAfterSeconds));
      return res.status(err.status).json({ error: err.code, message: err.message, ...(err.extra || {}) });
    }
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json', message: 'Invalid JSON.' });
    if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large', message: 'Request too large.' });
    return res.status(500).json({ error: 'internal_error', message: 'Something went wrong.' });
  });

  return app;
}

module.exports = { buildApp };
