// Copy buttons on the command blocks in the Deploy section.
import { copyWithFeedback } from './clipboard.js';

export function initCopy() {
  document.querySelectorAll('.cmd').forEach((box) => {
    const btn = box.querySelector('.copy-btn');
    const code = box.querySelector('code');
    if (btn && code) btn.addEventListener('click', () => copyWithFeedback(btn, code.textContent.trim()));
  });
}
