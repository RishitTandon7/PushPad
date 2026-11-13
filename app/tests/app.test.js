// Tests run in the pipeline's Test stage; a failure here blocks the deploy.
const request = require('supertest');
const app = require('../server');
const menu = require('../menu.json');

test('GET /health returns 200 ok', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ status: 'ok' });
});

test('GET /version has all keys', async () => {
  const res = await request(app).get('/version');
  expect(res.status).toBe(200);
  for (const key of ['branch', 'build', 'commit', 'deployedAt', 'env']) {
    expect(res.body).toHaveProperty(key);
  }
});

test('menu.json is valid: every dish has name, image and price > 0', () => {
  expect(menu.length).toBeGreaterThan(0);
  for (const dish of menu) {
    expect(typeof dish.name).toBe('string');
    expect(dish.name.length).toBeGreaterThan(0);
    expect(typeof dish.image).toBe('string');
    expect(dish.image.length).toBeGreaterThan(0);
    expect(typeof dish.price).toBe('number');
    expect(dish.price).toBeGreaterThan(0);
  }
});

test('GET /api/menu serves the menu', async () => {
  const res = await request(app).get('/api/menu');
  expect(res.status).toBe(200);
  expect(res.body).toEqual(menu);
});
