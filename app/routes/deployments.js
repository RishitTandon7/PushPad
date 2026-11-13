// Public deployment API: create, read, list and delete (with the manage token).
const express = require('express');

// Where mock-mode sites are served from: this server's own address (the Host header, only if it looks like a host).
function originOf(req) {
  const host = req.get('host') || '';
  return /^[A-Za-z0-9.:-]{1,100}$/.test(host) ? req.protocol + '://' + host : undefined;
}

function deploymentRoutes({ service }) {
  const router = express.Router();

  router.post('/', async (req, res, next) => {
    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const out = await service.create({
        repoUrl: body.repoUrl,
        branch: body.branch,
        subdir: body.subdir,
        accessCode: body.accessCode,
        ip: req.ip,
        origin: originOf(req),
      });
      res.status(201).json(out);        // manageToken is returned exactly once, here
    } catch (err) { next(err); }
  });

  router.get('/', async (req, res, next) => {
    try { res.json({ deployments: await service.list() }); } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try { res.json(await service.get(req.params.id)); } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const header = req.get('authorization') || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-manage-token') || '';
      res.json(await service.destroy(req.params.id, token));
    } catch (err) { next(err); }
  });

  return router;
}

module.exports = { deploymentRoutes };
