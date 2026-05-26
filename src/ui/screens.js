// =====================================================================
// AOTR — screens.js
// Overlays: loading (with click-to-start handoff), gameover, gyro,
// load-failure. A single overlay element is reused across phases.
// =====================================================================

function rebind(id, handler) {
  const el = document.getElementById(id);
  if (!el) return null;
  const fresh = el.cloneNode(true);
  el.parentNode.replaceChild(fresh, el);
  fresh.addEventListener('click', handler);
  return fresh;
}

export function showLoading() {
  document.getElementById('overlay-loading')?.removeAttribute('hidden');
}
export function hideLoading() {
  document.getElementById('overlay-loading')?.setAttribute('hidden', '');
}
export function setLoadingProgress(pct) {
  const fill = document.getElementById('loading-fill');
  const txt  = document.getElementById('loading-pct');
  if (fill) fill.style.width  = `${pct}%`;
  if (txt)  txt.textContent   = `${Math.floor(pct)}%`;
}

// When fetch completes, transform loading screen → click-to-start prompt.
// The button click is the user gesture that unlocks audio decoding.
export function showClickToStart(onStart) {
  ['loading-label', 'loading-bar', 'loading-pct'].forEach(
    id => document.getElementById(id)?.setAttribute('hidden', ''));
  const btn = document.getElementById('loading-start');
  if (btn) {
    btn.removeAttribute('hidden');
    rebind('loading-start', onStart);
  }
}

// v0.0.27: surface fetch/decode failures with an actionable retry instead
// of letting the loading bar sit at its last position forever.
export function showLoadFailure(message) {
  const label = document.getElementById('loading-label');
  const pct   = document.getElementById('loading-pct');
  if (label) {
    label.textContent = 'LOAD FAILED — TAP TO RETRY';
    label.removeAttribute('hidden');
  }
  if (pct) pct.setAttribute('hidden', '');
  console.error('[screens] load failure:', message);

  // Tap anywhere on the overlay to reload. We don't rely on a single
  // button because the layout may differ across error states.
  const overlay = document.getElementById('overlay-loading');
  if (overlay) {
    overlay.style.cursor = 'pointer';
    overlay.addEventListener('click', () => location.reload(), { once: true });
  }
}

// onRetry kept for back-compat callers but unused: the only path now is
// FRESH RELOAD, which sets sessionStorage and reloads the page.
export function showGameOver(topScore, _onRetry) {
  const overlay = document.getElementById('overlay-gameover');
  const kphEl   = document.getElementById('gameover-top-kph');
  if (kphEl) kphEl.textContent = String(Math.round(topScore));
  overlay?.removeAttribute('hidden');
  rebind('gameover-reload', () => {
    try { sessionStorage.setItem('aotr_autostart', '1'); } catch (_) {}
    location.reload();
  });
}

export function showGyroPrompt(onAllow, onSkip) {
  const overlay = document.getElementById('overlay-gyro');
  if (!overlay) { onSkip(); return; }
  overlay.removeAttribute('hidden');
  rebind('gyro-allow', () => { overlay.setAttribute('hidden', ''); onAllow(); });
  rebind('gyro-skip',  () => { overlay.setAttribute('hidden', ''); onSkip();  });
}
