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

  /** Axis-aligned box between two opposite corners (in any order). */
  box(key, a, b) {
    // A box given max-before-min would be built inside out (and flicker).
    const min = a.map((v, i) => Math.min(v, b[i]));
    const max = a.map((v, i) => Math.max(v, b[i]));
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

  /** A short bollard light (its cap glows at night). */
  bollard(x, z) {
    this.cyl('metal', x, z, 0, 0.9, 0.11, 10);
    return this.cyl('strip', x, z, 0.9, 1.04, 0.14, 10);
  }

  /** A plain concrete bench along X. */
  bench(x, z, len = 3) {
    return this.box('concrete', [x, 0, z], [x + len, 0.45, z + 0.7]);
  }

  /** A railing running along Z at x, on top of height y. */
  railingZ(key, z0, z1, x, y, h = 1.1, step = 1.5) {
    this.box(key, [x - 0.05, y + h - 0.05, z0], [x + 0.05, y + h + 0.05, z1]);
    this.box(key, [x - 0.03, y + 0.25, z0], [x + 0.03, y + 0.3, z1]);
    for (let z = z0; z <= z1 + 1e-3; z += step) this.box(key, [x - 0.03, y, z - 0.03], [x + 0.03, y + h, z + 0.03]);
    return this;
  }

  /** Vertical cylinder that tapers from r0 (bottom) to r1 (top). */
  taper(key, cx, cz, y0, y1, r0, r1, segments = 40) {
    const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, segments, 1, false);
    g.translate(cx, (y0 + y1) / 2, cz);
    return this.push(key, g);
  }

  /** Any geometry, moved to (x, y, z). */
  geo(key, geometry, x = 0, y = 0, z = 0) {
    geometry.translate(x, y, z);
    return this.push(key, geometry);
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
    for (const [key, list] of Object.entries(this.parts)) {
      // Merging needs all-indexed or all-non-indexed geometry (e.g. rocks are non-indexed).
      const mixed = list.some((g) => !g.index) && list.some((g) => g.index);
      const geos = mixed ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list;
      const merged = mergeGeometries(geos, false);
      new Set([...list, ...geos]).forEach((g) => g.dispose());
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
  // The side that faces the lamp: two ribbons behind a row of vertical fins.
  b.winX('glass', -11, 2.5, 13.0, 14.6, 4);
  b.winX('glassDark', -11, 2.5, 17.0, 18.6, 4);
  for (let z = -10.5; z <= 2.6; z += 1.45) b.box('white', [4, 12.2, z - 0.09], [4.75, 19.4, z + 0.09]);
  b.box('whiteShade', [-30.2, 21.5, -14.2], [4.2, 21.9, 4.8]);
  // An orange light tube down the front corner.
  b.box('orange', [3.15, 10.3, 4.6], [3.75, 21.1, 5.0]);
  // Roof: railing, stair hut and vent boxes, so the skyline isn't a flat line.
  b.railingX('metal', -29.5, 3.8, 4.4, 21.9, 1.0, 1.6);
  b.box('white', [-14, 21.9, -11], [-6, 25.2, -5]);
  b.winZ('glassDark', -13, -7, 22.6, 24.4, -5);
  b.box('whiteShade', [-14.2, 25.2, -11.2], [-5.8, 25.5, -4.8]);
  b.box('whiteShade', [-24, 21.9, -9], [-20, 23.0, -6]);
  b.box('whiteShade', [-3, 21.9, -9], [1.5, 22.8, -6]);

  // Glass bridge into the low wing, framed, with mullions.
  b.box('glass', [4, 9.7, -12], [7.5, 13.5, -6]);
  b.box('white', [4, 13.5, -12.2], [7.5, 14.0, -5.8]);
  b.box('white', [4, 9.3, -12.2], [7.5, 9.7, -5.8]);
  b.mullionsZ('metal', 4.4, 7.2, 9.7, 13.5, -5.95, 0.95, 0.05);

  // Low wing on the right: its roofline sits mid-frame, so the upper half of
  // the lamp's beam stands against open sky (as in the poster).
  // Ground floor: warm glazing under a lit canopy.
  b.box('white', [7.5, 0, -20], [32, 8.4, -5]);
  b.winZ('warm', 8.5, 31, 0.4, 3.6, -5);
  b.box('white', [8, 4.0, -5], [31.5, 4.4, -2.6]);
  b.box('strip', [8.5, 3.92, -4.8], [31, 4.0, -2.8]);
  for (let x = 10; x <= 30; x += 5) b.cyl('metal', x, -3.0, 0, 4.0, 0.09, 8);
  // Middle floor: ribbon window behind vertical fins.
  b.winZ('glass', 9, 31, 5.4, 7.6, -5);
  for (let x = 9; x <= 31.01; x += 1.6) b.box('white', [x - 0.12, 4.4, -5], [x + 0.12, 8.4, -4.2]);
  // Top floor set back behind a terrace, with a pergola.
  b.box('white', [7.5, 8.4, -20], [32, 8.8, -5]);
  b.box('white', [9, 8.8, -20], [32, 12.4, -8.5]);
  b.winZ('glassDark', 10, 31, 9.6, 11.4, -8.5);
  b.railingX('metal', 7.6, 31.9, -5.2, 8.8, 1.0, 1.4);
  b.box('whiteShade', [8.8, 12.4, -20.2], [32.2, 12.8, -8.3]);
  for (let x = 10; x <= 30.01; x += 2.5) b.box('white', [x - 0.1, 11.6, -8.5], [x + 0.1, 11.8, -5.4]);
  b.box('white', [9.6, 11.6, -5.6], [30.4, 11.8, -5.4]);

  // Slim stair tower closing the far right end, with horizontal fins.
  b.box('white', [32, 0, -16], [37, 25, -8]);
  b.winZ('glassDark', 33.8, 35.2, 3, 22, -8);
  for (let y = 5; y < 24; y += 2.6) b.box('white', [31.6, y, -8.6], [37.4, y + 0.18, -7.4]);

  // Street furniture along the plaza edge.
  for (let x = -24; x <= 30; x += 4.5) if (x < 2 || x > 16) b.bollard(x, 8);
  b.bench(-18, 9.5);
  b.bench(19, 9.5);
  return b.build();
}

/* ------------------------------------------------------------------------ */
/* 02 · DEBATE — "The Forum": two towers face each other; their sky bridges  */
/* stop two metres apart (the clash point); a grandstand and a round stage   */
/* with two lecterns sit in the gap between them.                            */
/* ------------------------------------------------------------------------ */
// The gap between the bridge arms: the split device in pages.js pivots here.
export const FORUM = { gap: [1, 23.05, -3] };

function debate(mats) {
  const b = new Builder(mats);

  /* --- Affirmative tower (left): tall, glass behind dense vertical fins --- */
  const A = { x0: -20, x1: -6, z0: -15, z1: -3, top: 38 };
  // Lobby: warm glazing under a deep slab with a light strip.
  b.box('warm', [A.x0 + 0.5, 0, A.z0 + 1], [A.x1 - 0.5, 4.6, A.z1 - 0.6]);
  b.box('white', [A.x0, 4.6, A.z0], [A.x1, 5.2, A.z1 + 1.6]);
  b.box('strip', [A.x0 + 0.4, 4.52, A.z1 - 0.4], [A.x1 - 0.4, 4.6, A.z1 + 1.4]);
  for (const x of [A.x0 + 1, A.x1 - 1]) b.box('white', [x - 0.3, 0, A.z1 - 0.3], [x + 0.3, 4.6, A.z1 + 0.3]);
  // Floors: glass with slim slab edges.
  const fhA = 3.6;
  for (let y = 5.2, i = 0; y < A.top - 3; y += fhA, i++) {
    // The top floors stay dark: the title is read against them, day and night.
    const dark = y > A.top - 14 || i % 4 === 2;
    b.box(dark ? 'glassDark' : 'glass', [A.x0 + 0.3, y, A.z0 + 0.3], [A.x1 - 0.3, y + fhA - 0.35, A.z1 - 0.3]);
    b.box('white', [A.x0, y + fhA - 0.35, A.z0], [A.x1, y + fhA, A.z1]);
  }
  // Vertical fins on the front and on the face looking at the other tower.
  for (let x = A.x0 + 0.6; x <= A.x1 - 0.5; x += 1.3) b.box('white', [x - 0.11, 5.2, A.z1 - 0.3], [x + 0.11, A.top - 2, A.z1 + 0.55]);
  for (let z = A.z0 + 0.8; z <= A.z1 - 0.5; z += 1.3) b.box('white', [A.x1 - 0.3, 5.2, z - 0.11], [A.x1 + 0.55, A.top - 2, z + 0.11]);
  // Crown with an orange slot.
  b.box('white', [A.x0, A.top - 2.6, A.z0], [A.x1, A.top, A.z1 + 0.6]);
  b.box('orange', [A.x0 + 1, A.top - 1.65, A.z1 + 0.6], [A.x1 - 1, A.top - 1.25, A.z1 + 0.7]);
  b.box('whiteShade', [-16, A.top, -12], [-10, A.top + 2.2, -7]);

  /* --- Negative tower (right): lower, horizontal bands, rounded corner --- */
  const B = { x0: 8, x1: 22, z0: -15, z1: -3, top: 28, r: 4 };
  const cx = B.x0 + B.r;
  const cz = B.z1 - B.r;
  // Footprint with its front corner (towards the gap) rounded, grown by e.
  const footprint = (key, y0, y1, e) => {
    b.box(key, [cx, y0, B.z0], [B.x1 + e, y1, B.z1 + e]);
    b.box(key, [B.x0 - e, y0, B.z0], [cx, y1, cz]);
    b.cyl(key, cx, cz, y0, y1, B.r + e, 40);
  };
  footprint('warm', 0, 4.4, -0.6);
  footprint('white', 4.4, 5.3, 0.6); // canopy
  b.box('strip', [cx, 4.32, B.z1 - 0.2], [B.x1, 4.4, B.z1 + 0.5]);
  const fhB = 3.3;
  for (let y = 5.3, i = 0; y < B.top - 1; y += fhB, i++) {
    footprint(i % 3 === 1 ? 'glass' : 'glassDark', y, y + fhB - 0.95, -0.25);
    footprint('white', y + fhB - 0.95, y + fhB, 0.35);
  }
  footprint('white', B.top - 1.2, B.top + 0.4, 0.35); // parapet
  b.box('whiteShade', [14, B.top + 0.4, -12], [19, B.top + 2.6, -7]);

  /* --- Sky bridges: two arms that stop 2 m short of each other --- */
  const [gx, gy, gz] = FORUM.gap;
  const y0 = gy - 1.55;
  const y1 = gy + 1.55;
  const armZ0 = gz - 6;
  const half = 1.2; // half the gap
  for (const [x0, x1] of [[A.x1 - 0.3, gx - half], [gx + half, cx]]) {
    b.box('white', [x0, y0, armZ0], [x1, y1, gz]);
    b.box('glass', [x0, y0 + 0.75, gz - 0.02], [x1, y1 - 0.45, gz + 0.04]);
    b.box('strip', [x0, y0 - 0.08, armZ0 + 0.4], [x1, y0, gz - 0.4]);
  }
  // Orange end plates on the two tips facing each other: the clash point.
  // (Proud of the arm ends and a hair over their edges: coplanar faces flicker.)
  b.box('orange', [gx - half - 0.1, y0 - 0.03, armZ0 - 0.03], [gx - half + 0.05, y1 + 0.03, gz + 0.05]);
  b.box('orange', [gx + half - 0.05, y0 - 0.03, armZ0 - 0.03], [gx + half + 0.1, y1 + 0.03, gz + 0.05]);

  /* --- Grandstand between the towers, rising away from the stage --- */
  // One block per step (overlapping full-depth blocks would share their side
  // faces, and the two alternating materials would flicker there).
  for (let i = 0; i < 7; i++) {
    const z = -2.4 - i * 1.15;
    const back = i === 6 ? -14.5 : z - 1.15;
    b.box(i % 2 ? 'whiteShade' : 'white', [A.x1 + 0.4, 0, back], [B.x0 - 0.4, 0.42 * (i + 1), z]);
  }
  b.railingX('metal', A.x1 + 0.4, B.x0 - 0.4, -14.4, 0.42 * 7, 1.0, 1.15);

  /* --- Round stage with two lecterns facing each other --- */
  const sx = gx;
  const sz = 5;
  b.cyl('white', sx, sz, 0, 0.7, 4.6, 64);
  b.cyl('whiteShade', sx, sz, 0, 0.1, 5.0, 64);
  b.box('orange', [sx - 0.07, 0.7, sz - 4.5], [sx + 0.07, 0.73, sz + 4.5]); // the line down the middle
  for (const [x, key, face] of [[sx - 2.6, 'white', 'orange'], [sx + 2.6, 'orange', 'white']]) {
    const dir = Math.sign(sx - x); // faces the other lectern
    b.box(key, [x - 0.35, 0.7, sz - 0.4], [x + 0.35, 2.0, sz + 0.4]);
    b.boxRot(key, [x + dir * 0.05, 2.08, sz], [0.85, 0.12, 0.9], [0, 0, dir * 0.35]);
    const fx = [x + dir * 0.35, x + dir * 0.4]; // min/max must be in order for box()
    b.box(face, [Math.min(...fx), 0.9, sz - 0.3], [Math.max(...fx), 1.75, sz + 0.3]);
  }

  /* --- Plaza edge --- */
  for (let x = -24; x <= 26; x += 4.6) if (Math.abs(x - sx) > 7) b.bollard(x, 13);
  b.bench(-18, 12.5);
  b.bench(16, 12.5);

  const group = b.build();

  // LED "speaking time" bars under the bridge glass: one side counts down,
  // then the other, like a debate timer.
  const bars = [];
  for (const [x0, x1] of [[A.x1 + 0.2, gx - half - 0.3], [B.x0 + 0.2, gx + half + 0.3]]) {
    const len = Math.abs(x1 - x0);
    const g = new THREE.BoxGeometry(1, 0.26, 0.1);
    g.translate(0.5, 0, 0);
    const bar = new THREE.Mesh(g, mats.orange);
    bar.position.set(x0, y0 + 0.42, gz + 0.06);
    bar.scale.x = len * Math.sign(x1 - x0);
    bar.userData.len = bar.scale.x;
    group.add(bar);
    bars.push(bar);
  }
  const turn = 9; // seconds per speech
  group.userData.animate = (t) => {
    const k = (t / turn) % 2;
    bars.forEach((bar, i) => {
      const mine = Math.floor(k) === i;
      const f = k % 1;
      // Counting down during its own turn; refilling quickly when it ends.
      const left = mine ? 1 - f : Math.min(1, f * 4);
      bar.scale.x = bar.userData.len * Math.max(0.001, left);
    });
  };
  return group;
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
  b.box('white', [13, 0, -18], [34, 11, -6]);
  b.winZ('glass', 14, 33, 6.5, 8, -6);
  b.winZ('warm', 15, 32, 0.4, 3.4, -6);
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

  // Low arcade on the left, under the lamp's beam.
  b.box('white', [-44, 6.6, -16], [-14, 8.2, -1.5]);
  b.box('strip', [-43.5, 6.52, -15.5], [-14.5, 6.6, -2]);
  b.box('warm', [-43, 0, -15], [-15, 6.6, -14.4]);
  for (let x = -42.5; x <= -16; x += 3.3) b.cyl('white', x, -2.6, 0, 6.6, 0.32, 14);

  // Tall block behind.
  b.box('white', [2, 0, -40], [21, 36, -22]);
  for (let y = 22; y < 34; y += 3.4) b.winX(y % 2 ? 'glass' : 'glassDark', -38, -24, y, y + 1.3, 21);
  b.box('orange', [21, 6, -27], [21.5, 33, -25]);
  b.box('whiteShade', [1.8, 36, -40.2], [21.2, 36.4, -21.8]);
  return b.build();
}

/* ------------------------------------------------------------------------ */
/* 05 · ABOUT — a lighthouse at the end of a pier, and a study by the sea    */
/* ------------------------------------------------------------------------ */
// Lantern centre: the beacon device in pages.js sweeps its beam from here.
export const LIGHTHOUSE = { x: -21, z: -66, lantern: 29.6 };

function about(mats) {
  const b = new Builder(mats);
  const Q = -24; // quay line; the sea starts here (see sea.js)

  // Quay wall and railing along the shore.
  b.box('white', [-120, 0, Q - 0.6], [120, 0.9, Q + 0.4]);
  b.railingX('metal', -120, 120, Q - 0.1, 0.9, 1.0, 2.2);
  for (let x = -40; x <= 40; x += 6) if (x < -27 || x > -15) b.bollard(x, Q + 2.2);
  b.bench(-6, Q + 3);
  b.bench(36, Q + 3);

  // Pier out to the lighthouse.
  const { x: LX, z: LZ } = LIGHTHOUSE;
  b.box('white', [LX - 3.5, 0, LZ + 6], [LX + 3.5, 1.0, Q - 0.6]);
  b.railingZ('metal', LZ + 6, Q - 0.6, LX - 3.3, 1.0, 1.0, 2.0);
  b.railingZ('metal', LZ + 6, Q - 0.6, LX + 3.3, 1.0, 1.0, 2.0);
  for (let z = Q - 4; z > LZ + 6; z -= 5) for (const x of [LX - 3.2, LX + 3.2]) b.box('concrete', [x - 0.3, -2, z - 0.3], [x + 0.3, 0.05, z + 0.3]);
  for (let z = Q - 6; z > LZ + 8; z -= 9) b.bollard(LX + 2.6, z);

  // Rock island with a round platform.
  b.cyl('concrete', LX, LZ, 0, 1.6, 12, 48);
  b.railingX('metal', LX - 11, LX - 6, LZ + 11.6, 1.6, 1.0, 1.25);
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * Math.PI * 2 + (i % 3) * 0.2;
    const r = 12 + (i % 4) * 1.1;
    const g = new THREE.DodecahedronGeometry(1.4 + (i % 3) * 0.6, 0);
    g.rotateY(i * 1.7);
    b.geo('concrete', g, LX + Math.cos(ang) * r, 0.5, LZ + Math.sin(ang) * r);
  }

  // Tower: tapered, white with two orange bands and a few small windows.
  const y0 = 1.6;
  const y1 = 27.6;
  const radiusAt = (y) => 3.1 - ((y - y0) / (y1 - y0)) * 0.9;
  b.taper('white', LX, LZ, y0, y1, 3.1, 2.2);
  for (const [a0, a1] of [[9, 11.5], [18, 20.5]]) b.taper('orange', LX, LZ, a0, a1, radiusAt(a0) + 0.06, radiusAt(a1) + 0.06);
  for (const y of [5.5, 14.5, 23]) {
    const r = radiusAt(y);
    b.box('glassDark', [LX - 0.45, y, LZ + r - 0.25], [LX + 0.45, y + 1.3, LZ + r + 0.08]);
  }
  // Gallery with railing.
  b.cyl('white', LX, LZ, y1, y1 + 0.5, 3.7, 40);
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * Math.PI * 2;
    b.box('metal', [LX + Math.cos(ang) * 3.5 - 0.04, y1 + 0.5, LZ + Math.sin(ang) * 3.5 - 0.04], [LX + Math.cos(ang) * 3.5 + 0.04, y1 + 1.5, LZ + Math.sin(ang) * 3.5 + 0.04]);
  }
  const ring = new THREE.TorusGeometry(3.5, 0.06, 6, 48);
  ring.rotateX(Math.PI / 2);
  b.geo('metal', ring, LX, y1 + 1.5, LZ);
  // Lantern room (glows at night), mullions, orange cap and finial.
  b.cyl('glass', LX, LZ, y1 + 0.5, y1 + 3.6, 1.9, 24);
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    b.box('white', [LX + Math.cos(ang) * 1.92 - 0.07, y1 + 0.5, LZ + Math.sin(ang) * 1.92 - 0.07], [LX + Math.cos(ang) * 1.92 + 0.07, y1 + 3.6, LZ + Math.sin(ang) * 1.92 + 0.07]);
  }
  b.cyl('white', LX, LZ, y1 + 3.6, y1 + 3.85, 2.4, 32);
  const cap = new THREE.ConeGeometry(2.3, 2.1, 32);
  b.geo('orange', cap, LX, y1 + 3.85 + 1.05, LZ);
  b.cyl('metal', LX, LZ, y1 + 5.9, y1 + 7.4, 0.07, 6);
  b.geo('metal', new THREE.SphereGeometry(0.22, 12, 8), LX, y1 + 7.4, LZ);
  // The keeper's study on the island: a white box with a big warm-lit glass
  // front, and a small observatory dome on its roof.
  const sx0 = LX - 12.5;
  const sx1 = LX - 3.6;
  const sz0 = LZ - 6;
  const sz1 = LZ + 5;
  b.box('white', [sx0, y0, sz0], [sx1, y0 + 5.2, sz0 + 1]);
  b.box('white', [sx0, y0, sz0], [sx0 + 0.8, y0 + 5.2, sz1]);
  b.box('white', [sx0 - 0.4, y0 + 5.2, sz0 - 0.4], [sx1 + 1.2, y0 + 5.9, sz1 + 1.4]);
  b.box('strip', [sx0, y0 + 5.12, sz0 + 1], [sx1 + 1, y0 + 5.2, sz1 + 1.2]);
  b.box('warm', [sx0 + 0.8, y0, sz0 + 1], [sx1, y0 + 5.2, sz0 + 1.4]);
  b.mullionsZ('metal', sx0 + 1, sx1, y0, y0 + 5.2, sz1, 1.6);
  b.box('metal', [sx0 + 0.8, y0 + 3.9, sz1 - 0.08], [sx1, y0 + 4.02, sz1 + 0.08]);
  b.box('orange', [sx1 - 0.2, y0, sz1 - 2], [sx1 + 0.2, y0 + 5.2, sz1]);
  const dx = (sx0 + sx1) / 2 - 1;
  const dz = (sz0 + sz1) / 2 - 1.5;
  b.cyl('white', dx, dz, y0 + 5.9, y0 + 6.8, 2.9, 32);
  const dome = new THREE.SphereGeometry(2.7, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  b.geo('white', dome, dx, y0 + 6.8, dz);
  b.boxRot('glassDark', [dx, y0 + 8.2, dz], [0.6, 3.0, 5.6], [0.4, 0.5, 0]);

  const group = b.build();

  // Two small sailboats out at sea, gently bobbing.
  const boats = [];
  for (const [x, z, s] of [[70, -230, 1], [-110, -330, 0.8]]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2), mats.white);
    hull.position.y = 0.6;
    const sail = new THREE.Mesh(new THREE.ConeGeometry(2.2, 8, 3), mats.white);
    sail.scale.z = 0.12;
    sail.position.y = 5.3;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 6), mats.metal);
    mast.position.y = 5.2;
    boat.add(hull, sail, mast);
    boat.position.set(x, 0, z);
    boat.scale.setScalar(s);
    boat.rotation.y = 0.6;
    group.add(boat);
    boats.push(boat);
  }
  group.userData.animate = (t) => {
    boats.forEach((boat, i) => {
      boat.position.y = Math.sin(t * 0.8 + i * 2) * 0.25;
      boat.rotation.z = Math.sin(t * 0.6 + i) * 0.05;
    });
  };
  return group;
}

export const BUILDERS = { home, debate, puzzle, games, about };
