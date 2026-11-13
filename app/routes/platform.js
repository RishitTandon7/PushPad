// Platform info for the UI: the free-tier limits and whether an access code is needed. Nothing secret here.
const express = require('express');

function platformRoutes({ config }) {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json({
      ttlMinutes: config.ttlMinutes,
      maxActive: config.maxActive,
      maxDeploysPerIpPerHour: config.maxDeploysPerIpPerHour,
      maxZipMb: config.maxZipMb,
      requireAccessCode: config.requireAccessCode,
      mock: config.mock,
    });
  });
  return router;
}

module.exports = { platformRoutes };
