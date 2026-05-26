// =====================================================================
// AOTR — notes.js
// Random-spawned notes on the Möbius. Each note is placed at an explicit
// t-coordinate; collision triggers when the car's t crosses the note's t
// while in the relevant lane(s).
//
// v0.0.22 perf: shared geometries AND materials per kind. Going from
// per-note (mesh-mat + wire-mat + wire-geom) to 3 mesh-mats + 3 wire-mats
// + 3 wire-geoms total cuts WebGL state changes ~3× per note.
// =====================================================================

import * as THREE from 'three';
import { sampleMobius, laneToU } from './track.js';
import { getAccentInt } from '../theme.js';
import { STATE } from '../config.js';

// Geometries (shared) — one per kind
const GEOMS = {
  single: new THREE.BoxGeometry(1.0, 1.0, 0.9),
  tall:   new THREE.BoxGeometry(1.0, 2.0, 0.9),
  wide:   new THREE.BoxGeometry(2.0, 1.0, 0.9),
};
const WIRE_GEOMS = {
  single: new THREE.WireframeGeometry(GEOMS.single),
  tall:   new THREE.WireframeGeometry(GEOMS.tall),
  wide:   new THREE.WireframeGeometry(GEOMS.wide),
};

// Shared materials — created lazily on first NoteManager construction so
// the accent color is correct at instantiation time. After that, color
// updates flow through SHARED.wire.color which all notes see.
let SHARED = null;
function ensureShared() {
  if (SHARED) return SHARED;
  const accent = getAccentInt();
  SHARED = {
    fill: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85 }),
    wire: new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 1.0 }),
  };
  return SHARED;
}

export class NoteManager {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.notes = [];
    this.onHit = null;
    this.onPassed = null;
    ensureShared();
  }

  spawn({ t, lane, kind = 'single' }) {
    const geom = GEOMS[kind] || GEOMS.single;
    const wireGeo = WIRE_GEOMS[kind] || WIRE_GEOMS.single;

    const mesh = new THREE.Mesh(geom, SHARED.fill);
    const wire = new THREE.LineSegments(wireGeo, SHARED.wire);
    mesh.add(wire);
    this.group.add(mesh);

    let u;
    if (kind === 'wide') {
      const u1 = laneToU(lane);
      const u2 = laneToU(Math.min(STATE.laneCount, lane + 1));
      u = (u1 + u2) / 2;
    } else {
      u = laneToU(lane);
    }

    const note = {
      mesh, wire, lane, kind,
      t: ((t % 2) + 2) % 2,
      u,
      hit: false, passed: false,
    };
    this._placeMesh(note);
    this.notes.push(note);
    return note;
  }

  _placeMesh(note) {
    const t = ((note.t % 2) + 2) % 2;
    const s = sampleMobius(t, note.u);
    const baseLift = note.kind === 'tall' ? 1.2 : 0.6;
    const lift = s.normal.clone().multiplyScalar(baseLift);
    note.mesh.position.set(
      s.position.x + lift.x,
      s.position.y + lift.y,
      s.position.z + lift.z
    );
    const lookAt = note.mesh.position.clone().add(s.tangent);
    const m = new THREE.Matrix4();
    m.lookAt(note.mesh.position, lookAt, s.normal);
    note.mesh.quaternion.setFromRotationMatrix(m);
  }

  _isColliding(n, carLane, carAirborne, carAirPhase) {
    const inLaneSet = (n.kind === 'wide')
      ? (carLane === n.lane || carLane === n.lane + 1)
      : (carLane === n.lane);
    if (!inLaneSet) return false;

    let result;
    if (n.kind === 'single' || n.kind === 'wide') {
      result = !carAirborne;
    } else if (n.kind === 'tall') {
      if (!carAirborne) result = true;
      else if (carAirPhase >= 0.35 && carAirPhase <= 0.65) result = false;
      else result = true;
    } else {
      result = false;
    }

    if (result) {
      console.log('[hit]', n.kind,
        'lane=', n.lane, '(carLane=', carLane, ')',
        'air=', carAirborne, 'phase=', carAirPhase?.toFixed?.(2) ?? carAirPhase);
    }
    return result;
  }

  update(carT, carLane, carAirborne, carAirPhase, _currentTSpeed) {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      this._placeMesh(n);

      let dt = n.t - carT;
      while (dt > 1.0) dt -= 2.0;
      while (dt < -1.0) dt += 2.0;

      const fullCircuit = 2 * (2 * Math.PI * 80);
      const arcDist = Math.abs(dt) / 2 * fullCircuit;
      const HIT_RANGE = 0.7;

      if (!n.hit && !n.passed) {
        if (arcDist < HIT_RANGE) {
          if (this._isColliding(n, carLane, carAirborne, carAirPhase)) {
            n.hit = true;
            if (this.onHit) this.onHit(n);
          }
        } else if (dt < -0.005 && dt > -0.5) {
          n.passed = true;
          if (this.onPassed) this.onPassed(n);
        }
      }

      if ((dt < -0.05 && dt > -0.5) || n.hit) {
        // Note: do NOT dispose mesh.geometry / wire.geometry / materials
        // here — they're shared and reused by other notes.
        this.group.remove(n.mesh);
        this.notes.splice(i, 1);
      }
    }
  }

  setAccent(intColor) {
    if (SHARED?.wire) SHARED.wire.color.setHex(intColor);
  }

  clear() {
    this.notes.forEach(n => this.group.remove(n.mesh));
    this.notes = [];
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    // Shared resources are NOT disposed — they're module-level and survive
    // restarts. Only disposed on full page unload (browser handles it).
  }
}
