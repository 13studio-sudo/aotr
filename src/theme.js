// =====================================================================
// AOTR — theme.js
// Four visual channels — wireframe, background, text, strings — each with
// independent color/alpha/width. Subscribers are notified on every change
// so the 3D scene, CSS variables, and HUD all stay in sync.
//
// v0.0.27: the four near-identical pub/sub pairs are folded into a small
// `makeChannel` helper. Public API surface is unchanged.
// =====================================================================

import { STATE } from './config.js';

// ----- color utils -----
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}
const rgba     = (rgb, a) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
const hexToInt = (hex)    => parseInt(hex.replace('#', ''), 16);

const root = document.documentElement;

// ----- subscriber channel factory -----
function makeChannel() {
  const subs = [];
  return {
    subscribe(fn, initialArgs) {
      subs.push(fn);
      try { fn(...initialArgs); } catch (_) {}
      return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); };
    },
    emit(...args) {
      subs.forEach(fn => { try { fn(...args); } catch (e) { console.warn(e); } });
    },
  };
}

const wireCh   = makeChannel();
const bgCh     = makeChannel();
const textCh   = makeChannel();
const stringCh = makeChannel();

// ----- apply functions: mutate STATE, set CSS vars, emit -----
export function applyWireframe(hex,
                               alpha = STATE.wireframeAlpha,
                               width = STATE.wireframeWidth) {
  STATE.wireframeColor = hex;
  STATE.wireframeAlpha = alpha;
  STATE.wireframeWidth = width;
  const rgb = hexToRgb(hex);

  root.style.setProperty('--orange',    hex);
  root.style.setProperty('--accent',    hex);
  root.style.setProperty('--orange-90', rgba(rgb, 0.90));
  root.style.setProperty('--orange-70', rgba(rgb, 0.70));
  root.style.setProperty('--orange-50', rgba(rgb, 0.50));
  root.style.setProperty('--orange-30', rgba(rgb, 0.30));
  root.style.setProperty('--orange-15', rgba(rgb, 0.15));
  root.style.setProperty('--orange-08', rgba(rgb, 0.08));
  root.style.setProperty('--orange-04', rgba(rgb, 0.04));
  root.style.setProperty('--glow-soft',   `0 0 4px ${rgba(rgb, 0.5)}`);
  root.style.setProperty('--glow-mid',    `0 0 7px ${rgba(rgb, 0.65)}, 0 0 2px ${rgba(rgb, 0.9)}`);
  root.style.setProperty('--glow-strong', `0 0 11px ${rgba(rgb, 0.8)}, 0 0 3px ${hex}`);
  root.style.setProperty('--wire-width',  `${width}px`);

  wireCh.emit(hexToInt(hex), hex, alpha, width);
}

export function applyBackground(hex, alpha = STATE.backgroundAlpha) {
  STATE.backgroundColor = hex;
  STATE.backgroundAlpha = alpha;
  const rgb = hexToRgb(hex);
  root.style.setProperty('--black',    hex);
  root.style.setProperty('--bg-0',     hex);
  root.style.setProperty('--black-95', rgba(rgb, 0.95));
  root.style.setProperty('--black-80', rgba(rgb, 0.80));
  root.style.setProperty('--black-60', rgba(rgb, 0.60));
  root.style.setProperty('--black-40', rgba(rgb, 0.40));
  root.style.setProperty('--black-20', rgba(rgb, 0.20));
  document.body.style.background = hex;
  bgCh.emit(hexToInt(hex), hex, alpha);
}

export function applyText(hex,
                          alpha = STATE.textAlpha,
                          width = STATE.textWidth) {
  STATE.textColor = hex;
  STATE.textAlpha = alpha;
  STATE.textWidth = width;
  const rgb = hexToRgb(hex);
  root.style.setProperty('--fg-0',        hex);
  root.style.setProperty('--fg-1',        rgba(rgb, alpha * 0.70));
  root.style.setProperty('--fg-2',        rgba(rgb, alpha * 0.45));
  root.style.setProperty('--text-weight', String(Math.max(300, Math.round(400 + (width - 1) * 200))));
  textCh.emit(hex, alpha, width);
}

export function applyStrings(alpha = STATE.stringAlpha,
                             width = STATE.stringWidth) {
  STATE.stringAlpha = alpha;
  STATE.stringWidth = width;
  stringCh.emit(alpha, width);
}

// ----- public subscribe API (back-compat names) -----
export const onWireframeChange  = (fn) => wireCh.subscribe(fn,
  [hexToInt(STATE.wireframeColor), STATE.wireframeColor, STATE.wireframeAlpha, STATE.wireframeWidth]);
export const onBackgroundChange = (fn) => bgCh.subscribe(fn,
  [hexToInt(STATE.backgroundColor), STATE.backgroundColor, STATE.backgroundAlpha]);
export const onTextChange       = (fn) => textCh.subscribe(fn,
  [STATE.textColor, STATE.textAlpha, STATE.textWidth]);
export const onStringChange     = (fn) => stringCh.subscribe(fn,
  [STATE.stringAlpha, STATE.stringWidth]);

export function applyAllDefaults() {
  applyWireframe (STATE.wireframeColor, STATE.wireframeAlpha, STATE.wireframeWidth);
  applyBackground(STATE.backgroundColor, STATE.backgroundAlpha);
  applyText      (STATE.textColor,      STATE.textAlpha,      STATE.textWidth);
  applyStrings   (STATE.stringAlpha,    STATE.stringWidth);
}

// Synthwave preset: pink-on-blue palette.
export function applySpecialMode(enabled) {
  STATE.specialMode = enabled;
  if (enabled) {
    applyWireframe ('#ff3df0', 0.40, 1.5);
    applyBackground('#0a0a2e', 1.00);
    applyText      ('#ff7df5', 1.00, 1.0);
    applyStrings   (0.95, 3);
  } else {
    applyWireframe ('#ff7a3d', 0.10, 1.0);
    applyBackground('#000000', 1.00);
    applyText      ('#ff7a3d', 1.00, 1.0);
    applyStrings   (0.90, 3);
  }
}

export const getAccent    = () => STATE.wireframeColor;
export const getAccentInt = () => hexToInt(STATE.wireframeColor);
