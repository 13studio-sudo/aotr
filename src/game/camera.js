// =====================================================================
// AOTR — camera.js
// Chase camera that follows the player along the Möbius band, using
// the surface normal as 'up' so the camera flips properly through twists.
// v0.0.22: shake() adds an exponentially-decaying noise offset on top of
// the standard chase position. Useful for collision feedback.
// =====================================================================

import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.camera.up.set(0, 1, 0);
    this._initialized = false;

    // Shake state
    this._shakeAmp = 0;          // current shake amplitude (units)
    this._shakeDecay = 8;        // per-second exponential decay
    this._shakeSeed = 0;         // randomized at start of each shake
  }

  // amplitude in world units, duration in seconds (decay rate derived).
  shake(amplitude = 1.6, duration = 0.45) {
    this._shakeAmp = amplitude;
    this._shakeDecay = Math.log(0.05) / -duration;   // decays to 5% at duration
    this._shakeSeed = Math.random() * 1000;
  }

  update(dt, pose) {
    if (!pose) return;
    const back = pose.tangent.clone().multiplyScalar(-9);
    const up = pose.normal.clone().multiplyScalar(4);
    const desired = pose.position.clone().add(back).add(up);

    if (!this._initialized) {
      this.camera.position.copy(desired);
      this._initialized = true;
    } else {
      this.camera.position.lerp(desired, 0.18);
    }

    // Apply shake offset on top of chase position
    if (this._shakeAmp > 0.001) {
      const t = (performance.now() / 1000) + this._shakeSeed;
      // Three uncorrelated sinusoids of irrational frequency for natural noise
      const ox = Math.sin(t * 47.3) * this._shakeAmp;
      const oy = Math.sin(t * 53.1 + 1.7) * this._shakeAmp;
      const oz = Math.sin(t * 61.7 + 3.3) * this._shakeAmp * 0.5;
      this.camera.position.x += ox;
      this.camera.position.y += oy;
      this.camera.position.z += oz;
      this._shakeAmp *= Math.exp(-this._shakeDecay * dt);
    } else {
      this._shakeAmp = 0;
    }

    // Look ahead along the band
    const lookAt = pose.position.clone()
      .add(pose.tangent.clone().multiplyScalar(14))
      .add(pose.normal.clone().multiplyScalar(0.6));
    this.camera.up.copy(pose.normal);
    this.camera.lookAt(lookAt);
  }

  resetTo(pose) {
    if (!pose) return;
    this._initialized = false;
    this._shakeAmp = 0;
    this.update(0, pose);
  }
}
