import * as THREE from 'three';

/**
 * Text that lives *inside* the 3D world: drawn to a canvas with the site's web
 * fonts, then mapped onto a plane. Because it is real geometry it gets
 * perspective, occlusion (the lamp pole passes in front of it) and it turns a
 * different colour wherever it sits inside the lamp's beam on screen — the
 * signature trick of the reference poster. Where it changes colour comes from
 * the reveal mask (MASK below).
 */
/**
 * Shared uniforms for the reveal mask (see devices.js): a screen-sized texture
 * that is white wherever the scene shows the opposite time of day. Letters
 * inside it switch colour. World keeps these values up to date.
 */
export const MASK = {
  tMask: { value: null },
  uMaskRes: { value: new THREE.Vector2(1, 1) },
};

export const MASK_GLSL = /* glsl */ `
  uniform sampler2D tMask;
  uniform vec2 uMaskRes;
  float beamCoverage(vec2 p) {
    return clamp(texture2D(tMask, p / uMaskRes).r, 0.0, 1.0);
  }
`;

export const FONTS = {
  display: { family: '"Anton", "Oswald", Impact, sans-serif', weight: 400, lh: 1.08, pad: 0.18 },
  caps: { family: '"Oswald", "Anton", sans-serif', weight: 600, lh: 1.25, pad: 0.2, spacing: 0.08 },
  cn: { family: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", sans-serif', weight: 900, lh: 1.2, pad: 0.2 },
  script: { family: '"Great Vibes", cursive', weight: 400, lh: 1.25, pad: 0.45 },
};

export async function loadFonts(texts) {
  if (!document.fonts) return;
  const jobs = [];
  for (const [key, f] of Object.entries(FONTS)) {
    const sample = texts.filter((t) => t.f === key).map((t) => t.t).join('') || 'A';
    jobs.push(document.fonts.load(`${f.weight} 64px ${f.family}`, sample).catch(() => {}));
  }
  await Promise.all(jobs);
}

function drawText(text, fontKey, align = 'left', tracking, minPad = 0) {
  // (tracking: letter spacing in em, instead of the font's own;
  //  minPad: room round the letters in em, e.g. for a tag behind them)
  const f = { ...FONTS[fontKey], spacing: tracking ?? FONTS[fontKey].spacing };
  f.pad = Math.max(f.pad, minPad);
  const px = 200;
  const lines = String(text).split('\n');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `${f.weight} ${px}px ${f.family}`;
  ctx.font = font;
  if (f.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${f.spacing * px}px`;
  const widths = lines.map((l) => ctx.measureText(l).width);
  const pad = px * f.pad;
  const lineH = px * f.lh;
  const w = Math.ceil(Math.max(...widths) + pad * 2);
  const h = Math.ceil(lineH * lines.length + pad * 2);
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  if (f.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${f.spacing * px}px`;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  // ink: the letters' own bounds in canvas pixels (for a tag fitted round them)
  const ink = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  lines.forEach((l, i) => {
    let x = pad;
    if (align === 'center') x = (w - widths[i]) / 2;
    if (align === 'right') x = w - pad - widths[i];
    const y = pad + lineH * (i + 0.5);
    ctx.fillText(l, x, y);
    const m = ctx.measureText(l);
    ink.x0 = Math.min(ink.x0, x - m.actualBoundingBoxLeft);
    ink.x1 = Math.max(ink.x1, x + m.actualBoundingBoxRight);
    ink.y0 = Math.min(ink.y0, y - m.actualBoundingBoxAscent);
    ink.y1 = Math.max(ink.y1, y + m.actualBoundingBoxDescent);
  });
  return { canvas, px, w, h, pad, ink };
}

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uIn;
  uniform vec3 uOut;
  uniform float uOpacity;
  uniform vec2 uHalo; // light-box halo: x outside the beam, y inside it
  uniform vec3 uHaloCol;
  uniform vec4 uTag; // a tag behind the letters: its rectangle in uv (none when empty)
  uniform vec3 uTagCol;
  varying vec2 vUv;
  ${MASK_GLSL}
  void main() {
    float cov = beamCoverage(gl_FragCoord.xy);
    float a = texture2D(map, vUv).a;
    // (premultiplied: the letters cover what is behind them, the halo adds light)
    vec3 c = mix(uOut, uIn, cov) * a;
    float glow = mix(uHalo.x, uHalo.y, cov);
    if (glow > 0.0) {
      // Blurred copies of the letters (coarse mip levels) make a soft glow
      // in the sign's colour round the lit letters.
      // (kept well below the letters' own brightness: a strong glow filled
      // the gaps between them and the lettering read as smudged)
      float h = textureLod(map, vUv, 4.5).a * 0.5 + textureLod(map, vUv, 6.0).a * 0.5;
      c += uHaloCol * clamp(h, 0.0, 1.0) * 0.5 * glow * (1.0 - a);
    }
    if (uTag.z > uTag.x) {
      // (edges anti-aliased over one pixel)
      vec2 d = min(vUv - uTag.xy, uTag.zw - vUv) / fwidth(vUv);
      float t = clamp(min(d.x, d.y) + 0.5, 0.0, 1.0);
      c += uTagCol * t * (1.0 - a);
      a += t * (1.0 - a);
    }
    c *= uOpacity;
    a *= uOpacity;
    if (max(a, max(c.r, max(c.g, c.b))) < 0.004) discard;
    gl_FragColor = vec4(c, a);
  }
`;

// Day/night colour pairs (linear, so values above 1 bloom a little at night).
// (Shared objects: setTextColors() changes them in place for a colour scheme.)
const ORANGE = new THREE.Color(0xff7d10);
const NAVY = new THREE.Color(0x0d1f3c);
const WHITE = new THREE.Color(0xffffff);
const CREAM = new THREE.Color(0xfff0d8);
const SIGN = new THREE.Color(0xff7d10); // a lit sign: the accent, brightened when lit
const PALETTE = {
  // By day the beam is night, so letters inside it are white; by night the
  // beam is daylight, so letters inside it turn navy.
  cone: { dayIn: WHITE, dayOut: ORANGE, nightIn: NAVY, nightOut: ORANGE },
  orange: { dayIn: ORANGE, dayOut: ORANGE, nightIn: ORANGE, nightOut: ORANGE },
  white: { dayIn: WHITE, dayOut: WHITE, nightIn: ORANGE, nightOut: ORANGE },
  // Script lettering: orange where the big letters are white (inside the beam), white elsewhere.
  inverse: { dayIn: ORANGE, dayOut: WHITE, nightIn: ORANGE, nightOut: CREAM },
  // Ink: the scheme's dark ink by day, cream by night (and swapped inside the beam).
  ink: { dayIn: WHITE, dayOut: NAVY, nightIn: NAVY, nightOut: CREAM },
  // Facade signs are light boxes: accent by day, lit (brighter, with a halo)
  // wherever it is night, i.e. outside the reveal at night and inside it by day.
  sign: { dayIn: SIGN, dayOut: ORANGE, nightIn: ORANGE, nightOut: SIGN },
  // Motto: ink outside the beam, accent inside it, so that where it crosses
  // the title's letters it never takes their colour (they are white/navy there).
  motto: { dayIn: ORANGE, dayOut: NAVY, nightIn: ORANGE, nightOut: CREAM },
  // White letters on a red tag (see spec.tag).
  tag: { dayIn: WHITE, dayOut: WHITE, nightIn: CREAM, nightOut: CREAM },
};

/** Lettering colours for a colour scheme (see palettes.js). */
export function setTextColors({ accent, ink, light, cream }) {
  ORANGE.set(accent);
  NAVY.set(ink);
  WHITE.set(light);
  CREAM.set(cream);
  // (barely lighter: mixing in linear light, a little white already turns
  // the accent pink and the lit letters read pale instead of vivid)
  SIGN.set(accent).lerp(WHITE, 0.03);
}

export class TextBlock {
  /**
   * @param {object} spec  { t, f, s, p:[x,y,z], r:[x,y,z], c, align }
   */
  constructor(spec, maxAniso = 8) {
    // spec.tag { padX, padY } (em): a red tag round the letters, drawn with them
    const tag = spec.tag && { padX: 0.45, padY: 0.25, ...spec.tag };
    const { canvas, px, w, h, pad: padPx, ink } = drawText(spec.t, spec.f, spec.align, spec.tracking, tag ? tag.padX + 0.1 : 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = maxAniso;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.spec = spec;
    this.palette = PALETTE[spec.c || 'cone'];
    this.glow = spec.c === 'orange' || spec.c === 'cone' ? 1.35 : 1.0;
    const scale = spec.s / px; // spec.s = font size in metres
    const pad = padPx;
    this.glyphWidth = (w - 2 * pad) * scale;
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        map: { value: tex },
        uIn: { value: new THREE.Color() },
        uOut: { value: new THREE.Color() },
        uOpacity: { value: 0 },
        uHalo: { value: new THREE.Vector2() },
        uHaloCol: { value: new THREE.Color() },
        uTag: { value: new THREE.Vector4(0, 0, 0, 0) },
        uTagCol: { value: new THREE.Color() },
        tMask: MASK.tMask,
        uMaskRes: MASK.uMaskRes,
      },
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    if (spec.c === 'sign') {
      // Signs also leave their letters' coverage in the frame's alpha
      // (alpha = 1 - coverage): the final pass lays less of the night glow
      // over the letters there, so nearby strip lights don't wash them pale.
      const m = this.material;
      m.blending = THREE.CustomBlending;
      m.blendSrc = THREE.OneFactor;
      m.blendDst = THREE.OneMinusSrcAlphaFactor;
      m.blendSrcAlpha = THREE.ZeroFactor;
      m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
    }
    if (tag) {
      const x0 = ink.x0 - tag.padX * px;
      const x1 = ink.x1 + tag.padX * px;
      const y0 = ink.y0 - tag.padY * px;
      const y1 = ink.y1 + tag.padY * px;
      this.material.uniforms.uTag.value.set(x0 / w, 1 - y1 / h, x1 / w, 1 - y0 / h);
    }
    const geo = new THREE.PlaneGeometry(w * scale, h * scale, spec.bend ? 64 : 1, 1);
    // anchor: which point of the glyph run sits at spec.p
    const shift = (w * scale) / 2 - pad * scale;
    if (spec.anchor === 'left') geo.translate(shift, 0, 0);
    if (spec.anchor === 'right') geo.translate(-shift, 0, 0);
    if (spec.bend) {
      // Wrapped round a cylinder of this radius whose axis is spec.p:
      // the middle of the line faces +z (turned by spec.r).
      const R = spec.bend;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const a = pos.getX(i) / R;
        pos.setXYZ(i, Math.sin(a) * R, pos.getY(i), Math.cos(a) * R);
      }
      geo.computeVertexNormals();
    }
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(...spec.p);
    if (spec.r) this.mesh.rotation.set(...spec.r);
    this.mesh.renderOrder = 6;
  }

  update(night, opacity) {
    const u = this.material.uniforms;
    const p = this.palette;
    u.uIn.value.copy(p.dayIn).lerp(p.nightIn, night);
    u.uOut.value.copy(p.dayOut).lerp(p.nightOut, night);
    if (this.spec.c === 'sign') {
      // Lit where it is night: brighter letters (much more washes the
      // colour out in the tone mapping) in a glow of the accent colour.
      const lit = 1.3;
      u.uOut.value.multiplyScalar(1 + (lit - 1) * night);
      u.uIn.value.multiplyScalar(1 + (lit - 1) * (1 - night));
      u.uHalo.value.set(night, 1 - night);
      u.uHaloCol.value.copy(ORANGE);
    } else if (night > 0) {
      const k = 1 + (this.glow - 1) * night;
      u.uOut.value.multiplyScalar(k);
    }
    // A tag is the title's own colour, glowing with it at night like the
    // title letters (see 'cone' and glow).
    if (this.spec.tag) u.uTagCol.value.copy(ORANGE).multiplyScalar(1 + 0.35 * night);
    u.uOpacity.value = opacity;
    this.mesh.visible = opacity > 0.003;
  }
}

/**
 * The poster's title stack, laid out from measured glyph widths:
 *
 *        CLEFT IN THE DAY
 *   思域 ················ OF REASON
 *   T E R R I T O R Y
 *        ~ script lettering across ~
 */
export function buildCluster(c, aniso) {
  const group = new THREE.Group();
  group.position.set(...c.p);
  group.rotation.set(...(c.r || [0, 0, 0]));
  const S = c.size;
  const blocks = [];
  const add = (spec) => {
    const b = new TextBlock(spec, aniso);
    group.add(b.mesh);
    blocks.push(b);
    return b;
  };
  const title = add({ t: c.title, f: 'display', s: S, p: [0, 0, 0], c: 'cone' });
  const half = title.glyphWidth / 2;
  const cap = S * 0.74; // Anton cap height
  const rowY = cap / 2 + S * 0.5;
  if (c.layout === 'name') {
    // The site's name (home page): "Jeu de" in script leads into the big
    // title like a signature, the Chinese name sits top right, a caption
    // line top left.
    if (c.script) add({ t: c.script, f: 'script', s: S * 0.72, p: [-half - S * 0.05, rowY * 0.8, 0.3], r: [0, 0, 0.12], anchor: 'left', c: c.scriptColor || 'ink' });
    // (cnShift: how far left of the title's right end the Chinese name ends,
    // in title sizes; keeps it clear of whatever stands in front, e.g. a lamp)
    if (c.cn) add({ t: c.cn, f: 'cn', s: S * (c.cnSize ?? 0.62), p: [half - S * (c.cnShift ?? 0), rowY + S * 0.24, 0.05], anchor: 'right', c: 'cone' });
    // A motto in script under the title, in the same ink as "Jeu de" and
    // right-aligned with the Chinese name above it: the two script lines
    // frame the title on a diagonal.
    if (c.decor) {
      // Tilted like "Jeu de" (the two run parallel); it starts just below the
      // title and rises across the foot of its last letters.
      const d = add({ t: c.decor, f: 'script', s: S * 0.36, p: [half - S * (c.cnShift ?? 0), -cap * 0.3, 0.3], r: [0, 0, 0.11], anchor: 'right', c: 'motto' });
      d.mesh.renderOrder = 6.5; // over the title letters (sorting by distance put it under), before the lamp (7)
    }
    // caption under the title (above it would meet the header)
    // (capsSize / capsTracking: a short line, such as an address, reads
    // better a little larger and more widely spaced)
    // (capsTag: white letters on a tag in the title's colour, its left edge in line with the title's)
    const cs = S * (c.capsSize ?? 0.16);
    const tag = c.capsTag ? { padX: 0.42, padY: 0.26 } : null;
    const x = tag ? -half + S * 0.09 + tag.padX * cs : -half + S * 0.08;
    if (c.caps) add({ t: c.caps, f: 'caps', s: cs, tracking: c.capsTracking, tag, p: [x, -cap / 2 - S * 0.2 - cs * 0.5, 0.05], anchor: 'left', c: tag ? 'tag' : 'cone' });
    return { group, blocks };
  }
  if (c.cn) add({ t: c.cn, f: 'cn', s: S * 0.56, p: [-half + S * 0.02, rowY + S * 0.06, 0.05], anchor: 'left', c: 'cone' });
  if (c.of) add({ t: c.of, f: 'display', s: S * 0.46, p: [half, rowY - S * 0.04, 0.05], anchor: 'right', c: 'cone' });
  if (c.caps)
    add({ t: c.caps, f: 'caps', s: S * 0.16, p: [-half + S * 0.25, rowY + S * 0.62, 0.05], r: [0, 0, -0.08], anchor: 'left', c: 'cone' });
  if (c.script) {
    // Each page may tilt and shift it a little (scriptTilt, scriptShift in title sizes).
    const [dx, dy] = c.scriptShift || [0, 0];
    const sc = add({ t: c.script, f: 'script', s: S * 0.34, p: [S * (0.15 + dx), rowY * 0.55 + S * dy, 0.3], r: [0, 0, c.scriptTilt ?? -0.26], c: 'inverse' });
    sc.mesh.renderOrder = 6.5; // over the big letters (sorting by distance used to put it under)
  }
  return { group, blocks };
}
