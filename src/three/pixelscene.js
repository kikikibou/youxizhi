import * as THREE from 'three';
import { Builder } from './buildings.js';
import { CELL } from './pixelart.js';

/**
 * Small things only the pixel-art look shows (see pixelart.js): flower boxes,
 * planters, beds and climbers, in each building's own frame (+Z faces the
 * plaza). The buildings themselves are unchanged.
 */
export function buildPixelDetails(site, px, foliage, R) {
  const fn = DETAILS[site.page.building];
  return fn ? fn(site, px, foliage, R) : null;
}

const FLOWERS = [
  [1, 0.55, 0.64],
  [1, 0.96, 0.88],
  [1, 0.8, 0.32],
  [0.76, 0.62, 1],
  [1, 0.46, 0.4],
];

function kit(site, F, R) {
  const W = (x, y, z) => site.group.localToWorld(new THREE.Vector3(x, y, z)).toArray();
  const pick = (a) => a[Math.floor(R() * a.length)];
  // Grass a little lighter and yellower than the trees.
  const grassTint = () => [1.08 + R() * 0.22, 1.1 + R() * 0.18, 0.82 + R() * 0.18];
  const leafTint = () => [0.94 + R() * 0.12, 1, 0.94 + R() * 0.12];
  const tuft = (x, y, z, h, flowers, flowerChance = 0.4) => {
    const fl = R() < flowerChance;
    F.add(W(x, y, z), [h * (1.05 + R() * 0.3), h], (fl ? CELL.flowers : CELL.grass) + Math.floor(R() * 8), { kind: 1, tint: grassTint(), flower: flowers || pick(FLOWERS) });
  };
  const clump = (x, y, z, size, nrm = [0, 1, 0]) => {
    F.add(W(x, y, z), [size, size], CELL.leaf + Math.floor(R() * 8), { nrm, tint: leafTint() });
  };
  const trail = (x, y, z, h, flowers) => {
    F.add(W(x, y, z), [0.5, h], CELL.trailing + Math.floor(R() * 4), { kind: 2, tint: leafTint(), flower: flowers });
  };
  /** A planted bed: a low kerb, soil, and grass with flowers. */
  const bed = (b, x0, x1, z0, z1, { h = [0.55, 1.15], step = 0.34, flowerChance = 0.35, bushes = 0 } = {}) => {
    b.box('concrete', [x0, 0, z0], [x1, 0.28, z1]);
    b.box('soil', [x0 + 0.15, 0.28, z0 + 0.15], [x1 - 0.15, 0.31, z1 - 0.15]);
    for (let x = x0 + 0.3; x < x1 - 0.2; x += step) {
      for (let z = z0 + 0.35; z < z1 - 0.2; z += step * 1.6) {
        tuft(x + (R() - 0.5) * step, 0.3, z + (R() - 0.5) * step, h[0] + R() * (h[1] - h[0]), null, flowerChance);
      }
    }
    for (let i = 0; i < bushes; i++) {
      const x = x0 + 1 + R() * (x1 - x0 - 2);
      const z = (z0 + z1) / 2;
      for (let k = 0; k < 4; k++) clump(x + (R() - 0.5) * 0.9, 0.7 + R() * 0.4, z + (R() - 0.5) * 0.8, 0.9 + R() * 0.3, [(R() - 0.5) * 0.6, 1, 0.4]);
    }
  };
  /** Grass round the foot of a tree. */
  const pit = (cx, cz, r = 2) => {
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2;
      const d = 0.5 + Math.sqrt(R()) * (r - 0.5);
      tuft(cx + Math.cos(a) * d, 0, cz + Math.sin(a) * d, 0.35 + R() * 0.35, null, 0.3);
    }
  };
  return { W, pick, tuft, clump, trail, bed, pit, grassTint, leafTint };
}

/* ------------------------------------------------------------------ home */
function home(site, px, F, R) {
  const b = new Builder(px.extra);
  const k = kit(site, F, R);

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

  return b.build();
}

const DETAILS = { home };
