// Free-tier limits: platform-wide capacity, one active deployment per client, and an hourly rate limit per client.
const { AppError } = require('./errors');
const { ACTIVE } = require('./state');

async function checkLimits({ store, config, ipHash, now }) {
  const all = await store.list();

  const active = all.filter((d) => ACTIVE.has(d.status));
  if (active.length >= config.maxActive) {
    throw new AppError(429, 'platform_full', `All ${config.maxActive} free slots are in use. Try again in a few minutes.`);
  }

  if (active.some((d) => d.ipHash === ipHash)) {
    throw new AppError(429, 'ip_active_limit', 'You already have a live deployment. Delete it or wait for it to expire.');
  }

  const hourAgo = now - 3600 * 1000;
  const recent = all.filter((d) => d.ipHash === ipHash && new Date(d.createdAt).getTime() > hourAgo);
  if (recent.length >= config.maxDeploysPerIpPerHour) {
    const oldest = Math.min(...recent.map((d) => new Date(d.createdAt).getTime()));
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 3600 * 1000 - now) / 1000));
    throw new AppError(429, 'rate_limited', `You can deploy ${config.maxDeploysPerIpPerHour} times per hour. Try again later.`, { retryAfterSeconds });
  }
}

module.exports = { checkLimits };
