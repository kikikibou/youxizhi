import * as THREE from 'three';

/**
 * Text that lives *inside* the 3D world: drawn to a canvas with the site's web
 * fonts, then mapped onto a plane. Because it is real geometry it gets
 * perspective, occlusion (the lamp pole passes in front of it) and it turns a
 * different colour wherever it sits inside the lamp's beam on screen — the
 * signature trick of the reference poster.
 */
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

function drawText(text, fontKey, align = 'left') {
  const f = FONTS[fontKey];
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
  lines.forEach((l, i) => {
    let x = pad;
    if (align === 'center') x = (w - widths[i]) / 2;
    if (align === 'right') x = w - pad - widths[i];
    ctx.fillText(l, x, pad + lineH * (i + 0.5));
  });
  return { canvas, px, w, h };
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
  uniform vec2 uA;
  uniform vec2 uB;
  uniform vec2 uC;
  varying vec2 vUv;
  float side(vec2 p, vec2 a, vec2 b) { return (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y); }
  bool inTri(vec2 p) {
    float d1 = side(p, uA, uB), d2 = side(p, uB, uC), d3 = side(p, uC, uA);
    bool neg = d1 < 0.0 || d2 < 0.0 || d3 < 0.0;
    bool pos = d1 > 0.0 || d2 > 0.0 || d3 > 0.0;
    return !(neg && pos);
  }
  void main() {
    float a = texture2D(map, vUv).a * uOpacity;
    if (a < 0.004) discard;
    vec3 c = inTri(gl_FragCoord.xy) ? uIn : uOut;
    gl_FragColor = vec4(c, a);
  }
`;

// Day/night colour pairs (linear, so values above 1 bloom a little at night).
const ORANGE = new THREE.Color(0xff7d10);
const PALETTE = {
  cone: { dayIn: new THREE.Color(0xffffff), dayOut: ORANGE, nightIn: new THREE.Color(0xfff0d8), nightOut: ORANGE },
  orange: { dayIn: ORANGE, dayOut: ORANGE, nightIn: ORANGE, nightOut: ORANGE },
  white: { dayIn: new THREE.Color(0xffffff), dayOut: new THREE.Color(0xffffff), nightIn: ORANGE, nightOut: ORANGE },
  // Script lettering: orange where the big letters are white (inside the beam), white elsewhere.
  inverse: { dayIn: ORANGE, dayOut: new THREE.Color(0xffffff), nightIn: ORANGE, nightOut: new THREE.Color(0xfff0d8) },
  navy: { dayIn: new THREE.Color(0xffffff), dayOut: new THREE.Color(0x0d1f3c), nightIn: new THREE.Color(0xfff0d8), nightOut: new THREE.Color(0xf3ead8) },
};

export class TextBlock {
  /**
   * @param {object} spec  { t, f, s, p:[x,y,z], r:[x,y,z], c, align }
   * @param {object} tri   shared { a, b, c } Vector2 uniforms of the page's beam
   */
  constructor(spec, tri, maxAniso = 8) {
    const { canvas, px, w, h } = drawText(spec.t, spec.f, spec.align);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = maxAniso;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    this.spec = spec;
    this.palette = PALETTE[spec.c || 'cone'];
    this.glow = spec.c === 'orange' || spec.c === 'cone' ? 1.35 : 1.0;
    const scale = spec.s / px; // spec.s = font size in metres
    const pad = FONTS[spec.f].pad * px;
    this.glyphWidth = (w - 2 * pad) * scale;
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        map: { value: tex },
        uIn: { value: new THREE.Color() },
        uOut: { value: new THREE.Color() },
        uOpacity: { value: 0 },
        uA: tri.a,
        uB: tri.b,
        uC: tri.c,
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.PlaneGeometry(w * scale, h * scale);
    // anchor: which point of the glyph run sits at spec.p
    const shift = (w * scale) / 2 - pad * scale;
    if (spec.anchor === 'left') geo.translate(shift, 0, 0);
    if (spec.anchor === 'right') geo.translate(-shift, 0, 0);
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
    if (night > 0) {
      const k = 1 + (this.glow - 1) * night;
      u.uOut.value.multiplyScalar(k);
    }
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
export function buildCluster(c, tri, aniso) {
  const group = new THREE.Group();
  group.position.set(...c.p);
  group.rotation.set(...(c.r || [0, 0, 0]));
  const S = c.size;
  const blocks = [];
  const add = (spec) => {
    const b = new TextBlock(spec, tri, aniso);
    group.add(b.mesh);
    blocks.push(b);
    return b;
  };
  const title = add({ t: c.title, f: 'display', s: S, p: [0, 0, 0], c: 'cone' });
  const half = title.glyphWidth / 2;
  const cap = S * 0.74; // Anton cap height
  const rowY = cap / 2 + S * 0.5;
  if (c.cn) add({ t: c.cn, f: 'cn', s: S * 0.56, p: [-half + S * 0.02, rowY + S * 0.06, 0.05], anchor: 'left', c: 'cone' });
  if (c.of) add({ t: c.of, f: 'display', s: S * 0.46, p: [half, rowY - S * 0.04, 0.05], anchor: 'right', c: 'cone' });
  if (c.caps)
    add({ t: c.caps, f: 'caps', s: S * 0.16, p: [-half + S * 0.25, rowY + S * 0.62, 0.05], r: [0, 0, -0.08], anchor: 'left', c: 'cone' });
  if (c.script)
    add({ t: c.script, f: 'script', s: S * 0.34, p: [S * 0.15, rowY * 0.55, 0.3], r: [0, 0, -0.26], c: 'inverse' });
  return { group, blocks };
}
