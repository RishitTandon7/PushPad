// Internal API for Jenkins: stage updates and the final URL, protected by a shared secret header.
const express = require('express');
const { AppError } = require('../lib/errors');
const { safeEqual } = require('../lib/tokens');

function internalRoutes({ service, settings }) {
  const router = express.Router();

  router.post('/jenkins/callback', async (req, res, next) => {
    try {
      const secret = await settings.get('callback-secret');
      const given = req.get('x-pushpad-secret') || '';
      // With no secret configured every callback is refused (fail closed).
      if (!secret || !safeEqual(given, secret)) throw new AppError(401, 'unauthorized', 'Unauthorized.');
      const d = await service.applyCallback(req.body);
      res.json({ ok: true, status: d.status });
    } catch (err) { next(err); }
  });

  return router;
}

module.exports = { internalRoutes };
