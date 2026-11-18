import * as THREE from 'three';
import { buildDetails, CELL } from './details.js';

/**
 * The pixel-art look (quality.pixel). The scene is drawn small and shown with
 * square pixels (see World.resize / renderPost); this module gives it what
 * makes pixel art read as drawn rather than shrunk:
 *   - surfaces painted texel by texel (stone panels, glazing with frames and
 *     reflections, shop interiors, paving), mapped by the face's axis in the
 *     building's own frame, about one texel to a screen pixel
 *   - a normal/depth pass, from which the final pass draws one-pixel outlines
 *     round silhouettes and light edges along convex corners
 *   - foliage: tree crowns, grass, flowers and climbers as clumps of painted
 *     cards, shaded in three flat tones
 *   - the page details (flower boxes, planters, beds: see details.js) drawn
 *     as foliage cards instead of low-poly plants
 * Everything is built the first time the look is switched on; switching it
 * off puts the original materials back.
 */

/* ------------------------------------------------------------------ util */

/** Small seeded random number generator (mulberry32): the same textures every visit. */
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

/** A tiny pixel painter. y runs up: row 0 is the bottom of the texture. Wraps at the edges. */
class Paint {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  i(x, y) {
    const w = this.w;
    const h = this.h;
    return ((((Math.floor(y) % h) + h) % h) * w + (((Math.floor(x) % w) + w) % w)) * 4;
  }
  set(x, y, r, g = r, b = r, a = 255) {
    const i = this.i(x, y);
    this.d[i] = r;
    this.d[i + 1] = g;
    this.d[i + 2] = b;
    this.d[i + 3] = a;
  }
  add(x, y, v) {
    const i = this.i(x, y);
    this.d[i] += v;
    this.d[i + 1] += v;
    this.d[i + 2] += v;
  }
  rect(x, y, w, h, r, g = r, b = r, a = 255) {
    for (let j = 0; j < h; j++) for (let k = 0; k < w; k++) this.set(x + k, y + j, r, g, b, a);
  }
  alpha(x, y) {
    return this.d[this.i(x, y) + 3];
  }
  /** color: sRGB colours (false: data, e.g. masks); mips: smooth when far, square when near */
  texture({ color = true, mips = true, nearestMips = false } = {}) {
    const t = new THREE.DataTexture(this.d, this.w, this.h, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = mips ? (nearestMips ? THREE.NearestMipmapNearestFilter : THREE.LinearMipmapLinearFilter) : THREE.NearestFilter;
    t.generateMipmaps = mips;
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return { tex: t, w: this.w, h: this.h };
  }
}

/* -------------------------------------------------------------- textures */
// All drawn as multipliers of the material's colour (255 = the colour itself),
// unless noted. Densities (texels per metre) are set where they are used.

/** Light stone cladding: panels 2 x 1 m (12 x 6 texels) in running bond. */
function wallTexture(R) {
  const c = new Paint(96, 48);
  const pw = 12;
  const ph = 6;
  for (let row = 0; row < c.h / ph; row++) {
    const off = (row % 2) * (pw / 2);
    for (let col = 0; col < c.w / pw; col++) {
      let tone = 243 + Math.floor(R() * 9) - 4;
      if (R() < 0.1) tone -= 8; // the odd replaced panel
      const warm = Math.floor(R() * 5) - 2;
      const x0 = col * pw + off;
      const y0 = row * ph;
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          let v = tone;
          if (y === 0) v = 214; // bed joint
          else if (x === 0) v = 222; // head joint
          else {
            if (y === ph - 1) v += 6; // the top edge catches the light
            if (x === pw - 1) v -= 4;
            const n = R();
            if (n < 0.05) v -= 8 + R() * 9;
            else if (n < 0.08) v += 5;
          }
          c.set(x0 + x, y0 + y, v + warm, v, v - warm);
        }
      }
      // A rain streak down from the odd panel's bottom edge.
      if (R() < 0.14) {
        const sx = x0 + 2 + Math.floor(R() * (pw - 4));
        const len = 3 + Math.floor(R() * 6);
        for (let k = 1; k <= len; k++) c.add(sx, y0 - k, -10 + k);
      }
    }
  }
  for (let k = 0; k < 7; k++) {
    let x = Math.floor(R() * c.w);
    let y = Math.floor(R() * c.h);
    const n = 3 + Math.floor(R() * 5);
    for (let s = 0; s < n; s++) {
      c.add(x, y, -26);
      x += R() < 0.5 ? 1 : 0;
      y -= 1;
    }
  }
  return c.texture();
}

/** Slabs, cornices, parapets: smooth cast stone with sparse pits. */
function trimTexture(R) {
  const c = new Paint(48, 48);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      let v = 238 + Math.floor(R() * 4);
      const n = R();
      if (n < 0.035) v -= 12 + R() * 8;
      else if (n < 0.06) v += 6;
      c.set(x, y, v, v, v);
    }
  }
  // Expansion joints every 4 m.
  for (let y = 0; y < c.h; y++) for (const x of [0, 24]) c.set(x, y, 214, 214, 214);
  return c.texture();
}

/** Roofs and other faces seen from above: gravel. */
function roofTexture(R) {
  const c = new Paint(32, 32);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const v = 196 + Math.floor(R() * 26);
      c.set(x, y, v, v - 2, v - 6);
    }
  }
  for (let k = 0; k < 14; k++) {
    const x = Math.floor(R() * 32);
    const y = Math.floor(R() * 32);
    c.rect(x, y, 2, 1, 176, 172, 168);
  }
  return c.texture();
}

/** Ceilings and soffits seen from below: square panels with a downlight in each. */
function soffitTexture() {
  const c = new Paint(24, 24);
  c.rect(0, 0, 24, 24, 236, 236, 236);
  for (let k = 0; k < 24; k++) {
    c.set(k, 0, 214);
    c.set(0, k, 214);
    c.set(k, 12, 214);
    c.set(12, k, 214);
  }
  for (const [x, y] of [[6, 6], [18, 6], [6, 18], [18, 18]]) c.rect(x - 1, y - 1, 2, 2, 205, 205, 214);
  return c.texture();
}

/** Benches, plinths, piers: rough concrete. */
function concreteTexture(R) {
  const c = new Paint(48, 48);
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      let v = 226 + Math.floor(R() * 14) - 7;
      if (R() < 0.05) v -= 18;
      c.set(x, y, v, v, v);
    }
  }
  for (let k = 0; k < c.w; k++) {
    c.set(k, 0, 196);
    c.set(0, k, 196);
  }
  return c.texture();
}

/**
 * Glazing, as data: r = mullion, g = reflection, b = how lit the room behind
 * each pane is at night. Panes 2 m wide (12 texels at 6 a metre).
 */
function glassTexture(R) {
  const c = new Paint(96, 24);
  const levels = [1, 0.95, 0.85, 0.7, 0.18, 0.08];
  for (let p = 0; p < c.w / 12; p++) {
    const lit = levels[Math.floor(R() * levels.length)];
    const curtain = R() < 0.25 ? Math.floor(R() * 2) : -1; // a curtain drawn over one half
    for (let x = 0; x < 12; x++) {
      for (let y = 0; y < c.h; y++) {
        const X = p * 12 + x;
        const mull = x === 0 ? 255 : 0;
        const u = (X + y) % 32;
        const refl = u < 2 ? 200 : u === 4 ? 120 : (X * 2 + y) % 45 === 0 ? 90 : 0;
        let b = lit;
        if (curtain >= 0 && (x < 6) === (curtain === 0)) b = lit * 0.4;
        c.set(X, y, mull, refl, Math.round(b * 255));
      }
    }
  }
  return c.texture({ color: false });
}

/** A shop interior, 8 x 4 m (64 x 32 texels): shelves, a counter, pendant lamps. Colour. */
function interiorTexture(R) {
  const c = new Paint(64, 32);
  for (let y = 0; y < c.h; y++) {
    const v = 214 + y * 1.3;
    for (let x = 0; x < c.w; x++) c.set(x, y, v, v - 8, v - 18);
  }
  c.rect(0, 0, 64, 3, 150, 118, 98); // floor
  c.rect(0, 3, 64, 1, 184, 160, 140); // skirting
  const goods = [[205, 92, 84], [86, 124, 176], [226, 192, 92], [94, 152, 112], [236, 230, 218], [154, 112, 172], [220, 140, 70]];
  for (const [x0, x1] of [[2, 17], [45, 61]]) {
    c.rect(x0, 4, 1, 24, 112, 88, 76);
    c.rect(x1, 4, 1, 24, 112, 88, 76);
    for (const sy of [6, 12, 18, 24]) {
      c.rect(x0, sy, x1 - x0 + 1, 1, 118, 92, 78);
      for (let x = x0 + 1; x < x1; x++) {
        if (R() < 0.3) continue;
        const h = 2 + Math.floor(R() * 3);
        const g = goods[Math.floor(R() * goods.length)];
        const k = 0.75 + R() * 0.3;
        c.rect(x, sy + 1, 1, h, g[0] * k, g[1] * k, g[2] * k);
      }
    }
  }
  // Counter with a lighter top and panelled front.
  c.rect(22, 3, 19, 6, 164, 122, 96);
  c.rect(22, 9, 19, 1, 238, 218, 194);
  for (let x = 23; x < 41; x += 3) c.rect(x, 4, 1, 4, 140, 104, 84);
  // Pendant lamps over the counter.
  for (const x of [26, 31, 36]) {
    c.rect(x, 27, 1, 5, 96, 86, 84);
    c.rect(x - 1, 25, 3, 2, 70, 66, 76);
    c.set(x, 24, 255, 248, 226);
  }
  // A potted plant by the counter.
  c.rect(18, 3, 3, 3, 176, 102, 72);
  for (const [x, y] of [[19, 6], [18, 7], [20, 7], [19, 8], [17, 8], [21, 8], [18, 9], [20, 9], [19, 10]]) c.set(x, y, 92, 150, 92);
  return c.texture();
}

/** Plaza paving, 16 x 16 m (128 texels at 8 a metre): flagstones, grass in the joints. Colour. */
function pavingTexture(R) {
  const c = new Paint(128, 128);
  const s = 8;
  for (let row = 0; row < c.h / s; row++) {
    const off = (row % 2) * 4;
    for (let col = 0; col < c.w / s; col++) {
      const t = Math.floor(R() * 14) - 7;
      const x0 = col * s + off;
      const y0 = row * s;
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          let r = 190 + t;
          let g = 180 + t;
          let b = 168 + t;
          if (x === 0 || y === 0) {
            r = 132;
            g = 124;
            b = 116;
          } else {
            const n = R();
            const d = n < 0.06 ? -14 : n < 0.1 ? 7 : Math.floor(R() * 5) - 2;
            r += d;
            g += d;
            b += d;
            if (y === s - 1 || x === s - 1) {
              r -= 6;
              g -= 6;
              b -= 6;
            }
          }
          c.set(x0 + x, y0 + y, r, g, b);
        }
      }
      // A few blades of grass and moss in this stone's joints.
      if (R() < 0.45) {
        const along = R() < 0.5;
        const p = Math.floor(R() * 5) + 1;
        const n = 1 + Math.floor(R() * 3);
        for (let k = 0; k < n; k++) {
          const gx = along ? x0 + p + k : x0;
          const gy = along ? y0 : y0 + p + k;
          const green = R() < 0.5 ? [112, 152, 84] : [90, 132, 72];
          c.set(gx, gy, ...green);
          if (R() < 0.4) c.set(gx + (along ? 0 : 1), gy + (along ? 1 : 0), 128, 168, 94);
        }
      }
    }
  }
  return c.texture();
}

/** Distant city blocks: a pale wall with a grid of windows (1 texel a metre). */
function skylineTextures(R) {
  const c = new Paint(32, 32);
  const e = new Paint(32, 32);
  // Square windows, 2 x 2 texels in a 4 x 4 grid (a floor every 4 m).
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const win = x % 4 >= 1 && x % 4 <= 2 && y % 4 >= 1 && y % 4 <= 2;
      const v = win ? 192 : 238;
      c.set(x, y, v, v, v + (win ? 10 : 0));
      e.set(x, y, 0);
    }
  }
  for (let y = 0; y < 32; y += 4) {
    for (let x = 0; x < 32; x += 4) {
      if (R() > 0.3) continue;
      const v = 150 + Math.floor(R() * 105);
      e.rect(x + 1, y + 1, 2, 2, v, v * 0.92, v * 0.78);
    }
  }
  return { map: c.texture(), emit: e.texture() };
}

/**
 * Foliage atlas, as data, 8 x 8 cells of 16 x 16: r = tone (0 dark rim … 1
 * highlight), g = flower, a = coverage (cells: see CELL in details.js).
 *   cells 0-7    leaf clumps (tree crowns, bushes, climbers)
 *   cells 8-15   grass tufts
 *   cells 16-23  grass tufts with flowers
 *   cells 24-27  trailing plants (hanging from a box)
 */
function foliageAtlas(R) {
  const A = new Paint(128, 128);
  const cell = (i) => [(i % 8) * 16, Math.floor(i / 8) * 16];

  // Leaf clumps: a few overlapping round lobes, lit from the top left, with a
  // dark rim on their lower right and leaf-sized flecks.
  for (let i = 0; i < 8; i++) {
    const [ox, oy] = cell(CELL.leaf + i);
    const lobes = [];
    const n = 3 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) lobes.push([4 + R() * 8, 4 + R() * 8, 2.6 + R() * 2.6]);
    const inside = (x, y) => lobes.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 < r * r);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!inside(x, y) || x === 0 || y === 0 || x === 15 || y === 15) continue;
        // Light from the top left: highest near the lobes' upper-left edges.
        let tone = 0.52 + ((y - 8) / 8) * 0.18 - ((x - 8) / 8) * 0.1;
        if (!inside(x + 1, y - 1)) tone = 0.18; // rim, lower right
        else if (!inside(x - 1, y + 1)) tone += 0.3; // lit edge, upper left
        const n2 = R();
        if (n2 < 0.18) tone -= 0.18;
        else if (n2 < 0.3) tone += 0.16;
        A.set(ox + x, oy + y, Math.max(0, Math.min(255, tone * 255)), 0, 0, 255);
      }
    }
  }

  // Grass tufts (and the same with flowers): blades rising from the bottom,
  // darker at the root.
  const tuft = (i, flowers) => {
    const [ox, oy] = cell(i);
    const blades = 5 + Math.floor(R() * 4);
    for (let b = 0; b < blades; b++) {
      let x = 3 + Math.floor(R() * 10);
      const h = 5 + Math.floor(R() * 10);
      const lean = R() < 0.5 ? -1 : 1;
      for (let y = 0; y < h; y++) {
        if (y > 2 && R() < 0.22) x += lean;
        if (x < 1 || x > 14) break;
        const tone = 0.3 + (y / h) * 0.55 + (R() - 0.5) * 0.1;
        A.set(ox + x, oy + y, tone * 255, 0, 0, 255);
      }
      if (flowers && R() < 0.55) {
        const top = Math.min(14, h);
        A.set(ox + x, oy + top, 200, 255, 0, 255);
        if (R() < 0.5) A.set(ox + x + 1, oy + top, 230, 255, 0, 255);
        if (R() < 0.4) A.set(ox + x, oy + Math.min(15, top + 1), 255, 255, 0, 255);
      }
    }
  };
  for (let i = 0; i < 8; i++) tuft(CELL.grass + i, false);
  for (let i = 0; i < 8; i++) tuft(CELL.flowers + i, true);

  // Trailing plants: strands hanging from the top edge, leaves along them.
  for (let i = 0; i < 4; i++) {
    const [ox, oy] = cell(CELL.trailing + i);
    const strands = 3 + Math.floor(R() * 3);
    for (let s = 0; s < strands; s++) {
      let x = 2 + Math.floor(R() * 12);
      const len = 6 + Math.floor(R() * 9);
      for (let k = 0; k < len; k++) {
        const y = 15 - k;
        if (k > 1 && R() < 0.25) x += R() < 0.5 ? -1 : 1;
        if (x < 1 || x > 14) break;
        A.set(ox + x, oy + y, (0.62 - k * 0.025) * 255, 0, 0, 255);
        if (R() < 0.45) A.set(ox + x + (R() < 0.5 ? -1 : 1), oy + y, 0.4 * 255, 0, 0, 255);
        if (R() < 0.08) A.set(ox + x, oy + y, 220, 255, 0, 255);
      }
    }
  }
  return A.texture({ color: false, nearestMips: true });
}

/* ------------------------------------------------------- surface shader */

const VERT_PARS = /* glsl */ `
  varying vec3 vPxPos;
  varying vec3 vPxNrm;
  varying vec2 vPxUv;
  uniform float uPxInflate; // metres per metre of depth: about half a scene pixel
`;
const VERT_MAIN = /* glsl */ `
  vPxPos = position;
  vPxNrm = normal;
  vPxUv = uv;
  #ifdef PX_INFLATE
    // Thin parts (railings, mullions) swell to about a pixel, so they draw as
    // unbroken lines instead of dashes.
    vec4 pxMv = modelViewMatrix * vec4(transformed, 1.0);
    transformed += normalize(normal) * (-pxMv.z) * uPxInflate;
  #endif
`;
const FRAG_PARS = /* glsl */ `
  varying vec3 vPxPos;
  varying vec3 vPxNrm;
  varying vec2 vPxUv;
  uniform sampler2D uPxSide;
  uniform sampler2D uPxTop;
  uniform sampler2D uPxBottom;
  uniform sampler2D uPxEmit;
  uniform vec2 uPxSideS; // repeats per metre (texels per metre / texture size)
  uniform vec2 uPxTopS;
  uniform vec2 uPxBottomS;
  uniform vec3 uPxFrame; // glazing: frame colour
  uniform vec3 uPxRefl;  // glazing: what the sky adds where it is reflected
  uniform float uPxGrime; // walls: darker towards the ground
`;
// Replaces <map_fragment>: the texture by the face's axis in the object's own
// frame (box faces are axis-aligned in a building's frame).
const FRAG_MAP = /* glsl */ `
  vec3 pxN = normalize(vPxNrm);
  vec3 pxA = abs(pxN);
  float pxFlat = step(pxA.x, pxA.y) * step(pxA.z, pxA.y);
  float pxOnX = (1.0 - pxFlat) * step(pxA.z, pxA.x);
  vec2 pxSideUv = mix(vPxPos.xy, vPxPos.zy, pxOnX);
  #ifdef PX_UV
    pxSideUv = vPxUv; // (uv already in metres, e.g. the skyline's turned blocks)
  #endif
  vec4 pxS = texture2D(uPxSide, pxSideUv * uPxSideS);
  float pxLit = 1.0;
  #ifdef PX_GLASS
    // One pixel of shadow round each pane's edge, one of frame inside it
    // (in screen pixels, from the face's own 0..1 uv), and the mullions.
    vec2 pxFw = max(fwidth(vPxUv), vec2(1e-5));
    vec2 pxEd = min(vPxUv, 1.0 - vPxUv) / pxFw;
    float pxE = min(pxEd.x, pxEd.y);
    float pxSide = 1.0 - pxFlat;
    float pxRim = pxSide * step(pxE, 1.0);
    float pxFr = max(pxS.r, pxSide * step(pxE, 2.0)) * (1.0 - pxRim);
    diffuseColor.rgb += pxS.g * uPxRefl * (1.0 - pxFr);
    diffuseColor.rgb = mix(diffuseColor.rgb, uPxFrame, pxFr);
    diffuseColor.rgb *= 1.0 - 0.6 * pxRim;
    pxLit = pxS.b * (1.0 - max(pxFr, pxRim));
  #else
    vec4 pxHi = texture2D(uPxTop, vPxPos.xz * uPxTopS);
    vec4 pxLo = texture2D(uPxBottom, vPxPos.xz * uPxBottomS);
    diffuseColor *= mix(pxS, mix(pxLo, pxHi, step(0.0, pxN.y)), pxFlat);
    diffuseColor.rgb *= 1.0 - uPxGrime * (1.0 - pxFlat) * (1.0 - smoothstep(0.0, 1.8, vPxPos.y));
  #endif
`;
const FRAG_EMIT = /* glsl */ `
  #if defined(PX_GLASS)
    totalEmissiveRadiance *= pxLit;
  #elif defined(PX_EMIT_SIDE)
    totalEmissiveRadiance *= pxS.rgb;
  #elif defined(PX_EMIT_MAP)
    totalEmissiveRadiance *= texture2D(uPxEmit, pxSideUv * uPxSideS).rgb;
  #endif
`;

// Shared: set from the camera and the scene's pixel size (PixelArt.update).
const INFLATE = { value: 0 };

/**
 * Paints a MeshStandardMaterial's surfaces with textures mapped by the face's
 * axis in the object's own frame (in place). side/top/bottom: { tex, w, h }
 * (e.g. from Paint.texture()); density: texels per metre.
 */
export function patchSurface(m, { side, top = side, bottom = top, density = 6, topDensity = density, defines = {}, emit = null, grime = 0 }) {
  const scale = (t, d) => new THREE.Vector2(d / t.w, d / t.h);
  const uni = {
    uPxSide: { value: side.tex },
    uPxTop: { value: top.tex },
    uPxBottom: { value: bottom.tex },
    uPxEmit: { value: (emit || side).tex },
    uPxSideS: { value: scale(side, density) },
    uPxTopS: { value: scale(top, topDensity) },
    uPxBottomS: { value: scale(bottom, topDensity) },
    uPxFrame: { value: new THREE.Color(1, 1, 1) },
    uPxRefl: { value: new THREE.Color(0, 0, 0) },
    uPxGrime: { value: grime },
    uPxInflate: INFLATE,
  };
  m.defines = { ...(m.defines || {}), ...defines };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${VERT_PARS}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <map_fragment>', FRAG_MAP)
      .replace('#include <emissivemap_fragment>', FRAG_EMIT);
  };
  const key = `px:${Object.keys(defines).join(',')}`;
  m.customProgramCacheKey = () => key;
  m.pxUniforms = uni; // (not in userData: clone() would deep-copy the textures)
  return m;
}

/** A pixel-art twin of a MeshStandardMaterial: the same lighting, painted surfaces. */
function surface(base, opts) {
  return patchSurface(base.clone(), opts);
}

/* ------------------------------------------------------------- foliage */

const FOLIAGE_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec2 aSize;
  attribute float aCell;
  attribute vec3 aNrm;
  attribute vec3 aTint;
  attribute vec3 aFlower;
  attribute float aKind; // 0 clump (centred), 1 tuft (stands on aPos), 2 trailing (hangs from aPos)
  uniform float uTime;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vTint;
  varying vec3 vFlower;
  varying float vLit;
  varying vec3 vVP;
  #include <fog_pars_vertex>
  void main() {
    vec2 q = position.xy;
    float tip = q.y + 0.5; // 0 at the bottom of the card, 1 at the top
    if (aKind > 0.5 && aKind < 1.5) q.y += 0.5;
    else if (aKind > 1.5) { q.y -= 0.5; tip = 0.5 - position.y; }
    // Wind: tufts and strands sway from their fixed end, clumps barely.
    float w = sin(uTime * 1.7 + aPos.x * 0.9 + aPos.z * 0.7) + 0.5 * sin(uTime * 2.9 + aPos.z * 1.3);
    float amp = aKind > 0.5 ? 0.08 * tip : 0.02;
    vec4 mvPosition = viewMatrix * vec4(aPos, 1.0);
    mvPosition.xy += (q + vec2(w * amp, 0.0)) * aSize;
    gl_Position = projectionMatrix * mvPosition;
    vec2 cell = vec2(mod(aCell, 8.0), floor(aCell / 8.0));
    vUv = (cell + (0.5 + uv * 15.0) / 16.0) / 8.0;
    vTint = aTint;
    vFlower = aFlower;
    vLit = dot(normalize(aNrm), uSunDir);
    vVP = mvPosition.xyz;
    #include <fog_vertex>
  }
`;
const FOLIAGE_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uLeaf;
  uniform float uNight;
  uniform vec3 uNightTint;
  varying vec2 vUv;
  varying vec3 vTint;
  varying vec3 vFlower;
  varying float vLit;
  varying vec3 vVP;
  #include <fog_pars_fragment>
  void main() {
    vec4 t = texture2D(uAtlas, vUv);
    if (t.a < 0.5) discard;
    // Three flat tones: shade, body, light (the clump's side towards the sun
    // and the texture's own tone together).
    float v = (vLit * 0.5 + 0.5) * 0.62 + (t.r - 0.5) * 1.15 + 0.24;
    vec3 base = uLeaf * vTint * 1.12;
    vec3 col = v < 0.36 ? base * vec3(0.5, 0.56, 0.72) : v < 0.68 ? base : base * vec3(1.55, 1.5, 1.08) + vec3(0.03, 0.035, 0.0);
    if (t.g > 0.5) col = vFlower * (v < 0.36 ? 0.62 : 1.0);
    col *= mix(vec3(1.0), uNightTint, uNight);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;
// The same cards in the normal/depth pass: marked as foliage (normal z = -1)
// so they are outlined against what stands behind them but not clump by clump.
const FOLIAGE_ND_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying vec3 vVP;
  void main() {
    if (texture2D(uAtlas, vUv).a < 0.5) discard;
    gl_FragColor = vec4(0.5, 0.5, 0.0, 1.0 / max(-vVP.z, 0.01));
  }
`;

/** Collects foliage cards, then builds them into one instanced draw. */
export class Foliage {
  constructor() {
    this.items = [];
  }

  /**
   * p: world position; size: [w, h] in metres; cell: atlas cell; kind: 0 clump,
   * 1 tuft, 2 trailing; nrm: which way the card's bit of the plant faces (for
   * its light); tint: multiplies the leaf colour; flower: colour of its flowers.
   */
  add(p, size, cell, { kind = 0, nrm = [0, 1, 0], tint = [1, 1, 1], flower = [1, 0.6, 0.7] } = {}) {
    this.items.push({ p, size, cell, kind, nrm, tint, flower });
  }

  build(atlas) {
    const n = this.items.length;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    g.setAttribute('uv', base.getAttribute('uv'));
    const arr = (k) => new Float32Array(n * k);
    const A = { aPos: arr(3), aSize: arr(2), aCell: arr(1), aNrm: arr(3), aTint: arr(3), aFlower: arr(3), aKind: arr(1) };
    const lin = new THREE.Color();
    this.items.forEach((it, i) => {
      A.aPos.set(it.p, i * 3);
      A.aSize.set(it.size, i * 2);
      A.aCell[i] = it.cell;
      A.aNrm.set(it.nrm, i * 3);
      A.aTint.set(it.tint, i * 3);
      lin.setRGB(...it.flower, THREE.SRGBColorSpace);
      A.aFlower.set([lin.r, lin.g, lin.b], i * 3);
      A.aKind[i] = it.kind;
    });
    for (const [k, v] of Object.entries(A)) g.setAttribute(k, new THREE.InstancedBufferAttribute(v, v.length / n));
    g.instanceCount = n;

    this.uniforms = {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uAtlas: { value: atlas.tex },
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uLeaf: { value: new THREE.Color(0x3c6e57) },
      uNight: { value: 0 },
      uNightTint: { value: new THREE.Color(0.2, 0.24, 0.42) },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: FOLIAGE_VERT, fragmentShader: FOLIAGE_FRAG, uniforms: this.uniforms, fog: true, side: THREE.DoubleSide });
    this.ndMat = new THREE.ShaderMaterial({ vertexShader: FOLIAGE_VERT, fragmentShader: FOLIAGE_ND_FRAG, uniforms: this.uniforms, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; // (cards all over the plaza; one draw)
    this.mesh.userData.foliage = this;
    return this.mesh;
  }
}

/* --------------------------------------------------- normal/depth pass */

// View-space normal (from the screen-space slope of the surface: flat faces,
// whatever the mesh's own normals) and 1 / depth, for the edge detection in
// the final pass.
const ND_VERT = /* glsl */ `
  #include <common>
  varying vec3 vVP;
  void main() {
    #include <begin_vertex>
    #include <project_vertex>
    vVP = mvPosition.xyz;
  }
`;
const ND_FRAG = /* glsl */ `
  varying vec3 vVP;
  void main() {
    vec3 n = normalize(cross(dFdx(vVP), dFdy(vVP)));
    gl_FragColor = vec4(n * 0.5 + 0.5, 1.0 / max(-vVP.z, 0.01));
  }
`;

/**
 * Edges, read in the final pass from the normal/depth target (one texel per
 * scene pixel). Returns (outline, light edge, crease):
 *   outline     the near side of a silhouette: where this pixel stands out
 *               from its neighbours (1/depth is linear across a plane, so its
 *               second difference is ~0 on any flat face, however oblique)
 *   light edge  a convex corner, on the side that faces up / the viewer
 *   crease      a concave corner (a little contact shade)
 */
export const EDGES_GLSL = /* glsl */ `
  uniform sampler2D tND;
  uniform vec2 uNDRes;
  vec3 pxNormal(vec4 s) { return normalize(s.rgb * 2.0 - 1.0); }
  bool pxLeaf(vec4 s) { return s.b < 0.25 && s.a > 0.0; }
  vec3 pxEdges(vec2 uv) {
    vec2 px = 1.0 / uNDRes;
    vec4 c = texture2D(tND, uv);
    if (c.a <= 0.0) return vec3(0.0); // sky
    vec4 s0 = texture2D(tND, uv - vec2(px.x, 0.0));
    vec4 s1 = texture2D(tND, uv + vec2(px.x, 0.0));
    vec4 s2 = texture2D(tND, uv - vec2(0.0, px.y));
    vec4 s3 = texture2D(tND, uv + vec2(0.0, px.y));
    float w = c.a;
    float fade = smoothstep(1.0 / 260.0, 1.0 / 130.0, w); // none in the distance
    if (pxLeaf(c)) {
      // Foliage: outlined only against what is behind it (not clump by clump).
      float o = 0.0;
      if (!pxLeaf(s0) && w - s0.a > 0.05 * w) o = 1.0;
      if (!pxLeaf(s1) && w - s1.a > 0.05 * w) o = 1.0;
      if (!pxLeaf(s2) && w - s2.a > 0.05 * w) o = 1.0;
      if (!pxLeaf(s3) && w - s3.a > 0.05 * w) o = 1.0;
      return vec3(o * fade * 0.8, 0.0, 0.0);
    }
    float lx = 2.0 * w - s0.a - s1.a;
    float ly = 2.0 * w - s2.a - s3.a;
    float outline = step(0.035 * w, max(lx, ly));
    vec3 n = pxNormal(c);
    float hi = 0.0;
    float crease = 0.0;
    vec3 bias = vec3(-0.3, 0.85, 0.45);
    for (int i = 0; i < 4; i++) {
      vec4 s = i == 0 ? s0 : i == 1 ? s1 : i == 2 ? s2 : s3;
      if (s.a <= 0.0 || pxLeaf(s)) continue;
      vec3 m = pxNormal(s);
      if (1.0 - dot(n, m) < 0.12) continue;
      float lap = i < 2 ? lx : ly;
      if (lap > -0.004 * w) { if (dot(n - m, bias) > 0.0) hi = 1.0; }
      else crease = 1.0;
    }
    return vec3(outline, hi * (1.0 - outline), crease * (1.0 - outline)) * fade;
  }
`;

/* ----------------------------------------------------------------- main */

export class PixelArt {
  constructor(world) {
    this.world = world;
    this.built = false;
    this.on = false;
  }

  build() {
    const w = this.world;
    const m = w.mats;
    const R = rng(20261118);
    const wall = wallTexture(R);
    const trim = trimTexture(R);
    const roof = roofTexture(R);
    const soffit = soffitTexture();
    const concrete = concreteTexture(R);
    const glass = glassTexture(R);
    const interior = interiorTexture(R);
    const sky = skylineTextures(R);
    this.atlas = foliageAtlas(R);

    // Twins of the shared materials (others, like metal or the light strips,
    // stay as they are: they are small, or lights).
    const t = (this.twins = {
      white: surface(m.white, { side: wall, top: roof, bottom: soffit, grime: 0.2 }),
      whiteShade: surface(m.whiteShade, { side: trim, top: roof, bottom: soffit, grime: 0.12 }),
      concrete: surface(m.concrete, { side: concrete }),
      glass: surface(m.glass, { side: glass, defines: { PX_GLASS: '' } }),
      glassDark: surface(m.glassDark, { side: glass, defines: { PX_GLASS: '' } }),
      warm: surface(m.warm, { side: interior, density: 8, defines: { PX_EMIT_SIDE: '' } }),
      metal: surface(m.metal, { side: trim, defines: { PX_INFLATE: '' } }),
    });
    for (const g of [t.glass, t.glassDark]) {
      g.metalness = 0;
      g.roughness = 0.5;
    }
    t.warm.roughness = 0.9;
    // The warm interiors' colour comes from the texture (tinted a little by the palette's).
    t.warm.userData.tint = 0.35;
    // Distant blocks: window grids that light up at night.
    this.skylineMat = surface(m.whiteShade, { side: sky.map, top: roof, emit: sky.emit, density: 1, topDensity: 2, defines: { PX_EMIT_MAP: '', PX_UV: '' } });
    this.skylineMat.emissive = new THREE.Color(0xffd9a8);
    // Materials only the pixel-art details use.
    this.extra = {
      wood: new THREE.MeshStandardMaterial({ color: 0xa8744e, roughness: 0.9 }),
      pot: new THREE.MeshStandardMaterial({ color: 0xc8714f, roughness: 0.9 }),
      soil: new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 1 }),
      white: t.white,
      whiteShade: t.whiteShade,
      concrete: t.concrete,
      metal: t.metal,
      trunk: m.trunk,
      bush: m.bush,
      flower: m.flower,
      orange: m.orange,
    };
    this.extra.wood = surface(this.extra.wood, { side: concrete });
    this.extra.pot = surface(this.extra.pot, { side: trim });

    // The paving.
    const paving = pavingTexture(R);
    paving.tex.repeat.set(75, 75); // (the ground plane is 1200 m: 16 m a tile)
    paving.tex.anisotropy = 8;
    this.groundMat = new THREE.MeshStandardMaterial({ map: paving.tex, roughness: 0.96, metalness: 0 });

    // Tree crowns are drawn as foliage cards; the round crowns stay only to cast shadows.
    this.shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

    this.swap = new Map([
      [m.white, t.white],
      [m.whiteShade, t.whiteShade],
      [m.concrete, t.concrete],
      [m.glass, t.glass],
      [m.glassDark, t.glassDark],
      [m.warm, t.warm],
      [m.metal, t.metal],
      [m.leaf, this.shadowOnly],
    ]);

    // Foliage: every tree's crown, plus the details of each page.
    const foliage = (this.foliage = new Foliage());
    this.groups = [];
    w.scene.updateMatrixWorld(true);
    w.scene.traverse((o) => {
      if (o.userData.tree) this.crown(o, foliage, R);
    });
    for (const site of w.sites) {
      const g = buildDetails(site, 'pixel', { R, mats: this.extra, foliage });
      if (g) {
        site.group.add(g);
        this.groups.push(g);
      }
    }
    w.scene.add(foliage.build(this.atlas));
    this.groups.push(foliage.mesh);

    this.ndMat = new THREE.ShaderMaterial({ vertexShader: ND_VERT, fragmentShader: ND_FRAG, side: THREE.DoubleSide });
    this.built = true;
  }

  /** Foliage cards over a tree's round crown (see createTree), and a few branches. */
  crown(tree, foliage, R) {
    const { blobs } = tree.userData.tree;
    const mw = tree.matrixWorld;
    const s = tree.getWorldScale(new THREE.Vector3()).x;
    const centre = new THREE.Vector3();
    for (const b of blobs) centre.add(new THREE.Vector3(b.x, b.y, b.z));
    centre.multiplyScalar(1 / blobs.length).applyMatrix4(mw);
    const p = new THREE.Vector3();
    const c = new THREE.Vector3();
    const n = new THREE.Vector3();
    const toCentre = new THREE.Vector3();
    for (const b of blobs) {
      c.set(b.x, b.y, b.z).applyMatrix4(mw);
      const r = b.r * s;
      const count = Math.round(5 + r * r * 2.4);
      for (let i = 0; i < count; i++) {
        // Points spread evenly over the lobe (a Fibonacci sphere), the lower ones left out.
        const y = 1 - ((i + 0.5) / count) * 2;
        if (y < -0.45) continue;
        const rr = Math.sqrt(1 - y * y);
        const a = i * 2.39996 + R() * 0.4;
        n.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
        p.copy(c).addScaledVector(n, r * (0.72 + R() * 0.2));
        toCentre.copy(p).sub(centre).normalize();
        n.lerp(toCentre, 0.45).normalize();
        const size = (1.25 + R() * 0.5) * s;
        foliage.add(p.toArray(), [size, size], CELL.leaf + Math.floor(R() * 8), { nrm: n.toArray(), tint: [0.92 + R() * 0.16, 0.95 + R() * 0.1, 0.9 + R() * 0.12] });
      }
    }
  }

  setEnabled(on) {
    if (on && !this.built) this.build();
    if (!this.built) return;
    this.on = on;
    const w = this.world;
    w.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (on) {
        const twin = this.swap.get(o.material);
        if (twin) {
          o.userData.flatMat = o.material;
          o.material = twin;
        }
      } else if (o.userData.flatMat) {
        o.material = o.userData.flatMat;
        delete o.userData.flatMat;
      }
    });
    if (on) {
      w.ground.userData.flatMat = w.ground.material;
      w.ground.material = this.groundMat;
      w.skyline.userData.flatMat ||= w.skyline.material;
      w.skyline.material = this.skylineMat;
    } else {
      if (w.ground.userData.flatMat) w.ground.material = w.ground.userData.flatMat;
      if (w.skyline.userData.flatMat) w.skyline.material = w.skyline.userData.flatMat;
    }
    for (const g of this.groups) g.visible = on;
  }

  /** Per render pass (the time of day of that pass): colours follow the flat materials. */
  applyTime(n) {
    if (!this.on) return;
    const w = this.world;
    const m = w.mats;
    for (const [key, twin] of Object.entries(this.twins)) {
      const flat = m[key];
      twin.color.copy(flat.color);
      if (twin.userData.tint !== undefined) twin.color.lerp(WHITE, 1 - twin.userData.tint);
      twin.emissive.copy(flat.emissive);
      twin.emissiveIntensity = flat.emissiveIntensity;
    }
    // Frames in the facade's own colour; the sky's blue in the panes by day.
    for (const g of [this.twins.glass, this.twins.glassDark]) {
      g.pxUniforms.uPxFrame.value.copy(m.white.color).multiplyScalar(0.92);
      g.pxUniforms.uPxRefl.value.copy(w.fog.color).multiplyScalar(0.3 * (1 - n));
    }
    this.skylineMat.color.copy(m.whiteShade.color);
    this.skylineMat.emissive.copy(m.glass.emissive);
    this.skylineMat.emissiveIntensity = n * 1.1;
    const u = this.foliage.uniforms;
    u.uLeaf.value.copy(m.leaf.color);
    u.uNight.value = n;
  }

  /** Once a frame. */
  update(time) {
    if (!this.on) return;
    const w = this.world;
    const u = this.foliage.uniforms;
    u.uTime.value = time;
    const cam = w.camera;
    INFLATE.value = (0.55 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * 2) / w.rtSize.y;
    u.uSunDir.value.copy(w.sun.position).sub(w.sun.target.position).normalize();
  }

  /** Normal/depth pass into rt (the scene's small size). */
  renderND(renderer, scene, camera, rt) {
    const hidden = [];
    scene.traverse((o) => {
      if (!o.visible || !(o.isMesh || o.isLine || o.isPoints)) return;
      if (!o.layers.test(camera.layers)) return;
      const mat = o.material;
      if (mat.isShaderMaterial || mat === this.shadowOnly || o.userData.foliage) {
        o.visible = false;
        hidden.push(o);
      }
    });
    scene.overrideMaterial = this.ndMat;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    for (const o of hidden) o.visible = true;
    // The foliage cards, cut out by their own alpha.
    const mesh = this.foliage.mesh;
    const mat = mesh.material;
    mesh.material = this.foliage.ndMat;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(mesh, camera);
    renderer.autoClear = autoClear;
    mesh.material = mat;
  }
}

const WHITE = new THREE.Color(1, 1, 1);
