import * as THREE from 'three';
import { Builder, GARDENS } from './buildings.js';

/**
 * Small additions round the buildings: flower boxes, planters, planted beds,
 * climbers. Each page's layout is written once, in the building's own frame
 * (+Z faces the plaza), low-poly and flat-shaded like the trees.
 */

/** Wind for the low-poly grass: seconds, set once a frame (World.update). */
export const WIND = { value: 0 };

/** A small seeded random generator (mulberry32): the same details on every visit. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLOWERS = [
  [1, 0.55, 0.64],
  [1, 0.96, 0.88],
  [1, 0.8, 0.32],
  [0.76, 0.62, 1],
  [1, 0.46, 0.4],
];

// Balloons and bunting: the schemes' accent and cream, with a few brighter ones.
const PARTY = [
  [0.95, 0.33, 0.36],
  [1, 0.8, 0.3],
  [0.45, 0.72, 0.95],
  [1, 0.95, 0.88],
  [1, 0.6, 0.7],
  [0.5, 0.82, 0.68],
];

/**
 * A page's details as a group for its building (null if it has none).
 * mats: materials by key (pot, soil, concrete, bush, grass, flower, orange,
 * white, metal, trunk).
 */
export function buildDetails(site, { R, mats }) {
  const layout = LAYOUTS[site.page.building];
  if (!layout) return null;
  const b = new Builder(mats);
  layout(b, kit(meshes(b, R), pieces(b, R), R), site, R);
  const group = b.build();
  // (blades and petals are too fine for the shadow map: they only receive)
  group.traverse((o) => {
    if (o.isMesh && (o.material === mats.grass || o.material === mats.flower)) o.castShadow = false;
  });
  return group;
}

/* ------------------------------------------------------------ painters */

const pick = (R, a) => a[Math.floor(R() * a.length)];

/**
 * Grass, shrubs and trailing plants, low-poly like the trees. Vertex
 * colours vary each piece's shade (the material carries the scheme's green);
 * uv.y is how far a vertex sways in the wind (0 at a blade's root).
 */
function meshes(b, R) {
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const lin = new THREE.Color();
  const paint = (g, fn, sway = 0) => {
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const [r, gg, bb] = fn(i, pos);
      col[i * 3] = r;
      col[i * 3 + 1] = gg;
      col[i * 3 + 2] = bb;
      if (sway !== null) uv.setY(i, typeof sway === 'function' ? sway(i, pos) : sway);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const head = (p, colour) => {
    const g = new THREE.IcosahedronGeometry(0.06 + R() * 0.035, 0);
    g.rotateY(R() * 6.28);
    g.translate(p.x, p.y, p.z);
    lin.setRGB(...colour, THREE.SRGBColorSpace);
    paint(g, () => [lin.r, lin.g, lin.b], 1);
    b.push('flower', g);
  };
  const leaf = (g, s) => paint(g, () => [s, s * (1.02 + R() * 0.04), s * (0.96 + R() * 0.06)], 0);
  return {
    tuft(x, y, z, h, flowers = null, chance = 0.4) {
      const fl = R() < chance ? flowers || pick(R, FLOWERS) : null;
      const n = 4 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const hh = h * (0.5 + R() * 0.5);
        const g = new THREE.ConeGeometry(0.03 + h * 0.03, hh, 3, 1, true);
        g.translate(0, hh / 2, 0);
        const shade = 0.82 + R() * 0.3;
        // Darker at the root, lighter at the tip; the tip sways.
        paint(g, (k, pos) => {
          const t = pos.getY(k) / hh;
          const s = (0.6 + 0.6 * t) * shade;
          return [s, s, s * 0.95];
        }, (k, pos) => pos.getY(k) / hh);
        e.set((R() - 0.5) * 0.55, R() * Math.PI * 2, (R() - 0.5) * 0.55);
        m4.compose(new THREE.Vector3(x + (R() - 0.5) * h * 0.35, y, z + (R() - 0.5) * h * 0.35), q.setFromEuler(e), one);
        g.applyMatrix4(m4);
        b.push('grass', g);
        if (fl && i < 2) head(new THREE.Vector3(0, hh, 0).applyMatrix4(m4), fl);
      }
    },
    /**
     * A low cushion of green on the ground, some with flowers on top: soft
     * and round like the tree crowns (upright blades on the ground read as
     * spiky). Darker underneath, lighter on top; it doesn't sway.
     */
    mound(x, y, z, r, flowers = null) {
      const g = new THREE.IcosahedronGeometry(r, 1);
      const sy = 0.5 + R() * 0.15;
      g.scale(1 + (R() - 0.5) * 0.25, sy, 1 + (R() - 0.5) * 0.25);
      g.rotateY(R() * 6.28);
      g.translate(x, y + r * sy * 0.45, z);
      const shade = 0.88 + R() * 0.26;
      paint(g, (k, pos) => {
        const t = Math.min(1, Math.max(0, (pos.getY(k) - y) / (r * sy * 1.45)));
        const v = (0.72 + 0.38 * t) * shade;
        return [v, v * 1.02, v * 0.9];
      }, 0);
      b.push('grass', g);
      if (!flowers) return;
      // (on its surface: the cushion's centre is r * sy * 0.45 up, its half-height r * sy)
      for (let i = 3 + Math.floor(R() * 4); i > 0; i--) {
        const a = R() * 6.28;
        const d = Math.sqrt(R()) * r * 0.55;
        const top = y + r * sy * (0.45 + Math.sqrt(1 - (d / r) ** 2)) + 0.02;
        head(new THREE.Vector3(x + Math.cos(a) * d, top, z + Math.sin(a) * d), flowers);
      }
    },
    clump(x, y, z, size, nrm = [0, 1, 0]) {
      const g = new THREE.IcosahedronGeometry(size * 0.42, 0);
      const climber = nrm[2] > 0.8; // (flat against a wall facing +z)
      if (!climber) g.rotateY(R() * 6.28);
      g.scale(1 + (R() - 0.5) * 0.3, 0.82 + R() * 0.2, climber ? 0.45 : 1 + (R() - 0.5) * 0.3);
      g.translate(x, y, z);
      b.push('bush', leaf(g, 0.88 + R() * 0.26));
    },
    trail(x, y, z, h, flowers) {
      // A string of small leaves hanging over the box's edge.
      const n = 3 + Math.floor(R() * 3);
      let px = x;
      let py = y;
      let pz = z;
      for (let i = 0; i < n; i++) {
        const r = 0.1 - i * 0.01;
        const g = new THREE.IcosahedronGeometry(r, 0);
        g.rotateY(R() * 6.28);
        g.translate(px, py - r * 0.6, pz);
        b.push('bush', leaf(g, 0.9 + R() * 0.2));
        if (flowers && R() < 0.2) head(new THREE.Vector3(px, py - r, pz + r * 0.7), flowers);
        py -= h / n;
        px += (R() - 0.5) * 0.1;
        pz += 0.025;
      }
    },
  };
}

/**
 * Larger pieces (hedges, topiary, balloons, bunting, lifebuoys). Vertex colours as in meshes(); uv.y is the sway.
 */
function pieces(b, R) {
  const lin = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);
  const colour = (g, rgb, sway = 0) => {
    lin.setRGB(...rgb, THREE.SRGBColorSpace);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      col.set([lin.r, lin.g, lin.b], i * 3);
      uv.setY(i, typeof sway === 'function' ? sway(i, pos) : sway);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  /** A thin rod from a to b (a Vector3 each). */
  const rod = (a, c, r, key, sway = null) => {
    const d = new THREE.Vector3().subVectors(c, a);
    const len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, 4, 1, true);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
    g.translate(a.x, a.y, a.z);
    if (sway) colour(g, [0.92, 0.9, 0.88], sway);
    b.push(key, g);
  };
  return {
    /** A clipped hedge filling a box (min/max corners in any order). */
    hedge(a, c, shade = 1) {
      const min = a.map((v, i) => Math.min(v, c[i]));
      const max = a.map((v, i) => Math.max(v, c[i]));
      const g = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
      g.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
      // (the leaf colour itself: the bush material carries the scheme's green)
      b.push('bush', colour(g, [shade, shade, shade]));
    },
    /** A square planter with a clipped ball on a short stem. */
    topiary(x, z, { y = 0, r = 0.6, stem = 0.6, key = 'pot' } = {}) {
      b.box(key, [x - 0.5, y, z - 0.5], [x + 0.5, y + 0.7, z + 0.5]);
      b.box('soil', [x - 0.42, y + 0.7, z - 0.42], [x + 0.42, y + 0.72, z + 0.42]);
      b.cyl('trunk', x, z, y + 0.7, y + 0.72 + stem, 0.05, 6);
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.translate(x, y + 0.7 + stem + r * 0.9, z);
      b.push('bush', colour(g, [1.05, 1.05, 1.05]));
    },
    /** A bunch of balloons on strings, tied at the anchor. */
    balloons([ax, ay, az], n = 6) {
      const anchor = new THREE.Vector3(ax, ay, az);
      for (let i = 0; i < n; i++) {
        const len = 3 + R() * 2.4;
        const top = new THREE.Vector3(ax + (R() - 0.5) * 2.4, ay + len, az + (R() - 0.5) * 1.4);
        rod(anchor, top, 0.012, 'flower', (k, pos) => Math.max(0, (pos.getY(k) - ay) / len));
        const g = new THREE.SphereGeometry(0.55, 12, 9);
        g.scale(1, 1.18, 1);
        g.translate(top.x, top.y + 0.6, top.z);
        b.push('flower', colour(g, PARTY[i % PARTY.length], 1));
      }
    },
    /** A string of pennants between two points, sagging in the middle. */
    bunting(p0, p1, sag = 0.5) {
      const A = new THREE.Vector3(...p0);
      const B = new THREE.Vector3(...p1);
      const at = (t) => A.clone().lerp(B, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
      for (let i = 0; i < 12; i++) rod(at(i / 12), at((i + 1) / 12), 0.014, 'metal');
      const along = new THREE.Vector3().subVectors(B, A).setY(0).normalize();
      const n = Math.max(2, Math.floor(A.distanceTo(B) / 0.7));
      for (let i = 1; i < n; i++) {
        const p = at(i / n);
        const l = p.clone().addScaledVector(along, -0.26);
        const r = p.clone().addScaledVector(along, 0.26);
        const tip = p.clone().add(new THREE.Vector3(0, -0.62, 0));
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...l.toArray(), ...r.toArray(), ...tip.toArray()], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
        g.computeVertexNormals();
        b.push('flower', colour(g, PARTY[i % PARTY.length], (k) => (k === 2 ? 1 : 0)));
      }
    },
    /** A lifebuoy hung on a railing, facing along +z turned by rotY. */
    lifebuoy(x, y, z, rotY) {
      const ring = new THREE.TorusGeometry(0.34, 0.085, 8, 24);
      ring.rotateY(rotY);
      ring.translate(x, y, z);
      b.push('orange', ring);
      for (let k = 0; k < 4; k++) {
        const band = new THREE.TorusGeometry(0.34, 0.092, 8, 3, Math.PI / 7);
        band.rotateZ(k * (Math.PI / 2) + Math.PI / 4 - Math.PI / 14);
        band.rotateY(rotY);
        band.translate(x, y, z);
        b.push('white', band);
      }
    },
  };
}

/**
 * The hedge maze in front of the 问答 cube, 10 x 3 cells (one way through:
 * every cell reachable). right[r][c]: a wall east of cell (c, r); down[r][c]:
 * south of it. Drawn once by a depth-first walk and fixed here, so changes to
 * the other planting (which draws on the same random sequence) leave it be.
 */
const MAZE = {
  right: ['1001000011', '0010101111', '0000010101'],
  down: ['0100111000', '1111000000', '1111111111'],
};
// (its place: see puzzle below; the way out right in front of the door under
// the canopy, so the way through it leads there: mazeRoute; the way in one
// cell along, so the two arches don't stand in line)
const MAZE_AT = { cols: 10, rows: 3, s: 1.7, x0: -8.5, z0: 2.6, in: 3, out: 2 };

/**
 * The way through the hedge maze, as [x, z] points on the ground in the 问答
 * building's frame: from the plaza in at the way in, cell by cell to the way
 * out, and on to `door` ([x, z]; if it isn't straight ahead, along the
 * cube's front first, between the hedges and the planters). (For the arrow
 * drawn through it: World, route.js.)
 */
export function mazeRoute(door) {
  const { cols, rows, s, x0, z0 } = MAZE_AT;
  const [right, down] = [MAZE.right, MAZE.down].map((rs) => rs.map((row) => [...row].map((c) => c === '1')));
  const start = [rows - 1, MAZE_AT.in];
  const goal = [0, MAZE_AT.out];
  const key = ([r, c]) => r * cols + c;
  const prev = new Map([[key(start), null]]);
  const queue = [start];
  while (queue.length) {
    const [r, c] = queue.shift();
    if (r === goal[0] && c === goal[1]) break;
    const next = [];
    if (c < cols - 1 && !right[r][c]) next.push([r, c + 1]);
    if (c > 0 && !right[r][c - 1]) next.push([r, c - 1]);
    if (r < rows - 1 && !down[r][c]) next.push([r + 1, c]);
    if (r > 0 && !down[r - 1][c]) next.push([r - 1, c]);
    for (const n of next) {
      if (prev.has(key(n))) continue;
      prev.set(key(n), [r, c]);
      queue.push(n);
    }
  }
  const cells = [];
  for (let p = goal; p; p = prev.get(key(p))) cells.unshift(p);
  const at = ([r, c]) => [x0 + (c + 0.5) * s, z0 + (r + 0.5) * s];
  const lane = z0 - 0.4; // (between the back hedges and the planters by the canopy)
  const out = at(goal)[0];
  const along = Math.abs(out - door[0]) > 0.05 ? [[out, lane], [door[0], lane]] : [];
  return [[at(start)[0], z0 + rows * s + 1.8], ...cells.map(at), ...along, door];
}

/** Shared helpers on top of the plants and the pieces. */
function kit(p, g, R) {
  /** A planted bed: a low kerb, soil, and grass with flowers (and a few bushes). */
  const bed = (b, x0, x1, z0, z1, { y = 0, flowerChance = 0.35, bushes = 0 } = {}) => {
    b.box('concrete', [x0, y, z0], [x1, y + 0.28, z1]);
    b.box('soil', [x0 + 0.15, y + 0.28, z0 + 0.15], [x1 - 0.15, y + 0.31, z1 - 0.15]);
    for (let x = x0 + 0.5; x < x1 - 0.35; x += 0.85 * (0.8 + R() * 0.4)) {
      for (let z = z0 + 0.5; z < z1 - 0.35; z += 0.85 * (0.9 + R() * 0.3)) {
        p.mound(x + (R() - 0.5) * 0.3, y + 0.28, z + (R() - 0.5) * 0.3, 0.38 + R() * 0.22, R() < flowerChance ? pick(R, FLOWERS) : null);
      }
    }
    for (let i = 0; i < bushes; i++) {
      const x = x0 + 1 + R() * (x1 - x0 - 2);
      const z = (z0 + z1) / 2;
      // (a bigger cushion, in the same soft green: dark faceted shrubs over low cushions read as rocks)
      p.mound(x, y + 0.28, z, 0.75 + R() * 0.2, null);
    }
  };
  /** Low cushions round the foot of a tree, a few flowering. */
  const pit = (cx, cz, r = 2) => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + R() * 0.5;
      const d = 0.75 + R() * (r - 1);
      p.mound(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d, 0.28 + R() * 0.2, R() < 0.25 ? pick(R, FLOWERS) : null);
    }
  };
  /** A long box planted with shrubs, trailing plants spilling over its front (skip: x ranges to leave clear). */
  const planter = (b, x0, x1, y, zFront, { key = 'pot', depth = 0.7, trail = true, skip = [] } = {}) => {
    b.box(key, [x0, y, zFront - depth], [x1, y + 0.42, zFront]);
    b.box('soil', [x0 + 0.06, y + 0.42, zFront - depth + 0.06], [x1 - 0.06, y + 0.44, zFront - 0.06]);
    for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.55) p.clump(x + (R() - 0.5) * 0.2, y + 0.75 + R() * 0.2, zFront - depth / 2, 0.75 + R() * 0.3, [(R() - 0.5) * 0.4, 0.9, 0.5]);
    if (!trail) return;
    for (let x = x0 + 0.25; x < x1 - 0.2; x += 0.42) {
      if (skip.some(([a, c]) => x > a && x < c)) continue;
      p.trail(x, y + 0.44, zFront + 0.06, 0.6 + R() * 0.6, R() < 0.3 ? pick(R, FLOWERS) : null);
    }
  };
  return { ...p, ...g, bed, pit, planter, pick: (a) => pick(R, a) };
}

/* ------------------------------------------------------------------ home */
function home(b, k, site, R) {
  // Flower boxes hung on the first-floor balcony railing (z 2.2, top rail at
  // 6.1), clear of the lettering above it, with trailing plants.
  for (const x of [-25.4, -22, -0.6, 2.8]) {
    b.box('pot', [x, 5.56, 2.28], [x + 2.4, 5.98, 2.74]);
    b.box('soil', [x + 0.06, 5.98, 2.34], [x + 2.34, 6.01, 2.68]);
    const flowers = k.pick(FLOWERS);
    for (let s = 0.14; s < 2.35; s += 0.2) k.tuft(x + s, 6.0, 2.5 + (R() - 0.5) * 0.16, 0.3 + R() * 0.16, flowers, 0.65);
    for (let s = 0.2; s < 2.3; s += 0.38) k.trail(x + s, 5.98, 2.78, 0.5 + R() * 0.45, flowers);
  }

  // Planters with shrubs along the top-floor terrace of the low wing (behind
  // its railing at z -5.2, floor at 8.8).
  for (let x = 9.2; x + 2.2 <= 31.6; x += 3.7) {
    b.box('pot', [x, 8.8, -6.5], [x + 2.2, 9.35, -5.55]);
    for (let s = 0.2; s < 2.1; s += 0.42) k.clump(x + s, 9.55 + R() * 0.35, -6.0 + (R() - 0.5) * 0.3, 0.8 + R() * 0.35, [(R() - 0.5) * 0.4, 0.9, 0.5]);
  }

  // Ivy up the front of the stair tower, either side of its tall window.
  for (const [x0, x1, top] of [[32.2, 33.6, 10.5], [35.4, 36.8, 6.5]]) {
    for (let y = 0.4; y < top; y += 0.55) {
      const spread = 1 - (y / top) * 0.6;
      for (let x = x0; x <= x1; x += 0.5) {
        if (R() > spread * 0.95) continue;
        k.clump(x + (R() - 0.5) * 0.3, y + (R() - 0.5) * 0.3, -7.3, 0.6 + R() * 0.3, [(R() - 0.5) * 0.5, 0.4, 1]);
      }
    }
  }

  // A planted strip along the plaza side (the lamp stands in the gap), and
  // grass round the trees.
  k.bed(b, -34, -3, 11, 13.6, { bushes: 3 });
  k.bed(b, 14, 44, 11, 13.6, { bushes: 3 });
  for (const [x, z] of site.page.scene.trees) k.pit(x, z);
}

/* ---------------------------------------------------------------- debate */
// Two sides, dressed alike: matching planters along both lobby canopies,
// clipped topiary either side of each lobby.
function debate(b, k, site, R) {
  // Tower A's canopy: top 5.2, front edge z -1.4 (its sign, CAVE CANEM, hangs
  // on the fascia round x -13: no trailing plants there).
  k.planter(b, -19.6, -6.4, 5.2, -1.45, { key: 'concrete', skip: [[-16.2, -9.8]] });
  // Tower B's canopy: top 5.3, its straight front at z -0.4 (east of the round corner).
  k.planter(b, 12.6, 22.2, 5.3, -0.45, { key: 'concrete' });
  for (const x of [-18.4, -7.6]) k.topiary(x, 0.2, { key: 'concrete' });
  for (const x of [13.4, 21]) k.topiary(x, 1.4, { key: 'concrete' });
  k.bed(b, -27, -10, 10.2, 11.8, { h: [0.45, 0.9], flowerChance: 0.45 });
  k.bed(b, 12, 29, 10.2, 11.8, { h: [0.45, 0.9], flowerChance: 0.45 });
  for (const [x, z] of site.page.scene.trees) k.pit(x, z);
  // The sky gardens (GARDENS in buildings.js): the left one has a pair of
  // ordinary trees (planted there) on a low gravel bed behind its railing;
  // potted shrubs in the right one's loggia. (On a sequence of their own:
  // drawing on the shared one would reshuffle every page after this, the maze too.)
  const R2 = rng(20261125);
  const g = kit(meshes(b, R2), pieces(b, R2), R2);
  const ga = GARDENS.a.y0;
  b.box('concrete', [-19.1, ga, -6.6], [GARDENS.a.x1 - 0.1, ga + 0.25, -3.5]);
  for (const [x, z] of [[14.6, -2.4], [21, -2.4], [9.6, -8.5], [9.6, -12]]) g.topiary(x, z, { y: GARDENS.b.y0, r: 0.45, stem: 0.4 });
  // Tower A's roof, round the helipad (HELIPAD in buildings.js): a planted
  // bed along the left edge and two clipped balls in pots at the stair hut's
  // door. (Seen from above only; a sequence of its own again.)
  const R3 = rng(20261126);
  const h = kit(meshes(b, R3), pieces(b, R3), R3);
  h.bed(b, -19.85, -18.85, -9.9, -6.7, { y: 38, flowerChance: 0.3 });
  for (const x of [-19.35, -17.55]) h.topiary(x, -11.85, { y: 38, r: 0.3, stem: 0.32 });
}

/* ---------------------------------------------------------------- puzzle */
// A small hedge maze on the plaza in front of the cube (one way through),
// laid out as a garden: a gravel bed in a stone kerb, leafy arches over the
// ways in and out, lanterns, planting round it; and clipped cubes on the
// cube's roof. (The 问答 close-up looks down on it: its route, World.)
function puzzle(b, k, site, R) {
  const { cols, rows, s, x0 } = MAZE_AT;
  const z0 = MAZE_AT.z0; // back edge (row 0); rows run towards the plaza (+z)
  const [right, down] = [MAZE.right, MAZE.down].map((rows) => rows.map((row) => [...row].map((c) => c === '1')));
  // The walls, as centre lines [x, z, x, z] (drawn round and leafy by mazeGarden).
  const walls = [];
  const wallX = (x, za, zb) => walls.push([x, za, x, zb]);
  const wallZ = (z, xa, xb) => walls.push([xa, z, xb, z]);
  for (let c = 0; c < cols; c++) {
    if (c !== MAZE_AT.out) wallZ(z0, x0 + c * s, x0 + (c + 1) * s); // back, the way out
    if (c !== MAZE_AT.in) wallZ(z0 + rows * s, x0 + c * s, x0 + (c + 1) * s); // front, the way in
  }
  wallX(x0, z0, z0 + rows * s);
  wallX(x0 + cols * s, z0, z0 + rows * s);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (right[r][c] && c < cols - 1) wallX(x0 + (c + 1) * s, z0 + r * s, z0 + (r + 1) * s);
      if (down[r][c] && r < rows - 1) wallZ(z0 + (r + 1) * s, x0 + c * s, x0 + (c + 1) * s);
    }
  }
  mazeGarden(b, { x0, z0, s, cols, rows, walls });

  // Clipped cubes in square planters: two big ones beside the maze, and a
  // row on the roof (top at 20.4; seen from above, during flights).
  const cube = (x, y, z, s, shade) => {
    b.box('pot', [x - s * 0.62, y, z - s * 0.62], [x + s * 0.62, y + s * 0.45, z + s * 0.62]);
    k.hedge([x - s / 2, y + s * 0.45, z - s / 2], [x + s / 2, y + s * 1.45, z + s / 2], shade);
  };
  cube(-10.4, 0, 5.2, 1.3, 1.3);
  cube(10.4, 0, 5.2, 1.3, 1.3);
  for (const x of [-3.5, 0, 3.4]) cube(x, 20.4, -2.6, 0.96, 1.4);
  // Grasses either side of the entrance canopy.
  for (const x of [-10.4, 0.2]) {
    b.box('pot', [x - 0.5, 0, 1.0], [x + 0.5, 0.6, 2.0]);
    for (let i = 0; i < 5; i++) k.tuft(x + (R() - 0.5) * 0.6, 0.6, 1.5 + (R() - 0.5) * 0.6, 0.7 + R() * 0.4, null, 0.3);
  }
  for (const [x, z] of site.page.scene.trees) k.pit(x, z);
}

/**
 * The hedge maze as a garden: its hedges round and leafy, low-poly like the
 * tree crowns (rows of overlapping clumps on a darker core); its bed of
 * gravel in a low stone kerb (open at the ways in and out, stepping stones up
 * to the way in); a leafy arch, flowering, over each way; stone lanterns at
 * its corners; low planting along its front and sides. On a random sequence
 * of its own, so the other pages' planting (which shares one) stays as it was.
 */
function mazeGarden(b, { x0, z0, s, cols, rows, walls }) {
  const R = rng(20261128);
  const k = kit(meshes(b, R), pieces(b, R), R);
  const lin = new THREE.Color();
  /** A leafy clump: an icosahedron squashed / stretched, darker below, lighter on top. */
  const clump = (x, y, z, r, [sx, sy, sz], shade) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.rotateY(R() * 6.28);
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.min(1, Math.max(0, (pos.getY(i) - (y - r * sy)) / (2 * r * sy)));
      const v = (0.74 + 0.4 * t) * shade;
      col.set([v, v * 1.02, v * 0.92], i * 3);
      uv.setY(i, 0);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    b.push('bush', g);
  };
  const flower = (x, y, z) => {
    const g = new THREE.IcosahedronGeometry(0.06 + R() * 0.03, 0);
    g.translate(x, y, z);
    lin.setRGB(...pick(R, FLOWERS), THREE.SRGBColorSpace);
    const pos = g.getAttribute('position');
    const uv = g.getAttribute('uv');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      col.set([lin.r, lin.g, lin.b], i * 3);
      uv.setY(i, 0);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    b.push('flower', g);
  };

  const x1 = x0 + cols * s;
  const z1 = z0 + rows * s;
  const bed = { x0: x0 - 0.6, x1: x1 + 0.6, z0: z0 - 0.42, z1: z1 + 0.6 };
  const way = (c) => [x0 + c * s, x0 + (c + 1) * s];
  const [in0, in1] = way(MAZE_AT.in);
  const [out0, out1] = way(MAZE_AT.out);

  // Lumps: every vertex nudged by a hash of where it is (so the copies of a
  // vertex that faces share move together and no crack opens), darker at the
  // foot, lighter on top, a little mottled. Flat-shaded, it reads low-poly.
  const hash = (x, y, z) => {
    const v = Math.sin(Math.round(x * 9) * 127.1 + Math.round(y * 9) * 311.7 + Math.round(z * 9) * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const leafy = (g, { lump = 0.03, base = 0, top = 1, shade = 1 } = {}) => {
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      let [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const [hx, hy, hz] = [hash(x, y, z), hash(z + 3.1, x, y), hash(y, z + 7.3, x)];
      x += (hx - 0.5) * 2 * lump;
      z += (hz - 0.5) * 2 * lump;
      if (y > base + 0.02) y += (hy - 0.5) * 2 * lump;
      pos.setXYZ(i, x, y, z);
      const t = Math.min(1, Math.max(0, (y - base) / (top - base)));
      const v = (0.7 + 0.42 * t) * shade * (0.94 + hx * 0.12);
      col.set([v, v * 1.02, v * 0.92], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 0);
    g.computeVertexNormals();
    return g;
  };

  // The hedges: each wall one clipped hedge, its section a rectangle with
  // its top corners rounded, its ends rounded off too (bevelled), lumpy.
  const HW = 0.25; // half its width
  const HH = 0.86; // its height
  const section = new THREE.Shape();
  section.moveTo(-HW, 0);
  section.lineTo(HW, 0);
  section.lineTo(HW, HH - 0.2);
  section.quadraticCurveTo(HW, HH, HW - 0.2, HH);
  section.lineTo(-HW + 0.2, HH);
  section.quadraticCurveTo(-HW, HH, -HW, HH - 0.2);
  section.lineTo(-HW, 0);
  for (const [xa, za, xb, zb] of walls) {
    const len = Math.hypot(xb - xa, zb - za);
    const g = new THREE.ExtrudeGeometry(section, {
      depth: len,
      steps: Math.max(2, Math.round(len / 0.55)),
      curveSegments: 1,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.05,
      bevelOffset: -0.05,
      bevelSegments: 2,
    });
    // (extruded along +z from 0: turned to lie along the wall)
    if (Math.abs(xb - xa) > Math.abs(zb - za)) g.rotateY(Math.PI / 2).translate(Math.min(xa, xb), 0, za);
    else g.translate(xa, 0, Math.min(za, zb));
    b.push('bush', leafy(g, { lump: 0.08, top: HH, shade: 1.12 + R() * 0.12 }));
    // (and a few clumps sunk into its top, so its line isn't a smooth roll)
    const n = Math.round(len / 0.75);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.2 + R() * 0.6) / n;
      const r = 0.2 + R() * 0.1;
      clump(xa + (xb - xa) * u + (R() - 0.5) * 0.06, HH - r * 0.45, za + (zb - za) * u + (R() - 0.5) * 0.06, r, [1.25, 0.85, 1.25], 1.18 + R() * 0.16);
    }
  }

  // The bed: gravel, and its kerb (open where the ways are).
  b.box('gravel', [bed.x0, 0, bed.z0], [bed.x1, 0.035, bed.z1]);
  const kw = 0.2;
  const kh = 0.15;
  const kerbZ = (za, zb, gap) => {
    b.box('concrete', [bed.x0, 0, za], [gap[0], kh, zb]);
    b.box('concrete', [gap[1], 0, za], [bed.x1, kh, zb]);
  };
  kerbZ(bed.z1 - kw, bed.z1, [in0, in1]);
  kerbZ(bed.z0, bed.z0 + kw, [out0, out1]);
  b.box('concrete', [bed.x0, 0, bed.z0], [bed.x0 + kw, kh, bed.z1]);
  b.box('concrete', [bed.x1 - kw, 0, bed.z0], [bed.x1, kh, bed.z1]);
  // Stepping stones up to the way in.
  const mid = (in0 + in1) / 2;
  for (const [i, z] of [bed.z1 + 0.45, bed.z1 + 1.15, bed.z1 + 1.85].entries()) {
    const dx = (i % 2 ? 1 : -1) * 0.12;
    b.box('concrete', [mid + dx - 0.36, 0, z - 0.26], [mid + dx + 0.36, 0.05, z + 0.26]);
  }

  // A leafy arch over each way: rising from the hedges' ends either side,
  // clumps up two legs and round a half circle over the top (about 2.1 m),
  // two deep, a few flowers in it.
  const arch = (xa, xb, z) => {
    const m = (xa + xb) / 2;
    const r = (xb - xa) / 2 - 0.05; // (the legs on the hedges' ends)
    const spring = 1.25;
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(new THREE.Vector3(m - r, 0.5, z), new THREE.Vector3(m - r, spring, z)));
    path.add(new THREE.EllipseCurve(m, spring, r, r * 0.95, Math.PI, 0, true).getPoints(14).reduce((c, p, i, ps) => {
      if (i) c.add(new THREE.LineCurve3(new THREE.Vector3(ps[i - 1].x, ps[i - 1].y, z), new THREE.Vector3(p.x, p.y, z)));
      return c;
    }, new THREE.CurvePath()));
    path.add(new THREE.LineCurve3(new THREE.Vector3(m + r, spring, z), new THREE.Vector3(m + r, 0.5, z)));
    const g = new THREE.TubeGeometry(path, 30, 0.26, 5, false);
    b.push('bush', leafy(g, { lump: 0.08, base: 0.5, top: spring + r, shade: 1.12 }));
    // a few clumps on it, and flowers
    const pts = path.getSpacedPoints(18);
    pts.forEach((p, i) => {
      if (i % 2 === 1) clump(p.x + (R() - 0.5) * 0.08, p.y + 0.06, z + (R() - 0.5) * 0.12, 0.2 + R() * 0.06, [1, 0.9, 1], 1.15 + R() * 0.15);
      if (R() < 0.45) flower(p.x + (R() - 0.5) * 0.24, p.y + 0.08 + R() * 0.1, z + (R() < 0.5 ? -1 : 1) * (0.16 + R() * 0.06));
    });
  };
  arch(in0, in1, z1);
  arch(out0, out1, z0);

  // Stone lanterns at the bed's corners: a post, a light, a cap.
  const lantern = (x, z) => {
    b.box('concrete', [x - 0.14, 0, z - 0.14], [x + 0.14, 0.58, z + 0.14]);
    b.box('strip', [x - 0.13, 0.58, z - 0.13], [x + 0.13, 0.84, z + 0.13]);
    b.box('concrete', [x - 0.24, 0.84, z - 0.24], [x + 0.24, 0.92, z + 0.24]);
    b.box('concrete', [x - 0.07, 0.92, z - 0.07], [x + 0.07, 1.02, z + 0.07]);
  };
  for (const [x, z] of [[bed.x0 - 0.42, bed.z1 + 0.42], [bed.x1 + 0.42, bed.z1 + 0.42], [bed.x0 - 0.25, bed.z0 - 0.2], [bed.x1 + 0.4, bed.z0 - 0.2]]) lantern(x, z);

  // Low planting along the front (but the way in) and the sides.
  const along = (xa, xb, z) => {
    for (let x = xa; x < xb; x += 0.7 + R() * 0.35) {
      if (x > in0 - 1.1 && x < in1 + 1.1) continue;
      k.mound(x, 0, z + (R() - 0.5) * 0.2, 0.3 + R() * 0.16, R() < 0.45 ? pick(R, FLOWERS) : null);
    }
  };
  along(bed.x0 + 0.3, bed.x1 - 0.3, bed.z1 + 0.42);
  for (const x of [bed.x0 - 0.42, bed.x1 + 0.42]) {
    for (let z = bed.z0 + 0.6; z < bed.z1 - 0.2; z += 0.75 + R() * 0.3) {
      if (Math.abs(z - 5.2) < 1.1) continue; // (the clipped cubes' planters, see puzzle)
      k.mound(x + (R() - 0.5) * 0.15, 0, z, 0.28 + R() * 0.14, R() < 0.35 ? pick(R, FLOWERS) : null);
    }
  }
}

/* ----------------------------------------------------------------- games */
// A fairground: balloons tied to the ticket booth, bunting from its roof,
// flowers round the Ferris wheel's base.
function games(b, k, site, R) {
  const W = { x: -33, z: -10 }; // the wheel (see buildings.js)
  // Ticket booth: x -23.5 .. -20, z -11 .. -8, its roof's top at 3.4.
  k.balloons([-20.3, 3.4, -8.0], 8);
  // Bunting from the booth's roof to the wheel's front leg, and to the drum's colonnade.
  k.bunting([-23.6, 3.3, -7.85], [W.x + 6.5 - 6.5 * (6 / 17), 6.0, W.z + 2.4], 0.6);
  k.bunting([-19.9, 3.3, -7.85], [Math.sin((-5 * Math.PI) / 12) * 12.7, 3.9, -14 + Math.cos((-5 * Math.PI) / 12) * 12.7], 0.5);
  // Flowers round the front and sides of the wheel's base (x -42 .. -24, z -14 .. -6).
  k.bed(b, -42.6, -23.4, -5.9, -4.7, { h: [0.35, 0.7], flowerChance: 0.75 });
  for (const [x, z] of site.page.scene.trees) k.pit(x, z);
}

/* ----------------------------------------------------------------- about */
// By the sea: low flowering cushions round the lighthouse's island, flowers along the
// study's glass front, planters and lifebuoys along the pier.
function about(b, k, site, R) {
  const LX = -21;
  const LZ = -66; // lighthouse (see buildings.js)
  // Cushions on the island's platform (top 1.6, radius 12), clear of the
  // pier's landing and the study.
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2;
    const r = 9.6 + R() * 2.1;
    const x = LX + Math.sin(a) * r;
    const z = LZ + Math.cos(a) * r;
    if (Math.abs(x - LX) < 4.4 && z > LZ + 5) continue; // the pier
    if (x < LX - 3 && z < LZ + 6.2) continue; // the study
    k.mound(x, 1.6, z, 0.3 + R() * 0.25, R() < 0.3 ? [1, 0.72, 0.82] : null);
  }
  // Flower planters along the study's glass front (z -61, x -33.5 .. -24.6).
  for (const [xa, xb] of [[-33.1, -29.4], [-28.6, -24.9]]) {
    b.box('pot', [xa, 1.6, -60.7], [xb, 2.05, -60.05]);
    b.box('soil', [xa + 0.06, 2.05, -60.64], [xb - 0.06, 2.07, -60.11]);
    const flowers = k.pick([[0.76, 0.62, 1], [1, 0.96, 0.88]]);
    for (let x = xa + 0.15; x < xb - 0.1; x += 0.22) k.tuft(x, 2.05, -60.38 + (R() - 0.5) * 0.2, 0.4 + R() * 0.25, flowers, 0.75);
  }
  // Along the pier (railings at x -24.3 and -17.7; the camera stands by the
  // right one): planters and a lifebuoy by the left railing.
  for (const z of [-36, -44, -54]) {
    b.box('pot', [LX - 3.1, 1.0, z - 0.9], [LX - 2.3, 1.55, z + 0.9]);
    for (let i = 0; i < 6; i++) k.tuft(LX - 2.7 + (R() - 0.5) * 0.4, 1.55, z + (R() - 0.5) * 1.5, 0.45 + R() * 0.3, null, 0.6);
  }
  k.lifebuoy(LX - 3.18, 1.55, -48, Math.PI / 2);
}

const LAYOUTS = { home, debate, puzzle, games, about };
