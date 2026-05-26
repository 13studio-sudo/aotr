// =====================================================================
// AOTR — car.js
// Strict square-only F1: every part is a BoxGeometry. Black fills with
// accent-colored wireframe edges. v0.0.27 collapses the repetitive
// per-part code into a single data-driven build pass.
// =====================================================================

import * as THREE from 'three';
import { getAccentInt } from '../theme.js';

// Single geometry preset (one song = one car shape).
const G = { wingHeight: 1.0, wingSpan: 0.95, sidepodSize: 0.9, noseLength: 0.9 };

// Body / accent / wheel material opacities differ slightly so the
// silhouette reads even against bright backgrounds.
const OPACITY = { body: 0.6, accent: 0.7, wheel: 0.85 };

export function buildCar() {
  const group = new THREE.Group();
  const accent = getAccentInt();

  const matBody   = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: OPACITY.body   });
  const matAccent = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: OPACITY.accent });
  const matWheel  = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: OPACITY.wheel  });
  const matWire   = new THREE.LineBasicMaterial({ color: accent,   transparent: true, opacity: 1.0 });

  const wires = [];

  // ----- part list. dims = [x, y, z], pos = [x, y, z], mat = 'body'|'accent'|'wheel'
  const fwingSpan   = 1.4 * G.wingSpan;
  const noseZ       = -1.4 * G.noseLength;
  const rwingPostH  = 0.4 * G.wingHeight;
  const rwingY      = 0.4 + rwingPostH / 2;
  const podScale    = G.sidepodSize;

  const parts = [
    // Chassis & cabin
    { dims: [0.90, 0.25, 2.6], pos: [0, 0.30,  0   ], mat: 'body'   },
    { dims: [0.55, 0.30, 0.9], pos: [0, 0.55,  0.10], mat: 'body'   },
    { dims: [0.45, 0.18, 0.4], pos: [0, 0.70,  0.05], mat: 'accent' },
    // Wings
    { dims: [fwingSpan, 0.08, 0.35],          pos: [0, 0.18, noseZ], mat: 'body' },
    { dims: [0.04, rwingPostH, 0.04],         pos: [-0.25, rwingY - rwingPostH / 4, 1.25], mat: 'accent' },
    { dims: [0.04, rwingPostH, 0.04],         pos: [ 0.25, rwingY - rwingPostH / 4, 1.25], mat: 'accent' },
    { dims: [1.0 * G.wingSpan, 0.06, 0.30],   pos: [0, 0.4 + rwingPostH, 1.25], mat: 'body' },
    // Sidepods
    { dims: [0.35 * podScale, 0.32 * podScale, 1.0],
      pos:  [-(0.55 + (podScale - 1) * 0.1), 0.32, 0.1], mat: 'body' },
    { dims: [0.35 * podScale, 0.32 * podScale, 1.0],
      pos:  [ (0.55 + (podScale - 1) * 0.1), 0.32, 0.1], mat: 'body' },
    // Square wheels — by spec, ALL geometry is squares
    { dims: [0.36, 0.45, 0.45], pos: [-0.7, 0.28, -1.0], mat: 'wheel' },
    { dims: [0.36, 0.45, 0.45], pos: [ 0.7, 0.28, -1.0], mat: 'wheel' },
    { dims: [0.36, 0.45, 0.45], pos: [-0.7, 0.28,  1.0], mat: 'wheel' },
    { dims: [0.36, 0.45, 0.45], pos: [ 0.7, 0.28,  1.0], mat: 'wheel' },
  ];

  const matFor = { body: matBody, accent: matAccent, wheel: matWheel };

  for (const part of parts) {
    const geom = new THREE.BoxGeometry(...part.dims);
    const mesh = new THREE.Mesh(geom, matFor[part.mat]);
    mesh.position.set(...part.pos);
    group.add(mesh);

    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geom), matWire);
    wire.position.copy(mesh.position);
    wire.quaternion.copy(mesh.quaternion);
    wire.scale.copy(mesh.scale);
    group.add(wire);
    wires.push(wire);
  }

  group.userData.wires     = wires;
  group.userData.setAccent = (intColor) => wires.forEach(w => w.material.color.setHex(intColor));

  // Explicit disposal — Three.js does NOT auto-free GPU resources.
  group.userData.dispose = () => {
    group.traverse(obj => {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
      else                              obj.material?.dispose();
    });
  };

  return group;
}
