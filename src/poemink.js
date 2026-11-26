import * as THREE from 'three';
import { MASK, MASK_GLSL } from './three/typography.js';

/**
 * The poems (top right of each page) are page text laid over the 3D canvas,
 * so on their own they can't see the reveal (the lamp's beam, the split line,
 * the sliding tiles, the ribbons, the lighthouse's beam: the other time of
 * day). To change colour inside it, as the 3D titles do, their letters are
 * drawn again at the end of the 3D frame, over the scene, through the same
 * reveal mask. The page text stays where it is (layout, selection, screen
 * readers) but is drawn transparent (html.poem-ink in style.css).
 *
 * Each part of a poem (eyebrow words, the rule before them, the lines, the
 * small line) is rasterised once into a canvas of its own (r: letters,
 * g: their glow) at the positions the page laid them out at, and drawn every
 * frame where the part's element is and as opaque as it is, so the parts'
 * fade-ins and slides come along.
 */

const PAD = 24; // css px round a part, for its glow
const GLOW = 18; // .poem's text-shadow blur (style.css)
const HALO = 0.35; // and its strength

const rgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

// (colours in sRGB, as the page's own: written straight to the screen)
const SHARED = {
  uNight: { value: 0 },
  uInkDay: { value: rgb('#0d1f3c') },
  uInkNight: { value: new THREE.Vector3(1, 1, 1) },
  uHaloDay: { value: new THREE.Vector3(1, 1, 1) },
  uHaloNight: { value: new THREE.Vector3(0, 0, 0) },
  // the canvas in pixels: the reveal mask is in the 3D's own, maybe coarser
  // (World.renderSize), so a pixel here is found in it by its share of the screen
  uViewRes: { value: new THREE.Vector2(1, 1) },
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tInk;
  uniform float uSolid; // (the rule: a plain bar, no glow)
  uniform float uOpacity;
  uniform float uNight;
  uniform vec3 uInkDay;
  uniform vec3 uInkNight;
  uniform vec3 uHaloDay;
  uniform vec3 uHaloNight;
  uniform vec2 uViewRes;
  varying vec2 vUv;
  ${MASK_GLSL}
  void main() {
    vec2 t = uSolid > 0.5 ? vec2(1.0, 0.0) : texture2D(tInk, vUv).rg;
    // (inside the reveal, the other time: so a poem standing on the split's
    // other side, pages.js poemTone, needs nothing of its own here)
    float m = mix(uNight, 1.0 - uNight, beamCoverage(gl_FragCoord.xy / uViewRes * uMaskRes));
    vec3 ink = mix(uInkDay, uInkNight, m);
    vec3 halo = mix(uHaloDay, uHaloNight, m);
    float ah = t.g * ${HALO.toFixed(2)} * (1.0 - t.r);
    gl_FragColor = vec4(ink * t.r + halo * ah, t.r + ah) * uOpacity; // (premultiplied)
  }`;

const quad = new THREE.PlaneGeometry(1, 1).translate(0.5, -0.5, 0); // (top-left origin)

/** The text of an element as runs to draw: whole lines where it can, else letter by letter. */
function runsOf(el) {
  const runs = [];
  const range = document.createRange();
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    if (!node.data.trim() || node.parentElement.closest('.blank')) continue;
    const cs = getComputedStyle(node.parentElement);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    // The baseline: where a zero-height box set on it sits.
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;padding:0;border:0;margin:0';
    node.parentNode.insertBefore(probe, node);
    const baseline = probe.getBoundingClientRect().top;
    probe.remove();
    range.selectNodeContents(node);
    const lines = range.getClientRects();
    if (lines.length === 1 && cs.letterSpacing === 'normal') {
      // (whole: keeps the font's kerning and ligatures)
      runs.push({ text: node.data, x: lines[0].left, y: baseline, font });
      continue;
    }
    let off = null;
    for (let i = 0; i < node.data.length; ) {
      const ch = String.fromCodePoint(node.data.codePointAt(i));
      range.setStart(node, i);
      range.setEnd(node, i + ch.length);
      i += ch.length;
      const r = range.getBoundingClientRect();
      off ??= baseline - r.top; // (the same on every line of it)
      if (!ch.trim() || !r.width) continue;
      runs.push({ text: ch, x: r.left, y: r.top + off, font });
    }
  }
  return runs;
}

/**
 * An element's box, grown to take in its text where that runs out of it (a
 * line longer than the poem runs out leftwards, see .poem-lines in style.css).
 */
function boundsOf(el) {
  const a = el.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(el);
  const b = range.getBoundingClientRect();
  if (!b.width || !a.width) return a;
  const left = Math.min(a.left, b.left);
  const top = Math.min(a.top, b.top);
  return { left, top, width: Math.max(a.right, b.right) - left, height: Math.max(a.bottom, b.bottom) - top };
}

class Part {
  constructor(el, solid, uniforms) {
    this.el = el;
    this.solid = solid;
    this.reveal = el.closest('.reveal') || el;
    this.key = '';
    this.canvas = solid ? null : document.createElement('canvas');
    this.tex = solid ? null : new THREE.CanvasTexture(this.canvas);
    if (this.tex) {
      this.tex.premultiplyAlpha = true; // (r and g are then the letters' and glow's coverage)
      this.tex.generateMipmaps = false;
      this.tex.minFilter = THREE.LinearFilter;
    }
    this.mesh = new THREE.Mesh(
      quad,
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, tInk: { value: this.tex }, uSolid: { value: solid ? 1 : 0 }, uOpacity: { value: 1 } },
        vertexShader,
        fragmentShader,
        transparent: true,
        premultipliedAlpha: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Letters (red) and their glow (green) into the canvas, if the part's size or the scale changed. */
  raster(box, ratio) {
    const key = `${box.width.toFixed(1)}x${box.height.toFixed(1)}@${ratio}:${document.fonts.status}`;
    if (key === this.key) return;
    this.key = key;
    const c = this.canvas;
    const w = Math.max(1, Math.ceil((box.width + 2 * PAD) * ratio));
    const h = Math.max(1, Math.ceil((box.height + 2 * PAD) * ratio));
    // three.js sizes a texture's storage on the GPU once, at its first
    // upload: a canvas of another size after that was written into a corner
    // of the old storage (when the automatic resolution stepped down, the
    // letters shrank towards the bottom left with the old ones showing past
    // them). A new size gets new storage.
    if (c.width !== w || c.height !== h) this.tex.dispose();
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const ox = box.left - PAD;
    const oy = box.top - PAD;
    const runs = runsOf(this.el);
    const fill = (dx) => {
      for (const r of runs) {
        g.font = r.font;
        g.fillText(r.text, r.x - ox - dx, r.y - oy);
      }
    };
    // The glow: the letters' shadow only (the letters themselves drawn off the canvas).
    const away = 4000;
    g.save();
    g.fillStyle = g.shadowColor = '#00ff00';
    g.shadowBlur = GLOW * ratio; // (shadows ignore the transform: device px)
    g.shadowOffsetX = away * ratio;
    fill(away);
    g.restore();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = '#ff0000';
    fill(0);
    g.globalCompositeOperation = 'source-over';
    this.tex.needsUpdate = true;
  }

  /** Where the part is this frame (css px), as opaque as it is; false when it can't be seen. */
  place(ratio) {
    const box = this.solid ? this.el.getBoundingClientRect() : boundsOf(this.el);
    const opacity = parseFloat(getComputedStyle(this.reveal).opacity);
    if (!box.width || !box.height || opacity < 0.004) return false;
    const pad = this.solid ? 0 : PAD;
    if (!this.solid) this.raster(box, ratio);
    // (on whole device pixels, so the letters stay sharp)
    const x = Math.round((box.left - pad) * ratio) / ratio;
    const y = Math.round((box.top - pad) * ratio) / ratio;
    const w = this.solid ? box.width : this.canvas.width / ratio;
    const h = this.solid ? box.height : this.canvas.height / ratio;
    this.mesh.position.set(x, -y, 0);
    this.mesh.scale.set(w, h, 1);
    this.mesh.material.uniforms.uOpacity.value = opacity;
    return true;
  }
}

export class PoemInk {
  /** @param pageEls the pages' <section> elements (renderPages in ui.js) */
  constructor(pageEls) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -1, 1);
    this.pages = pageEls.map((page) => {
      const poem = page.querySelector('.poem');
      const uniforms = { ...SHARED, tMask: MASK.tMask, uMaskRes: MASK.uMaskRes };
      const parts = [];
      const add = (sel, solid = false) => poem.querySelectorAll(sel).forEach((el) => parts.push(new Part(el, solid, uniforms)));
      add('.poem-rule', true);
      add('.poem-eyebrow-text');
      add('.poem-lines');
      add('.poem-small');
      parts.forEach((p) => this.scene.add(p.mesh));
      return { page, poem, parts };
    });
    document.documentElement.classList.add('poem-ink');
  }

  /** The scheme's ink (the poem's colour by day; white by night). */
  setInk(hex) {
    SHARED.uInkDay.value.copy(rgb(hex));
  }

  /** Over the finished frame (World.renderPost). */
  render(renderer, night) {
    const ratio = renderer.getPixelRatio();
    const size = renderer.getSize(new THREE.Vector2());
    renderer.getDrawingBufferSize(SHARED.uViewRes.value);
    let any = false;
    for (const { page, poem, parts } of this.pages) {
      // (the page shown, or fading out; its poem not put aside for the panel, nor hidden on a phone)
      const on = page.classList.contains('is-active') && getComputedStyle(poem).visibility === 'visible' && poem.offsetParent !== null;
      for (const p of parts) any = (p.mesh.visible = on && p.place(ratio)) || any;
    }
    if (!any) return;
    SHARED.uNight.value = night;
    const cam = this.camera;
    if (cam.right !== size.x || cam.bottom !== -size.y) {
      cam.right = size.x;
      cam.bottom = -size.y;
      cam.updateProjectionMatrix();
    }
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(this.scene, cam);
    renderer.autoClear = autoClear;
  }
}
