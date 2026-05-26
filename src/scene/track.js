// =====================================================================
// AOTR — track.js
// Möbius rhythm-track. Uses parametric t ∈ [0, 2) for one full traversal
// (a Möbius requires two full circuits in θ for the cross-section frame
// to return to its starting orientation). Triangles render at low alpha;
// lane "strings" render at high alpha, each as three parallel lines to
// fake thickness (since LineBasicMaterial.linewidth is ignored on most
// WebGL implementations).
// =====================================================================

import * as THREE from 'three';
import { STATE, TRACK } from '../config.js';
import { getAccentInt } from '../theme.js';

const TWO_PI = Math.PI * 2;

export function sampleMobius(t, u) {
  const R     = TRACK.mobiusRadius;
  const W     = STATE.trackWidth;
  const theta = t * TWO_PI;
  const phi   = theta * 0.5;
  const halfW = (u * W) * 0.5;

  const tan    = new THREE.Vector3(-Math.sin(theta), 0,  Math.cos(theta));
  const radial = new THREE.Vector3( Math.cos(theta), 0,  Math.sin(theta));
  const up0    = new THREE.Vector3(0, 1, 0);

  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const across = radial.clone().multiplyScalar( cosP).add(up0.clone().multiplyScalar(sinP));
  const normal = radial.clone().multiplyScalar(-sinP).add(up0.clone().multiplyScalar(cosP));

  const position = new THREE.Vector3(
    R * Math.cos(theta) + across.x * halfW,
                          across.y * halfW,
    R * Math.sin(theta) + across.z * halfW,
  );
  return { position, tangent: tan, normal, binormal: across };
}

export function laneToU(laneIndex) {
  const N = STATE.laneCount;
  return N === 1 ? 0 : -1 + (2 * (laneIndex - 1) / (N - 1));
}

// Base t-speed at 1.0× starting speed: chosen so that nominal cadence
// matches ~100 BPM of forward motion at the lane spacing.
export function getBaseTSpeed() {
  const beatsPerSec   = 100 / 60;
  const laneSpacing   = STATE.trackWidth / Math.max(1, STATE.laneCount - 1);
  const linearSpeed   = laneSpacing * TRACK.unitsPerBeat * beatsPerSec;
  const fullCircuit   = 2 * (TWO_PI * TRACK.mobiusRadius);
  return (linearSpeed / fullCircuit) * 2;
}

export class MobiusTrack {
  constructor(scene) {
    this.scene        = scene;
    this.group        = new THREE.Group();
    this.lineMeshes   = [];
    this.stringMeshes = [];
    this._build();
    scene.add(this.group);
  }

  _build() {
    const accent = getAccentInt();
    const segs   = TRACK.mobiusSegments;
    const wSegs  = STATE.laneCount;

    // Vertex grid over t ∈ [0, 2) so the Möbius closes properly.
    const positions = [];
    const indices   = [];
    for (let i = 0; i < segs; i++) {
      const t = (i / segs) * 2;
      for (let j = 0; j <= wSegs; j++) {
        const u = (j / wSegs) * 2 - 1;
        const s = sampleMobius(t, u);
        positions.push(s.position.x, s.position.y, s.position.z);
      }
    }
    const idxAt = (ringI, j) => (ringI % segs) * (wSegs + 1) + j;
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < wSegs; j++) {
        const a = idxAt(i, j),     b = idxAt(i, j + 1);
        const c = idxAt(i + 1, j), d = idxAt(i + 1, j + 1);
        indices.push(a, c, b,  b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // Surface fill — black semi-transparent
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x000000, side: THREE.DoubleSide, transparent: true, opacity: 0.55,
    }));
    this.group.add(this.mesh);

    // Triangle wireframe — low alpha
    this.wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({
        color: accent, transparent: true, opacity: STATE.wireframeAlpha,
      }),
    );
    this.group.add(this.wireframe);
    this.lineMeshes.push(this.wireframe);

    this._buildLaneLines(segs, accent);

    // Bold perpendicular start line
    this.startLine = this._buildPerpLine(0.0, accent, 0.7);
    this.group.add(this.startLine);
    this.lineMeshes.push(this.startLine);
  }

  _buildLaneLines(segs, accent) {
    // Tear down old lane lines if rebuilding
    if (this._laneLines) {
      this._laneLines.forEach(m => {
        this.group.remove(m);
        m.geometry.dispose();
        m.material.dispose();
      });
    }
    this._laneLines   = [];
    this.stringMeshes = [];

    const N        = STATE.laneCount;
    const alpha    = STATE.stringAlpha;
    const widthFac = STATE.stringWidth;       // 1.0 thin, 3.0 bold

    const matBright = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: alpha       });
    const matGlow   = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: alpha * 0.5 });

    const liftAmt = 0.10;
    const sideAmt = 0.04 * widthFac;

    for (let k = 1; k <= N; k++) {
      const u = (N === 1) ? 0 : -1 + (2 * (k - 1) / (N - 1));
      const ptsCenter = [], ptsAbove = [], ptsBelow = [];

      for (let i = 0; i <= segs; i++) {
        const t = (i / segs) * 2;
        const s = sampleMobius(t, u);
        const pC = new THREE.Vector3(
          s.position.x + s.normal.x * liftAmt,
          s.position.y + s.normal.y * liftAmt,
          s.position.z + s.normal.z * liftAmt,
        );
        ptsCenter.push(pC);
        ptsAbove.push(new THREE.Vector3(
          pC.x + s.binormal.x * sideAmt,
          pC.y + s.binormal.y * sideAmt,
          pC.z + s.binormal.z * sideAmt,
        ));
        ptsBelow.push(new THREE.Vector3(
          pC.x - s.binormal.x * sideAmt,
          pC.y - s.binormal.y * sideAmt,
          pC.z - s.binormal.z * sideAmt,
        ));
      }

      // Three parallel lines = fake bold (since linewidth is ignored)
      const lineC = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsCenter), matBright);
      const lineA = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsAbove),  matGlow);
      const lineB = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsBelow),  matGlow);
      [lineC, lineA, lineB].forEach(l => {
        this.group.add(l);
        this._laneLines.push(l);
        this.lineMeshes.push(l);
        this.stringMeshes.push(l);
      });
    }
  }

  _buildPerpLine(t, accent, lift = 0.5) {
    const N = 16;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const s = sampleMobius(t, -1 + (2 * i / N));
      const o = s.normal.clone().multiplyScalar(lift);
      pts.push(new THREE.Vector3(s.position.x + o.x, s.position.y + o.y, s.position.z + o.z));
    }
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 1.0 }),
    );
  }

  rebuildLanes() {
    this.dispose();
    this.group        = new THREE.Group();
    this.lineMeshes   = [];
    this.stringMeshes = [];
    this._build();
    this.scene.add(this.group);
  }

  setAccent(intColor, alpha, width) {
    if (this.wireframe?.material) {
      this.wireframe.material.color.setHex(intColor);
      if (alpha !== undefined) this.wireframe.material.opacity = alpha;
    }
    this.lineMeshes.forEach(m => {
      if (m !== this.wireframe && m.material) m.material.color.setHex(intColor);
    });
    if (width !== undefined && width !== this._lastWireWidth) {
      this._lastWireWidth = width;
      this._buildLaneLines(TRACK.mobiusSegments, intColor);
    }
  }

  setStringAlpha(alpha, width) {
    if (alpha !== undefined) {
      // index % 3 === 0 corresponds to the bright center line; the other
      // two of each triplet are the glow lines.
      this.stringMeshes.forEach((m, i) => {
        if (!m.material) return;
        m.material.opacity = (i % 3 === 0) ? alpha : alpha * 0.5;
      });
    }
    if (width !== undefined && width !== this._lastStringWidth) {
      this._lastStringWidth = width;
      this._buildLaneLines(TRACK.mobiusSegments, getAccentInt());
    }
  }

  // Audio-reactive pulse: bass level [0,1] briefly boosts opacity.
  setBassPulse(pulse01) {
    const p = Math.max(0, Math.min(1, pulse01));
    if (this.wireframe?.material) {
      this.wireframe.material.opacity = Math.min(1, STATE.wireframeAlpha * (1 + p * 0.5));
    }
    const targetCenter = Math.min(1, STATE.stringAlpha * (1 + p * 0.3));
    this.stringMeshes.forEach((m, i) => {
      if (!m.material) return;
      m.material.opacity = (i % 3 === 0) ? targetCenter : targetCenter * 0.5;
    });
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(obj => {
      obj.geometry?.dispose();
      obj.material?.dispose();
    });
  }
}
