// Ids and manage tokens. Only a SHA-256 hash of a token is ever stored; the token itself is shown once.
const crypto = require('crypto');

const newId = () => crypto.randomBytes(5).toString('hex');            // 10 hex chars
const newToken = () => crypto.randomBytes(24).toString('base64url');
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Constant-time comparison so token checks do not leak timing.
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const verifyToken = (token, hash) => Boolean(token) && Boolean(hash) && safeEqual(hashToken(token), hash);

// Hash the client address so raw IPs are never stored.
const hashIp = (ip) => crypto.createHash('sha256').update('pushpad-ip:' + String(ip)).digest('hex').slice(0, 24);

module.exports = { newId, newToken, hashToken, safeEqual, verifyToken, hashIp };
