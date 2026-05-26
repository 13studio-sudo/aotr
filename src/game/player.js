// =====================================================================
// AOTR — player.js
// Möbius rhythm-track player. State:
//   • t        — position around the band (0..1, wraps)
//   • u        — current lateral position (-1..1)
//   • lane     — current discrete lane (1..N)
//   • targetLane — lane the player wants to be in (lerped toward)
//   • airborne / airTime — jump state
//   • fallen   — true if u went out of bounds (game over → restart)
// =====================================================================

import * as THREE from 'three';
import { STATE, PLAYER } from '../config.js';
import { sampleMobius, laneToU } from '../scene/track.js';

export class Player {
  constructor(mesh) {
    this.mesh = mesh;
    this.tSpeed = 0.05;     // set externally
    this.reset();
  }

  setSpeed(s) { this.tSpeed = s; }

  reset() {
    this.t = 0;
    this.lane = Math.ceil(STATE.laneCount / 2);
    this.targetLane = this.lane;
    this.u = laneToU(this.lane);
    this.airborne = false;
    this.airTime = 0;
    this.fallen = false;
    this.alive = true;
    this._frozen = false;
    this._updateMesh();
  }

  // INVERTED ARROWS: caller decides the polarity. Here, +1 = increase u, -1 = decrease u.
  shiftLane(delta) {
    const N = STATE.laneCount;
    this.targetLane = Math.max(1, Math.min(N, this.targetLane + delta));
  }

  setTargetLane(lane) {
    const N = STATE.laneCount;
    this.targetLane = Math.max(1, Math.min(N, Math.round(lane)));
  }

  jump() {
    if (this.airborne || !this.alive) return;
    this.airborne = true;
    this.airTime = 0;
    if (this.onJump) this.onJump();
  }

  freeze() { this._frozen = true; }
  unfreeze() { this._frozen = false; }

  // dt: seconds. Returns true if a fall-off happened this frame.
  update(dt) {
    if (!this.alive) return false;

    // Forward motion (t increases). Mobius requires t ∈ [0,2) to complete
    // one full traversal back to the same side of the strip. We wrap at 2.0.
    if (!this._frozen) {
      this.t = (this.t + this.tSpeed * dt) % 2;
    }

    // Lateral smoothing toward targetLane
    const targetU = laneToU(this.targetLane);
    const du = targetU - this.u;
    const switchSpeed = (2 / STATE.laneCount) / PLAYER.laneSwitchTime;  // u-units per second per lane
    const moveAmount = Math.sign(du) * Math.min(Math.abs(du), switchSpeed * dt);
    this.u += moveAmount;
    if (Math.abs(targetU - this.u) < 0.01) {
      this.u = targetU;
      this.lane = this.targetLane;
    }

    // Jump animation
    let jumpY = 0;
    if (this.airborne) {
      this.airTime += dt;
      if (this.airTime >= STATE.jumpDuration) {
        this.airborne = false;
        this.airTime = 0;
      } else {
        const phase = this.airTime / STATE.jumpDuration;
        jumpY = Math.sin(phase * Math.PI) * PLAYER.jumpHeight;
      }
    }

    // Fall-off detection: if u went out of [-1, 1] by more than fallOffSlack in u-units
    const slackU = (PLAYER.fallOffSlack * 2) / STATE.laneCount;
    if (this.u < -1 - slackU || this.u > 1 + slackU) {
      console.log('[fell-off] u=', this.u.toFixed(3), 'slackU=', slackU.toFixed(3),
                  'lane=', this.lane, 'targetLane=', this.targetLane);
      this.fallen = true;
      this.alive = false;
    }

    this._updateMesh(jumpY);
    return this.fallen;
  }

  _updateMesh(jumpY = 0) {
    const s = sampleMobius(this.t, this.u);
    // Lift slightly above the band surface
    const lift = s.normal.clone().multiplyScalar(0.45 + jumpY);
    this.mesh.position.set(
      s.position.x + lift.x,
      s.position.y + lift.y,
      s.position.z + lift.z
    );
    // Orient car to surface — forward along tangent, up along normal
    // BoxGeometry's "front" is +Z by convention; lookAt with target at (pos + tangent)
    const lookTarget = this.mesh.position.clone().add(s.tangent);
    const m = new THREE.Matrix4();
    m.lookAt(this.mesh.position, lookTarget, s.normal);
    this.mesh.quaternion.setFromRotationMatrix(m);

    // Light banking when lane-changing
    const targetU = laneToU(this.targetLane);
    const tilt = (targetU - this.u) * 0.3;
    // Apply a local roll on top of the surface alignment
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
    this.mesh.quaternion.multiply(q);
  }

  // Get current world transform for the camera
  getPose() {
    const s = sampleMobius(this.t, this.u);
    return {
      position: s.position.clone(),
      tangent:  s.tangent.clone(),
      normal:   s.normal.clone(),
    };
  }

  // 0 = takeoff, 0.5 = peak, 1 = landing. -1 if grounded.
  getAirPhase() {
    if (!this.airborne) return -1;
    return Math.min(1, this.airTime / STATE.jumpDuration);
  }
}
