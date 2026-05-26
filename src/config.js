// =====================================================================
// AOTR — config.js
// Endless rhythm-driving on a Möbius. Single funk loop or muted.
// All chord/music-learning state has been removed.
// =====================================================================

export const DEFAULTS = {
  // Track
  trackWidth: 12,
  laneCount: 6,

  // Audio
  musicVolume: 0.6,           // BGM gain

  // Theme — 3 channels (kept; visuals haven't changed)
  wireframeColor: '#ff7a3d',
  wireframeAlpha: 0.35,
  wireframeWidth: 1.0,
  stringAlpha: 0.95,
  stringWidth: 3.0,
  backgroundColor: '#000000',
  backgroundAlpha: 1.0,
  textColor: '#ff7a3d',
  textAlpha: 1.0,
  textWidth: 1.0,

  // Visual options
  specialMode: false,
  universeBg: true,
  jumpSfx: 1,                 // 1..3

  // Speed: starting multiplier picked at launch
  startSpeed: 1.0,            // 0.5..2.0
  // Acceleration: passive growth per second (compounded)
  // Doubled in v0.0.20: 0.005 → 0.010 (1% per second).
  speedAccelPerSec: 0.010,

  // Boost (hold key/touch): accel multiplier ramps with hold duration.
  boostStartMul:    1.5,      // applied at moment of press
  boostMaxMul:      8.0,      // cap when held > boostRampDuration
  boostRampDuration: 1.2,     // seconds to ramp from start to max

  // Score display: pure speed-multiplier × baseScore. Starts at 60 by default
  // and climbs as currentSpeedMul grows. Decoupled from KPH math.
  scoreBase: 60,

  // Note spawning (random / endless)
  baseNoteIntervalSec: 0.65,
  noteIntervalMin: 0.20,
  noteSpawnLeadSec: 3.5,

  // Player feel
  jumpDuration: 0.55,         // air time per jump in seconds (0.30..1.00)
};

export const STATE = { ...DEFAULTS };

// ----- Settings persistence -----
const STORAGE_KEY = 'aotr.settings.v1';

// Keys saved/restored. Theme + visuals + game tuning. Volatile run-state
// (e.g. nothing here yet) is excluded.
const PERSISTED_KEYS = [
  'laneCount',
  'startSpeed',
  'speedAccelPerSec',
  'musicVolume',
  'wireframeColor', 'wireframeAlpha', 'wireframeWidth',
  'stringAlpha', 'stringWidth',
  'backgroundColor', 'backgroundAlpha',
  'textColor', 'textAlpha', 'textWidth',
  'specialMode', 'universeBg', 'jumpSfx',
  'scoreBase', 'jumpDuration',
];

export function saveSettings() {
  try {
    const out = {};
    PERSISTED_KEYS.forEach(k => { out[k] = STATE[k]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    return true;
  } catch (e) {
    console.warn('[saveSettings] failed', e);
    return false;
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    PERSISTED_KEYS.forEach(k => {
      if (parsed[k] !== undefined) STATE[k] = parsed[k];
    });
    return true;
  } catch (e) {
    console.warn('[loadSettings] failed', e);
    return false;
  }
}

// Track / world constants
export const TRACK = {
  unitsPerBeat: 4,
  mobiusRadius: 80,
  mobiusSegments: 360,
  // Real-world conversion: tune so that speed multiplier 1.0 ≈ 180 km/h
  metersPerUnit: 0.1,
};

export const PLAYER = {
  laneSwitchTime: 0.18,
  jumpDuration:   0.55,
  jumpHeight:     2.4,
  fallOffSlack:   0.6,
};

// =====================================================================
// The single audio loop. Chart data is no longer used (notes are random).
// =====================================================================
export const SONG = {
  audioFile: 'funky_fusion_bass.m4a',
};
