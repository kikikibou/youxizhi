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
 * A maze on a cols x rows grid (depth-first: every cell reachable, one way
 * through). right[r][c]: a wall east of cell (c, r); down[r][c]: south of it.
 */
function maze(cols, rows, R) {
  const right = Array.from({ length: rows }, () => Array(cols).fill(true));
  const down = Array.from({ length: rows }, () => Array(cols).fill(true));
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const stack = [[0, 0]];
  seen[0][0] = true;
  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const next = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !seen[y][x]);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const [nc, nr] = next[Math.floor(R() * next.length)];
    if (nc !== c) right[r][Math.min(c, nc)] = false;
    else down[Math.min(r, nr)][c] = false;
    seen[nr][nc] = true;
    stack.push([nc, nr]);
  }
  return { right, down };
}

/** Shared helpers on top of the plants and the pieces. */
function kit(p, g, R) {
  /** A planted bed: a low kerb, soil, and grass with flowers (and a few bushes). */
  const bed = (b, x0, x1, z0, z1, { h = [0.55, 1.15], step = 0.34, flowerChance = 0.35, bushes = 0 } = {}) => {
    b.box('concrete', [x0, 0, z0], [x1, 0.28, z1]);
    b.box('soil', [x0 + 0.15, 0.28, z0 + 0.15], [x1 - 0.15, 0.31, z1 - 0.15]);
    for (let x = x0 + 0.3; x < x1 - 0.2; x += step) {
      for (let z = z0 + 0.35; z < z1 - 0.2; z += step * 1.6) {
        p.tuft(x + (R() - 0.5) * step, 0.3, z + (R() - 0.5) * step, h[0] + R() * (h[1] - h[0]), null, flowerChance);
      }
    }
    for (let i = 0; i < bushes; i++) {
      const x = x0 + 1 + R() * (x1 - x0 - 2);
      const z = (z0 + z1) / 2;
      for (let k = 0; k < 4; k++) p.clump(x + (R() - 0.5) * 0.9, 0.7 + R() * 0.4, z + (R() - 0.5) * 0.8, 0.9 + R() * 0.3, [(R() - 0.5) * 0.6, 1, 0.4]);
    }
  };
  /** Grass round the foot of a tree. */
  const pit = (cx, cz, r = 2) => {
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2;
      const d = 0.5 + Math.sqrt(R()) * (r - 0.5);
      p.tuft(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d, 0.35 + R() * 0.35, null, 0.3);
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
  // The sky gardens (GARDENS in buildings.js; their trees are planted there):
  // a planter along the left one's edge, trailing over it; potted shrubs in
  // the right one's loggia. (On a sequence of their own: drawing on the
  // shared one would reshuffle every page after this, the maze too.)
  const R2 = rng(20261125);
  const g = kit(meshes(b, R2), pieces(b, R2), R2);
  g.planter(b, -19.5, -6.5, GARDENS.a.y0, -3.0, { key: 'concrete', depth: 0.6 });
  for (const [x, z] of [[14.6, -2.4], [21, -2.4], [9.6, -8.5], [9.6, -12]]) g.topiary(x, z, { y: GARDENS.b.y0, r: 0.45, stem: 0.4 });
}

/* ---------------------------------------------------------------- puzzle */
// A small hedge maze on the plaza in front of the cube (one way through),
// and clipped cubes on the cube's roof.
function puzzle(b, k, site, R) {
  const cols = 10;
  const rows = 3;
  const s = 1.7;
  const x0 = -8.5;
  const z0 = 2.6; // back edge (row 0); rows run towards the plaza (+z)
  const t = 0.21; // half a hedge's thickness
  const h = 0.8;
  const { right, down } = maze(cols, rows, R);
  // (one shade for every wall: where two meet, their tops share a plane)
  const wallX = (x, za, zb) => k.hedge([x - t, 0, za - t], [x + t, h, zb + t], 1.25);
  const wallZ = (z, xa, xb) => k.hedge([xa - t, 0, z - t], [xb + t, h, z + t], 1.25);
  for (let c = 0; c < cols; c++) {
    if (c !== 7) wallZ(z0, x0 + c * s, x0 + (c + 1) * s); // back, the way out at column 7
    if (c !== 2) wallZ(z0 + rows * s, x0 + c * s, x0 + (c + 1) * s); // front, the way in at column 2
  }
  wallX(x0, z0, z0 + rows * s);
  wallX(x0 + cols * s, z0, z0 + rows * s);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (right[r][c] && c < cols - 1) wallX(x0 + (c + 1) * s, z0 + r * s, z0 + (r + 1) * s);
      if (down[r][c] && r < rows - 1) wallZ(z0 + (r + 1) * s, x0 + c * s, x0 + (c + 1) * s);
    }
  }
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
// By the sea: dune grass round the lighthouse's island, flowers along the
// study's glass front, planters and lifebuoys along the pier.
function about(b, k, site, R) {
  const LX = -21;
  const LZ = -66; // lighthouse (see buildings.js)
  // Dune grass on the island's platform (top 1.6, radius 12), clear of the
  // pier's landing and the study.
  for (let i = 0; i < 150; i++) {
    const a = R() * Math.PI * 2;
    const r = 9.6 + R() * 2.1;
    const x = LX + Math.sin(a) * r;
    const z = LZ + Math.cos(a) * r;
    if (Math.abs(x - LX) < 4.4 && z > LZ + 5) continue; // the pier
    if (x < LX - 3 && z < LZ + 6.2) continue; // the study
    k.tuft(x, 1.6, z, 0.5 + R() * 0.55, [1, 0.95, 0.88], 0.12);
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
