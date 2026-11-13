// Deployment service: create, read, delete, expire, and apply Jenkins callbacks. All state lives in the store.
const v = require('./validate');
const st = require('./state');
const { AppError } = require('./errors');
const { checkLimits } = require('./limits');
const { newId, newToken, hashToken, verifyToken, hashIp, safeEqual } = require('./tokens');

const MIN = 60 * 1000;
const STUCK_AFTER_MS = 20 * MIN;                 // queued/running this long means Jenkins never reported back
const URL_RE = /^https?:\/\/[A-Za-z0-9.:-]{1,100}(\/[A-Za-z0-9._~/-]{0,100})?$/;

// Strip control characters and cap the length of any text that came from a build log.
const clean = (value, max = 200) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

function createService({ store, settings, jenkins, config, mock, baseUrl, now = () => Date.now() }) {
  // Public fields only: never the ip hash, token hash or internal errors.
  const view = (d) => ({
    id: d.id,
    slug: d.slug,
    repo: d.repo,
    branch: d.branch,
    subdir: d.subdir || '',
    status: d.status,
    stage: d.stage,
    stages: d.stages,
    appType: d.appType || null,
    url: d.status === 'live' ? d.url : null,
    error: d.error || null,
    logs: (d.logs || []).slice(-config.logLinesKept),
    createdAt: d.createdAt,
    liveAt: d.liveAt || null,
    expiresAt: d.expiresAt,
  });
  const listView = (d) => ({ id: d.id, repo: d.repo, status: d.status, createdAt: d.createdAt, expiresAt: d.expiresAt });

  const baseOrigin = async () => (await settings.get('public-base-url')) || baseUrl;

  const runMock = async (fn) => { fn().catch(() => {}); };

  async function create({ repoUrl, branch, subdir, accessCode, ip, origin }) {
    const { owner, repo, repoUrl: canonical } = v.parseRepoUrl(repoUrl);
    const b = v.parseBranch(branch);
    const dir = v.parseSubdir(subdir);

    if (config.requireAccessCode) {
      const expected = await settings.get('access-code');
      if (!expected || !safeEqual(typeof accessCode === 'string' ? accessCode : '', expected)) {
        throw new AppError(403, 'invalid_access_code', 'That access code is not valid.');
      }
    }

    const ipHash = hashIp(ip);
    const t = now();
    await checkLimits({ store, config, ipHash, now: t });

    const id = newId();
    const manageToken = newToken();
    const item = {
      id,
      slug: v.slugFor(repo, id),
      repo: `${owner}/${repo}`,
      repoUrl: canonical,
      branch: b,
      subdir: dir,
      status: 'queued',
      stage: null,
      stages: st.newStages(),
      logs: [],
      url: null,
      error: null,
      ipHash,
      tokenHash: hashToken(manageToken),
      createdAt: new Date(t).toISOString(),
      updatedAt: new Date(t).toISOString(),
      liveAt: null,
      expiresAt: new Date(t + config.ttlMinutes * MIN).toISOString(),
    };
    await store.put(item);

    try {
      if (config.mock) {
        const site = origin || await baseOrigin();
        runMock(() => mock.simulateDeploy(item, applyCallback, { stepMs: config.mockStepMs, baseUrl: site }));
      } else {
        await jenkins.triggerDeploy(item);
      }
    } catch {
      await applyCallback({ deployId: id, status: 'failed', message: 'Could not start the build. Try again shortly.' });
      throw new AppError(502, 'build_unavailable', 'Could not start the build. Try again shortly.');
    }
    return { deployment: view(item), manageToken };
  }

  // Marks a live deployment expired once its time is up (the cleanup job destroys the server).
  async function expireIfDue(item) {
    const t = now();
    const due = new Date(item.expiresAt).getTime() <= t;
    if (item.status === 'live' && due) {
      const next = await store.mutate(item.id, (d) => (d.status === 'live' ? { ...d, status: 'expired', url: null, updatedAt: new Date(t).toISOString() } : null));
      if (config.mock && next && next.status === 'expired') {
        runMock(() => mock.simulateDestroy(item.id, applyCallback, { stepMs: config.mockStepMs }));
      }
      return next || item;
    }
    if ((item.status === 'queued' || item.status === 'running') && t - new Date(item.createdAt).getTime() > STUCK_AFTER_MS) {
      return (await store.mutate(item.id, (d) => (['queued', 'running'].includes(d.status)
        ? { ...d, status: 'failed', error: 'The build timed out.', updatedAt: new Date(t).toISOString() } : null))) || item;
    }
    return item;
  }

  async function get(id) {
    if (!v.isValidId(id)) throw new AppError(404, 'not_found', 'Deployment not found.');
    const item = await store.get(id);
    if (!item) throw new AppError(404, 'not_found', 'Deployment not found.');
    return view(await expireIfDue(item));
  }

  async function list() {
    const items = await Promise.all((await store.list()).map(expireIfDue));
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, config.recentListSize).map(listView);
  }

  // Early delete: needs the one-time manage token returned at creation.
  async function destroy(id, token) {
    if (!v.isValidId(id)) throw new AppError(404, 'not_found', 'Deployment not found.');
    const item = await store.get(id);
    if (!item) throw new AppError(404, 'not_found', 'Deployment not found.');
    if (!verifyToken(token, item.tokenHash)) throw new AppError(403, 'forbidden', 'That manage token is not valid.');
    if (item.status === 'destroying' || item.status === 'destroyed') return view(item);

    const next = await store.mutate(id, (d) => ({ ...d, status: 'destroying', url: null, updatedAt: new Date(now()).toISOString() }));
    try {
      if (config.mock) runMock(() => mock.simulateDestroy(id, applyCallback, { stepMs: config.mockStepMs }));
      else await jenkins.triggerDestroy(id);
    } catch {
      throw new AppError(502, 'build_unavailable', 'Could not start the delete. Try again shortly.');
    }
    return view(next);
  }

  // Jenkins (or the mock) reports progress here. Shape: { deployId, stage?, status, message?, logs?, url?, instanceId?, appType? }.
  async function applyCallback(p) {
    if (!p || !v.isValidId(p.deployId)) throw new AppError(400, 'bad_callback', 'Invalid callback.');
    const hasStage = p.stage !== undefined && p.stage !== null;
    if (hasStage && !st.STAGES.includes(p.stage)) throw new AppError(400, 'bad_callback', 'Unknown stage.');
    if (!['running', 'done', 'failed', 'live', 'destroyed'].includes(p.status)) throw new AppError(400, 'bad_callback', 'Unknown status.');
    if (p.status === 'live' && !URL_RE.test(String(p.url || ''))) throw new AppError(400, 'bad_callback', 'Invalid URL.');

    const existing = await store.get(p.deployId);
    if (!existing) throw new AppError(404, 'not_found', 'Deployment not found.');

    // Decide the next deployment status for this event.
    let target = existing.status;
    if (hasStage) target = p.status === 'failed' ? 'failed' : 'running';
    else if (p.status === 'live') target = 'live';
    else if (p.status === 'failed') target = 'failed';
    else if (p.status === 'destroyed') target = 'destroyed';
    if (!st.canTransition(existing.status, target)) {
      throw new AppError(409, 'bad_transition', `Cannot go from ${existing.status} to ${target}.`);
    }

    const t = new Date(now()).toISOString();
    const out = await store.mutate(p.deployId, (d) => {
      const next = { ...d, status: target, updatedAt: t };
      next.logs = [...(d.logs || []), ...(Array.isArray(p.logs) ? p.logs.slice(0, 20).map((l) => clean(l)) : [])].slice(-config.logLinesKept);
      if (p.appType === 'static' || p.appType === 'node') next.appType = p.appType;
      if (typeof p.instanceId === 'string') next.instanceId = clean(p.instanceId, 40);
      if (hasStage) {
        next.stage = p.stage;
        const idx = st.STAGES.indexOf(p.stage);
        next.stages = d.stages.map((s, i) => {
          if (i < idx && s.status !== 'done') return { ...s, status: 'done', startedAt: s.startedAt || t, endedAt: t };
          if (i !== idx) return s;
          if (p.status === 'running') return { ...s, status: 'running', startedAt: t, endedAt: null };
          return { ...s, status: p.status === 'failed' ? 'failed' : 'done', startedAt: s.startedAt || t, endedAt: t };
        });
        if (p.status === 'failed') next.error = clean(p.message || 'This stage failed.');
      } else if (p.status === 'live') {
        next.url = p.url;
        next.liveAt = t;
        next.expiresAt = new Date(now() + config.ttlMinutes * MIN).toISOString();   // the 10 minutes start when it goes live
        next.stages = d.stages.map((s) => ({ ...s, status: 'done', endedAt: s.endedAt || t }));
      } else if (p.status === 'failed') {
        next.error = d.error || clean(p.message || 'The deployment failed.');   // keep the stage's friendlier message
      } else if (p.status === 'destroyed') {
        next.url = null;
      }
      return next;
    });
    return view(out);
  }

  // Called on a timer: expire due deployments even if nobody is looking at them.
  async function sweep() {
    const items = await store.list();
    await Promise.all(items.map(expireIfDue));
  }

  return { create, get, list, destroy, applyCallback, sweep, view };
}

module.exports = { createService, clean };
