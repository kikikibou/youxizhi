import * as THREE from 'three';
import { Lamp } from './props.js';

/**
 * "Reveal devices": each page has one shape through which the scene is shown
 * at the opposite time of day (night by day, day by night).
 *
 * A device owns:
 *   group   visible parts (added to the page's building group)
 *   mask    meshes on MASK_LAYER, drawn white into a mask texture each frame.
 *           The mask is screen-space, like a graphic overlay: it ignores
 *           depth, so a beam can cross in front of a building as in the poster.
 *   glow    optional point (local coords) that glows like a sun over the
 *           revealed daylight
 *
 *   punch   the same shape, a little wider, on PUNCH_LAYER: drawn into the
 *           second render's depth buffer first, so that render only shades
 *           pixels inside the reveal (see World.renderBeam)
 *
 * The World renders the mask, renders the scene a second time at the other
 * time of day, and swaps that render in wherever the mask is white. 3D text
 * reads the same mask to change colour.
 */
export const MASK_LAYER = 1;
export const PUNCH_LAYER = 2;

// Writes "far" depth wherever the shape covers, and no colour.
const punchVert = /* glsl */ `
  void main() {
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    p.z = p.w; // exactly the far plane, where the sky also sits (xyww)
    gl_Position = p;
  }
`;
const punchFrag = /* glsl */ `void main() { gl_FragColor = vec4(0.0); }`;
function punchMaterial(vertexShader = punchVert, uniforms = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: punchFrag,
    uniforms,
    colorWrite: false,
    depthTest: true, // (depth is only written while the test is enabled)
    depthFunc: THREE.AlwaysDepth,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
}

class Device {
  constructor() {
    this.group = new THREE.Group();
    this.mask = new THREE.Group();
    this.group.add(this.mask);
    this.punch = new THREE.Group();
    this.group.add(this.punch);
    this.maskMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    this.glow = null; // { pos: Vector3 (local), radius, day, night }
    this.spotAnchor = null; // { top, base } for the single real spotlight
  }

  addMask(geometry, parent = this.mask) {
    const m = new THREE.Mesh(geometry, this.maskMat);
    m.layers.set(MASK_LAYER);
    m.frustumCulled = false;
    parent.add(m);
    return m;
  }

  addPunch(geometry, material = (this.punchMat ??= punchMaterial())) {
    const m = new THREE.Mesh(geometry, material);
    m.layers.set(PUNCH_LAYER);
    m.frustumCulled = false;
    this.punch.add(m);
    return m;
  }

  /** Called once per frame. `reveal` (0..1) is how strongly the mask shows. */
  update(time, dt, night, activity) {
    this.setReveal(activity);
  }

  setReveal(v) {
    this.maskMat.color.setScalar(v);
    this.mask.visible = this.punch.visible = v > 0.002;
  }

  /** Called once per render pass with that pass's time of day. */
  applyTime() {}
}

/* -------------------------------------------------------------------------- */
/* 01 · Street lamp: a cone of light from the lamp head down to the ground     */
/* -------------------------------------------------------------------------- */
export class LampDevice extends Device {
  constructor(mats, { p, h }) {
    super();
    this.lamp = new Lamp(mats, { height: h, hero: true });
    this.lamp.group.position.set(p[0], 0, p[1]);
    this.group.add(this.lamp.group);
    const m = this.addMask(this.lamp.beamGeo);
    m.position.copy(this.lamp.group.position);
    // Slightly wider than the mask, so its anti-aliased edge has pixels behind it.
    const pm = this.addPunch(this.lamp.beamGeo);
    pm.position.copy(this.lamp.group.position);
    pm.scale.set(1.06, 1, 1.06);
    this.glow = { pos: new THREE.Vector3(p[0], this.lamp.topY, p[1]), radius: this.lamp.topRadius, day: 0, night: 1.1 };
    this.spotAnchor = { top: new THREE.Vector3(p[0], this.lamp.topY, p[1]), base: new THREE.Vector3(p[0], 0, p[1]) };
  }

  applyTime(night, activity) {
    this.lamp.update(night, activity);
  }
}

/* -------------------------------------------------------------------------- */
/* 02 · Split line: the picture divided at the gap between the two towers      */
/* -------------------------------------------------------------------------- */
/*
 * A line through the "clash point" (the gap between the bridge arms) divides
 * the whole picture: one side is shown at the other time of day. The line
 * rocks slowly about that point, like the beam of a balance. Drawn in screen
 * space ("aspect NDC", as the beacon): x scaled by the aspect ratio.
 */
const splitVert = /* glsl */ `
  uniform vec2 uOrigin;   // pivot (aspect NDC)
  uniform vec2 uDir;      // unit direction of the line on screen
  uniform float uAspect;
  uniform float uSide;    // +1: reveal to the right of the line, -1: left
  uniform float uOffset;  // move the near edge across the line (punch overlap)
  uniform float uHalf;    // >0: draw a thin band of this half-width instead
  uniform float uDepth;
  void main() {
    vec2 n = vec2(uDir.y, -uDir.x) * uSide;
    float across = uHalf > 0.0 ? position.x * uHalf : position.x * 8.0 - uOffset;
    vec2 p = uOrigin + n * across + uDir * position.y * 8.0;
    gl_Position = vec4(p.x / uAspect, p.y, uDepth, 1.0);
  }
`;
const splitMaskFrag = /* glsl */ `
  uniform float uReveal;
  void main() { gl_FragColor = vec4(vec3(uReveal), 1.0); }
`;
const splitLineFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() { gl_FragColor = vec4(uColor, uOpacity); }
`;

function quad(x0, x1) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, -1, 0, x1, -1, 0, x1, 1, 0, x0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export class SplitDevice extends Device {
  /**
   * @param {object} cfg
   *   p      pivot (local): the gap between the bridge arms
   *   side   1 = the right of the line shows the other time, -1 = the left
   *   sway   how far the line rocks either way (radians)
   *   period seconds per rock
   */
  constructor({ p, side = 1, sway = 0.06, period = 13, color = 0xff7d10 }) {
    super();
    this.p = new THREE.Vector3(...p);
    this.sway = sway;
    this.period = period;
    this.shape = {
      uOrigin: { value: new THREE.Vector2() },
      uDir: { value: new THREE.Vector2(0, 1) },
      uAspect: { value: 1 },
      uSide: { value: side },
    };
    const half = quad(0, 1);
    const common = { vertexShader: splitVert, depthTest: false, depthWrite: false, side: THREE.DoubleSide };
    this.maskMat = new THREE.ShaderMaterial({
      ...common,
      fragmentShader: splitMaskFrag,
      uniforms: { ...this.shape, uOffset: { value: 0 }, uHalf: { value: 0 }, uDepth: { value: 0 }, uReveal: { value: 0 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    this.addMask(half);
    this.punchMat = punchMaterial(splitVert, { ...this.shape, uOffset: { value: 0.012 }, uHalf: { value: 0 }, uDepth: { value: 1 } });
    this.addPunch(half, this.punchMat);

    // The line itself: a thin orange stroke over the picture, in both renders.
    this.line = new THREE.Mesh(
      quad(-1, 1),
      new THREE.ShaderMaterial({
        ...common,
        fragmentShader: splitLineFrag,
        uniforms: { ...this.shape, uOffset: { value: 0 }, uHalf: { value: 0.0032 }, uDepth: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
        transparent: true,
      }),
    );
    this.line.frustumCulled = false;
    this.line.renderOrder = 8;
    this.group.add(this.line);

    this.glow = { pos: this.p.clone(), radius: 1.4, day: 0.25, night: 0.95 };
    this._L = new THREE.Vector3();
    this._o = new THREE.Vector3();
  }

  setReveal(v) {
    this.maskMat.uniforms.uReveal.value = v;
    this.mask.visible = this.punch.visible = v > 0.002;
  }

  update(time, dt, night, activity, camera) {
    this.group.updateWorldMatrix(true, false);
    const L = this._L.copy(this.p).applyMatrix4(this.group.matrixWorld);
    const viewZ = this._o.copy(L).applyMatrix4(camera.matrixWorldInverse).z;
    if (viewZ > -camera.near) {
      this.on = 0;
      this.setReveal(0);
      return;
    }
    const aspect = camera.aspect;
    const o = this._o.copy(L).project(camera);
    // Rocking like a balance: a slow swing with a little unevenness.
    const w = (Math.PI * 2) / this.period;
    const tilt = this.sway * (Math.sin(time * w) * 0.85 + Math.sin(time * w * 2.3 + 1.1) * 0.15);
    const s = this.shape;
    s.uOrigin.value.set(o.x * aspect, o.y);
    s.uDir.value.set(-Math.sin(tilt), Math.cos(tilt));
    s.uAspect.value = aspect;
    this.on = activity;
    this.setReveal(activity);
  }

  /** Pixel rectangle (x, y, w, h) covering the revealed side of the screen. */
  screenBox(size, out) {
    const s = this.shape;
    const a = s.uAspect.value;
    const o = s.uOrigin.value;
    const d = s.uDir.value;
    if (Math.abs(d.y) < 0.2) return out.set(0, 0, size.x, size.y);
    // Where the line crosses the top and bottom of the screen.
    const xs = [-1, 1].map((y) => ((o.x + (d.x * (y - o.y)) / d.y) / a) * 0.5 + 0.5);
    const right = d.y * s.uSide.value > 0;
    const x0 = right ? Math.max(0, Math.floor(Math.min(...xs) * size.x) - 3) : 0;
    const x1 = right ? size.x : Math.min(size.x, Math.ceil(Math.max(...xs) * size.x) + 3);
    return out.set(x0, 0, Math.max(1, x1 - x0), size.y);
  }

  applyTime(night, activity) {
    const u = this.line.material.uniforms;
    u.uOpacity.value = 0.95 * activity;
    this.line.visible = u.uOpacity.value > 0.002;
  }
}

/* -------------------------------------------------------------------------- */
/* 05 · Lighthouse beacon: a flat wedge of light sweeping out of the lantern   */
/* -------------------------------------------------------------------------- */
/*
 * The beam is drawn in screen space, like a graphic laid over the picture:
 * a wedge that leaves the lantern glass and always runs past the edge of the
 * screen (a 3D cone would show its far end, converging on the horizon).
 * It turns round the lantern on screen (see BeaconDevice.update).
 *
 * Wedge space: "aspect NDC" — x scaled by the aspect ratio so lengths are
 * equal in both directions; the screen spans ±aspect × ±1.
 */
const wedgeVert = /* glsl */ `
  uniform vec2 uOrigin;   // lantern centre (aspect NDC)
  uniform vec2 uDir;      // unit direction on screen
  uniform float uAspect;
  uniform float uW0;      // half-width where the light leaves the lamp
  uniform float uSpread;  // half-width gained per unit of length
  uniform float uLen;     // far end: always beyond the screen edge
  uniform float uStart;   // where this layer begins (distance from the centre)
  uniform float uWidth;   // width multiplier (the halo is a little fatter)
  uniform float uDepth;   // 0, or 1 for the depth punch (far plane)
  varying vec2 vST;       // distance from the lantern, -1..1 across
  void main() {
    float d = uStart + position.x * (uLen - uStart);
    float hw = (uW0 + d * uSpread) * uWidth;
    vec2 n = vec2(-uDir.y, uDir.x);
    vec2 p = uOrigin + uDir * d + n * position.y * hw;
    vST = vec2(d, position.y);
    gl_Position = vec4(p.x / uAspect, p.y, uDepth, 1.0);
  }
`;
// Mask: white inside the wedge, fading in just outside the glass.
const wedgeMaskFrag = /* glsl */ `
  uniform float uReveal;
  uniform float uStart;
  uniform float uFeather;
  varying vec2 vST;
  void main() {
    float k = smoothstep(uStart, uStart + uFeather, vST.x) * uReveal;
    gl_FragColor = vec4(vec3(k), 1.0);
  }
`;
// Halo: soft light hugging the revealed band, brightest at the lamp.
const wedgeHaloFrag = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vST;
  void main() {
    float across = clamp(1.0 - abs(vST.y), 0.0, 1.0);
    float along = 0.22 + 0.78 * exp(-max(vST.x, 0.0) * 1.6);
    float a = across * across * along * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

function wedgeGeometry(segments = 32) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    pos.push(s, -1, 0, s, 0, 0, s, 1, 0);
    if (i < segments) {
      const a = i * 3;
      const b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export class BeaconDevice extends Device {
  /**
   * @param {object} cfg
   *   p        lantern centre (local)
   *   source   half-height of the light as it leaves the glass (m)
   *   glass    lantern glass radius (m): the reveal starts there
   *   spread   how fast the wedge opens on screen (half-width per unit length)
   *   speed    turning speed on screen while the beam shows (radians/s)
   *   angle    starting angle on screen (0 = pointing right, π/2 = up)
   */
  constructor({ p, source = 0.95, glass = 1.95, spread = 0.085, speed = 0.3, angle = 0.25 }) {
    super();
    this.p = new THREE.Vector3(...p);
    this.source = source;
    this.glass = glass;
    this.spread = spread;
    this.speed = speed;
    this.angle = angle;
    this.fade = 0;
    this.flash = 0;

    // Shared wedge shape (both materials read the same uniform objects).
    this.shape = {
      uOrigin: { value: new THREE.Vector2() },
      uDir: { value: new THREE.Vector2(1, 0) },
      uAspect: { value: 1 },
      uW0: { value: 0.01 },
      uSpread: { value: spread },
      uLen: { value: 6 },
      uDepth: { value: 0 },
    };
    const geo = wedgeGeometry();

    this.maskMat = new THREE.ShaderMaterial({
      vertexShader: wedgeVert,
      fragmentShader: wedgeMaskFrag,
      uniforms: { ...this.shape, uStart: { value: 0 }, uWidth: { value: 1 }, uReveal: { value: 0 }, uFeather: { value: 0.02 } },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.addMask(geo);
    this.punchMat = punchMaterial(wedgeVert, { ...this.shape, uDepth: { value: 1 }, uStart: { value: 0 }, uWidth: { value: 1.08 } });
    this.addPunch(geo, this.punchMat);

    this.halo = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: wedgeVert,
        fragmentShader: wedgeHaloFrag,
        uniforms: { ...this.shape, uStart: { value: 0 }, uWidth: { value: 1.3 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xffd9a0) } },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 5;
    this.group.add(this.halo);

    this.glow = { pos: this.p.clone(), radius: 2.2, day: 0.35, night: 1.2 };
    this._L = new THREE.Vector3();
    this._D = new THREE.Vector3();
    this._o = new THREE.Vector3();
    this._e = new THREE.Vector3();
  }

  setReveal(v) {
    this.maskMat.uniforms.uReveal.value = v;
    this.mask.visible = this.punch.visible = v > 0.002;
  }

  /*
   * The beam turns like a clock hand on screen: right, up through the sky
   * (that's the stretch where it swings towards the viewer, so it opens
   * wider and brighter), left, then on round underneath, where it would
   * dip into the sea, so it fades out *while still turning* and comes back
   * on the other side. It turns a little faster while it is hidden.
   */
  update(time, dt, night, activity, camera) {
    this.group.updateWorldMatrix(true, false);
    const L = this._L.copy(this.p).applyMatrix4(this.group.matrixWorld);
    // Lantern on screen; behind the camera (mid-flight) there is nothing to draw.
    const viewZ = this._o.copy(L).applyMatrix4(camera.matrixWorldInverse).z;
    if (viewZ > -camera.near) {
      this.fade = 0;
      this.setReveal(0);
      return;
    }
    const aspect = camera.aspect;
    const o = this._o.copy(L).project(camera);
    const ox = o.x * aspect;
    const oy = o.y;
    // Screen units per metre at the lantern's distance.
    const unit = 1 / (-viewZ * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const w0 = this.source * unit;
    // The horizon on screen (eye level, straight ahead).
    const fwd = this._e.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
    const horizon = this._D.copy(camera.position).addScaledVector(fwd, 1000).project(camera).y;

    const phi = this.angle;
    const dx = Math.cos(phi);
    const dy = Math.sin(phi);
    this.flash = Math.max(dy, 0); // pointing up = swinging towards the viewer
    const spread = this.spread * (1 + 2.2 * this.flash * this.flash);

    // Visible while the beam's lower edge stays above the horizon all the way
    // to the edge of the screen; fades out as it gets close.
    let vis = 1;
    if (dy < 0) {
      const tx = dx > 1e-6 ? (aspect - ox) / dx : dx < -1e-6 ? (-aspect - ox) / dx : Infinity;
      const t = Math.max(0, Math.min(tx, (-1 - oy) / dy));
      const low = oy + dy * t - Math.abs(dx) * (w0 + t * spread);
      vis = THREE.MathUtils.smoothstep(low - horizon, 0.02, 0.3);
    }
    this.angle = (phi + dt * this.speed * (1 + 1.5 * (1 - vis) ** 2)) % (Math.PI * 2);

    const s = this.shape;
    s.uOrigin.value.set(ox, oy);
    s.uDir.value.set(dx, dy);
    s.uAspect.value = aspect;
    s.uW0.value = w0;
    s.uSpread.value = spread;
    // Long enough to pass the farthest screen corner.
    let far = 0;
    for (const [cx, cy] of [[-aspect, -1], [aspect, -1], [-aspect, 1], [aspect, 1]]) far = Math.max(far, Math.hypot(cx - ox, cy - oy));
    s.uLen.value = far + 0.5;
    const start = this.glass * unit;
    this.maskMat.uniforms.uStart.value = start;
    this.punchMat.uniforms.uStart.value = start * 0.8;
    this.maskMat.uniforms.uFeather.value = Math.max(0.01, start * 0.6);

    this.fade = vis;
    this.setReveal(activity * vis);
  }

  /** Pixel rectangle (x, y, w, h) covering the wedge, clipped to the screen. */
  screenBox(size, out) {
    const s = this.shape;
    const a = s.uAspect.value;
    const o = s.uOrigin.value;
    const d = s.uDir.value;
    const start = this.maskMat.uniforms.uStart.value;
    const L = s.uLen.value;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const dist of [start, L]) {
      const hw = s.uW0.value + dist * s.uSpread.value;
      for (const side of [-1, 1]) {
        const px = o.x + d.x * dist - d.y * side * hw;
        const py = o.y + d.y * dist + d.x * side * hw;
        const sx = (px / a) * 0.5 + 0.5;
        const sy = py * 0.5 + 0.5;
        x0 = Math.min(x0, sx);
        y0 = Math.min(y0, sy);
        x1 = Math.max(x1, sx);
        y1 = Math.max(y1, sy);
      }
    }
    x0 = Math.max(0, Math.floor(x0 * size.x) - 2);
    y0 = Math.max(0, Math.floor(y0 * size.y) - 2);
    x1 = Math.min(size.x, Math.ceil(x1 * size.x) + 2);
    y1 = Math.min(size.y, Math.ceil(y1 * size.y) + 2);
    return out.set(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  }

  applyTime(night, activity) {
    const u = this.halo.material.uniforms;
    u.uOpacity.value = (0.05 + 0.26 * night) * (1 + 0.4 * this.flash) * activity * this.fade;
    this.halo.visible = u.uOpacity.value > 0.002;
  }
}
