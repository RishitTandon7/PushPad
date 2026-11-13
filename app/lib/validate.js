// Strict input validation. Only public https://github.com/<owner>/<repo> URLs are accepted; nothing user-supplied reaches a shell unchecked.
class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.status = 400;
  }
}

const REPO_RE = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/;

// Returns { owner, repo, repoUrl } or throws ValidationError.
function parseRepoUrl(input) {
  if (typeof input !== 'string' || input.length > 200) throw new ValidationError('invalid_repo_url', 'Enter a GitHub repository URL.');
  const match = REPO_RE.exec(input.trim());
  if (!match) throw new ValidationError('invalid_repo_url', 'Use a public repo URL like https://github.com/owner/repo');
  const [, owner, repo] = match;
  if (repo === '.' || repo === '..' || owner.endsWith('-') || /^\.+$/.test(repo)) {
    throw new ValidationError('invalid_repo_url', 'That repository name is not valid.');
  }
  return { owner, repo, repoUrl: `https://github.com/${owner}/${repo}` };
}

// Branch names: letters, digits, dot, dash, underscore and single slashes. Never starts with "-" (option injection).
function parseBranch(input) {
  const branch = input === undefined || input === null || input === '' ? 'main' : input;
  if (typeof branch !== 'string' || branch.length > 100) throw new ValidationError('invalid_branch', 'That branch name is not valid.');
  const bad = !/^[A-Za-z0-9._/-]+$/.test(branch) || branch.startsWith('-') || branch.startsWith('/')
    || branch.endsWith('/') || branch.includes('//') || branch.includes('..') || branch.endsWith('.lock');
  if (bad) throw new ValidationError('invalid_branch', 'That branch name is not valid.');
  return branch;
}

// Optional sub-folder of the repo to deploy (for monorepos and the bundled examples).
function parseSubdir(input) {
  if (input === undefined || input === null || input === '') return '';
  if (typeof input !== 'string' || input.length > 100) throw new ValidationError('invalid_subdir', 'That folder is not valid.');
  const dir = input.replace(/^\/+|\/+$/g, '');
  const bad = !/^[A-Za-z0-9._/-]+$/.test(dir) || dir.startsWith('-') || dir.split('/').some((p) => p === '..' || p === '.' || p === '');
  if (bad) throw new ValidationError('invalid_subdir', 'That folder is not valid.');
  return dir;
}

// A short, URL-safe name for the deployment, e.g. "my-repo-a1b2".
function slugFor(repo, id) {
  const base = repo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'site';
  return `${base}-${id.slice(0, 4)}`;
}

const ID_RE = /^[a-f0-9]{10}$/;
const isValidId = (id) => typeof id === 'string' && ID_RE.test(id);

module.exports = { ValidationError, parseRepoUrl, parseBranch, parseSubdir, slugFor, isValidId };
