// =====================================================================
// AOTR — debugHud.js
// In-game live-state HUD. Shows phase, FPS, speed mul, boost, audio,
// note count, and recent log lines. Toggle with the BACKTICK key (`).
// =====================================================================

export class DebugHud {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'debug-hud';
    this.el.className = 'debug-hud';
    this.el.hidden = true;
    document.body.appendChild(this.el);

    this._lines = [];
    this._maxLines = 8;
    this._fpsSamples = [];
    this._lastUpdate = 0;

    // Wire backtick key to toggle
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote' || e.key === '`') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Capture console.log → append to feed (only while open, to avoid overhead)
    this._installLogTap();
  }

  _installLogTap() {
    const orig = console.log.bind(console);
    console.log = (...args) => {
      orig(...args);
      // Only buffer when visible
      if (!this.el.hidden) this._pushLine(args.map(String).join(' '));
    };
  }

  _pushLine(text) {
    this._lines.push(text);
    if (this._lines.length > this._maxLines) this._lines.shift();
  }

  toggle() {
    this.el.hidden = !this.el.hidden;
  }

  update(snapshot, dt) {
    if (this.el.hidden) return;
    this._fpsSamples.push(1 / Math.max(dt, 0.001));
    if (this._fpsSamples.length > 30) this._fpsSamples.shift();

    const now = performance.now();
    if (now - this._lastUpdate < 100) return;     // 10 Hz max
    this._lastUpdate = now;

    const fps = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    const html = `
      <div class="dh-row"><span>phase</span><b>${snapshot.phase}</b></div>
      <div class="dh-row"><span>fps</span><b>${fps.toFixed(1)}</b></div>
      <div class="dh-row"><span>speed×</span><b>${snapshot.speedMul.toFixed(2)}</b></div>
      <div class="dh-row"><span>boost</span><b>${snapshot.boost ? `${snapshot.boostHold.toFixed(2)}s` : 'no'}</b></div>
      <div class="dh-row"><span>audio</span><b>${snapshot.audioPlaying ? `on (${snapshot.audioSources})` : 'off'}</b></div>
      <div class="dh-row"><span>notes</span><b>${snapshot.noteCount}</b></div>
      <div class="dh-row"><span>player</span><b>t=${snapshot.playerT.toFixed(3)} u=${snapshot.playerU.toFixed(3)} L${snapshot.playerLane}</b></div>
      <div class="dh-row"><span>air</span><b>${snapshot.airborne ? `phase ${snapshot.airPhase.toFixed(2)}` : '—'}</b></div>
      <div class="dh-row"><span>gpu</span><b>g${snapshot.gpuGeometries} t${snapshot.gpuTextures} p${snapshot.gpuPrograms} d${snapshot.drawCalls}</b></div>
      <hr/>
      ${this._lines.slice(-this._maxLines).map(l => `<div class="dh-log">${escapeHtml(l)}</div>`).join('')}
    `;
    this.el.innerHTML = html;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
