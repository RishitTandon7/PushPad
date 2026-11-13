const { newId, newToken, hashToken, verifyToken, hashIp, safeEqual } = require('../lib/tokens');

test('ids are 10 hex chars and unique', () => {
  const ids = new Set(Array.from({ length: 200 }, newId));
  expect(ids.size).toBe(200);
  for (const id of ids) expect(id).toMatch(/^[a-f0-9]{10}$/);
});

test('a manage token verifies against its hash only', () => {
  const token = newToken();
  const hash = hashToken(token);
  expect(hash).not.toContain(token);
  expect(verifyToken(token, hash)).toBe(true);
  expect(verifyToken(token + 'x', hash)).toBe(false);
  expect(verifyToken(newToken(), hash)).toBe(false);
  expect(verifyToken('', hash)).toBe(false);
  expect(verifyToken(undefined, hash)).toBe(false);
  expect(verifyToken(token, undefined)).toBe(false);
});

test('ip hashes are stable, short and do not contain the ip', () => {
  expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
  expect(hashIp('1.2.3.4')).not.toBe(hashIp('1.2.3.5'));
  expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4');
});

test('safeEqual handles different lengths without throwing', () => {
  expect(safeEqual('abc', 'abcd')).toBe(false);
  expect(safeEqual('abc', 'abc')).toBe(true);
});
