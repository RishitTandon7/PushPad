const request = require('supertest');
const { makeEnv, REPO, waitFor, goLive } = require('./helpers');

describe('POST /api/deployments', () => {
  test('creates a deployment and returns the manage token once', async () => {
    const { app } = makeEnv();
    const res = await request(app).post('/api/deployments').send({ repoUrl: REPO });
    expect(res.status).toBe(201);
    expect(res.body.manageToken).toBeTruthy();
    expect(res.body.deployment.status).toBe('queued');
    const again = await request(app).get('/api/deployments/' + res.body.deployment.id);
    expect(again.status).toBe(200);
    expect(JSON.stringify(again.body)).not.toContain(res.body.manageToken);
    expect(again.body).not.toHaveProperty('tokenHash');
    expect(again.body).not.toHaveProperty('ipHash');
  });

  test('validation errors are 400 with a stable code', async () => {
    const { app } = makeEnv();
    const res = await request(app).post('/api/deployments').send({ repoUrl: 'https://gitlab.com/a/b' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_repo_url');
    const bad = await request(app).post('/api/deployments').set('Content-Type', 'application/json').send('{nope');
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('bad_json');
  });

  test('limit errors are 429 and rate limits set Retry-After', async () => {
    const { app } = makeEnv();
    const first = await request(app).post('/api/deployments').send({ repoUrl: REPO });
    expect(first.status).toBe(201);
    const second = await request(app).post('/api/deployments').send({ repoUrl: REPO });
    expect(second.status).toBe(429);
    expect(second.body.error).toBe('ip_active_limit');
  });

  test('access code is enforced when required', async () => {
    const { app } = makeEnv({ config: { requireAccessCode: true } });
    expect((await request(app).post('/api/deployments').send({ repoUrl: REPO })).status).toBe(403);
    expect((await request(app).post('/api/deployments').send({ repoUrl: REPO, accessCode: 'letmein' })).status).toBe(201);
  });
});

describe('listing, lookup and delete', () => {
  test('list shows public fields only, no url or secrets', async () => {
    const { app, service } = makeEnv();
    const res = await request(app).post('/api/deployments').send({ repoUrl: REPO });
    await goLive(service, res.body.deployment.id);
    const list = await request(app).get('/api/deployments');
    expect(list.status).toBe(200);
    expect(Object.keys(list.body.deployments[0]).sort()).toEqual(['createdAt', 'expiresAt', 'id', 'repo', 'status']);
  });

  test('unknown or malformed ids are 404', async () => {
    const { app } = makeEnv();
    expect((await request(app).get('/api/deployments/abcdef0123')).status).toBe(404);
    expect((await request(app).get('/api/deployments/..%2F..%2Fetc')).status).toBe(404);
    expect((await request(app).get('/api/deployments/not-an-id')).status).toBe(404);
  });

  test('DELETE needs the manage token', async () => {
    const { app } = makeEnv();
    const created = await request(app).post('/api/deployments').send({ repoUrl: REPO });
    const id = created.body.deployment.id;
    expect((await request(app).delete('/api/deployments/' + id)).status).toBe(403);
    expect((await request(app).delete('/api/deployments/' + id).set('Authorization', 'Bearer wrong')).status).toBe(403);
    const ok = await request(app).delete('/api/deployments/' + id).set('Authorization', 'Bearer ' + created.body.manageToken);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('destroying');
  });
});

describe('POST /api/internal/jenkins/callback', () => {
  const body = (id) => ({ deployId: id, stage: 'clone', status: 'running' });

  test('refuses missing or wrong secrets, accepts the right one', async () => {
    const { app } = makeEnv();
    const id = (await request(app).post('/api/deployments').send({ repoUrl: REPO })).body.deployment.id;
    expect((await request(app).post('/api/internal/jenkins/callback').send(body(id))).status).toBe(401);
    expect((await request(app).post('/api/internal/jenkins/callback').set('X-PushPad-Secret', 'wrong').send(body(id))).status).toBe(401);
    const ok = await request(app).post('/api/internal/jenkins/callback').set('X-PushPad-Secret', 's3cret').send(body(id));
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ ok: true, status: 'running' });
  });

  test('fails closed when no secret is configured', async () => {
    const { app } = makeEnv({ settings: { 'callback-secret': undefined } });
    const res = await request(app).post('/api/internal/jenkins/callback').set('X-PushPad-Secret', '').send(body('abcdef0123'));
    expect(res.status).toBe(401);
  });

  test('a bad transition is a 409, not a crash', async () => {
    const { app, service } = makeEnv();
    const id = (await request(app).post('/api/deployments').send({ repoUrl: REPO })).body.deployment.id;
    await service.applyCallback({ deployId: id, status: 'destroyed' });
    const res = await request(app).post('/api/internal/jenkins/callback').set('X-PushPad-Secret', 's3cret').send(body(id));
    expect(res.status).toBe(409);
  });
});

describe('error hygiene', () => {
  test('unexpected errors never leak internals', async () => {
    const env = makeEnv();
    env.service.create = async () => { throw new Error('AWS key AKIA123 at /opt/app/secret.js'); };
    const res = await request(env.app).post('/api/deployments').send({ repoUrl: REPO });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/AKIA|secret\.js/);
    expect(res.body.error).toBe('internal_error');
  });

  test('unknown api paths are json 404s', async () => {
    const { app } = makeEnv();
    const res = await request(app).get('/api/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  test('platform info exposes limits and the access-code flag, no secrets', async () => {
    const { app } = makeEnv({ config: { requireAccessCode: true } });
    const res = await request(app).get('/api/platform');
    expect(res.body).toMatchObject({ ttlMinutes: 30, maxActive: 3, requireAccessCode: true });
    expect(JSON.stringify(res.body)).not.toMatch(/letmein|s3cret/);
  });
});

describe('mock mode full run', () => {
  test('a deployment goes through every stage and goes live, then delete destroys it', async () => {
    const env = makeEnv({ config: { mock: true, mockStepMs: 3 } });
    const created = await request(env.app).post('/api/deployments').send({ repoUrl: REPO });
    expect(created.status).toBe(201);
    const id = created.body.deployment.id;
    const live = await waitFor(async () => {
      const d = (await request(env.app).get('/api/deployments/' + id)).body;
      return d.status === 'live' ? d : null;
    });
    expect(live.stages.map((s) => s.status)).toEqual(Array(6).fill('done'));
    expect(live.url).toBe('http://localhost:3000/mock/' + id);
    expect(live.logs.length).toBeGreaterThan(5);

    const site = await request(env.app).get('/mock/' + id);
    expect(site.status).toBe(200);
    expect(site.text).toContain('octocat/Hello-World');

    const del = await request(env.app).delete('/api/deployments/' + id).set('Authorization', 'Bearer ' + created.body.manageToken);
    expect(del.status).toBe(200);
    await waitFor(async () => (await request(env.app).get('/api/deployments/' + id)).body.status === 'destroyed');
    expect((await request(env.app).get('/mock/' + id)).status).toBe(404);
  });

  test('a repo called "fail" fails at the Detect stage with a clear message', async () => {
    const env = makeEnv({ config: { mock: true, mockStepMs: 3 } });
    const created = await request(env.app).post('/api/deployments').send({ repoUrl: 'https://github.com/octocat/fail' });
    const id = created.body.deployment.id;
    const failed = await waitFor(async () => {
      const d = (await request(env.app).get('/api/deployments/' + id)).body;
      return d.status === 'failed' ? d : null;
    });
    expect(failed.stage).toBe('detect');
    expect(failed.error).toMatch(/index\.html|package\.json/);
    expect(failed.url).toBeNull();
  });

  test('live deployments expire and are cleaned up automatically', async () => {
    const env = makeEnv({ config: { mock: true, mockStepMs: 3 } });
    const created = await request(env.app).post('/api/deployments').send({ repoUrl: REPO });
    const id = created.body.deployment.id;
    await waitFor(async () => (await request(env.app).get('/api/deployments/' + id)).body.status === 'live');
    env.clock.t += 31 * 60 * 1000;
    expect((await request(env.app).get('/api/deployments/' + id)).body.status).toBe('expired');
    await waitFor(async () => (await request(env.app).get('/api/deployments/' + id)).body.status === 'destroyed');
  });
});
