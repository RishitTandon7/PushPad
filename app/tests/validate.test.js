const { parseRepoUrl, parseBranch, parseSubdir, slugFor, isValidId } = require('../lib/validate');

describe('parseRepoUrl', () => {
  test('accepts plain github repo urls', () => {
    expect(parseRepoUrl('https://github.com/octocat/Hello-World')).toEqual({ owner: 'octocat', repo: 'Hello-World', repoUrl: 'https://github.com/octocat/Hello-World' });
    expect(parseRepoUrl('https://github.com/octocat/Hello-World/').repo).toBe('Hello-World');
    expect(parseRepoUrl('https://github.com/octocat/Hello-World.git').repo).toBe('Hello-World');
    expect(parseRepoUrl('https://github.com/a/my.repo_1').repo).toBe('my.repo_1');
  });

  test.each([
    'http://github.com/octocat/Hello-World',
    'https://gitlab.com/octocat/Hello-World',
    'https://github.com.evil.com/octocat/Hello-World',
    'https://evil.com/https://github.com/octocat/x',
    'https://github.com/octocat',
    'https://github.com/octocat/repo/tree/main',
    'https://github.com/octocat/repo?x=1',
    'https://user:pw@github.com/octocat/repo',
    'git@github.com:octocat/repo.git',
    'https://github.com/-bad/repo',
    'https://github.com/octocat/..',
    'https://github.com/octocat/repo; rm -rf /',
    'https://github.com/octocat/$(whoami)',
    'https://github.com/octocat/repo name',
    '',
    null,
    42,
  ])('rejects %p', (input) => {
    expect(() => parseRepoUrl(input)).toThrow(/URL|repository|Enter/);
  });
});

describe('parseBranch', () => {
  test('defaults to main and accepts normal names', () => {
    expect(parseBranch(undefined)).toBe('main');
    expect(parseBranch('')).toBe('main');
    expect(parseBranch('feature/new-roll')).toBe('feature/new-roll');
    expect(parseBranch('release-1.2_x')).toBe('release-1.2_x');
  });

  test.each(['-delete', '--upload-pack=x', 'a b', 'a;b', 'a$(x)', 'a..b', '/abs', 'trail/', 'a//b', 'x.lock', 'a`b`', 'a\nb', 'a'.repeat(101)])('rejects %p', (b) => {
    expect(() => parseBranch(b)).toThrow('branch');
  });
});

describe('parseSubdir', () => {
  test('empty is fine, normal paths pass', () => {
    expect(parseSubdir('')).toBe('');
    expect(parseSubdir(undefined)).toBe('');
    expect(parseSubdir('examples/static-site/')).toBe('examples/static-site');
  });
  test.each(['../etc', 'a/../b', '-x', 'a b', 'a;b', './x', 'a//b'])('rejects %p', (d) => {
    expect(() => parseSubdir(d)).toThrow('folder');
  });
});

test('slugFor builds a short url-safe name and ids are validated', () => {
  expect(slugFor('My_Repo.js', 'abcdef0123')).toBe('my-repo-js-abcd');
  expect(slugFor('...', 'abcdef0123')).toBe('site-abcd');
  expect(isValidId('abcdef0123')).toBe(true);
  expect(isValidId('ABCDEF0123')).toBe(false);
  expect(isValidId('../etc')).toBe(false);
});
