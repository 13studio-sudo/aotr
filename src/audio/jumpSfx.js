// =====================================================================
// AOTR — jumpSfx.js
// 3 simple cute jump sound effects, all synthesized via Web Audio.
// Selectable in the dev panel.
// =====================================================================

export const JUMP_SFX_NAMES = ['BOING', 'WOOP', 'HOP'];

export function playJumpSfx(audioCtx, masterNode, sfxIndex = 1) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const dest = masterNode || audioCtx.destination;

  switch (sfxIndex) {
    case 1: return _boing(audioCtx, dest, t);
    case 2: return _woop(audioCtx, dest, t);
    case 3: return _hop(audioCtx, dest, t);
    default: return _boing(audioCtx, dest, t);
  }
}

// 1) BOING — quick descending sine with a wobble
function _boing(ctx, dest, t) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.18);
  // Vibrato
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 18;
  lfoGain.gain.value = 60;
  lfo.connect(lfoGain).connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(g).connect(dest);
  osc.start(t); lfo.start(t);
  osc.stop(t + 0.25); lfo.stop(t + 0.25);
}

// 2) WOOP — ascending square with quick fade
function _woop(ctx, dest, t) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
  // Lowpass to take the harsh edges off
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2500;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.22, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(lp).connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.18);
}

// 3) HOP — short triangle blip
function _hop(ctx, dest, t) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.exponentialRampToValueAtTime(660, t + 0.04);
  osc.frequency.exponentialRampToValueAtTime(330, t + 0.10);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.30, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.15);
}
