// =====================================================================
// AOTR — lighting.js
// A backdrop universe: black sky + procedural starfield + a slowly
// rotating wireframe icosahedron horizon. v0.0.27 drops the dead
// ambient light (all materials are MeshBasicMaterial / LineBasic, which
// don't respond to scene lights).
// =====================================================================

import * as THREE from 'three';
import { getAccentInt } from '../theme.js';

const STAR_VERTEX = `
  attribute float size;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

const STAR_FRAGMENT = `
  uniform vec3 color;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.2, length(uv));
    gl_FragColor = vec4(color, a * 0.5);
  }`;

function buildStars(scene, count = 800) {
  const positions = new Float32Array(count * 3);
  const sizes     = new Float32Array(count);
  const radius    = 480;
  for (let i = 0; i < count; i++) {
    // Uniform on sphere
    const theta = 2 * Math.PI * Math.random();
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = radius * (0.92 + Math.random() * 0.08);
    positions[i * 3    ] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = Math.random() < 0.05 ? 2.4 : (0.6 + Math.random() * 1.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms:       { color: { value: new THREE.Color(getAccentInt()) } },
    vertexShader:   STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthWrite:  false,
  });
  const stars = new THREE.Points(geo, mat);
  scene.add(stars);
  return stars;
}

function buildOrbitGrid(scene) {
  const geo  = new THREE.IcosahedronGeometry(280, 4);
  const wire = new THREE.WireframeGeometry(geo);
  const mat  = new THREE.LineBasicMaterial({
    color: getAccentInt(), transparent: true, opacity: 0.12,
  });
  const lines = new THREE.LineSegments(wire, mat);
  const group = new THREE.Group();
  group.add(lines);
  group.position.set(0, -160, 0);
  scene.add(group);
  return { group, lines };
}

export function buildLighting(scene) {
  scene.background = new THREE.Color(0x000000);
  const stars = buildStars(scene, 800);
  const orbit = buildOrbitGrid(scene);
  return { stars, orbit: orbit.group, orbitLines: orbit.lines };
}

export function applyAccentToLighting(lights, intColor) {
  lights.orbitLines?.material?.color.setHex(intColor);
  if (lights.stars?.material?.uniforms?.color) {
    lights.stars.material.uniforms.color.value.setHex(intColor);
  }
}

export function applyBackgroundToLighting(scene, intColor) {
  if (scene.background?.setHex) scene.background.setHex(intColor);
  else                          scene.background = new THREE.Color(intColor);
}

export function updateUniverse(lights, dt) {
  if (lights.orbit) {
    lights.orbit.rotation.y += dt * 0.040;
    lights.orbit.rotation.x += dt * 0.012;
  }
  if (lights.stars) lights.stars.rotation.y += dt * 0.005;
}
