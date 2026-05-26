// =====================================================================
// AOTR — input.js
// Three input methods:
//   1. Keyboard: ←/→ shift lanes (INVERTED).
//      W or Space hold = boost, release = jump.
//   2. Touch: hold anywhere = boost, release = jump.
//   3. Gyro tilt: smooth lane targeting (gamma axis on phone).
// =====================================================================

export class InputManager {
  constructor() {
    this._handlers = { lane: [], jump: [], laneAbsolute: [], boostStart: [], boostEnd: [] };
    this._gyroEnabled = false;
    this._gyroBase = 0;
    this._gyroTimer = null;
    this._lastGyroLane = null;
    this._gyroPermissionRequested = false;

    this._wHeld = false;
    this._touchHeld = false;
    this._touchStartId = null;

    this._bindKeyboard();
    this._bindTouch();
  }

  on(event, fn) {
    if (this._handlers[event]) this._handlers[event].push(fn);
  }

  _emit(event, ...args) {
    (this._handlers[event] || []).forEach(fn => fn(...args));
  }

  _bindKeyboard() {
    const isBoostKey = (e) =>
      e.code === 'KeyW' || e.key === 'w' || e.key === 'W' ||
      e.code === 'Space' || e.key === ' ';

    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this._emit('lane', +1);
      } else if (e.code === 'ArrowRight' || e.key === 'ArrowRight') {
        e.preventDefault();
        this._emit('lane', -1);
      } else if (isBoostKey(e)) {
        if (e.repeat) return;
        e.preventDefault();
        if (!this._wHeld) {
          this._wHeld = true;
          this._emit('boostStart');
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      if (isBoostKey(e)) {
        e.preventDefault();
        if (this._wHeld) {
          this._wHeld = false;
          this._emit('boostEnd');
          this._emit('jump');
        }
      }
    });
  }

  _bindTouch() {
    const isUiTarget = (target) =>
      target?.closest && target.closest('button, input, select, .dev-panel, .overlay');

    document.addEventListener('touchstart', (e) => {
      if (isUiTarget(e.target)) return;
      // Track only the first touch — multi-touch ignored
      if (this._touchHeld) return;
      this._touchHeld = true;
      this._touchStartId = e.changedTouches[0]?.identifier ?? null;
      this._emit('boostStart');
    }, { passive: true });

    const onTouchEnd = (e) => {
      if (!this._touchHeld) return;
      // End if the matching touch ended
      const t = Array.from(e.changedTouches).find(t => t.identifier === this._touchStartId);
      if (!t) return;
      this._touchHeld = false;
      this._touchStartId = null;
      this._emit('boostEnd');
      this._emit('jump');
    };
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
  }

  // Public: request gyro permission (must be called from user gesture on iOS)
  async requestGyroPermission() {
    if (this._gyroPermissionRequested) return this._gyroEnabled;
    this._gyroPermissionRequested = true;

    // iOS 13+ requires explicit permission
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted') {
          this._enableGyro();
          return true;
        }
      } catch (e) {
        console.warn('[input] gyro permission denied or unavailable:', e);
      }
      return false;
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      // Android & older iOS — no permission needed
      this._enableGyro();
      return true;
    }
    return false;
  }

  _enableGyro() {
    this._gyroEnabled = true;
    let calibrated = false;

    window.addEventListener('deviceorientation', (e) => {
      // Determine which axis to use based on current orientation
      const isLandscape = window.innerWidth > window.innerHeight;
      // Portrait: gamma is left-right tilt
      // Landscape: beta becomes the left-right axis (with sign depending on which side is up)
      let raw;
      if (isLandscape) {
        // beta in landscape, with rough sign correction. screen.orientation.angle gives 90 or -90/270
        const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        raw = (e.beta || 0) * (angle === 90 ? 1 : -1);
      } else {
        raw = e.gamma || 0;
      }
      if (!calibrated) {
        this._gyroBase = raw;
        calibrated = true;
      }
      this._lastGyroDelta = raw - this._gyroBase;
    });

    // Re-calibrate on orientation change
    window.addEventListener('orientationchange', () => {
      calibrated = false;
    });
  }

  // Game queries this each frame to get the current target lane.
  getGyroLane(currentLane, laneCount) {
    if (!this._gyroEnabled || this._lastGyroDelta === undefined) return currentLane;
    const TILT_RANGE = 20;
    // INVERTED to match inverted-arrow-keys spec:
    // tilt right → lane shifts left (lower index); tilt left → lane shifts right.
    const offset = Math.max(-1, Math.min(1, -this._lastGyroDelta / TILT_RANGE));
    const center = (laneCount + 1) / 2;
    const targetLane = Math.round(center + offset * (laneCount / 2));
    return Math.max(1, Math.min(laneCount, targetLane));
  }

  isGyroEnabled() { return this._gyroEnabled; }
}
