import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createTree } from './props.js';

const THIN = new Set(['pane', 'paneLit', 'frosted', 'blind', 'beacon', 'gold', 'bone']);

/** A small seeded random generator (mulberry32): the same building on every visit. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Collects primitive geometries per material key and merges them into a
 * handful of meshes, so each building costs only a few draw calls.
 * All coordinates are in the building's local frame: the facade facing the
 * plaza is the +Z side, ground is y = 0.
 */
export class Builder {
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

  /** A flat ring lying at height y round (cx, cz). */
  ring(key, cx, cz, y, r0, r1, segments = 64) {
    const g = new THREE.RingGeometry(r0, r1, segments);
    g.rotateX(-Math.PI / 2);
    return this.geo(key, g, cx, y, cz);
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
      // (thin pieces laid on a face, like lit panes and blinds, would only
      // speckle the face behind them with their shadow)
      mesh.castShadow = !lightish && !THIN.has(key);
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
  // (dark glass: the light-box sign runs across it, and a lit window
  // behind the letters at night made them hard to read)
  b.winZ('glassDark', -21, -5, 6.2, 7.9, -1.0);
  b.winZ('glassDark', -2, 4, 6.2, 7.9, -1.0);

  // Shadow gap under the cantilever.
  b.box('glassDark', [-26, 9.0, -12], [6, 9.7, -3]);

  // Upper cantilever volume.
  b.box('white', [-30, 9.7, -14], [4, 21.5, 4.6]);
  b.box('strip', [-29, 9.58, 0.6], [3, 9.7, 4.2]);
  // (no ribbon window behind the title any more: the left of the picture read heavy)
  b.winZ('glassDark', -28, -17, 17.0, 18.6, 4.6);
  // The side that faces the lamp: two ribbons behind a row of vertical fins.
  b.winX('glass', -11, 2.5, 13.0, 14.6, 4);
  b.winX('glassDark', -11, 2.5, 17.0, 18.6, 4);
  for (let z = -10.5; z <= 2.6; z += 1.45) b.box('white', [4, 12.2, z - 0.09], [4.75, 19.4, z + 0.09]);
  b.box('whiteShade', [-30.2, 21.5, -14.2], [4.2, 21.9, 4.8]);
  // An orange light tube down the front corner.
  b.box('tube', [3.15, 10.3, 4.6], [3.75, 21.1, 5.0]);
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
// The two towers' sky gardens, at about the same height across the gap
// (floor and ceiling; see debate() and the planting in details.js). The right
// tower's floors: five glazed ones, gH tall, with 0.95 m bands between.
const B_GH = (FORUM.gap[1] - 1.55 - 0.08 - 0.06 - 5.3 - 4 * 0.95) / 5;
export const GARDENS = {
  a: { y0: 12.4, y1: 19.25, depth: 4.2, x1: -15.2 }, // two of the left tower's floors (3.6 m), opened up at its left corner, to the wide pier
  b: { y0: 5.3 + 2 * (B_GH + 0.95), y1: 5.3 + 2 * (B_GH + 0.95) + 2 * B_GH + 0.95, back: 3.2 }, // its 3rd and 4th
};

// The helipad on the affirmative tower's roof: 攻错's card flies the camera up
// here before it leaves for debatestone.com (its `spot` in pages.js). From
// the plaza it stays out of sight behind the crown. The roof round it is a
// working one, drawn finely for the view from above (paving, a stair hut,
// a safety net, floodlights, a windsock); only the pad itself is in that
// site's colours: the black touchstone, a gold ring and dial, a bone H.
export const HELIPAD = { x: -11.5, z: -10.3, y: 39.25, r: 4 };

/** Signed difference between two angles, in -π..π. */
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** HELIPAD and the roof round it, on tower A (A: the tower's box, see debate()). */
function helipad(b, A) {
  const { x: cx, z: cz, y, r } = HELIPAD;
  const roof = A.top;
  const at = (a, d) => [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
  const STEPS = Math.PI; // the steps come up on the left (-x)
  // Paving joints across the roof, a hair proud of it.
  for (let x = A.x0 + 1.4; x < A.x1 - 0.5; x += 1.4) b.box('whiteShade', [x - 0.025, roof, A.z0 + 0.25], [x + 0.025, roof + 0.012, A.z1 + 0.35]);
  for (let z = A.z0 + 1.4; z < A.z1 + 0.3; z += 1.4) b.box('whiteShade', [A.x0 + 0.25, roof, z - 0.025], [A.x1 - 0.25, roof + 0.012, z + 0.025]);

  // The deck on short legs over a low plant room: a white slab with the
  // black stone laid on it.
  b.box('whiteShade', [cx - 2.4, roof, cz - 2.2], [cx + 2.4, y - 0.4, cz + 2.2]);
  for (let k = 0; k < 8; k++) {
    const [lx, lz] = at(((k + 0.5) / 8) * Math.PI * 2, r - 0.7);
    b.box('metal', [lx - 0.11, roof, lz - 0.11], [lx + 0.11, y - 0.38, lz + 0.11]);
  }
  b.cyl('white', cx, cz, y - 0.4, y - 0.04, r, 64);
  b.cyl('stone', cx, cz, y - 0.12, y, r - 0.2, 64);
  // Its markings, in gold and bone: the touchdown ring, a dial of ticks
  // round it (every fifth a long one), a fine rim, and the H (upright as
  // seen from the plaza side, where the camera comes up).
  b.ring('gold', cx, cz, y + 0.012, 2.5, 2.84);
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * Math.PI * 2;
    const long = k % 5 === 0;
    const [d0, d1] = [3.0, long ? 3.38 : 3.2];
    const [mx, mz] = at(a, (d0 + d1) / 2);
    b.boxRot('gold', [mx, y + 0.006, mz], [d1 - d0, 0.012, long ? 0.075 : 0.04], [0, -a, 0]);
  }
  b.ring('gold', cx, cz, y + 0.012, r - 0.42, r - 0.36);
  const [hw, hh, t] = [0.7, 1.08, 0.17];
  for (const s of [-1, 1]) b.box('bone', [cx + s * hw - t, y, cz - hh], [cx + s * hw + t, y + 0.01, cz + hh]);
  b.box('bone', [cx - hw + t, y, cz - t], [cx + hw - t, y + 0.01, cz + t]);
  // Rim lights (lit at night).
  for (let k = 0; k < 16; k++) {
    const [lx, lz] = at((k / 16) * Math.PI * 2, r - 0.1);
    b.cyl('padLight', lx, lz, y - 0.04, y + 0.07, 0.065, 8);
  }
  // A safety net round the deck, a little below its top: thin ribs sloping
  // out and up, an outer rim and two fine rings between; open at the steps.
  const [n0, n1, ny0, ny1] = [r, r + 0.72, y - 0.32, y - 0.14];
  const gap = 0.2; // (rad, either side of the steps)
  const slope = Math.atan2(ny1 - ny0, n1 - n0);
  for (let k = 0; k < 56; k++) {
    const a = (k / 56) * Math.PI * 2;
    if (Math.abs(angDiff(a, STEPS)) < gap) continue;
    const [mx, mz] = at(a, (n0 + n1) / 2);
    b.boxRot('metal', [mx, (ny0 + ny1) / 2, mz], [n1 - n0, 0.03, 0.03], [0, -a, slope]);
  }
  const rim = (d, h, tube) => {
    const g = new THREE.TorusGeometry(d, tube, 5, 96, Math.PI * 2 - gap * 2);
    g.rotateX(Math.PI / 2);
    g.rotateY(-(STEPS + gap));
    b.geo('metal', g, cx, h, cz);
  };
  rim(n1, ny1, 0.04);
  for (const f of [0.36, 0.68]) rim(n0 + (n1 - n0) * f, ny0 + (ny1 - ny0) * f, 0.014);
  // Four steps up from the roof on the left, a handrail either side.
  const sx = cx - r;
  for (let k = 1; k <= 4; k++) b.box('white', [sx - 0.3 * k - 0.02, roof, cz - 0.55], [sx - 0.3 * (k - 1) + 0.05, y - 0.25 * k, cz + 0.55]);
  const [rx0, ry0, rx1, ry1] = [sx - 1.22, roof + 1.15, sx + 0.05, y + 0.9];
  for (const s of [-1, 1]) {
    const z = cz + s * 0.6;
    for (const [px, py] of [[rx0, roof], [rx1, y - 0.04]]) b.box('metal', [px - 0.03, py, z - 0.03], [px + 0.03, py + 0.95, z + 0.03]);
    const len = Math.hypot(rx1 - rx0, ry1 - ry0);
    b.boxRot('metal', [(rx0 + rx1) / 2, (ry0 + ry1) / 2, z], [len, 0.05, 0.05], [0, 0, Math.atan2(ry1 - ry0, rx1 - rx0)]);
  }
  // The stair hut in the back left corner, its door towards the steps, a
  // light over it; a fire-hose cabinet beside it, stepping stones between.
  const [hx0, hx1, hz0, hz1, hh2] = [-19.7, -17.2, -14.7, -12.2, 2.7];
  b.box('white', [hx0, roof, hz0], [hx1, roof + hh2, hz1]);
  b.box('whiteShade', [hx0 - 0.15, roof + hh2, hz0 - 0.15], [hx1 + 0.15, roof + hh2 + 0.22, hz1 + 0.15]);
  b.box('glassDark', [-18.85, roof, hz1 - 0.02], [-18.05, roof + 2.1, hz1 + 0.04]);
  b.box('metal', [-18.2, roof + 1.0, hz1 + 0.04], [-18.13, roof + 1.12, hz1 + 0.1]);
  b.box('strip', [-19.0, roof + 2.25, hz1], [-17.9, roof + 2.32, hz1 + 0.14]);
  b.box('metal', [-19.25, roof + hh2 + 0.22, -14.2], [-18.65, roof + hh2 + 0.62, -13.6]);
  b.box('orange', [-17.1, roof, -12.0], [-16.55, roof + 0.95, -11.74]);
  for (const [px, pz] of [[-18.45, -11.72], [-18.0, -11.02], [-17.35, -10.4]]) b.box('concrete', [px - 0.34, roof, pz - 0.24], [px + 0.34, roof + 0.035, pz + 0.24]);
  // Two floodlights on posts, aimed at the pad.
  for (const [fx, fz] of [[-16.1, -14.5], [-6.95, -6.1]]) {
    b.cyl('metal', fx, fz, roof, roof + 1.5, 0.05, 8);
    const a = Math.atan2(cz - fz, cx - fx);
    const [ux, uz] = [Math.cos(a), Math.sin(a)];
    b.boxRot('metal', [fx + ux * 0.1, roof + 1.58, fz + uz * 0.1], [0.3, 0.22, 0.36], [0, -a, -0.35]);
    b.boxRot('padLight', [fx + ux * 0.26, roof + 1.53, fz + uz * 0.26], [0.03, 0.17, 0.28], [0, -a, -0.35]);
  }
  // A windsock in the back right corner: accent and white bands, tapering
  // downwind (towards the front left) and drooping a little.
  const [wx, wz, wy] = [-7.3, -13.9, roof + 4.2];
  b.cyl('metal', wx, wz, roof, wy + 0.1, 0.06, 8);
  const dir = new THREE.Vector3(-0.62, -0.3, 0.72).normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const rad = (s) => 0.3 - s * 0.085;
  for (let k = 0; k < 4; k++) {
    const g = new THREE.CylinderGeometry(rad(k + 1), rad(k), 0.46, 12);
    g.applyQuaternion(turn);
    const mid = dir.clone().multiplyScalar(0.12 + (k + 0.5) * 0.46);
    b.geo(k % 2 ? 'white' : 'orange', g, wx + mid.x, wy + mid.y, wz + mid.z);
  }
}

function debate(mats) {
  // ('pane': a window lit at night only, laid on the glass, see THIN)
  const b = new Builder({ ...mats, pane: mats.paneNight });
  const R = seeded(20261122);

  /* --- Affirmative tower (left): tall, glass behind dense vertical fins --- */
  const A = { x0: -20, x1: -6, z0: -15, z1: -3, top: 38 };
  // Lobby: a glass front (mullions, a transom, double doors) before a warm
  // interior set back behind it, under a deep slab with a light strip.
  const zg = A.z1 - 0.6; // the glazing line
  b.box('warm', [A.x0 + 0.4, 0, A.z0 + 1], [A.x1 - 0.4, 4.6, zg - 1.3]);
  for (const [x0, x1] of [[A.x0, A.x0 + 0.6], [A.x1 - 0.6, A.x1]]) b.box('white', [x0, 0, A.z0 + 1], [x1, 4.6, zg + 0.1]);
  b.mullionsZ('metal', A.x0 + 0.6, A.x1 - 0.6, 0, 4.6, zg, 1.6, 0.06);
  b.box('metal', [A.x0 + 0.6, 2.75, zg - 0.06], [A.x1 - 0.6, 2.85, zg + 0.06]);
  // (under CAVE CANEM: darker than the lit lobby, with push bars)
  b.box('glassDark', [-14.6, 0, zg - 0.03], [-11.4, 2.75, zg + 0.03]);
  for (const x of [-13.25, -12.75]) b.box('metal', [x - 0.03, 0.95, zg + 0.03], [x + 0.03, 1.75, zg + 0.1]);
  b.box('white', [A.x0, 4.6, A.z0], [A.x1, 5.2, A.z1 + 1.6]);
  b.box('strip', [A.x0 + 0.4, 4.52, A.z1 - 0.4], [A.x1 - 0.4, 4.6, A.z1 + 1.4]);
  for (const x of [A.x0 + 1, A.x1 - 1]) b.box('white', [x - 0.3, 0, A.z1 - 0.3], [x + 0.3, 4.6, A.z1 + 0.3]);
  // The front: white piers and full-height glass slots of varied widths,
  // like a barcode (one pattern of fins, floor after floor, read as a dense
  // dark grid); the side looking at the other tower is plain glass.
  const fhA = 3.6;
  const zL = A.z1 - 1.45; // the sky bridge arm's front (see below)
  // A sky garden two floors high at the left corner, as far as the wide pier
  // (GARDENS.a; right across the front it was too big a hole): there the
  // glass and the slab between stand back by `depth`, the piers within it
  // break off, a white wall closes its right side, and a light strip runs
  // under its ceiling. (Planting: details.js; trees: below.)
  const G = GARDENS.a;
  const zr = A.z1 - G.depth; // the garden's back wall
  const gardX = G.x1; // its right side
  const [s0, s1] = [5.2, A.top - 2.6]; // the shaft: from the lobby's slab to the crown
  const front = A.z1 - 0.45; // the glass, in the slots
  const slabFront = front + 0.15; // (the floor edges show as lines in the slots)
  const bays = []; // the slots [x0, x1]: lit windows go in them
  const backMullions = []; // where the garden's back wall gets mullions
  // Piers and slots, alternately, from the left (14 m in all).
  const piers = [0.8, 0.5, 0.5, 1.4, 0.5, 0.5, 0.8, 1.2];
  const slots = [0.6, 1.8, 0.6, 0.6, 2.4, 0.6, 1.2];
  let px = A.x0;
  piers.forEach((pw, k) => {
    const corner = k === 0 || k === piers.length - 1;
    // (the corner piers 2 cm in: flush, their faces would share a plane with the slabs' and flicker)
    const [p0, p1] = [k === 0 ? px + 0.02 : px, corner && k > 0 ? px + pw - 0.02 : px + pw];
    const inside = !corner && px + pw <= gardX; // (a pier within the garden breaks off there)
    for (const [y0, y1] of inside ? [[s0, G.y0], [G.y1, s1]] : [[s0, s1]]) b.box('white', [p0, y0, front], [p1, y1, A.z1]);
    if (inside) backMullions.push(px + pw / 2);
    px += pw;
    if (k < slots.length) {
      bays.push([px, px + slots[k]]);
      px += slots[k];
    }
  });
  // Floors: glass with slab edges; some windows lit at night, a few with a blind down.
  for (let y = 5.2; y < A.top - 3; y += fhA) {
    const yt = y + fhA - 0.35;
    const inGarden = y >= G.y0 && yt <= G.y1 + 0.01;
    // (in the garden's floors: its part stands back, the rest as on any floor)
    const parts = inGarden ? [[A.x0 + 0.3, gardX, zr, zr + 0.3], [gardX, A.x1 - 0.3, front, slabFront]] : [[A.x0 + 0.3, A.x1 - 0.3, front, slabFront]];
    for (const [x0, x1, gf, sf] of parts) {
      b.box('glassDark', [x0, y, A.z0 + 0.3], [x1, yt, gf]);
      // (the slab between the garden's two floors stands back with the glass)
      b.box('white', [x0 === A.x0 + 0.3 ? A.x0 : x0, yt, A.z0], [x1 === A.x1 - 0.3 ? A.x1 : x1, y + fhA, inGarden && yt < G.y1 ? sf : slabFront]);
    }
    if (inGarden) for (const x of backMullions) b.box('white', [x - 0.05, y, zr], [x + 0.05, yt, zr + 0.1]); // (mullions on the back wall)
    // The top floors stay dark: the title is read against them, day and night.
    if (y > A.top - 14) continue;
    for (const [x0, x1] of bays) {
      if (R() > 0.48) continue;
      // (1e-6: the slots' ends add up in floating point, and the last slot
      // before the wide pier ends a hair past gardX; its window hung at the front)
      const back = inGarden && x1 <= gardX + 1e-6;
      const gf = back ? zr : front;
      const a0 = Math.max(A.x0 + 0.3, x0 + (back ? 0.06 : 0));
      const a1 = Math.min(A.x1 - 0.3, x1 - (back ? 0.06 : 0));
      b.box('pane', [a0, y + 0.05, gf], [a1, yt - 0.05, gf + 0.03]);
      if (R() < 0.15) b.box('blind', [a0 + 0.04, yt - 0.06 - (0.5 + R() * 1.2), gf + 0.03], [a1 - 0.04, yt - 0.06, gf + 0.05]);
    }
  }
  // (its right side: a white wall from the back to the wide pier's face, a hair proud of the glass there)
  b.box('white', [gardX - 0.02, G.y0, zr], [gardX + 0.5, G.y1, front]);
  b.box('strip', [A.x0 + 0.85, G.y1 - 0.08, A.z1 - 1.5], [gardX - 0.05, G.y1, A.z1 - 0.8]); // (a slim cove line: the whole ceiling lit read as a slab)
  b.railingX('metal', A.x0 + 0.85, gardX - 0.05, A.z1 - 0.38, G.y0, 1.0, 1.4);
  // (and along its open left side, from the back glass to the corner pier)
  b.railingZ('metal', zr + 0.2, front, A.x0 + 0.4, G.y0, 1.0, 1.4);
  // Crown with an orange slot.
  b.box('white', [A.x0, A.top - 2.6, A.z0], [A.x1, A.top, A.z1 + 0.6]);
  b.box('orange', [A.x0 + 1, A.top - 1.65, A.z1 + 0.6], [A.x1 - 1, A.top - 1.25, A.z1 + 0.7]);
  // Roof: a railing round the front corner, a water tank on legs, plant
  // boxes, and a mast with a red warning light (blinks at night). (Seen from
  // the plaza, steeply up: only what stands near the front edge shows over
  // it; on the left, clear of the title.)
  b.railingX('metal', A.x0 + 0.4, A.x1 - 0.4, A.z1 + 0.1, A.top, 1.0, 1.5);
  b.railingZ('metal', A.z0 + 0.4, A.z1 + 0.1, A.x1 - 0.4, A.top, 1.0, 1.5);
  const [tx, tz, legs] = [-15.6, -5.8, 2.2];
  for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) b.box('metal', [tx + dx - 0.07, A.top, tz + dz - 0.07], [tx + dx + 0.07, A.top + legs, tz + dz + 0.07]);
  b.box('metal', [tx - 1.05, A.top + legs - 0.05, tz - 1.05], [tx + 1.05, A.top + legs + 0.05, tz + 1.05]);
  b.cyl('whiteShade', tx, tz, A.top + legs + 0.05, A.top + legs + 2.3, 1.0, 20);
  b.taper('whiteShade', tx, tz, A.top + legs + 2.3, A.top + legs + 2.8, 1.0, 0.12, 20);
  for (const x of [-11.4, -9.8]) b.box('concrete', [x - 0.6, A.top, -5.4], [x + 0.6, A.top + 0.9, -4.4]);
  const [mx, mz] = [-18.9, -3.9];
  b.cyl('metal', mx, mz, A.top, A.top + 9, 0.09, 8);
  b.box('metal', [mx - 0.7, A.top + 6.2, mz - 0.03], [mx + 0.7, A.top + 6.27, mz + 0.03]);
  b.box('metal', [mx - 0.45, A.top + 7.6, mz - 0.03], [mx + 0.45, A.top + 7.67, mz + 0.03]);
  b.cyl('beacon', mx, mz, A.top + 9, A.top + 9.35, 0.17, 10);
  helipad(b, A);

  /* --- Negative tower (right): lower, horizontal bands, rounded corner --- */
  // (Its front stands 2 m proud of the bridge arms, so the right arm runs
  // into the round corner from the side instead of jutting out in front of it.)
  const B = { x0: 8, x1: 22, z0: -15, z1: -1, top: 28, r: 4 };
  const cx = B.x0 + B.r;
  const cz = B.z1 - B.r;
  // Footprint with its front corner (towards the gap) rounded, grown by e.
  const footprint = (key, y0, y1, e) => {
    b.box(key, [cx, y0, B.z0], [B.x1 + e, y1, B.z1 + e]);
    b.box(key, [B.x0 - e, y0, B.z0], [cx, y1, cz]);
    b.cyl(key, cx, cz, y0, y1, B.r + e, 40);
  };
  // The footprint's outline towards the gap and the plaza, grown by e: up the
  // left face from the back, round the corner, along the front. at(s): the
  // point s metres along it, the way it runs (dx, dz) and which part it's on.
  const outline = (e) => {
    const rad = B.r + e;
    const L1 = cz - (B.z0 + 0.6);
    const L2 = (rad * Math.PI) / 2;
    const L3 = B.x1 + e - 0.6 - cx;
    const at = (s) => {
      if (s <= L1) return { x: B.x0 - e, z: B.z0 + 0.6 + s, dx: 0, dz: 1, part: 0 };
      if (s <= L1 + L2) {
        const t = -Math.PI / 2 + (s - L1) / rad;
        return { x: cx + rad * Math.sin(t), z: cz + rad * Math.cos(t), dx: Math.cos(t), dz: -Math.sin(t), part: 1, t };
      }
      return { x: cx + (s - L1 - L2), z: B.z1 + e, dx: 1, dz: 0, part: 2 };
    };
    // n points spaced evenly along it, each moved out by `out` (the outward normal is (-dz, dx))
    const points = (n, out = 0) =>
      Array.from({ length: n + 1 }, (_, k) => {
        const p = at((k * (L1 + L2 + L3)) / n);
        return { ...p, x: p.x - p.dz * out, z: p.z + p.dx * out };
      });
    return { L: L1 + L2 + L3, at, points, rad };
  };
  // A thin panel laid on the outline's face between two of its points (both
  // on one part), `off` proud of it.
  const lay = (key, o, p, q, y0, y1, off) => {
    if (p.part === 0) b.box(key, [p.x - off, y0, p.z], [p.x, y1, q.z]);
    else if (p.part === 2) b.box(key, [p.x, y0, p.z], [q.x, y1, p.z + off]);
    else {
      const rr = o.rad + off;
      b.geo(key, new THREE.CylinderGeometry(rr, rr, y1 - y0, 8, 1, true, p.t, q.t - p.t), cx, (y0 + y1) / 2, cz);
    }
  };
  // Lobby: glazing round the corner (mullions, a transom, double doors on
  // the front) before a warm interior set back behind it.
  footprint('warm', 0, 4.4, -1.9);
  const shop = outline(-0.6);
  const sp = shop.points(Math.round(shop.L / 1.6));
  for (const p of sp) b.box('metal', [p.x - 0.06, 0, p.z - 0.06], [p.x + 0.06, 4.4, p.z + 0.06]);
  sp.slice(1).forEach((p, k) => {
    const q = sp[k];
    b.boxRot('metal', [(p.x + q.x) / 2, 2.8, (p.z + q.z) / 2], [Math.hypot(p.x - q.x, p.z - q.z), 0.1, 0.12], [0, Math.atan2(-(p.z - q.z), p.x - q.x), 0]);
  });
  const fr = sp.map((p, k) => k).filter((k) => sp[k].part === 2 && sp[k - 1]?.part === 2 && sp[k + 1]?.part === 2);
  const dm = fr[Math.floor(fr.length / 2)];
  b.box('glassDark', [sp[dm - 1].x, 0, B.z1 - 0.63], [sp[dm + 1].x, 2.75, B.z1 - 0.57]);
  for (const x of [sp[dm].x - 0.25, sp[dm].x + 0.25]) b.box('metal', [x - 0.03, 0.95, B.z1 - 0.57], [x + 0.03, 1.75, B.z1 - 0.5]);
  b.box('white', [B.x0 + 0.5, 0, B.z0], [B.x0 + 2.0, 4.4, B.z0 + 0.6]); // (the recess closed at its ends)
  b.box('white', [sp[sp.length - 1].x + 0.06, 0, B.z1 - 2.0], [B.x1 - 0.5, 4.4, B.z1 - 0.5]);
  footprint('white', 4.4, 5.3, 0.6); // canopy
  b.box('strip', [cx, 4.32, B.z1 - 0.2], [B.x1, 4.4, B.z1 + 0.5]);
  // Window frames on the glazing, some windows lit, some with blinds down.
  const glassLine = outline(-0.25);
  const nW = Math.round(glassLine.L / 2.4); // (wide windows: finer, the frames read busy)
  const frames = glassLine.points(nW, 0.08);
  const edges = glassLine.points(nW);
  const windows = (y0, y1, lit) => {
    for (const p of frames) b.box('white', [p.x - 0.06, y0, p.z - 0.06], [p.x + 0.06, y1, p.z + 0.06]);
    if (!lit) return;
    for (let k = 0; k < nW; k++) {
      if (R() > 0.45) continue;
      const drop = R() < 0.15 ? y1 - 0.06 - (0.4 + R() * 1.2) : null;
      // (pulled in clear of the frames; a window across two parts is left dark)
      const p = glassLine.at(((k + 0.06) * glassLine.L) / nW);
      const q = glassLine.at(((k + 0.94) * glassLine.L) / nW);
      if (p.part !== q.part || edges[k].part !== edges[k + 1].part) continue;
      lay('pane', glassLine, p, q, y0 + 0.05, y1 - 0.05, 0.03);
      if (drop) lay('blind', glassLine, p, q, drop, y1 - 0.06, 0.05);
    }
  };
  // Floors: glazing set back behind proud white bands, and at the sky
  // bridge's height a "bridge storey" flush with the bands that carries the
  // bridge's window ribbon round the tower, so the bridge arm runs into one
  // smooth surface. (Over set-back glass and proud bands at once, its end
  // looked notched.) Its underside sits a little below the arm's light strip,
  // so the strip runs into its side: level with it, the two faces flickered.
  const by0 = FORUM.gap[1] - 1.55 - 0.08 - 0.06;
  const by1 = FORUM.gap[1] + 1.55;
  const gH = (by0 - 5.3 - 4 * 0.95) / 5; // five glazed floors and four bands below it
  // The 3rd and 4th floors (GARDENS.b) are a garden loggia round the corner:
  // their glass and the band between stand far back (lit all through at
  // night), slim columns at the edge, a railing round it, a light strip under
  // its ceiling. (Potted shrubs: details.js; a tree: below.)
  const GB = GARDENS.b;
  const back = -GB.back;
  const inner = outline(back + 0.06);
  let fy = 5.3;
  for (let i = 0; i < 5; i++) {
    const loggia = i === 2 || i === 3;
    if (loggia) {
      footprint('pane', fy, fy + gH, back);
      for (const p of inner.points(Math.round(inner.L / 1.8))) b.box('white', [p.x - 0.05, fy, p.z - 0.05], [p.x + 0.05, fy + gH, p.z + 0.05]);
    } else {
      footprint('glassDark', fy, fy + gH, -0.25);
      windows(fy, fy + gH, true);
    }
    fy += gH;
    if (i === 4) break;
    footprint('white', fy, fy + 0.95, i === 2 ? back + 0.3 : 0.35);
    fy += 0.95;
  }
  for (const p of outline(-0.45).points(Math.round(outline(-0.45).L / 3.4))) b.cyl('white', p.x, p.z, GB.y0, GB.y1, 0.2, 14);
  const rail = outline(0.12).points(Math.round(outline(0.12).L / 1.4));
  for (const p of rail) b.cyl('metal', p.x, p.z, GB.y0, GB.y0 + 1.05, 0.03, 6);
  rail.slice(1).forEach((p, k) => {
    const q = rail[k];
    b.boxRot('metal', [(p.x + q.x) / 2, GB.y0 + 1.05, (p.z + q.z) / 2], [Math.hypot(p.x - q.x, p.z - q.z) + 0.04, 0.06, 0.06], [0, Math.atan2(-(p.z - q.z), p.x - q.x), 0]);
  });
  // (a slim cove line near the edge: the strip, its inner part covered by the white ceiling just below it)
  footprint('strip', GB.y1 - 0.08, GB.y1, -0.6);
  footprint('white', GB.y1 - 0.1, GB.y1 - 0.02, -1.3);
  footprint('white', by0, by1, 0.35);
  footprint('glass', FORUM.gap[1] - 1.55 + 0.75, by1 - 0.45, 0.39); // (level with the bridge's window, and as proud of it)
  footprint('glassDark', by1, B.top - 1.2, -0.25); // top floor
  windows(by1, B.top - 1.2, false); // (frames only: the title is read against it)
  footprint('white', B.top - 1.2, B.top + 0.4, 0.35); // parapet
  b.box('whiteShade', [14, B.top + 0.4, -12], [19, B.top + 2.6, -7]);
  // Roof: a railing along the front, a slatted pergola over a terrace at the
  // round corner, an aerial on the stair hut.
  const ry = B.top + 0.4;
  b.railingX('metal', cx, B.x1 - 0.3, B.z1 - 0.3, ry, 1.0, 1.5);
  const [px0, px1, pz0, pz1, ph] = [9.2, 13.6, -8.4, -2.6, 2.7];
  for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]]) b.box('white', [x - 0.12, ry, z - 0.12], [x + 0.12, ry + ph, z + 0.12]);
  for (const z of [pz0, pz1]) b.box('white', [px0 - 0.3, ry + ph, z - 0.12], [px1 + 0.3, ry + ph + 0.25, z + 0.12]);
  for (let x = px0; x <= px1 + 1e-3; x += 0.55) b.box('white', [x - 0.05, ry + ph + 0.25, pz0 - 0.4], [x + 0.05, ry + ph + 0.4, pz1 + 0.4]);
  b.cyl('metal', 18.2, -11.2, B.top + 2.6, B.top + 6.4, 0.06, 6);

  /* --- Sky bridges: two arms that stop 2 m short of each other --- */
  const [gx, gy, gz] = FORUM.gap;
  const y0 = gy - 1.55;
  const y1 = gy + 1.55;
  const half = 1.2; // half the gap
  // The right arm runs into B's bridge storey, its front at the gap's z. The
  // left one leaves A's flank a little behind the front corner (zL, above)
  // and starts inside the glass, so the corner stays whole; the two arms
  // needn't line up.
  const finOut = A.x1; // (A's flank: its glass side, no fins on it)
  const arms = [
    { x0: A.x1 - 0.6, x1: gx - half, z: zL, strip0: finOut + 0.05 },
    { x0: gx + half, x1: cx, z: gz, strip0: gx + half },
  ];
  for (const { x0, x1, z, strip0 } of arms) {
    b.box('white', [x0, y0, z - 6], [x1, y1, z]);
    b.box('glass', [x0, y0 + 0.75, z - 0.02], [x1, y1 - 0.45, z + 0.04]);
    b.box('strip', [strip0, y0 - 0.08, z - 5.6], [x1, y0, z - 0.4]);
  }
  // Orange end plates on the two tips facing each other: the clash point.
  // (Proud of the arm ends and a hair over their edges: coplanar faces flicker.)
  b.box('orange', [gx - half - 0.1, y0 - 0.03, zL - 6.03], [gx - half + 0.05, y1 + 0.03, zL + 0.05]);
  b.box('orange', [gx + half - 0.05, y0 - 0.03, gz - 6.03], [gx + half + 0.1, y1 + 0.03, gz + 0.05]);

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

  // Small trees in the two sky gardens.
  // (the left one's two, loosely, one half behind the other, on its gravel bed 0.25 up)
  const ga = GARDENS.a.y0 + 0.25;
  for (const [x, z, y, s] of [[-18, A.z1 - 2, ga, 0.5], [-16.5, A.z1 - 3.2, ga, 0.4], [18.6, B.z1 - 1.6, GARDENS.b.y0, 0.42]]) {
    const tree = createTree(mats, s);
    tree.position.set(x, y, z);
    group.add(tree);
  }

  // LED "speaking time" displays under the bridge glass: one side counts
  // down, then the other, like a debate timer.
  const xJ = cx - Math.sqrt((B.r + 0.35) ** 2 - (gz - cz) ** 2); // where the right arm meets the bridge storey
  const bars = [];
  for (const [x0, x1, z] of [[finOut + 0.55, gx - half - 0.3, zL], [xJ - 0.35, gx + half + 0.3, gz]]) {
    const len = Math.abs(x1 - x0);
    const track = new THREE.Mesh(new THREE.BoxGeometry(len + 0.16, 0.44, 0.05), mats.glassDark);
    track.position.set((x0 + x1) / 2, y0 + 0.38, z + 0.035);
    group.add(track);
    const g = new THREE.BoxGeometry(1, 0.32, 0.08);
    g.translate(0.5, 0, 0);
    const bar = new THREE.Mesh(g, mats.orange);
    bar.position.set(x0, y0 + 0.38, z + 0.07);
    bar.scale.x = len * Math.sign(x1 - x0);
    bar.userData.len = bar.scale.x;
    group.add(bar);
    bars.push(bar);
  }
  const turn = 9; // seconds per speech
  group.userData.animate = (t) => {
    mats.beacon.userData.on = t % 1.6 < 0.22 ? 1 : 0; // (the mast's light: a short blink, see updateMaterials)
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
/* 03 · PUZZLE — "The Cube Lab": a cube of 4×4 modules pushed in and out,    */
/* its top corner module missing (it floats above the roof); a zigzag stair  */
/* climbs the side and keeps going into the air; a low wing wears a maze.    */
/* ------------------------------------------------------------------------ */
// Module grid on the cube's front: cell (0,0) has its lower-left corner at
// CUBE.x0, CUBE.y0; the slide device in pages.js uses the same grid.
export const CUBE = { x0: -10, y0: 4, z: 0, cell: 5, n: 4 };

function puzzle(mats) {
  // ('pane': a lit window laid on the glass; 'frosted': a soft unlit pane, see THIN)
  const b = new Builder({ ...mats, pane: mats.glass, frosted: mats.skyWin, paneLit: mats.skyWinLit });
  const R = seeded(20261123);
  const { x0, y0, z: Z, cell, n } = CUBE;
  const x1 = x0 + cell * n;
  const top = y0 + cell * n;
  const back = Z - cell * n;

  // Pilotis and a recessed warm lobby.
  for (const x of [x0 + 2, x0 + 7.5, x1 - 7.5, x1 - 2]) for (const z of [Z - 2, Z - 10, Z - 18]) b.cyl('white', x, z, 0, y0, 0.35, 20);
  b.box('warm', [x0 + 4, 0, back + 4], [x1 - 4, y0, Z - 5]);
  b.box('strip', [x0 + 0.5, y0 - 0.08, back + 0.5], [x1 - 0.5, y0, Z - 0.5]);
  b.mullionsZ('metal', x0 + 4, x1 - 4, 0, y0, Z - 4.9, 2.0);
  // Entrance canopy under the left half, its front a fascia for the sign.
  b.box('white', [x0 + 0.4, 2.75, Z - 4.5], [x0 + 9.4, 3.65, Z + 1.8]);
  b.box('strip', [x0 + 0.7, 2.67, Z - 4.2], [x0 + 9.1, 2.75, Z + 1.6]);

  // Cube body (set back a little so the modules can stand proud or sink),
  // with the top right corner cut out where the missing module was.
  const hole = { x: x1 - cell, y: top - cell, z: Z - 6 };
  // (the right side set back too: modules stand there as well, see below)
  b.box('white', [x0, y0, back], [x1 - 1.4, top, hole.z]);
  b.box('white', [x0, y0, hole.z], [x1 - 1.4, hole.y, Z - 1.4]);
  b.box('white', [x0, hole.y, hole.z], [hole.x, top, Z - 1.4]);

  // Front modules: depth offset (+ out, - in) and a window style each.
  // Row 0 is the bottom row; [n-1][n-1] (top right) is missing.
  const depth = [
    [0.6, -0.8, 1.4, 0],
    [1.4, 0, -0.8, 0.8],
    [-0.8, 1.2, 0, 1.4],
    [0, 1.4, -0.8, null],
  ];
  const style = [
    ['square', 'slots', 'orange', 'square'],
    ['blank', 'square', 'band', 'slots'],
    ['slots', 'band', 'square', 'blank'],
    ['band', 'square', 'slots', null],
  ];
  const g = 0.12; // seam between modules
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const mx0 = x0 + c * cell + g;
      const mx1 = x0 + (c + 1) * cell - g;
      const my0 = y0 + r * cell + g;
      const my1 = y0 + (r + 1) * cell - g;
      const d = depth[r][c];
      if (d === null) {
        // The missing piece: a dark hollow where the module should be.
        b.box('glassDark', [mx0, my0, hole.z], [mx1, my1, hole.z + 0.1]);
        continue;
      }
      const front = Z + d;
      b.box('white', [mx0, my0, Z - 1.6], [mx1, my1, front]);
      const cx = (mx0 + mx1) / 2;
      const cy = (my0 + my1) / 2;
      const s = style[r][c];
      // (frames stand on the glass: square windows get a cross, bands
      // mullions; most are lit at night, some not, some have a blind down)
      const f = front + 0.06;
      const lit = R() < 0.7 ? 'glass' : 'glassDark';
      if (s === 'square') {
        b.winZ(lit, cx - 1.4, cx + 1.4, cy - 1.4, cy + 1.4, front);
        if (lit === 'glass' && R() < 0.4) b.box('blind', [cx - 1.36, cy + 1.36 - (0.6 + R() * 1.2), f], [cx + 1.36, cy + 1.36, f + 0.02]);
        b.box('white', [cx - 1.4, cy - 0.05, f], [cx + 1.4, cy + 0.05, f + 0.06]);
        b.box('white', [cx - 0.05, cy - 1.4, f], [cx + 0.05, cy + 1.4, f + 0.06]);
      }
      if (s === 'slots') for (const ox of [-1.5, 0, 1.5]) b.winZ('glassDark', cx + ox - 0.3, cx + ox + 0.3, cy - 1.65, cy + 1.65, front);
      if (s === 'band') {
        b.winZ(lit, mx0 + 0.6, mx1 - 0.6, cy - 0.5, cy + 0.5, front);
        for (let x = mx0 + 1.55; x < mx1 - 0.9; x += 0.95) b.box('white', [x - 0.05, cy - 0.5, f], [x + 0.05, cy + 0.5, f + 0.06]);
      }
      if (s === 'orange') b.winZ('orange', mx0 + 0.45, mx1 - 0.45, my0 + 0.45, my1 - 0.45, front);
    }
  }
  b.box('whiteShade', [x0 - 0.2, top, back - 0.2], [x1 + 0.2, top + 0.4, hole.z]);
  b.box('whiteShade', [x0 - 0.2, top, hole.z], [hole.x, top + 0.4, Z - 1.2]);

  // The right side: modules too, round the corner from the front's (a flat
  // wall there made the front read as a skin laid on a box). Along the
  // zigzag stair (the first three cells from the front) they only sink in or
  // stand flush; behind it some stand out. [r][k], k counted from the front;
  // the top front one is the missing module's gap.
  const sideDepth = [
    [-1.2, 0.1, -0.5, 1.2],
    [0.1, -1.1, 0.1, 0.6],
    [-1, 0.1, -1.2, 1.4],
    [null, -0.9, 0, 0.8],
  ];
  const sideStyle = [
    ['slots', 'square', 'blank', 'band'],
    ['square', 'band', 'slots', 'square'],
    ['band', 'blank', 'square', 'slots'],
    [null, 'slots', 'band', 'orange'],
  ];
  const zs = Z - 1.6; // (the front modules' back: the side's cells run from there to the back)
  const sc = (zs - back) / 4;
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < 4; k++) {
      const ds = sideDepth[r][k];
      if (ds === null) continue;
      const [za, zb] = [zs - k * sc - g, zs - (k + 1) * sc + g];
      const [my0, my1] = [y0 + r * cell + g, y0 + (r + 1) * cell - g];
      const xf = x1 + ds; // the module's face
      b.box('white', [x1 - 1.6, my0, zb], [xf, my1, za]);
      const zc = (za + zb) / 2;
      const cy = (my0 + my1) / 2;
      const f = xf + 0.06;
      const lit = R() < 0.7 ? 'glass' : 'glassDark';
      const s = sideStyle[r][k];
      if (s === 'square') {
        b.winX(lit, zc - 1.4, zc + 1.4, cy - 1.4, cy + 1.4, xf);
        if (lit === 'glass' && R() < 0.4) b.box('blind', [f, cy + 1.36 - (0.6 + R() * 1.2), zc - 1.36], [f + 0.02, cy + 1.36, zc + 1.36]);
        b.box('white', [f, cy - 0.05, zc - 1.4], [f + 0.06, cy + 0.05, zc + 1.4]);
        b.box('white', [f, cy - 1.4, zc - 0.05], [f + 0.06, cy + 1.4, zc + 0.05]);
      }
      if (s === 'slots') for (const oz of [-1.5, 0, 1.5]) b.winX('glassDark', zc + oz - 0.3, zc + oz + 0.3, cy - 1.65, cy + 1.65, xf);
      if (s === 'band') {
        b.winX(lit, zb + 0.6, za - 0.6, cy - 0.5, cy + 0.5, xf);
        for (let z = zb + 1.55; z < za - 0.9; z += 0.95) b.box('white', [f, cy - 0.5, z - 0.05], [f + 0.06, cy + 0.5, z + 0.05]);
      }
      if (s === 'orange') b.winX('orange', zb + 0.45, za - 0.45, my0 + 0.45, my1 - 0.45, xf);
    }
  }
  // A railing along the roof's front edge (round the gap the missing module left).
  b.railingX('metal', x0 + 0.2, hole.x - 0.2, Z - 1.6, top + 0.4, 1.0, 1.5);

  // Zigzag stair up the right side: three flights with landings, then a
  // last flight across the roof that rises into the air and stops.
  const rise = 0.36;
  const going = 0.5;
  const flight = (xa, xb, zStart, yStart, dir, steps) => {
    for (let i = 0; i < steps; i++) {
      const za = zStart + dir * i * going;
      const zb = za + dir * going;
      b.box('white', [xa, yStart + i * rise - 0.25, za], [xb, yStart + (i + 1) * rise, zb]);
    }
    const len = steps * going;
    const ang = Math.atan2(steps * rise, len);
    const zc = zStart + (dir * len) / 2;
    const yc = yStart + (steps * rise) / 2 + 0.55;
    // (rotating +z up by ang is a negative turn about x)
    for (const xr of [xa + 0.05, xb - 0.05]) b.boxRot('metal', [xr, yc, zc], [0.06, 0.06, Math.hypot(len, steps * rise)], [-dir * ang, 0, 0]);
    return { z: zStart + dir * len, y: yStart + steps * rise };
  };
  const sx0 = x1 + 0.2;
  const sx1 = x1 + 1.8;
  const steps = Math.round(top / 3 / rise);
  let p = flight(sx0, sx1, Z + 1, 0, -1, steps);
  b.box('white', [sx0, p.y - 0.3, p.z - 2], [sx1 + 1.7, p.y, p.z]);
  p = flight(sx1 + 0.1, sx1 + 1.7, p.z, p.y, 1, steps);
  b.box('white', [sx0, p.y - 0.3, p.z], [sx1 + 1.7, p.y, p.z + 2]);
  p = flight(sx0, sx1, p.z, p.y, -1, steps);
  b.box('white', [x1 - 4, p.y - 0.3, p.z - 2.5], [sx1, top + 0.45, p.z]); // (not flush with the roof)
  // Across the roof and up into nothing, towards the floating piece.
  flight(x1 - 3.6, x1 - 2, p.z - 2.5 + 0.01, top + 0.4, 1, 12);

  // Low wing to the right, its front a maze in relief.
  const wx0 = 17;
  const wx1 = 37;
  const wz = -6;
  b.box('white', [wx0, 0, -20], [wx1, 11, wz]);
  b.winZ('warm', wx0 + 1, wx1 - 1, 0.4, 3.2, wz);
  // A shop front on it: mullions, a transom, double doors in the middle.
  const sf = wz + 0.09;
  b.mullionsZ('metal', wx0 + 1, wx1 - 1, 0.4, 3.2, sf, 1.8, 0.05);
  b.box('metal', [wx0 + 1, 2.35, sf - 0.05], [wx1 - 1, 2.45, sf + 0.05]);
  b.box('glassDark', [wx0 + 8.2, 0, sf - 0.03], [wx0 + 11.8, 2.35, sf + 0.03]);
  for (const x of [wx0 + 9.75, wx0 + 10.25]) b.box('metal', [x - 0.03, 0.95, sf + 0.03], [x + 0.03, 1.75, sf + 0.1]);
  b.box('white', [wx0, 3.6, wz], [wx1, 4.0, wz + 1.2]);
  b.box('strip', [wx0 + 0.5, 3.52, wz + 0.2], [wx1 - 0.5, 3.6, wz + 1.1]);
  // Maze walls on a 2 m grid between y 4.6 and 10.4, framing windows: the
  // cells are panes, most a soft frosted grey, some lit at night, a few
  // with a blind down.
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 3; j++) {
      const px = wx0 + 0.5 + i * 1.9;
      const py = 10.2 - (j + 1) * 2;
      const u = R();
      const key = u < 0.3 ? 'paneLit' : u < 0.4 ? 'blind' : 'frosted';
      b.box(key, [px + 0.05, py + 0.2, wz], [px + 1.85, py + 1.95, wz + 0.04]);
    }
  }
  b.railingX('metal', wx0 + 0.3, wx1 - 0.3, wz - 0.5, 11.4, 1.0, 1.5);
  const maze = [
    'H.H.HHH.HH',
    '.V..V...V.',
    'HH.H.HH.H.',
  ];
  maze.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const mx = wx0 + 0.5 + i * 1.9;
      const my = 10.2 - j * 2;
      const key = (i + j) % 3 === 0 ? 'orange' : 'white';
      if (ch === 'H') b.box(key, [mx, my - 0.15, wz], [mx + 1.9, my + 0.15, wz + 0.55]);
      // (vertical walls sit a little further back, so where they meet a
      // horizontal wall their fronts don't share a plane)
      if (ch === 'V') b.box(key, [mx - 0.15, my - 2, wz], [mx + 0.15, my, wz + 0.48]);
    });
  });
  b.box('whiteShade', [wx0 - 0.2, 11, -20.2], [wx1 + 0.2, 11.4, wz + 0.2]);

  // Plaza edge.
  for (let x = -18; x <= 38; x += 4.8) b.bollard(x, 9);
  b.bench(-10, 8.5);
  b.bench(22, 8.5);

  const group = b.build();

  // The missing module, floating and slowly turning above the roof: an
  // orange cube with a white frame on its twelve edges, and each face in a
  // different module style (like the facade it fell out of). The underside,
  // which the street sees most, is a light square that glows at night.
  const piece = new THREE.Group();
  const s = cell - 0.4;
  const h = s / 2;
  const parts = { orange: [new THREE.BoxGeometry(s, s, s)], white: [], glass: [], glassDark: [], strip: [] };
  const t = 0.32;
  for (const axis of [0, 1, 2]) {
    for (const p of [-1, 1]) {
      for (const q of [-1, 1]) {
        const size = [t, t, t];
        size[axis] = s + t;
        const pos = axis === 0 ? [0, p * h, q * h] : axis === 1 ? [p * h, 0, q * h] : [p * h, q * h, 0];
        parts.white.push(new THREE.BoxGeometry(...size).translate(...pos));
      }
    }
  }
  // An inset on a face, in that face's own (u right, v up) coordinates.
  const d = 0.08;
  const face = (f, u, v, w, hh, key) => {
    const o = h + d / 2;
    const g = {
      pz: () => new THREE.BoxGeometry(w, hh, d).translate(u, v, o),
      nz: () => new THREE.BoxGeometry(w, hh, d).translate(-u, v, -o),
      px: () => new THREE.BoxGeometry(d, hh, w).translate(o, v, -u),
      nx: () => new THREE.BoxGeometry(d, hh, w).translate(-o, v, u),
      py: () => new THREE.BoxGeometry(w, d, hh).translate(u, o, -v),
      ny: () => new THREE.BoxGeometry(w, d, hh).translate(u, -o, v),
    }[f]();
    parts[key].push(g);
  };
  // front: a square window with a white cross
  face('pz', 0, 0, 2.6, 2.6, 'glass');
  parts.white.push(new THREE.BoxGeometry(2.6, 0.12, 0.06).translate(0, 0, h + d + 0.03), new THREE.BoxGeometry(0.12, 2.6, 0.06).translate(0, 0, h + d + 0.03));
  // back: three slots
  for (const u of [-1.15, 0, 1.15]) face('nz', u, 0, 0.5, 2.9, 'glassDark');
  // sides: a band, and a 2 × 2 grid
  face('px', 0, 0.3, 3.4, 0.9, 'glass');
  face('px', 0, -0.75, 3.4, 0.12, 'white');
  for (const u of [-0.75, 0.75]) for (const v of [-0.75, 0.75]) face('nx', u, v, 1.1, 1.1, 'glassDark');
  // top: a white disc
  parts.white.push(new THREE.CylinderGeometry(1.25, 1.25, d, 40).translate(0, h + d / 2, 0));
  // underside: a light square round a dark centre
  face('ny', 0, 0, 2.0, 2.0, 'glassDark');
  for (const [u, v, w, hh] of [[0, 1.2, 2.6, 0.22], [0, -1.2, 2.6, 0.22], [1.2, 0, 0.22, 2.6], [-1.2, 0, 0.22, 2.6]]) face('ny', u, v, w, hh, 'strip');
  for (const [key, geos] of Object.entries(parts)) {
    if (!geos.length) continue;
    const m = new THREE.Mesh(mergeGeometries(geos), mats[key]);
    geos.forEach((g) => g.dispose());
    // (no shadow: it turns, and the shadow map is only redrawn when the sun moves)
    piece.add(m);
  }
  const home = new THREE.Vector3(x0 + 3.5 * cell, top + 6.5, Z - 3);
  piece.position.copy(home);
  group.add(piece);
  // Every 18 s it tries its old place: it squares up, sinks most of the way
  // into the gap it left, hesitates there, and floats back up. The puzzle is
  // never quite solved. (Seated, its centre would be at hole.y + cell / 2.)
  const CYCLE = 18;
  const dipY = hole.y + cell / 2 + 1.1;
  const free = new THREE.Quaternion();
  const square = new THREE.Quaternion();
  const e = new THREE.Euler();
  const ease = (x) => {
    const k = Math.min(1, Math.max(0, x));
    return k * k * (3 - 2 * k);
  };
  group.userData.animate = (t) => {
    const c = t % CYCLE;
    // Down over 10-13 s, a pause, back up over 14-17.5 s; squared up before it
    // reaches the roof, and let go only once it is clear of it again.
    const down = ease((c - 10) / 3) * (1 - ease((c - 14) / 3.5));
    const sq = ease((c - 10) / 1.4) * (1 - ease((c - 15.8) / 1.7));
    free.setFromEuler(e.set(0.35 + Math.sin(t * 0.3) * 0.08, t * 0.22, 0.25));
    // (the quarter turn nearest the way it is facing halfway down)
    const yaw = Math.round(((t - c + 11.5) * 0.22) / (Math.PI / 2)) * (Math.PI / 2);
    square.setFromEuler(e.set(0, yaw, 0));
    piece.quaternion.slerpQuaternions(free, square, sq);
    const hover = Math.sin(t * 0.7) * 0.4 * (1 - down) + Math.sin(t * 2.4) * 0.05 * down;
    piece.position.y = THREE.MathUtils.lerp(home.y, dipY, down) + hover;
  };
  return group;
}

/* ------------------------------------------------------------------------ */
/* 04 · GAMES — "The Arcade Park": a drum wrapped in a spiral slide, a      */
/* Ferris wheel turning beside it, and a tower of stacked toy blocks.        */
/* ------------------------------------------------------------------------ */
function games(mats) {
  const b = new Builder(mats);

  /* --- The drum, with a spiral ramp (a slide) wrapped round it --- */
  const cz = -14;
  const R = 13;
  b.cyl('warm', 0, cz, 0, 4, R - 1.4, 64);
  b.cyl('strip', 0, cz, 3.85, 4.0, R - 0.2, 64);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) b.cyl('white', Math.sin(a) * (R - 0.5), cz + Math.cos(a) * (R - 0.5), 0, 4, 0.22, 10);
  const fh = 3.6;
  const floors = 3;
  // The glass bands stay whole, unframed ribbons (the 辩论 towers have the
  // window frames; here they made the two pages look alike).
  for (let i = 0; i < floors; i++) {
    const y = 4 + i * fh;
    b.cyl('white', 0, cz, y, y + 1.15, R, 72);
    b.cyl(i === 1 ? 'glassDark' : 'glass', 0, cz, y + 1.15, y + fh, R - 0.55, 72);
  }
  const top = 4 + floors * fh;
  b.cyl('white', 0, cz, top, top + 2.2, R, 72);
  b.cyl('whiteShade', 0, cz, top + 2.2, top + 2.5, R + 0.15, 72);
  // A railing round the roof's edge.
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 30) b.cyl('metal', Math.sin(a) * (R - 0.4), cz + Math.cos(a) * (R - 0.4), top + 2.5, top + 3.5, 0.04, 6);
  b.geo('metal', new THREE.TorusGeometry(R - 0.4, 0.06, 6, 96).rotateX(Math.PI / 2), 0, top + 3.5, cz);

  // Spiral ramp: 1.4 turns from the ground to the roof, with an orange
  // parapet on its outer edge (it reads as a slide).
  const rr = R + 1.9; // ramp centre line radius
  const turns = 1.4;
  const segs = 64;
  const a0 = Math.PI * 0.15; // starts at the front right
  const rampTop = top + 2.2;
  const segLen = ((Math.PI * 2 * turns) / segs) * rr;
  const pitch = Math.atan2(rampTop / segs, segLen);
  for (let i = 0; i < segs; i++) {
    const a = a0 + ((i + 0.5) / segs) * Math.PI * 2 * turns;
    const y = ((i + 0.5) / segs) * rampTop;
    // Box length (local z) along the circle's tangent, (cos a, 0, -sin a),
    // tilted up: yaw a + 90°, then a negative turn about x.
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, a + Math.PI / 2, 0, 'YXZ'));
    const place = (key, w, h, len, off, dy) => {
      const g = new THREE.BoxGeometry(w, h, len);
      g.applyQuaternion(q);
      const r = rr + off;
      g.translate(Math.sin(a) * r, y + dy, cz + Math.cos(a) * r);
      b.geo(key, g);
    };
    // (each piece as long as its own arc: the outer parapet's arc is longer)
    place('white', 2.6, 0.3, (segLen * (rr + 1.3)) / rr + 0.05, 0, 0);
    place('orange', 0.18, 0.9, (segLen * (rr + 1.35)) / rr + 0.08, 1.35, 0.45);
  }
  // Ramp columns every few segments.
  for (let i = 4; i < segs; i += 8) {
    const a = a0 + ((i + 0.5) / segs) * Math.PI * 2 * turns;
    const y = ((i + 0.5) / segs) * rampTop;
    b.cyl('white', Math.sin(a) * rr, cz + Math.cos(a) * rr, 0, y - 0.15, 0.18, 10);
  }

  /* --- Ferris wheel: legs (static) --- */
  // (centre far enough left that the turning rim and cabins clear the
  // spiral ramp, whose outer edge reaches x ≈ -15.8 at this depth)
  const W = { x: -33, y: 17, z: -10, r: 13 };
  for (const dz of [-2.4, 2.4]) {
    for (const dx of [-6.5, 6.5]) {
      const len = Math.hypot(dx, W.y);
      const g = new THREE.BoxGeometry(0.45, len, 0.45);
      g.rotateZ(Math.atan2(dx, W.y));
      g.translate(W.x + dx / 2, W.y / 2, W.z + dz);
      b.geo('white', g);
    }
  }
  b.box('white', [W.x - 0.3, W.y - 0.3, W.z - 2.6], [W.x + 0.3, W.y + 0.3, W.z + 2.6]); // axle
  b.box('concrete', [W.x - 9, 0, W.z - 4], [W.x + 9, 0.5, W.z + 4]);
  // Ticket booth.
  b.box('white', [W.x + 9.5, 0, W.z - 1], [W.x + 13, 3, W.z + 2]);
  b.box('orange', [W.x + 9.3, 3, W.z - 1.2], [W.x + 13.2, 3.4, W.z + 2.2]);
  b.winZ('warm', W.x + 10.2, W.x + 12.3, 0.9, 2.3, W.z + 2);

  /* --- Toy-block tower behind the drum --- */
  const T = { x: 22, z: -32 };
  const blocks = [
    // [w, h, d, yaw, key, dx, dz]
    [14, 9, 11, 0, 'white', 0, 0],
    [10, 6, 10, 0.26, 'orange', -0.5, 0.5],
    [12, 7, 8, -0.18, 'white', 0.8, -0.3],
    [7, 7, 7, 0.45, 'glass', -0.6, 0.4],
    [9, 4, 9, 0.05, 'white', 0.4, 0],
  ];
  let ty = 0;
  for (const [w, h, d, yaw, key, dx, dz] of blocks) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateY(yaw);
    g.translate(T.x + dx, ty + h / 2, T.z + dz);
    b.geo(key, g);
    if (key === 'white') {
      // a row of windows on the block's front, with white mullions
      const wg = new THREE.BoxGeometry(w * 0.7, h * 0.28, 0.12);
      wg.translate(0, 0, d / 2 + 0.02);
      wg.rotateY(yaw);
      wg.translate(T.x + dx, ty + h * 0.55, T.z + dz);
      b.geo('glassDark', wg);
      const nm = Math.round((w * 0.7) / 1.3);
      for (let k = 1; k < nm; k++) {
        const mg = new THREE.BoxGeometry(0.12, h * 0.28, 0.1);
        mg.translate(-w * 0.35 + (k * w * 0.7) / nm, 0, d / 2 + 0.11);
        mg.rotateY(yaw);
        mg.translate(T.x + dx, ty + h * 0.55, T.z + dz);
        b.geo('white', mg);
      }
    }
    ty += h;
  }
  // A ball on top, like the last piece of the stack.
  b.geo('orange', new THREE.SphereGeometry(2.4, 24, 16), T.x, ty + 2.3, T.z);

  /* --- Plaza edge --- */
  for (let x = -22; x <= 30; x += 4.8) if (x < -12 || x > 12) b.bollard(x, 10);
  b.bench(-6, 11);
  b.bench(16, 11);

  const group = b.build();

  /* --- Ferris wheel: the turning part --- */
  const wheel = new THREE.Group();
  wheel.position.set(W.x, W.y, W.z);
  const wheelGeos = [];
  for (const dz of [-1.2, 1.2]) {
    const rim = new THREE.TorusGeometry(W.r, 0.22, 8, 120);
    rim.translate(0, 0, dz);
    wheelGeos.push(rim);
    const inner = new THREE.TorusGeometry(W.r * 0.55, 0.12, 6, 80);
    inner.translate(0, 0, dz);
    wheelGeos.push(inner);
  }
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    for (const dz of [-1.2, 1.2]) {
      const s = new THREE.BoxGeometry(0.14, W.r, 0.14);
      s.translate(0, W.r / 2, dz);
      s.rotateZ(a);
      wheelGeos.push(s);
    }
    const c = new THREE.BoxGeometry(0.16, 0.16, 2.4); // cross bar at the rim
    c.translate(-Math.sin(a) * W.r, Math.cos(a) * W.r, 0); // where spoke i meets the rim
    wheelGeos.push(c);
  }
  const frame = new THREE.Mesh(mergeGeometries(wheelGeos.map((g) => (g.index ? g.toNonIndexed() : g))), mats.white);
  wheelGeos.forEach((g) => g.dispose());
  wheel.add(frame);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.2, 24).rotateX(Math.PI / 2), mats.orange);
  wheel.add(hub);
  group.add(wheel);

  // Cabins hang from the rim and stay upright as it turns (one draw call).
  const cabinGeo = new THREE.BoxGeometry(2.2, 2.0, 2.0);
  const cabins = new THREE.InstancedMesh(cabinGeo, mats.orange, N);
  const roofGeo = new THREE.BoxGeometry(2.5, 0.25, 2.3);
  const roofs = new THREE.InstancedMesh(roofGeo, mats.white, N);
  group.add(cabins, roofs);
  // Moving parts don't cast shadows: the shadow map is only redrawn when
  // the sun moves (see World.update), so their shadows would go stale.
  for (const m of [frame, hub, cabins, roofs]) m.castShadow = false;

  const m4 = new THREE.Matrix4();
  const spin = (t) => {
    const rot = t * 0.07;
    wheel.rotation.z = rot;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rot;
      const x = W.x - Math.sin(a) * W.r;
      const y = W.y + Math.cos(a) * W.r;
      m4.makeTranslation(x, y - 1.55, W.z);
      cabins.setMatrixAt(i, m4);
      m4.makeTranslation(x, y - 0.42, W.z);
      roofs.setMatrixAt(i, m4);
    }
    cabins.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    cabins.computeBoundingSphere();
    roofs.computeBoundingSphere();
  };
  spin(0);
  group.userData.animate = spin;
  return group;
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
  // Two lamps along the left railing, out towards the island (nearer ones
  // stood cut off at the picture's edge), clear of the planters and the
  // lifebuoy (details.js).
  for (const z of [-51, -59.4]) {
    const x = LX - 2.9;
    b.box('metal', [x - 0.14, 1.0, z - 0.14], [x + 0.14, 1.3, z + 0.14]);
    b.cyl('metal', x, z, 1.3, 5.3, 0.06, 8);
    b.box('metal', [x - 0.03, 5.15, z - 0.03], [x + 0.5, 5.21, z + 0.03]);
    b.cyl('white', x + 0.5, z, 5.0, 5.18, 0.3, 16);
    b.geo('bulb', new THREE.SphereGeometry(0.17, 12, 8), x + 0.5, 4.95, z);
  }

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
    // (a sill below and a hood above, so each reads as a window in a thick wall)
    b.box('white', [LX - 0.62, y - 0.16, LZ + r - 0.2], [LX + 0.62, y - 0.02, LZ + r + 0.26]);
    b.box('white', [LX - 0.62, y + 1.32, LZ + r - 0.2], [LX + 0.62, y + 1.48, LZ + r + 0.2]);
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
