const { createSettings } = require('../lib/settings');

test('environment variables win and unknown names are refused', async () => {
  const s = createSettings({ awsMode: false, env: { JENKINS_URL: 'http://j:8080' } });
  expect(await s.get('jenkins-url')).toBe('http://j:8080');
  expect(await s.get('jenkins-token')).toBeUndefined();
  await expect(s.get('../etc/passwd')).rejects.toThrow('unknown setting');
});

test('falls back to SSM in AWS mode, caches, and treats errors as not configured', async () => {
  let calls = 0;
  const ssmClient = { send: async (cmd) => { calls++; if (cmd.input.Name === '/pushpad/access-code') return { Parameter: { Value: 'abc' } }; throw new Error('ParameterNotFound'); } };
  const s = createSettings({ awsMode: true, env: {}, ssmClient });
  expect(await s.get('access-code')).toBe('abc');
  expect(await s.get('access-code')).toBe('abc');
  expect(calls).toBe(1);
  expect(await s.get('callback-secret')).toBeUndefined();
});
