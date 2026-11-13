// Test helpers: build a service/app with an in-memory store, fake settings, a recording Jenkins and a controllable clock.
const mock = require('../lib/mock');
const { createMemoryStore } = require('../lib/store/memory');
const { createService } = require('../lib/service');
const { buildApp } = require('../lib/app');
const limits = require('../config/limits.json');

function makeEnv(overrides = {}) {
  const clock = { t: Date.parse('2026-01-01T12:00:00Z') };
  const config = { ...limits, requireAccessCode: false, mock: false, mockStepMs: 3, recentListSize: 8, logLinesKept: 40, jenkinsDeployJob: 'd', jenkinsDestroyJob: 'x', ...overrides.config };
  const values = { 'access-code': 'letmein', 'callback-secret': 's3cret', ...overrides.settings };
  const settings = { get: async (k) => values[k] };
  const calls = { deploy: [], destroy: [] };
  const jenkins = overrides.jenkins || {
    triggerDeploy: async (d) => { calls.deploy.push(d); },
    triggerDestroy: async (id) => { calls.destroy.push(id); },
  };
  const store = createMemoryStore();
  const service = createService({ store, settings, jenkins, config, mock, baseUrl: 'http://localhost:3000', now: () => clock.t });
  const app = buildApp({ service, config, settings });
  return { clock, config, settings, calls, store, service, app };
}

const REPO = 'https://github.com/octocat/Hello-World';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, ms = 3000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timed out waiting');
    await sleep(10);
  }
}

// Move a queued deployment to live the way Jenkins would: a stage reports running, then the final URL arrives.
async function goLive(service, id, url = 'http://203.0.113.7') {
  await service.applyCallback({ deployId: id, stage: 'clone', status: 'running' });
  return service.applyCallback({ deployId: id, status: 'live', url });
}

module.exports = { makeEnv, REPO, sleep, waitFor, goLive };
