// Footer build line: PushPad own build number, commit and environment, read from /version.
import { getVersion } from './api.js';

export async function initFooterVersion() {
  const el = document.getElementById('build-line');
  if (!el) return;
  const v = await getVersion();
  el.textContent = v ? `build #${v.build} · commit ${String(v.commit).slice(0, 7)} · ${String(v.env).toUpperCase()}` : 'build info offline';
}
