import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Collects primitive geometries per material key and merges them into a
 * handful of meshes, so each building costs only a few draw calls.
 * All coordinates are in the building's local frame: the facade facing the
 * plaza is the +Z side, ground is y = 0.
 */
class Builder {
  constructor(mats) {
    this.mats = mats;
    this.parts = {};
  }

  push(key, geo) {
    (this.parts[key] ||= []).push(geo);
    return this;
  }

  /** Axis-aligned box from min corner to max corner. */
  box(key, min, max) {
    const g = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    return this.push(key, g);
  }

  /** Box with arbitrary rotation (Euler, radians) around its own center. */
  boxRot(key, center, size, rot) {
    const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
    g.applyMatrix4(
      new THREE.Matrix4().compose(
        new THREE.Vector3(...center),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
        new THREE.Vector3(1, 1, 1),
      ),
    );
    return this.push(key, g);
  }

  /** Vertical cylinder centered at (cx, cz) spanning y0..y1. */
  cyl(key, cx, cz, y0, y1, r, segments = 24) {
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, segments, 1, false);
    g.translate(cx, (y0 + y1) / 2, cz);
    return this.push(key, g);
  }

  /** Thin vertical mullions along a facade parallel to X at depth z. */
  mullionsZ(key, x0, x1, y0, y1, z, step = 2.2, t = 0.09) {
    for (let x = x0; x <= x1 + 1e-3; x += step) this.box(key, [x - t, y0, z - t], [x + t, y1, z + t]);
    return this;
  }

  /** A railing running along X at depth z on top of height y. */
  railingX(key, x0, x1, z, y, h = 1.1, step = 1.5) {
    this.box(key, [x0, y + h - 0.05, z - 0.05], [x1, y + h + 0.05, z + 0.05]);
    this.box(key, [x0, y + 0.25, z - 0.03], [x1, y + 0.3, z + 0.03]);
    for (let x = x0; x <= x1 + 1e-3; x += step) this.box(key, [x - 0.03, y, z - 0.03], [x + 0.03, y + h, z + 0.03]);
    return this;
  }

  /** Window that sits flush on a facade facing +Z at depth z. */
  winZ(key, x0, x1, y0, y1, z) {
    return this.box(key, [x0, y0, z - 0.06], [x1, y1, z + 0.06]);
  }

  /** Window that sits flush on a facade facing +X at x. */
  winX(key, z0, z1, y0, y1, x) {
    return this.box(key, [x - 0.06, y0, z0], [x + 0.06, y1, z1]);
  }

  build() {
    const group = new THREE.Group();
    for (const [key, geos] of Object.entries(this.parts)) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, this.mats[key]);
      const lightish = key === 'strip';
      mesh.castShadow = !lightish;
      mesh.receiveShadow = !lightish;
      group.add(mesh);
    }
    return group;
  }
}

/* ------------------------------------------------------------------------ */
/* 01 · HOME — stacked white volumes with a cantilever, close to the poster  */
/* ------------------------------------------------------------------------ */
function home(mats) {
  const b = new Builder(mats);
  // Ground floor: recessed warm interior, glowing like the poster's base.
  b.box('warm', [-24, 0, -7], [5, 4.2, -6]);
  b.box('strip', [-24, 4.0, -6], [5, 4.2, -1.2]);
  b.mullionsZ('metal', -24, 5, 0, 4.0, -1.5, 2.4);
  b.box('metal', [-24, 2.9, -1.56], [5, 3.0, -1.44]);
  for (const x of [-20, -12, -4]) b.box('white', [x - 0.35, 0, -1.1], [x + 0.35, 4.2, -0.4]);

  // Level 1 slab + balcony railing.
  b.box('white', [-26, 4.2, -16], [6, 5.0, 2.4]);
  b.railingX('metal', -26, 6, 2.2, 5.0);

  // Level 1 mass with a ribbon window.
  b.box('white', [-26, 5.0, -16], [6, 9.0, -1.0]);
  b.winZ('glass', -21, -5, 6.2, 7.9, -1.0);
  b.winZ('glassDark', -2, 4, 6.2, 7.9, -1.0);

  // Shadow gap under the cantilever.
  b.box('glassDark', [-26, 9.0, -12], [6, 9.7, -3]);

  // Upper cantilever volume.
  b.box('white', [-30, 9.7, -14], [4, 21.5, 4.6]);
  b.box('strip', [-29, 9.58, 0.6], [3, 9.7, 4.2]);
  b.winZ('glass', -28, -11, 13.0, 14.6, 4.6);
  b.winZ('glassDark', -28, -17, 17.0, 18.6, 4.6);
  b.winX('glass', -11, 2.5, 13.0, 14.6, 4);
  b.box('whiteShade', [-30.2, 21.5, -14.2], [4.2, 21.9, 4.8]);

  // Glass bridge into the tower.
  b.box('glass', [4, 9.7, -12], [7.5, 13.5, -6]);

  // Tower on the right.
  b.box('white', [7.5, 0, -20], [21, 28, -5]);
  b.winZ('glassDark', 11, 12.3, 3, 25, -5);
  b.winZ('glass', 15.5, 19.5, 6, 7.4, -5);
  b.winZ('glass', 15.5, 19.5, 12, 13.4, -5);
  b.winZ('glassDark', 15.5, 19.5, 18, 19.4, -5);
  b.box('warm', [8.5, 0, -5.2], [10.2, 3.4, -4.9]);
  b.box('whiteShade', [7.3, 28, -20.2], [21.2, 28.4, -4.8]);
  return b.build();
}

/* ------------------------------------------------------------------------ */
/* 02 · DEBATE — a slab tower of stacked floors with a canopy                */
/* ------------------------------------------------------------------------ */
function debate(mats) {
  const b = new Builder(mats);
  const L = -14;
  const C = 6; // start of the solid core
  const R = 14;
  const D = -14;
  const floors = 8;
  const fh = 3.4;
  const base = 4.4;

  b.box('warm', [L, 0, D], [C, base, -3.2]);
  b.box('strip', [L, base - 0.15, -3.2], [C, base, 0]);
  b.mullionsZ('metal', L, C, 0, base - 0.15, -1.2, 2.5);
  for (let i = 0; i < floors; i++) {
    const y = base + i * fh;
    b.box('white', [L, y, D], [C, y + 1.0, 0.7]);
    b.box(i % 3 === 1 ? 'glassDark' : 'glass', [L + 0.2, y + 1.0, D + 1], [C, y + fh, -0.7]);
    b.mullionsZ('metal', L + 1, C - 0.5, y + 1.0, y + fh, -0.62, 3.0, 0.06);
  }
  const top = base + floors * fh;
  b.box('white', [L, top, D], [C, top + 1.4, 0.7]);

  // Solid core with punched windows.
  b.box('white', [C, 0, D], [R, top + 4.5, 0.3]);
  for (let y = 6; y < top; y += fh * 2) b.winZ(y % 3 > 1 ? 'glass' : 'glassDark', C + 2.2, C + 3.6, y, y + 1.4, 0.3);
  b.box('warm', [C + 1.4, 0, 0.2], [C + 4.5, 3.6, 0.45]);

  // Cantilevered wing on the upper floors.
  const wy0 = base + 4 * fh;
  const wy1 = base + 7 * fh;
  b.box('white', [-26, wy0, -12], [L, wy1, -2]);
  b.winZ('glass', -25, L - 1, wy0 + 2.0, wy0 + 3.6, -2);
  b.winZ('glassDark', -25, L - 1, wy0 + 6.0, wy0 + 7.6, -2);
  b.box('strip', [-25.5, wy0 - 0.08, -11.5], [L, wy0, -2.5]);

  // Entrance canopy.
  b.box('white', [-12, 4.6, 0], [4, 5.1, 9]);
  b.box('strip', [-11.5, 4.52, 0.5], [3.5, 4.6, 8.5]);
  b.cyl('metal', -10, 8, 0, 4.6, 0.14, 12);
  b.cyl('metal', 2, 8, 0, 4.6, 0.14, 12);
  return b.build();
}

/* ------------------------------------------------------------------------ */
/* 03 · PUZZLE — a grid cube lifted on pilotis                               */
/* ------------------------------------------------------------------------ */
function puzzle(mats) {
  const b = new Builder(mats);
  for (const x of [-9, -3, 3, 9]) for (const z of [-2, -11, -20]) b.cyl('white', x, z, 0, 4.5, 0.36, 20);
  b.box('warm', [-7, 0, -18], [7, 4.5, -7]);
  b.box('strip', [-10.5, 4.42, -21.5], [10.5, 4.5, -0.5]);
  b.mullionsZ('metal', -7, 7, 0, 4.5, -6.9, 2.0);

  const y0 = 4.5;
  const size = 22;
  b.box('white', [-11, y0, -22], [11, y0 + size, 0]);
  const n = 4;
  const cell = size / n;
  const lit = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = -11 + cell * (i + 0.5);
      const cy = y0 + cell * (j + 0.5);
      const h = 1.45;
      b.winZ(lit[i * n + j] ? 'glass' : 'glassDark', cx - h, cx + h, cy - h, cy + h, 0);
      // Deep frames make every window a little stage of light and shadow.
      const f = 0.22;
      const dz = 0.9;
      b.box('white', [cx - h - f, cy + h, 0], [cx + h + f, cy + h + f, dz]);
      b.box('white', [cx - h - f, cy - h - f, 0], [cx + h + f, cy - h, dz]);
      b.box('white', [cx - h - f, cy - h, 0], [cx - h, cy + h, dz]);
      b.box('white', [cx + h, cy - h, 0], [cx + h + f, cy + h, dz]);
    }
  }
  b.box('whiteShade', [-11.2, y0 + size, -22.2], [11.2, y0 + size + 0.4, 0.2]);
  // An orange "missing piece" on the roof.
  b.box('orange', [3.5, y0 + size + 0.4, -9], [8.5, y0 + size + 5.4, -4]);

  // Side cube and a ramp.
  b.box('white', [13, 0, -18], [24, 11, -6]);
  b.winZ('glass', 14, 23, 6.5, 8, -6);
  b.box('warm', [15, 0, -6.2], [18, 3.4, -5.9]);
  b.boxRot('white', [-15, 2.2, 3], [3, 0.4, 16], [0.29, 0, 0]);
  b.boxRot('metal', [-16.45, 3.3, 3], [0.08, 1.1, 16], [0.29, 0, 0]);
  return b.build();
}

/* ------------------------------------------------------------------------ */
/* 04 · GAMES — a ribbon-windowed drum in front of a tall block              */
/* ------------------------------------------------------------------------ */
function games(mats) {
  const b = new Builder(mats);
  const cz = -15;
  const R = 15;
  b.cyl('warm', 0, cz, 0, 4, R - 1.4, 64);
  b.cyl('strip', 0, cz, 3.85, 4.0, R - 0.2, 64);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
    b.cyl('white', Math.sin(a) * (R - 0.5), cz + Math.cos(a) * (R - 0.5), 0, 4, 0.22, 10);
  }
  const fh = 3.6;
  for (let i = 0; i < 4; i++) {
    const y = 4 + i * fh;
    b.cyl('white', 0, cz, y, y + 1.15, R, 72);
    b.cyl(i === 2 ? 'glassDark' : 'glass', 0, cz, y + 1.15, y + fh, R - 0.55, 72);
  }
  const top = 4 + 4 * fh;
  b.cyl('white', 0, cz, top, top + 2.6, R, 72);
  b.cyl('whiteShade', 0, cz, top + 2.6, top + 2.9, R + 0.15, 72);

  // Tall block behind.
  b.box('white', [2, 0, -40], [21, 36, -22]);
  for (let y = 22; y < 34; y += 3.4) b.winX(y % 2 ? 'glass' : 'glassDark', -38, -24, y, y + 1.3, 21);
  b.box('orange', [21, 6, -27], [21.5, 33, -25]);
  b.box('whiteShade', [1.8, 36, -40.2], [21.2, 36.4, -21.8]);
  return b.build();
}

/* ------------------------------------------------------------------------ */
/* 05 · ABOUT — a floating-roof pavilion beside a ribbon-window slab         */
/* ------------------------------------------------------------------------ */
function about(mats) {
  const b = new Builder(mats);
  b.box('concrete', [-21, 0, -19], [17, 0.35, 6]);
  b.box('white', [-21, 7, -19], [17, 8.3, 6]);
  b.box('strip', [-20, 6.92, -18], [16, 7.0, 5]);
  for (const x of [-18, -10, -2, 6, 14]) for (const z of [3.5, -16]) b.cyl('metal', x, z, 0.35, 7, 0.16, 12);
  b.box('warm', [-14, 0.35, -14], [10, 7, -13.4]);
  b.box('warm', [-14, 0.35, -14], [-13.4, 7, -3]);
  b.mullionsZ('metal', -14, 10, 0.35, 7, -3, 2.0);
  b.box('metal', [-14, 6.6, -3.1], [10, 6.75, -2.9]);

  // Tall white fin wall with a slit.
  b.box('white', [-26, 0, -12], [-23.6, 19, 7]);
  b.winX('glass', -4, -2.6, 2, 17, -23.6);

  // Slab tower behind.
  b.box('white', [-2, 0, -36], [17, 38, -21]);
  for (let i = 0; i < 9; i++) {
    const y = 10 + i * 3.1;
    b.winZ(i % 3 === 0 ? 'glassDark' : 'glass', -0.5, 15.5, y, y + 1.35, -21);
  }
  b.box('whiteShade', [-2.2, 38, -36.2], [17.2, 38.4, -20.8]);
  return b.build();
}

export const BUILDERS = { home, debate, puzzle, games, about };
