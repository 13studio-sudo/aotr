// =====================================================================
// AOTR — devPanel.js
// CM-style compact panel:
//   • Slim left nav with sections (GAME, THEME, AUDIO, FX)
//   • Right pane: dense rows, label/control pairs aligned in columns
//   • All controls fit without scrolling on a typical desktop
// =====================================================================

import { STATE, DEFAULTS, saveSettings } from '../config.js';
import {
  applyWireframe, applyBackground, applyText, applyStrings,
  applySpecialMode,
} from '../theme.js';
import { JUMP_SFX_NAMES, playJumpSfx } from '../audio/jumpSfx.js';

const SECTIONS = [
  { id: 'game',  label: 'GAME'  },
  { id: 'theme', label: 'THEME' },
  { id: 'audio', label: 'AUDIO' },
  { id: 'fx',    label: 'FX'    },
];

export class DevPanel {
  constructor({ onLaneCountChange, onVolumeChange, onUniverseBgChange, onNewGame }) {
    this.callbacks = { onLaneCountChange, onVolumeChange, onUniverseBgChange, onNewGame };
    this.panelEl = document.getElementById('dev-panel');
    this.toggleEl = document.getElementById('dev-toggle');
    this.toggleEl.addEventListener('click', () => this.toggle());
    this.activeSection = 'game';
    this._build();
  }

  toggle() {
    if (this.panelEl.hasAttribute('hidden')) this.open();
    else this.close();
  }
  open() {
    this.panelEl.removeAttribute('hidden');
    this.toggleEl.setAttribute('aria-expanded', 'true');
  }
  close() {
    this.panelEl.setAttribute('hidden', '');
    this.toggleEl.setAttribute('aria-expanded', 'false');
  }

  _build() {
    const navHtml = SECTIONS.map(s =>
      `<button class="cm-nav-item ${s.id === this.activeSection ? 'active' : ''}"
               data-section="${s.id}">${s.label}</button>`
    ).join('');

    this.panelEl.innerHTML = `
      <div class="cm-panel">
        <div class="cm-header">
          <div class="cm-title">DEVP</div>
          <button class="cm-close" id="dev-close" title="CLOSE">×</button>
        </div>
        <div class="cm-body">
          <div class="cm-nav">${navHtml}</div>
          <div class="cm-pane" id="cm-pane">${this._renderSection(this.activeSection)}</div>
        </div>
      </div>
    `;
    this._wireNav();
    this._wireActiveSection();
  }

  _renderSection(id) {
    if (id === 'game') return this._sectionGame();
    if (id === 'theme') return this._sectionTheme();
    if (id === 'audio') return this._sectionAudio();
    if (id === 'fx') return this._sectionFx();
    return '';
  }

  // ----- GAME -----
  _sectionGame() {
    const accelPct = (STATE.speedAccelPerSec * 100).toFixed(2);
    return `
      <div class="cm-section">
        <div class="cm-section-title">TRACK</div>
        ${this._row('Lanes',
          `<input type="range" class="cm-slider" id="lane-count" min="4" max="7" step="1" value="${STATE.laneCount}">
           <span class="cm-val" id="lc-val">${STATE.laneCount}</span>`)}
        ${this._row('Start speed',
          `<input type="range" class="cm-slider" id="start-speed" min="0.5" max="2" step="0.05" value="${STATE.startSpeed}">
           <span class="cm-val" id="ss-val">${STATE.startSpeed.toFixed(2)}×</span>`)}
        ${this._row('Accel /sec',
          `<input type="range" class="cm-slider" id="accel-rate" min="0" max="0.03" step="0.0005" value="${STATE.speedAccelPerSec}">
           <span class="cm-val" id="ar-val">${accelPct}%</span>`)}
        ${this._row('Jump time',
          `<input type="range" class="cm-slider" id="jump-time" min="0.30" max="1.00" step="0.05" value="${STATE.jumpDuration}">
           <span class="cm-val" id="jt-val">${STATE.jumpDuration.toFixed(2)}s</span>`)}

        <div class="cm-row-actions">
          <button class="cm-btn cm-btn-warn" id="game-reset">RESET</button>
          <button class="cm-btn" id="game-save">SAVE</button>
          <button class="cm-btn cm-btn-primary" id="game-new">NEW GAME</button>
        </div>
      </div>
    `;
  }

  // ----- THEME -----
  _sectionTheme() {
    return `
      <div class="cm-section">
        <div class="cm-section-title">COLORS</div>
        ${this._colorRow('Wireframe', 'wire',
          STATE.wireframeColor, STATE.wireframeAlpha, STATE.wireframeWidth)}
        ${this._colorRow('Strings', 'string',
          STATE.wireframeColor, STATE.stringAlpha, STATE.stringWidth, true)}
        ${this._colorRow('Background', 'bg',
          STATE.backgroundColor, STATE.backgroundAlpha, null)}
        ${this._colorRow('Text', 'text',
          STATE.textColor, STATE.textAlpha, STATE.textWidth)}
        <div class="cm-row-actions">
          <button class="cm-btn" id="reset-colors">RESET</button>
        </div>
      </div>
    `;
  }

  // ----- AUDIO -----
  _sectionAudio() {
    return `
      <div class="cm-section">
        <div class="cm-section-title">VOLUMES</div>
        ${this._row('Music',
          `<input type="range" class="cm-slider" id="music-vol" min="0" max="1" step="0.01" value="${STATE.musicVolume}">
           <span class="cm-val" id="mv-val">${Math.round(STATE.musicVolume*100)}%</span>`)}
      </div>
    `;
  }

  // ----- FX -----
  _sectionFx() {
    const sfxOptions = JUMP_SFX_NAMES.map((n, i) =>
      `<option value="${i+1}" ${(i+1) === STATE.jumpSfx ? 'selected' : ''}>${n}</option>`
    ).join('');

    return `
      <div class="cm-section">
        <div class="cm-section-title">EFFECTS</div>
        ${this._row('Jump SFX',
          `<select class="cm-select" id="jump-sfx-pick">${sfxOptions}</select>
           <button class="cm-btn cm-btn-mini" id="jump-sfx-test">TEST</button>`)}
        ${this._row('Synthwave',
          `<label class="cm-toggle">
             <input type="checkbox" id="special-mode" ${STATE.specialMode ? 'checked' : ''}>
             <span class="cm-toggle-track"></span>
           </label>`)}
        ${this._row('Universe BG',
          `<label class="cm-toggle">
             <input type="checkbox" id="universe-bg" ${STATE.universeBg ? 'checked' : ''}>
             <span class="cm-toggle-track"></span>
           </label>`)}
      </div>
    `;
  }

  // ----- Helpers -----
  _row(label, controlHtml) {
    return `
      <div class="cm-row">
        <div class="cm-row-label">${label}</div>
        <div class="cm-row-control">${controlHtml}</div>
      </div>`;
  }

  _colorRow(label, prefix, color, alpha, width, sharedColor = false) {
    const colorPart = sharedColor
      ? `<span class="cm-shared-note">(uses Wireframe)</span>`
      : `<input type="color" class="cm-color" id="${prefix}-color" value="${color}">
         <input type="text" class="cm-hex" id="${prefix}-hex" value="${color}" maxlength="7">`;
    const alphaPart = `
      <input type="range" class="cm-slider cm-slider-mini" id="${prefix}-alpha"
             min="0" max="1" step="0.01" value="${alpha}">
      <span class="cm-val cm-val-mini" id="${prefix}-alpha-val">${Math.round(alpha*100)}%</span>`;
    const widthPart = (width !== null) ? `
      <input type="range" class="cm-slider cm-slider-mini" id="${prefix}-width"
             min="0.5" max="5" step="0.1" value="${width}">
      <span class="cm-val cm-val-mini" id="${prefix}-width-val">${width.toFixed(1)}</span>` : '';

    return `
      <div class="cm-row cm-row-color">
        <div class="cm-row-label">${label}</div>
        <div class="cm-row-control cm-color-control">
          <div class="cm-color-pair">${colorPart}</div>
          <div class="cm-mods">
            <span class="cm-mod-label">α</span>${alphaPart}
            ${width !== null ? `<span class="cm-mod-label">W</span>${widthPart}` : ''}
          </div>
        </div>
      </div>`;
  }

  _wireNav() {
    this.panelEl.querySelectorAll('.cm-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeSection = btn.dataset.section;
        this.panelEl.querySelectorAll('.cm-nav-item').forEach(b =>
          b.classList.toggle('active', b === btn));
        const pane = this.panelEl.querySelector('#cm-pane');
        if (pane) pane.innerHTML = this._renderSection(this.activeSection);
        this._wireActiveSection();
      });
    });
    const closeBtn = this.panelEl.querySelector('#dev-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
  }

  _wireActiveSection() {
    if (this.activeSection === 'game') this._wireGame();
    else if (this.activeSection === 'theme') this._wireTheme();
    else if (this.activeSection === 'audio') this._wireAudio();
    else if (this.activeSection === 'fx') this._wireFx();
  }

  _wireGame() {
    const lc = this._q('#lane-count');
    const lcVal = this._q('#lc-val');
    if (lc) lc.addEventListener('input', () => {
      const n = parseInt(lc.value, 10);
      STATE.laneCount = n;
      if (lcVal) lcVal.textContent = String(n);
      this.callbacks.onLaneCountChange?.(n);
    });
    const ss = this._q('#start-speed');
    const ssVal = this._q('#ss-val');
    if (ss) ss.addEventListener('input', () => {
      const v = parseFloat(ss.value);
      STATE.startSpeed = v;
      if (ssVal) ssVal.textContent = `${v.toFixed(2)}×`;
    });
    const ar = this._q('#accel-rate');
    const arVal = this._q('#ar-val');
    if (ar) ar.addEventListener('input', () => {
      const v = parseFloat(ar.value);
      STATE.speedAccelPerSec = v;
      if (arVal) arVal.textContent = `${(v * 100).toFixed(2)}%`;
    });
    const jt = this._q('#jump-time');
    const jtVal = this._q('#jt-val');
    if (jt) jt.addEventListener('input', () => {
      const v = parseFloat(jt.value);
      STATE.jumpDuration = v;
      if (jtVal) jtVal.textContent = `${v.toFixed(2)}s`;
    });

    const saveBtn = this._q('#game-save');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      const ok = saveSettings();
      const original = saveBtn.textContent;
      saveBtn.textContent = ok ? 'SAVED' : 'SAVE FAILED';
      saveBtn.disabled = true;
      setTimeout(() => {
        saveBtn.textContent = original;
        saveBtn.disabled = false;
      }, 900);
    });

    const newBtn = this._q('#game-new');
    if (newBtn) newBtn.addEventListener('click', () => {
      this.callbacks.onNewGame?.();
    });

    const resetBtn = this._q('#game-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      // Restore every persisted-relevant field to its DEFAULTS value
      Object.assign(STATE, DEFAULTS);
      // Wipe saved settings from localStorage
      try { localStorage.removeItem('aotr.settings.v1'); } catch (_) {}
      // Push theme changes through subscribers so UI reflects defaults
      applyWireframe(STATE.wireframeColor, STATE.wireframeAlpha, STATE.wireframeWidth);
      applyStrings(STATE.stringAlpha, STATE.stringWidth);
      applyBackground(STATE.backgroundColor, STATE.backgroundAlpha);
      applyText(STATE.textColor, STATE.textAlpha, STATE.textWidth);
      applySpecialMode(STATE.specialMode);
      // Re-render the active section so sliders/values show new state
      const pane = this.panelEl.querySelector('#cm-pane');
      if (pane) pane.innerHTML = this._renderSection(this.activeSection);
      this._wireActiveSection();
      // Restart the game with default settings
      this.callbacks.onNewGame?.();
    });
  }

  _wireTheme() {
    this._bindColorRow('wire', applyWireframe);
    this._bindColorRow('bg', applyBackground);
    this._bindColorRow('text', applyText);

    const sa = this._q('#string-alpha');
    const saV = this._q('#string-alpha-val');
    const sw = this._q('#string-width');
    const swV = this._q('#string-width-val');
    if (sa) sa.addEventListener('input', () => {
      const v = parseFloat(sa.value);
      if (saV) saV.textContent = `${Math.round(v*100)}%`;
      applyStrings(v, STATE.stringWidth);
    });
    if (sw) sw.addEventListener('input', () => {
      const v = parseFloat(sw.value);
      if (swV) swV.textContent = v.toFixed(1);
      applyStrings(STATE.stringAlpha, v);
    });

    const reset = this._q('#reset-colors');
    if (reset) reset.addEventListener('click', () => this._resetColors());
  }

  _wireAudio() {
    const mv = this._q('#music-vol');
    const mvV = this._q('#mv-val');
    if (mv) mv.addEventListener('input', () => {
      const v = parseFloat(mv.value);
      STATE.musicVolume = v;
      if (mvV) mvV.textContent = `${Math.round(v*100)}%`;
      this.callbacks.onVolumeChange?.('music', v);
    });
  }

  _wireFx() {
    const sfxPick = this._q('#jump-sfx-pick');
    if (sfxPick) sfxPick.addEventListener('change', () => {
      STATE.jumpSfx = parseInt(sfxPick.value, 10);
    });
    const sfxTest = this._q('#jump-sfx-test');
    if (sfxTest) sfxTest.addEventListener('click', () => {
      if (this._audio) {
        this._audio.ensureCtx();
        const dest = this._audio.gain || this._audio.ctx.destination;
        playJumpSfx(this._audio.ctx, dest, STATE.jumpSfx);
      }
    });

    const smTog = this._q('#special-mode');
    if (smTog) smTog.addEventListener('change', (e) => {
      applySpecialMode(e.target.checked);
    });
    const ub = this._q('#universe-bg');
    if (ub) ub.addEventListener('change', () => {
      STATE.universeBg = ub.checked;
      this.callbacks.onUniverseBgChange?.(ub.checked);
    });
  }

  _bindColorRow(prefix, applyFn) {
    const colorInput = this._q(`#${prefix}-color`);
    const hexInput = this._q(`#${prefix}-hex`);
    const alphaInput = this._q(`#${prefix}-alpha`);
    const alphaVal = this._q(`#${prefix}-alpha-val`);
    const widthInput = this._q(`#${prefix}-width`);
    const widthVal = this._q(`#${prefix}-width-val`);

    const apply = () => {
      const hex = colorInput ? colorInput.value : null;
      const alpha = alphaInput ? parseFloat(alphaInput.value) : 1;
      const width = widthInput ? parseFloat(widthInput.value) : 1;
      if (hexInput && hex) hexInput.value = hex;
      if (alphaVal) alphaVal.textContent = `${Math.round(alpha * 100)}%`;
      if (widthVal) widthVal.textContent = width.toFixed(1);
      applyFn(hex, alpha, width);
    };

    if (colorInput) colorInput.addEventListener('input', apply);
    if (hexInput) hexInput.addEventListener('change', () => {
      let v = hexInput.value.trim();
      if (!v.startsWith('#')) v = '#' + v;
      if (/^#[0-9a-fA-F]{6}$/.test(v) && colorInput) {
        colorInput.value = v;
        apply();
      } else {
        hexInput.value = colorInput ? colorInput.value : v;
      }
    });
    if (alphaInput) alphaInput.addEventListener('input', apply);
    if (widthInput) widthInput.addEventListener('input', apply);
  }

  _resetColors() {
    Object.assign(STATE, {
      wireframeColor: '#ff7a3d', wireframeAlpha: 0.35, wireframeWidth: 1.0,
      stringAlpha: 0.95, stringWidth: 3.0,
      backgroundColor: '#000000', backgroundAlpha: 1.0,
      textColor: '#ff7a3d', textAlpha: 1.0, textWidth: 1.0,
      specialMode: false,
    });
    applyWireframe(STATE.wireframeColor, STATE.wireframeAlpha, STATE.wireframeWidth);
    applyStrings(STATE.stringAlpha, STATE.stringWidth);
    applyBackground(STATE.backgroundColor, STATE.backgroundAlpha);
    applyText(STATE.textColor, STATE.textAlpha, STATE.textWidth);
    // Re-render the theme pane to reflect reset values
    if (this.activeSection === 'theme') {
      this.panelEl.querySelector('#cm-pane').innerHTML = this._renderSection('theme');
      this._wireActiveSection();
    }
  }

  _q(sel) { return this.panelEl.querySelector(sel); }
  attachAudio(audio) { this._audio = audio; }
}
