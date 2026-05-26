// =====================================================================
// AOTR — main.js
// Endless rhythm-run on a Möbius band. The car accelerates continuously;
// notes spawn ahead; the run ends on collision or fall-off. Score is a
// pure function of the speed multiplier.
// =====================================================================

import * as THREE from 'three';

import { STATE, SONG, loadSettings } from './config.js';
import {
  applyAllDefaults,
  onWireframeChange, onBackgroundChange, onStringChange,
} from './theme.js';

import { AudioLoop }        from './audio/audioLoop.js';
import { playJumpSfx }      from './audio/jumpSfx.js';

import {
  buildLighting, applyAccentToLighting, applyBackgroundToLighting, updateUniverse,
} from './scene/lighting.js';
import { MobiusTrack, getBaseTSpeed } from './scene/track.js';
import { NoteManager }                from './scene/notes.js';
import { buildCar }                   from './scene/car.js';

import { Player }           from './game/player.js';
import { CameraController } from './game/camera.js';
import { InputManager }     from './game/input.js';

import { DevPanel }   from './ui/devPanel.js';
import { HUD }        from './ui/hud.js';
import { DebugHud }   from './ui/debugHud.js';
import { injectLogos } from './ui/logo.js';
import * as Screens   from './ui/screens.js';

// Pull saved settings before any module reads them.
loadSettings();
applyAllDefaults();

// =====================================================================
// Three.js setup
// =====================================================================
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

// WebGL context loss is real on mobile under memory pressure. Without
// this handler the canvas freezes silently on a stale frame.
canvas.addEventListener('webglcontextlost', (e) => {
  console.error('[webgl] context LOST', e);
  e.preventDefault();
  alert('GPU context lost. Reloading…');
  setTimeout(() => location.reload(), 500);
}, false);
canvas.addEventListener('webglcontextrestored',
  () => console.log('[webgl] context restored'), false);

// Adaptive pixel-ratio: scales render resolution against measured FPS.
const adaptiveQuality = (() => {
  const native = Math.min(window.devicePixelRatio || 1, 1.5);
  const s = { current: native, min: 0.65, max: native, samples: [], lastAdjustMs: 0 };
  return {
    current: () => s.current,
    record(dt) {
      s.samples.push(1 / Math.max(dt, 0.001));
      if (s.samples.length > 60) s.samples.shift();
    },
    evaluate(now) {
      if (s.samples.length < 60) return;
      if (now - s.lastAdjustMs < 1500) return;
      const avg = s.samples.reduce((a, b) => a + b, 0) / s.samples.length;
      if      (avg < 50 && s.current > s.min) s.current = Math.max(s.min, s.current - 0.15);
      else if (avg > 58 && s.current < s.max) s.current = Math.min(s.max, s.current + 0.10);
      else return;
      renderer.setPixelRatio(s.current);
      s.lastAdjustMs = now;
      s.samples = [];
    },
  };
})();
renderer.setPixelRatio(adaptiveQuality.current());

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);
camera.position.set(0, 80, -80);

const lights    = buildLighting(scene);
const cam       = new CameraController(camera);
const audioLoop = new AudioLoop();
const input     = new InputManager();
const hud       = new HUD();
const debugHud  = new DebugHud();

let track          = null;
let notes          = null;
let playerCarMesh  = null;
let player         = null;

let phase            = 'loading';
let lastTime         = performance.now();
let baseTSpeed       = 0;
let currentSpeedMul  = 1.0;
let topScore         = 0;
let nextSpawnTime    = 0;
let boosting         = false;
let boostHoldTime    = 0;

const mobileDetected = (typeof window.orientation !== 'undefined') ||
                       !!navigator.userAgent.match(/Mobi|Android|iPhone|iPad|iPod/i);

// =====================================================================
// Theme subscribers
// =====================================================================
onWireframeChange((intColor, _hex, alpha, width) => {
  if (track)         track.setAccent(intColor, alpha, width);
  if (notes)         notes.setAccent(intColor);
  if (playerCarMesh) playerCarMesh.userData.setAccent?.(intColor);
  applyAccentToLighting(lights, intColor);
});
onBackgroundChange((intColor) => applyBackgroundToLighting(scene, intColor));
onStringChange((alpha, width) => { if (track) track.setStringAlpha(alpha, width); });

// =====================================================================
// Dev panel
// =====================================================================
const dev = new DevPanel({
  onLaneCountChange: () => { if (track) track.rebuildLanes(); },
  onVolumeChange:    () => audioLoop.applyVolume(),
  onUniverseBgChange: (enabled) => {
    if (lights.stars) lights.stars.visible = enabled;
    if (lights.orbit) lights.orbit.visible = enabled;
  },
  onNewGame: () => newGame(),
});
dev.attachAudio(audioLoop);

// =====================================================================
// Resize
// =====================================================================
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize',            resize);
window.addEventListener('orientationchange', resize);
resize();
injectLogos();

// =====================================================================
// Boot — fetch the audio bytes, then either auto-start (after a fresh
// reload) or prompt the user to click-to-start so audio can decode.
// =====================================================================
async function boot() {
  Screens.showLoading();
  Screens.setLoadingProgress(0);
  try {
    await audioLoop.fetchAssets(
      `./songs/${SONG.audioFile}`,
      (pct) => Screens.setLoadingProgress(pct * 100),
    );
  } catch (e) {
    console.error('[boot] audio fetch failed:', e);
    Screens.showLoadFailure(e.message || String(e));
    return;     // do NOT continue to click-to-start if assets are missing
  }

  // Check the autostart flag set by the FRESH RELOAD button in the
  // game-over screen. The reload itself is a user gesture, so modern
  // browsers will carry it across — but iOS may not, hence fallback.
  let autostart = false;
  try {
    autostart = sessionStorage.getItem('aotr_autostart') === '1';
    sessionStorage.removeItem('aotr_autostart');
  } catch (_) {}

  if (autostart) {
    try { await handleClickToStart(); return; }
    catch (e) { console.warn('[boot] autostart failed; falling back', e); }
  }

  phase = 'click-to-start';
  Screens.showClickToStart(handleClickToStart);
}

async function handleClickToStart() {
  audioLoop.ensureCtx();
  if (audioLoop.ctx?.state === 'suspended') {
    try { await audioLoop.ctx.resume(); } catch (e) { console.warn(e); }
  }
  try {
    await audioLoop.ensureDecoded();
  } catch (e) {
    console.error('[click-to-start] decode failed:', e);
    Screens.showLoadFailure('Audio decode failed: ' + (e.message || e));
    return;
  }
  Screens.hideLoading();

  if (mobileDetected && !input.isGyroEnabled()) {
    Screens.showGyroPrompt(
      async () => { await input.requestGyroPermission(); beginRace(); },
      ()      => beginRace(),
    );
  } else {
    beginRace();
  }
}

// =====================================================================
// Scene build / teardown
// =====================================================================
function buildScene() {
  if (track) { track.dispose(); track = null; }
  if (notes) { notes.dispose(); notes = null; }
  if (playerCarMesh) {
    scene.remove(playerCarMesh);
    playerCarMesh.userData?.dispose?.();
    playerCarMesh = null;
  }
  if (renderer.info?.memory) {
    const m = renderer.info.memory;
    console.log(`[buildScene] GPU before-build: g=${m.geometries} t=${m.textures}`);
  }

  track         = new MobiusTrack(scene, {});
  notes         = new NoteManager(scene);
  playerCarMesh = buildCar({});
  scene.add(playerCarMesh);

  player     = new Player(playerCarMesh);
  baseTSpeed = getBaseTSpeed();
  player.setSpeed(baseTSpeed * STATE.startSpeed);
  player.reset();
  player.onJump = () => {
    if (audioLoop.ctx) {
      const dest = audioLoop.gain || audioLoop.ctx.destination;
      playJumpSfx(audioLoop.ctx, dest, STATE.jumpSfx);
    }
  };

  cam.resetTo(player.getPose());
}

// =====================================================================
// Race lifecycle
// =====================================================================
let _beginRaceInFlight = false;
function beginRace() {
  if (_beginRaceInFlight) return;
  _beginRaceInFlight = true;
  try {
    buildScene();
    notes.onHit = () => gameOver();
    audioLoop.start();

    currentSpeedMul = STATE.startSpeed;
    topScore        = 0;
    boosting        = false;
    boostHoldTime   = 0;
    nextSpawnTime   = performance.now() + 5000;
    phase           = 'playing';
  } catch (e) {
    console.error('[beginRace] failed:', e);
    alert('Scene build failed: ' + (e.message || e));
  } finally {
    _beginRaceInFlight = false;
  }
}

function gameOver() {
  if (phase !== 'playing') return;
  phase = 'gameover';
  audioLoop.stop();
  cam.shake(2.2, 0.45);
  notes?.clear();
  player?.freeze();

  Screens.showGameOver(topScore, () => {
    // Pre-set autostart so the page reload skips click-to-start.
    try { sessionStorage.setItem('aotr_autostart', '1'); } catch (_) {}
    location.reload();
  });
}

// DEV-PANEL "NEW GAME": restart in-place with current settings.
function newGame() {
  if (audioLoop.playing) audioLoop.stop();
  notes?.clear();
  player?.freeze();
  document.getElementById('overlay-gameover')?.setAttribute('hidden', '');
  dev.close();
  phase = 'gameover-restart';
  setTimeout(beginRace, 200);
}

// =====================================================================
// Note spawner — random, density scales with speed
// =====================================================================
function spawnRandomNote() {
  if (!notes || !player) return;
  const N = STATE.laneCount;
  const r = Math.random();
  const kind = r < 0.60 ? 'single'
             : r < 0.85 ? 'tall'
             :            'wide';
  // Wide spans 2 lanes, so its lane range is 1..N-1
  const laneMax = (kind === 'wide') ? Math.max(1, N - 1) : N;
  const lane    = 1 + Math.floor(Math.random() * laneMax);
  // Place noteSpawnLeadSec ahead of player in t-space
  const noteT = (player.t + player.tSpeed * STATE.noteSpawnLeadSec) % 2;
  notes.spawn({ t: noteT, lane, kind });
}

function scheduleNextSpawn(nowMs) {
  const interval = Math.max(STATE.noteIntervalMin,
                            STATE.baseNoteIntervalSec / currentSpeedMul);
  const jitter   = (Math.random() - 0.5) * interval * 0.2;
  nextSpawnTime  = nowMs + (interval + jitter) * 1000;
}

// =====================================================================
// Tick loop
// =====================================================================
function tick() {
  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  if (dt > 0.1) dt = 0.1;
  lastTime = now;

  adaptiveQuality.record(dt);
  adaptiveQuality.evaluate(now);
  resize();
  updateUniverse(lights, dt);

  if (phase === 'playing' && player && notes) {
    let accelRate = STATE.speedAccelPerSec;
    if (boosting) {
      boostHoldTime += dt;
      const t01 = Math.min(1, boostHoldTime / STATE.boostRampDuration);
      accelRate *= STATE.boostStartMul +
                   (STATE.boostMaxMul - STATE.boostStartMul) * t01;
    }
    currentSpeedMul *= Math.pow(1 + accelRate, dt);

    const finalTSpeed = baseTSpeed * currentSpeedMul;
    player.setSpeed(finalTSpeed);

    // Pure speed-based score. HUD displays the number; not real KPH.
    const score = currentSpeedMul * STATE.scoreBase;
    if (score > topScore) topScore = score;
    hud.setKph(score);

    if (input.isGyroEnabled()) {
      player.setTargetLane(input.getGyroLane(player.lane, STATE.laneCount));
    }

    const fell = player.update(dt);
    cam.update(dt, player.getPose());

    if (track && audioLoop.playing) {
      track.setBassPulse(audioLoop.getBassLevel());
    }

    if (fell) {
      gameOver();
    } else {
      if (now >= nextSpawnTime) {
        spawnRandomNote();
        scheduleNextSpawn(now);
      }
      notes.update(player.t, player.lane, player.airborne, player.getAirPhase(), finalTSpeed);
    }
  } else if (player) {
    cam.update(dt, player.getPose());
  }

  // Debug HUD (toggle with `)
  debugHud.update({
    phase,
    speedMul:    currentSpeedMul,
    boost:       boosting,
    boostHold:   boostHoldTime,
    audioPlaying:audioLoop.playing,
    audioSources:audioLoop._sources?.length ?? 0,
    noteCount:   notes?.notes?.length ?? 0,
    playerT:     player?.t ?? 0,
    playerU:     player?.u ?? 0,
    playerLane:  player?.lane ?? 0,
    airborne:    player?.airborne ?? false,
    airPhase:    player?.getAirPhase?.() ?? -1,
    gpuGeometries: renderer.info?.memory?.geometries ?? 0,
    gpuTextures:   renderer.info?.memory?.textures ?? 0,
    gpuPrograms:   renderer.info?.programs?.length ?? 0,
    drawCalls:     renderer.info?.render?.calls ?? 0,
  }, dt);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// =====================================================================
// Input wiring
// =====================================================================
input.on('lane', (delta) => {
  if (phase === 'playing' && player) player.shiftLane(delta);
});
input.on('jump', () => {
  if (phase === 'playing' && player) player.jump();
});
input.on('boostStart', () => {
  if (phase !== 'playing') return;
  boosting = true;
  boostHoldTime = 0;
});
input.on('boostEnd', () => {
  boosting = false;
  boostHoldTime = 0;
});

// =====================================================================
// Boot
// =====================================================================
boot();
requestAnimationFrame(tick);
