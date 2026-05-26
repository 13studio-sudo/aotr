// =====================================================================
// AOTR — hud.js
// HUD: just the live score number (big, top-left).
// Top-record removed; only shown on game-over screen.
// =====================================================================

export class HUD {
  constructor() {
    this.kphEl = document.getElementById('hud-kph');
  }

  setKph(kph) {
    if (this.kphEl) this.kphEl.textContent = `${Math.round(kph)}`;
  }
}
