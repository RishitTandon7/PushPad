const { makeEnv, REPO, goLive } = require('./helpers');
const { hashToken } = require('../lib/tokens');

const MIN = 60 * 1000;

describe('create', () => {
  test('queues a deployment, triggers Jenkins, returns a one-time token and public fields only', async () => {
    const env = makeEnv();
    const { deployment, manageToken } = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
    expect(deployment).toMatchObject({ repo: 'octocat/Hello-World', branch: 'main', status: 'queued' });
    expect(deployment.expiresAt).toBe(new Date(env.clock.t + 10 * MIN).toISOString());
    expect(deployment).not.toHaveProperty('ipHash');
    expect(deployment).not.toHaveProperty('tokenHash');
    expect(manageToken).toBeTruthy();
    const stored = await env.store.get(deployment.id);
    expect(stored.tokenHash).toBe(hashToken(manageToken));
    expect(JSON.stringify(stored)).not.toContain(manageToken);
    expect(JSON.stringify(stored)).not.toContain('1.1.1.1');
    expect(env.calls.deploy).toHaveLength(1);
    expect(env.calls.deploy[0]).toMatchObject({ id: deployment.id, repoUrl: REPO, branch: 'main' });
  });

  test('rejects bad input before doing anything', async () => {
    const env = makeEnv();
    await expect(env.service.create({ repoUrl: 'https://evil.com/a/b', ip: '1.1.1.1' })).rejects.toMatchObject({ code: 'invalid_repo_url' });
    await expect(env.service.create({ repoUrl: REPO, branch: '--evil', ip: '1.1.1.1' })).rejects.toMatchObject({ code: 'invalid_branch' });
    expect(env.calls.deploy).toHaveLength(0);
  });

  test('marks the deployment failed when Jenkins cannot be reached', async () => {
    const env = makeEnv({ jenkins: { triggerDeploy: async () => { throw new Error('connect ECONNREFUSED 10.0.0.5:8080'); }, triggerDestroy: async () => {} } });
    await expect(env.service.create({ repoUrl: REPO, ip: '1.1.1.1' })).rejects.toMatchObject({ status: 502, code: 'build_unavailable' });
    const [d] = await env.store.list();
    expect(d.status).toBe('failed');
    expect(JSON.stringify(d)).not.toContain('ECONNREFUSED');
  });
});

describe('access code', () => {
  test('required when the flag is on', async () => {
    const env = makeEnv({ config: { requireAccessCode: true } });
    await expect(env.service.create({ repoUrl: REPO, ip: '1.1.1.1' })).rejects.toMatchObject({ status: 403, code: 'invalid_access_code' });
    await expect(env.service.create({ repoUrl: REPO, accessCode: 'nope', ip: '1.1.1.1' })).rejects.toMatchObject({ code: 'invalid_access_code' });
    const ok = await env.service.create({ repoUrl: REPO, accessCode: 'letmein', ip: '1.1.1.1' });
    expect(ok.deployment.status).toBe('queued');
  });

  test('refused when the flag is on but no code is configured', async () => {
    const env = makeEnv({ config: { requireAccessCode: true }, settings: { 'access-code': undefined } });
    await expect(env.service.create({ repoUrl: REPO, accessCode: '', ip: '1.1.1.1' })).rejects.toMatchObject({ code: 'invalid_access_code' });
  });

  test('not needed when the flag is off', async () => {
    const env = makeEnv({ config: { requireAccessCode: false } });
    await expect(env.service.create({ repoUrl: REPO, ip: '1.1.1.1' })).resolves.toBeTruthy();
  });
});

describe('limits', () => {
  test('max 3 active deployments platform-wide', async () => {
    const env = makeEnv();
    for (const ip of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) await env.service.create({ repoUrl: REPO, ip });
    await expect(env.service.create({ repoUrl: REPO, ip: '4.4.4.4' })).rejects.toMatchObject({ status: 429, code: 'platform_full' });
  });

  test('1 active deployment per client', async () => {
    const env = makeEnv();
    await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
    await expect(env.service.create({ repoUrl: REPO, ip: '1.1.1.1' })).rejects.toMatchObject({ status: 429, code: 'ip_active_limit' });
    await expect(env.service.create({ repoUrl: REPO, ip: '9.9.9.9' })).resolves.toBeTruthy();
  });

  test('3 deploys per client per hour, with Retry-After info', async () => {
    const env = makeEnv();
    for (let i = 0; i < 3; i++) {
      const { deployment } = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
      await env.service.applyCallback({ deployId: deployment.id, status: 'failed', message: 'x' });   // frees the active slot
      env.clock.t += 5 * MIN;
    }
    const err = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' }).catch((e) => e);
    expect(err).toMatchObject({ status: 429, code: 'rate_limited' });
    expect(err.extra.retryAfterSeconds).toBeGreaterThan(0);
    env.clock.t += 60 * MIN;                                       // window passes
    await expect(env.service.create({ repoUrl: REPO, ip: '1.1.1.1' })).resolves.toBeTruthy();
  });
});

describe('manage token and early delete', () => {
  test('wrong token is refused, right token starts the destroy job', async () => {
    const env = makeEnv();
    const { deployment, manageToken } = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
    await expect(env.service.destroy(deployment.id, 'wrong')).rejects.toMatchObject({ status: 403 });
    await expect(env.service.destroy(deployment.id, '')).rejects.toMatchObject({ status: 403 });
    expect(env.calls.destroy).toHaveLength(0);
    const out = await env.service.destroy(deployment.id, manageToken);
    expect(out.status).toBe('destroying');
    expect(env.calls.destroy).toEqual([deployment.id]);
    await env.service.applyCallback({ deployId: deployment.id, status: 'destroyed' });
    expect((await env.service.get(deployment.id)).status).toBe('destroyed');
  });
});

describe('callback state transitions', () => {
  const stageCb = (id, stage, status, extra = {}) => ({ deployId: id, stage, status, ...extra });

  test('stages light up in order and the final url makes it live for 10 minutes', async () => {
    const env = makeEnv();
    const { deployment } = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
    const id = deployment.id;
    let d = await env.service.applyCallback(stageCb(id, 'clone', 'running'));
    expect(d.status).toBe('running');
    expect(d.stages[0].status).toBe('running');
    d = await env.service.applyCallback(stageCb(id, 'detect', 'running'));   // skipping "done" for clone still closes it
    expect(d.stages[0].status).toBe('done');
    env.clock.t += 2 * MIN;
    d = await env.service.applyCallback({ deployId: id, status: 'live', url: 'http://203.0.113.7' });
    expect(d.status).toBe('live');
    expect(d.url).toBe('http://203.0.113.7');
    expect(d.stages.every((s) => s.status === 'done')).toBe(true);
    expect(d.expiresAt).toBe(new Date(env.clock.t + 10 * MIN).toISOString());
  });

  test('a failed stage fails the deployment with a cleaned message', async () => {
    const env = makeEnv();
    const { deployment } = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
    const d = await env.service.applyCallback(stageCb(deployment.id, 'detect', 'failed', { message: 'No index.html\u0007 found' }));
    expect(d.status).toBe('failed');
    expect(d.error).toBe('No index.html  found');
    expect(d.stages[1].status).toBe('failed');
  });

  test('rejects impossible transitions and bad payloads', async () => {
    const env = makeEnv();
    const { deployment } = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
    const id = deployment.id;
    await env.service.applyCallback({ deployId: id, status: 'destroyed' });
    await expect(env.service.applyCallback(stageCb(id, 'clone', 'running'))).rejects.toMatchObject({ status: 409 });
    await expect(env.service.applyCallback({ deployId: id, status: 'live', url: 'http://1.2.3.4' })).rejects.toMatchObject({ status: 409 });
    await expect(env.service.applyCallback({ deployId: 'nope', status: 'running' })).rejects.toMatchObject({ status: 400 });
    await expect(env.service.applyCallback(stageCb(id, 'rm -rf', 'running'))).rejects.toMatchObject({ code: 'bad_callback' });
    await expect(env.service.applyCallback({ deployId: id, status: 'live', url: 'javascript:alert(1)' })).rejects.toMatchObject({ code: 'bad_callback' });
    await expect(env.service.applyCallback({ deployId: 'abcdef0123', status: 'running' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('expiry', () => {
  test('a live deployment is marked expired when its time is up, and hides its url', async () => {
    const env = makeEnv();
    const { deployment } = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
    await goLive(env.service, deployment.id);
    env.clock.t += 29 * MIN;
    expect((await env.service.get(deployment.id)).status).toBe('live');
    env.clock.t += 2 * MIN;
    const d = await env.service.get(deployment.id);
    expect(d.status).toBe('expired');
    expect(d.url).toBeNull();
    expect((await env.service.list())[0].status).toBe('expired');
  });

  test('sweep expires deployments nobody is looking at; expired ones still count until destroyed', async () => {
    const env = makeEnv();
    const { deployment } = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
    await goLive(env.service, deployment.id);
    env.clock.t += 31 * MIN;
    await env.service.sweep();
    expect((await env.store.get(deployment.id)).status).toBe('expired');
    await expect(env.service.create({ repoUrl: REPO, ip: '1.1.1.1' })).rejects.toMatchObject({ code: 'ip_active_limit' });
    await env.service.applyCallback({ deployId: deployment.id, status: 'destroyed' });
    await expect(env.service.create({ repoUrl: REPO, ip: '1.1.1.1' })).resolves.toBeTruthy();
  });

  test('a build that never reports back is failed after 20 minutes', async () => {
    const env = makeEnv();
    const { deployment } = await env.service.create({ repoUrl: REPO, ip: '1.1.1.1' });
    env.clock.t += 21 * MIN;
    const d = await env.service.get(deployment.id);
    expect(d.status).toBe('failed');
    expect(d.error).toMatch(/timed out/);
  });
});
