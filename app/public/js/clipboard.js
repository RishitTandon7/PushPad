// Copy text to the clipboard. Plain-HTTP pages (like a preview URL) have no navigator.clipboard, so fall back to execCommand.
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '-1000px';
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

// Give a button a short "Copied" confirmation.
export async function copyWithFeedback(btn, text) {
  const label = btn.dataset.label || btn.textContent;
  btn.dataset.label = label;
  btn.textContent = (await copyText(text)) ? 'Copied' : 'Press Ctrl+C';
  setTimeout(() => { btn.textContent = label; }, 1500);
}
