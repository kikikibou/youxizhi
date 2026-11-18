import * as THREE from 'three';
import { Builder } from './buildings.js';

/**
 * Small additions round the buildings: flower boxes, planters, planted beds,
 * climbers. Each page's layout is written once, in the building's own frame
 * (+Z faces the plaza), and drawn in either look:
 *   'flat'   low-poly, flat-shaded like the trees (the site's own look)
 *   'pixel'  painted foliage cards for the pixel-art look (see pixelart.js)
 */

/** Foliage atlas cells of the pixel-art look (see foliageAtlas in pixelart.js). */
export const CELL = { leaf: 0, grass: 8, flowers: 16, trailing: 24 };

/** Wind for the low-poly grass: seconds, set once a frame (World.update). */
export const WIND = { value: 0 };

const FLOWERS = [
  [1, 0.55, 0.64],
  [1, 0.96, 0.88],
  [1, 0.8, 0.32],
  [0.76, 0.62, 1],
  [1, 0.46, 0.4],
];

/**
 * A page's details as a group for its building (null if it has none).
 * mats: materials by key (pot, soil, concrete; and for 'flat' bush, grass, flower);
 * foliage: the Foliage collector ('pixel' only).
 */
export function buildDetails(site, style, { R, mats, foliage }) {
  const layout = LAYOUTS[site.page.building];
  if (!layout) return null;
  const b = new Builder(mats);
  const paint = style === 'pixel' ? cards(site, foliage, R) : meshes(b, R);
  layout(b, kit(paint, R), site, R);
  const group = b.build();
  // (blades and petals are too fine for the shadow map: they only receive)
  group.traverse((o) => {
    if (o.isMesh && (o.material === mats.grass || o.material === mats.flower)) o.castShadow = false;
  });
  return group;
}

/* ------------------------------------------------------------ painters */

const pick = (R, a) => a[Math.floor(R() * a.length)];

/** Pixel art: cards in world space (one instanced draw for the whole plaza). */
function cards(site, F, R) {
  const W = (x, y, z) => site.group.localToWorld(new THREE.Vector3(x, y, z)).toArray();
  // Grass a little lighter and yellower than the trees.
  const grassTint = () => [1.08 + R() * 0.22, 1.1 + R() * 0.18, 0.82 + R() * 0.18];
  const leafTint = () => [0.94 + R() * 0.12, 1, 0.94 + R() * 0.12];
  return {
    tuft(x, y, z, h, flowers = null, chance = 0.4) {
      const fl = R() < chance;
      F.add(W(x, y, z), [h * (1.05 + R() * 0.3), h], (fl ? CELL.flowers : CELL.grass) + Math.floor(R() * 8), { kind: 1, tint: grassTint(), flower: flowers || pick(R, FLOWERS) });
    },
    clump(x, y, z, size, nrm = [0, 1, 0]) {
      F.add(W(x, y, z), [size, size], CELL.leaf + Math.floor(R() * 8), { nrm, tint: leafTint() });
    },
    trail(x, y, z, h, flowers) {
      F.add(W(x, y, z), [0.5, h], CELL.trailing + Math.floor(R() * 4), { kind: 2, tint: leafTint(), flower: flowers });
    },
  };
}

/**
 * The site's own look: low-poly and flat-shaded like its trees. Vertex
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

/** Shared helpers on top of a painter. */
function kit(p, R) {
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
  return { ...p, bed, pit, pick: (a) => pick(R, a) };
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

const LAYOUTS = { home };
