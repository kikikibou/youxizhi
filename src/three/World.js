import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { createMaterials, updateMaterials } from './materials.js';
import { BUILDERS } from './buildings.js';
import { createGround, createTree, Lamp, Ribbon } from './props.js';
import { createSky, SKY } from './sky.js';
import { TextBlock, buildCluster, loadFonts, MAX_HULL, BEAM_GLSL } from './typography.js';

const PLAZA_RADIUS = 56;
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Monotone-chain convex hull; returns the polygon counter-clockwise (y up). */
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, uGrain: { value: 0.03 }, uVignette: { value: 0.55 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uGrain; uniform float uVignette; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      // Static paper grain (animated grain read as flicker).
      float n = h(floor(gl_FragCoord.xy));
      c.rgb += (n - 0.5) * uGrain;
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - dot(q, q) * uVignette;
      gl_FragColor = c;
    }`,
};

/**
 * Inside the hero lamp's beam the scene is shown at the *opposite* time of day:
 * tOther is a second render of the whole scene (buildings and sky) at that
 * time, swapped in wherever the pixel lies inside the beam's outline.
 */
const beamCompositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tOther: { value: null },
    uHull: { value: Array.from({ length: MAX_HULL }, () => new THREE.Vector2()) },
    uHullN: { value: 0 },
    uMix: { value: 0 },
    uSunPos: { value: new THREE.Vector2() },
    uSunR: { value: 10 },
    uSun: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tOther;
    uniform float uMix;
    uniform vec2 uSunPos;
    uniform float uSunR;
    uniform float uSun;
    varying vec2 vUv;
    ${BEAM_GLSL}
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (uMix > 0.001) {
        float k = beamCoverage(gl_FragCoord.xy) * uMix;
        if (k > 0.0) c = mix(c, texture2D(tOther, vUv), k);
      }
      // When the beam shows daylight, the lamp is its sun.
      c.rgb += vec3(1.0, 0.86, 0.62) * uSun * exp(-length(gl_FragCoord.xy - uSunPos) / uSunR);
      gl_FragColor = c;
    }`,
};

/**
 * Renders the scene into its own multisampled target and copies the resolved
 * image into the post-processing chain. Keeping MSAA out of the chain's
 * ping-pong targets avoids a resolve after every full-screen pass (measured:
 * ~9 ms per frame on an integrated GPU).
 */
class SceneMsaaPass extends Pass {
  constructor(scene, camera, target) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.target = target;
    this.needsSwap = false;
    this.copy = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
        vertexShader: CopyShader.vertexShader,
        fragmentShader: CopyShader.fragmentShader,
      }),
    );
  }

  setSize(width, height) {
    this.target.setSize(width, height);
  }

  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.copy.material.uniforms.tDiffuse.value = this.target.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    this.copy.render(renderer);
  }
}

export class World {
  constructor(canvas, pages) {
    this.canvas = canvas;
    this.pages = pages;
    this.night = 0;
    this.nightTarget = 0;
    this.time = 0;
    this.pointer = new THREE.Vector2();
    this.parallax = new THREE.Vector2();
    this.active = 0;
    this.flight = null;
    this.baseFov = 56;
    this.sites = [];
    // Phones / touch devices get a lighter render budget.
    this.lowPower = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 860;

    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      // Dev only: lets screenshots of a backgrounded tab capture the real frame.
      preserveDrawingBuffer: import.meta.env.DEV,
    }));
    // Adaptive resolution: start sharp, step down if this GPU can't keep up
     // (see trackFrame). renderScale multiplies the base pixel ratio.
     this.basePixelRatio = Math.min(window.devicePixelRatio, this.lowPower ? 1.25 : 1.5);
     this.renderScale = 1;
     this.perf = { frames: 0, sum: 0, settleUntil: performance.now() + 2500 };
     r.setPixelRatio(this.basePixelRatio);
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    // Updated once per frame by hand: both time-of-day renders share one map.
    r.shadowMap.autoUpdate = false;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.3, 2000);
    this.basePos = new THREE.Vector3();
    this.baseQuat = new THREE.Quaternion();

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.fog = new THREE.Fog(SKY.dayHor.clone(), 150, 650);
    this.scene.fog = this.fog;

    this.mats = createMaterials();
    this.buildLights();
    this.sky = createSky();
    this.scene.add(this.sky);
    this.scene.add(createGround());
    this.buildSites();
    this.buildPlazaFurniture();
    this.buildSkyline();
    this.buildComposer();

    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._focus = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._moon = new THREE.Color(0.55, 0.65, 1.0);
    this._hemiDay = new THREE.Color(0xc4dcf2);
    this._hemiNight = new THREE.Color(0x24345e);
    this._groundDay = new THREE.Color(0xd9c6ae);
    this._groundNight = new THREE.Color(0x8a5a32);
    this._size = new THREE.Vector2();
    window.addEventListener('resize', () => this.resize(true));
  }

  /* ------------------------------------------------------------------ */

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xc4dcf2, 0xd9c6ae, 1.2);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xfff1de, 3.2));
    sun.castShadow = true;
    // The shadow camera follows the view (see updateSun), so a 2048 map over
    // ±75 m stays about as sharp as the old 4096 map over the whole plaza.
    sun.shadow.mapSize.set(2048, 2048);
    const s = 75;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 420 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);

    // One real spotlight, moved to whichever page's lamp is on (night only).
    // Every light is evaluated for every lit pixel, so one is much cheaper
    // than one per building.
    this.spot = new THREE.SpotLight(0xffc580, 0, 46, 0.72, 0.75, 1.4);
    this.scene.add(this.spot, this.spot.target);
  }

  buildSites() {
    const n = this.pages.length;
    this.pages.forEach((page, i) => {
      const a = (i / n) * Math.PI * 2;
      const group = BUILDERS[page.building](this.mats);
      group.position.set(Math.sin(a) * PLAZA_RADIUS, 0, Math.cos(a) * PLAZA_RADIUS);
      group.rotation.y = a + Math.PI;
      this.scene.add(group);
      group.updateMatrixWorld(true);

      const sc = page.scene;
      const lamp = new Lamp(this.mats, { height: sc.lamp.h, hero: true });
      lamp.group.position.set(sc.lamp.p[0], 0, sc.lamp.p[1]);
      group.add(lamp.group);

      const ribbon = new Ribbon(this.mats.orange, sc.ribbon);
      ribbon.mesh.position.set(...sc.ribbon.p);
      ribbon.mesh.rotation.set(...sc.ribbon.r);
      group.add(ribbon.mesh);

      for (const [x, z, s] of sc.trees) {
        const t = createTree(this.mats, s);
        t.position.set(x, 0, z);
        group.add(t);
      }
      group.updateMatrixWorld(true);


      // On-screen outline of this page's beam, shared by all its 3D text.
      const beam = {
        pts: { value: Array.from({ length: MAX_HULL }, () => new THREE.Vector2()) },
        n: { value: 0 },
      };
      this.sites.push({ page, group, lamp, ribbon, beam, texts: [], view: this.viewFor(group, sc.view), activity: 0 });
    });
  }

  /** Camera pose for a view given in a building's local frame. */
  viewFor(group, v) {
    const pos = group.localToWorld(new THREE.Vector3(...v.pos));
    const target = group.localToWorld(new THREE.Vector3(...v.target));
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, target, UP));
    quat.multiply(new THREE.Quaternion().setFromAxisAngle(Z, v.roll || 0));
    return { pos, quat, fov: v.fov };
  }

  /**
   * Dev tool: change a page's camera, hero lamp and title placement live
   * (same shape as pages.js scene config) and jump there.
   */
  recompose(index, { view, lamp, cluster } = {}) {
    const site = this.sites[index];
    const sc = site.page.scene;
    if (lamp) {
      Object.assign(sc.lamp, lamp);
      site.group.remove(site.lamp.group);
      site.lamp = new Lamp(this.mats, { height: sc.lamp.h, hero: true });
      site.lamp.group.position.set(sc.lamp.p[0], 0, sc.lamp.p[1]);
      site.group.add(site.lamp.group);
      site.group.updateMatrixWorld(true);
    }
    if (view) site.view = this.viewFor(site.group, Object.assign(sc.view, view));
    if (cluster && site.cluster) {
      Object.assign(sc.cluster, cluster);
      site.cluster.position.set(...sc.cluster.p);
      site.cluster.rotation.set(...sc.cluster.r);
    }
    this.jumpTo(index);
  }

  buildPlazaFurniture() {
    const n = this.pages.length;
    // Smaller lamps in a ring around the plaza centre (behind the page cameras,
    // so they glow during flights without crowding the compositions), plus trees.
    this.plazaLamps = [];
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      const lamp = new Lamp(this.mats, { height: 8, beamRadius: 3.2 });
      lamp.group.position.set(Math.sin(a) * 18, 0, Math.cos(a) * 18);
      this.scene.add(lamp.group);
      this.plazaLamps.push(lamp);
      for (const off of [-0.09, 0.09]) {
        const t = createTree(this.mats, 0.95 + Math.random() * 0.3);
        t.position.set(Math.sin(a + off * 2) * 24, 0, Math.cos(a + off * 2) * 24);
        this.scene.add(t);
      }
    }
  }

  buildSkyline() {
    // A ring of quiet distant blocks so the horizon is never empty.
    const geos = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + rnd() * 0.05;
      const d = 170 + rnd() * 120;
      const w = 14 + rnd() * 26;
      const h = 10 + rnd() * 45;
      const g = new THREE.BoxGeometry(w, h, 10 + rnd() * 20);
      g.rotateY(a);
      g.translate(Math.sin(a) * d, h / 2, Math.cos(a) * d);
      geos.push(g);
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos), this.mats.whiteShade);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.skyline = mesh;
  }

  buildComposer() {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const samples = this.lowPower ? 2 : 4;
    // Post-processing ping-pong targets: no MSAA (see SceneMsaaPass).
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(r, rt);
    this.sceneRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
    this.composer.addPass(new SceneMsaaPass(this.scene, this.camera, this.sceneRT));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.15, 0.45, 0.95);
    this.composer.addPass(this.bloom);
    // The other time of day, rendered separately and swapped in inside the beam.
    this.otherRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
    this.beamPass = new ShaderPass(beamCompositeShader);
    this.beamPass.uniforms.tOther.value = this.otherRT.texture;
    this.composer.addPass(this.beamPass);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(gradeShader);
    this.composer.addPass(this.grade);
  }

  async buildTypography() {
    const all = this.sites.flatMap(({ page: { scene: sc } }) => [
      ...sc.texts,
      { t: sc.cluster.title + sc.cluster.of, f: 'display' },
      { t: sc.cluster.cn, f: 'cn' },
      { t: sc.cluster.caps, f: 'caps' },
      { t: sc.cluster.script, f: 'script' },
    ]);
    await loadFonts(all);
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    for (const site of this.sites) {
      const cluster = buildCluster(site.page.scene.cluster, site.beam, aniso);
      site.group.add(cluster.group);
      site.cluster = cluster.group;
      site.texts.push(...cluster.blocks);
      for (const spec of site.page.scene.texts) {
        const block = new TextBlock(spec, site.beam, aniso);
        block.mesh.renderOrder = 3; // facade lettering sits *behind* the beam
        site.group.add(block.mesh);
        site.texts.push(block);
      }
    }
  }

  /**
   * Run behind the loading screen: compile every shader (including objects
   * that start invisible, like other pages' lettering and the night glows),
   * upload every texture, and draw each page's view once by day and by night,
   * so no first-time GPU work lands in the middle of a camera flight.
   */
  warmUp() {
    const r = this.renderer;
    const hidden = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    for (const site of this.sites) for (const t of site.texts) t.material.uniforms.uOpacity.value = 1;
    r.compile(this.scene, this.camera);
    this.scene.traverse((o) => {
      const m = o.material;
      if (!m) return;
      for (const tex of [m.map, m.uniforms?.map?.value]) if (tex) r.initTexture(tex);
    });
    const pos = this.basePos.clone();
    const quat = this.baseQuat.clone();
    this.otherRT.scissorTest = false;
    for (const site of this.sites) {
      this.camera.position.copy(site.view.pos);
      this.camera.quaternion.copy(site.view.quat);
      this.camera.updateMatrixWorld();
      for (const n of [0, 1]) {
        this.applyTime(n);
        r.shadowMap.needsUpdate = true;
        r.setRenderTarget(this.otherRT);
        r.render(this.scene, this.camera);
      }
    }
    r.setRenderTarget(null);
    // Run the post chain once with bloom on, so the first switch to night
    // doesn't compile the bloom shaders mid-animation.
    const bloomWas = this.bloom.enabled;
    this.bloom.enabled = true;
    this.composer.render(0);
    this.bloom.enabled = bloomWas;
    hidden.forEach((o) => (o.visible = false));
    this.basePos.copy(pos);
    this.baseQuat.copy(quat);
    this.applyTime(this.night);
  }

  /* ------------------------------------------------------------------ */

  /** Jump (no animation) to a page. */
  jumpTo(index) {
    const v = this.sites[index].view;
    this.active = index;
    this.basePos.copy(v.pos);
    this.baseQuat.copy(v.quat);
    this.baseFov = v.fov;
    this.flight = null;
    this.sites.forEach((s, i) => (s.activity = i === index ? 1 : 0));
  }

  /** Fly the camera to a page. Resolves when the camera lands. */
  flyTo(index, duration = 2.8) {
    const to = this.sites[index].view;
    const from = { pos: this.basePos.clone(), quat: this.baseQuat.clone(), fov: this.baseFov };
    const mid = from.pos.clone().add(to.pos).multiplyScalar(0.5);
    const dist = from.pos.distanceTo(to.pos);
    mid.lerp(new THREE.Vector3(0, mid.y, 0), 0.25);
    mid.y += 5 + dist * 0.12;
    this.active = index;
    if (this.flight) this.flight.resolve();
    return new Promise((resolve) => {
      this.flight = { from, to, mid, t: 0, duration: duration * (0.75 + Math.min(dist, 110) / 440), resolve };
    });
  }

  /** Opening shot: start high above the plaza and descend into the page. */
  intro(index) {
    const v = this.sites[index].view;
    this.basePos.copy(v.pos).lerp(new THREE.Vector3(0, v.pos.y, 0), 0.55);
    this.basePos.y += 34;
    const look = new THREE.Matrix4().lookAt(this.basePos, this.sites[index].group.position.clone().setY(10), UP);
    this.baseQuat.setFromRotationMatrix(look);
    this.baseFov = v.fov + 8;
    this.sites.forEach((s) => (s.activity = 0));
    return this.flyTo(index, 3.6);
  }

  /**
   * Views are composed for a landscape screen. On narrower screens keep
   * roughly the same horizontal coverage by widening the vertical FOV.
   */
  adaptFov(fov) {
    const ref = 1.25;
    const aspect = this.camera.aspect;
    if (aspect >= ref) return fov;
    const half = Math.atan((Math.tan(THREE.MathUtils.degToRad(fov) / 2) * ref) / aspect);
    return Math.min(THREE.MathUtils.radToDeg(half * 2), 92);
  }

  setNight(isNight) {
    this.nightTarget = isNight ? 1 : 0;
  }

  get progress() {
    return this.flight ? this.flight.t : 1;
  }

  resize(fromWindow = true) {
    if (fromWindow) {
      // New window size: start again from full sharpness.
      this.renderScale = 1;
      this.renderer.setPixelRatio(this.basePixelRatio);
      this.perf.settleUntil = performance.now() + 1500;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    // The composer keeps its own copy of the pixel ratio for its targets.
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const size = this.renderer.getDrawingBufferSize(this._size);
    this.otherRT.setSize(size.x, size.y); // sceneRT is resized by its pass
  }

  /* ------------------------------------------------------------------ */

  updateCamera(dt) {
    const f = this.flight;
    if (f) {
      f.t = Math.min(1, f.t + dt / f.duration);
      const e = easeInOut(f.t);
      // Quadratic Bezier through a raised mid-point: a crane move over the plaza.
      const p0 = f.from.pos;
      const p1 = f.to.pos;
      const k = 1 - e;
      this.basePos.set(
        k * k * p0.x + 2 * k * e * f.mid.x + e * e * p1.x,
        k * k * p0.y + 2 * k * e * f.mid.y + e * e * p1.y,
        k * k * p0.z + 2 * k * e * f.mid.z + e * e * p1.z,
      );
      this.baseQuat.slerpQuaternions(f.from.quat, f.to.quat, e);
      this.baseFov = THREE.MathUtils.lerp(f.from.fov, f.to.fov, e) + Math.sin(e * Math.PI) * 6;
      if (f.t >= 1) {
        this.flight = null;
        f.resolve();
      }
    }

    // Subtle hand-held parallax that follows the pointer.
    this.parallax.x = damp(this.parallax.x, this.pointer.x, 2.5, dt);
    this.parallax.y = damp(this.parallax.y, this.pointer.y, 2.5, dt);
    const sway = Math.sin(this.time * 0.25) * 0.004;
    const q = this._q.setFromEuler(this._euler.set(this.parallax.y * 0.022 + sway, -this.parallax.x * 0.035, 0, 'YXZ'));
    this.camera.position.copy(this.basePos);
    this.camera.position.y += Math.sin(this.time * 0.4) * 0.05;
    this.camera.quaternion.copy(this.baseQuat).multiply(q);
    this.camera.fov = this.adaptFov(this.baseFov);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /**
   * The sun swings with the camera so every facade is lit — and while the
   * camera travels, shadows sweep across the plaza like passing hours. Its
   * direction is set once per frame so both renders share one shadow map.
   */
  updateSun() {
    const fwd = this._v.set(0, 0, -1).applyQuaternion(this.baseQuat);
    const yaw = Math.atan2(fwd.x, fwd.z) + Math.PI + 0.85;
    const elev = THREE.MathUtils.lerp(0.78, 0.95, this.night);
    // Centre the shadow camera on the ground a little ahead of the view.
    fwd.y = 0;
    fwd.normalize();
    const focus = this._focus.copy(this.basePos).addScaledVector(fwd, 28).setY(0);
    this.sun.position
      .set(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev))
      .multiplyScalar(180)
      .add(focus);
    this.sun.target.position.copy(focus);
  }

  /**
   * Everything that depends on the time of day, for one render pass.
   * `inBeam` is the pass seen through the hero beam: its night sky keeps fewer
   * clouds, so by day the beam reads as the poster's deep navy.
   */
  applyTime(n, inBeam = false) {
    this.sun.intensity = THREE.MathUtils.lerp(3.3, 0.35, n);
    this.sun.color.setRGB(1, 0.94, 0.87).lerp(this._moon, n);
    this.hemi.intensity = THREE.MathUtils.lerp(1.25, 0.55, n);
    this.hemi.color.copy(this._hemiDay).lerp(this._hemiNight, n);
    this.hemi.groundColor.copy(this._groundDay).lerp(this._groundNight, n);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.55, 0.12, n);
    this.fog.color.copy(SKY.dayHor).lerp(SKY.nightHor, n);
    this.sky.material.uniforms.uNight.value = n;
    this.sky.material.uniforms.uCloud.value = inBeam ? 1 - 0.65 * n : 1;
    updateMaterials(this.mats, n);
    this.spot.intensity = n * 260 * (this.spotSite ? this.spotSite.activity : 0);
    this.sites.forEach((site) => site.lamp.update(n, site.activity));
    this.plazaLamps.forEach((l) => l.update(n, 0));
  }

  /** Post-processing follows the *current* time of day only. */
  updatePost(n) {
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.08, 1.05, n);
    this.bloom.strength = THREE.MathUtils.lerp(0.1, 0.45, n);
    this.bloom.threshold = THREE.MathUtils.lerp(0.95, 0.9, n);
    this.bloom.radius = THREE.MathUtils.lerp(0.4, 0.5, n);
    this.bloom.enabled = n > 0.02; // barely visible by day; skip the cost
    this.sky.material.uniforms.uTime.value = this.time;
  }

  /**
   * Project each active hero beam (a frustum from the lamp's full width down to
   * the ground) to its on-screen outline: the convex hull of its projected top
   * and bottom circles. The text shader uses it to recolour letters inside.
   */
  updateBeams() {
    const size = this.renderer.getDrawingBufferSize(this._size);
    const cam = this.camera;
    const SEG = 20;
    for (const site of this.sites) {
      if (site.activity < 0.002) continue;
      const lamp = site.lamp;
      const pts = [];
      for (const [y, r] of [
        [lamp.topY, lamp.topRadius],
        [0, lamp.beamRadius],
      ]) {
        for (let k = 0; k < SEG; k++) {
          const th = (k / SEG) * Math.PI * 2;
          const w = lamp.group.localToWorld(this._v.set(Math.cos(th) * r, y, Math.sin(th) * r));
          if (this._v2.copy(w).applyMatrix4(cam.matrixWorldInverse).z > -cam.near) continue; // behind camera
          w.project(cam);
          pts.push({ x: (w.x * 0.5 + 0.5) * size.x, y: (w.y * 0.5 + 0.5) * size.y });
        }
      }
      let hull = convexHull(pts);
      if (hull.length > MAX_HULL) {
        const stepN = Math.ceil(hull.length / MAX_HULL);
        hull = hull.filter((_, i) => i % stepN === 0);
      }
      hull.forEach((p, i) => site.beam.pts.value[i].set(p.x, p.y));
      site.beam.n.value = hull.length;
      // Pixel bounding box: the opposite-time render is scissored to it.
      const xs = hull.map((q) => q.x);
      const ys = hull.map((q) => q.y);
      const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 2);
      const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 2);
      const x1 = Math.min(size.x, Math.ceil(Math.max(...xs)) + 2);
      const y1 = Math.min(size.y, Math.ceil(Math.max(...ys)) + 2);
      (site.beam.box ||= new THREE.Vector4()).set(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));

      // Lens centre and on-screen radius, for the "lamp as sun" glow.
      const c = lamp.group.localToWorld(this._v.set(0, lamp.topY, 0)).project(cam);
      const e = lamp.group.localToWorld(this._v2.set(lamp.topRadius, lamp.topY, 0)).project(cam);
      site.beam.sun = site.beam.sun || new THREE.Vector2();
      site.beam.sun.set((c.x * 0.5 + 0.5) * size.x, (c.y * 0.5 + 0.5) * size.y);
      site.beam.sunR = Math.max(4, Math.hypot((e.x - c.x) * 0.5 * size.x, (e.y - c.y) * 0.5 * size.y));
    }
  }

  /**
   * Dev tool for composing views: ray-casts a grid of points inside the active
   * beam's on-screen outline and reports how much of it shows sky, row by row
   * from the lamp down to the bottom of the frame.
   */
  probeBeam(rows = 16, cols = 7) {
    const site = this.sites[this.active];
    const n = site.beam.n.value;
    const hull = site.beam.pts.value.slice(0, n);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const lampParts = new Set();
    site.lamp.group.traverse((o) => lampParts.add(o));
    const targets = [];
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.visible || o === this.sky || lampParts.has(o)) return;
      if (o.material.isShaderMaterial || this.sites.some((x) => x.ribbon.mesh === o)) return;
      targets.push(o);
    });
    const top = Math.max(...hull.map((p) => p.y));
    const bottom = Math.max(0, Math.min(...hull.map((p) => p.y)));
    const ray = new THREE.Raycaster();
    const rowSky = [];
    for (let r = 0; r < rows; r++) {
      const y = top - ((r + 0.5) / rows) * (top - bottom);
      // Horizontal extent of the polygon at this height.
      let xl = Infinity;
      let xr = -Infinity;
      for (let i = 0; i < n; i++) {
        const a = hull[i];
        const b = hull[(i + 1) % n];
        if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) continue;
        const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
        xl = Math.min(xl, x);
        xr = Math.max(xr, x);
      }
      if (!isFinite(xl)) continue;
      let sky = 0;
      for (let c = 0; c < cols; c++) {
        const x = xl + ((c + 0.5) / cols) * (xr - xl);
        ray.setFromCamera(new THREE.Vector2((x / size.x) * 2 - 1, (y / size.y) * 2 - 1), this.camera);
        if (!ray.intersectObjects(targets, false).length) sky++;
      }
      rowSky.push(sky / cols);
    }
    const half = Math.ceil(rowSky.length / 2);
    const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    return {
      lampTopPct: +(100 - (top / size.y) * 100).toFixed(1), // lamp lens, % from top of the frame
      lampXPct: +((site.beam.sun.x / size.x) * 100).toFixed(1),
      skyUpperHalf: +avg(rowSky.slice(0, half)).toFixed(2),
      skyAll: +avg(rowSky).toFixed(2),
      rows: rowSky.map((v) => Math.round(v * 9)).join(''), // 9 = all sky, 0 = all building
    };
  }

  /** Hang the single spotlight in the most "on" hero lamp. */
  placeSpot() {
    const site = this.sites.reduce((best, x) => (x.activity > best.activity ? x : best));
    this.spotSite = site;
    const lamp = site.lamp;
    lamp.group.localToWorld(this.spot.position.set(0, lamp.topY, 0));
    lamp.group.localToWorld(this.spot.target.position.set(0, 0, 0));
    this.spot.target.updateMatrixWorld();
  }

  /**
   * Adaptive resolution. Fed the real time between animation frames; if the
   * average stays above ~20 ms (below ~50 fps) the render resolution steps
   * down, never below 0.8 CSS px per pixel. It never steps back up on its own
   * (a 60 Hz display can't show headroom), but a window resize starts over.
   */
  trackFrame(ms) {
    const p = this.perf;
    const now = performance.now();
    if (now < p.settleUntil || this.flight || document.hidden || ms > 250) return;
    p.frames++;
    p.sum += ms;
    if (p.frames < 45) return;
    const avg = p.sum / p.frames;
    p.frames = 0;
    p.sum = 0;
    const floor = Math.min(1, 0.8 / this.basePixelRatio);
    if (avg > 20 && this.renderScale > floor + 1e-3) {
      this.renderScale = Math.max(floor, this.renderScale * 0.82);
      this.renderer.setPixelRatio(this.basePixelRatio * this.renderScale);
      this.resize(false);
      p.settleUntil = now + 1200; // let the new size settle before judging again
    }
  }

  /** Render the scene at the opposite time of day for the beam, if one is visible. */
  renderBeam() {
    const site = this.sites.reduce((best, x) => (x.activity > best.activity ? x : best));
    const mix = site.activity > 0.002 && site.beam.n.value >= 3 ? site.activity : 0;
    const u = this.beamPass.uniforms;
    u.uMix.value = mix;
    u.uSun.value = 0;
    if (!mix) return;
    u.uHull.value = site.beam.pts.value;
    u.uHullN.value = site.beam.n.value;
    u.uSunPos.value.copy(site.beam.sun);
    u.uSunR.value = site.beam.sunR * 0.9;
    u.uSun.value = this.night * mix * 1.1;

    this.applyTime(1 - this.night, true);
    const r = this.renderer;
    this.otherRT.scissor.copy(site.beam.box);
    this.otherRT.scissorTest = true;
    r.setRenderTarget(this.otherRT);
    r.clear();
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
  }

  update(dt) {
    this.time += dt;
    this.night = damp(this.night, this.nightTarget, 2.2, dt);
    if (Math.abs(this.night - this.nightTarget) < 0.001) this.night = this.nightTarget;

    this.updateCamera(dt);
    this.updateSun();

    const p = this.progress;
    this.sites.forEach((site, i) => {
      const on = i === this.active && p > 0.62 ? 1 : 0;
      site.activity = damp(site.activity, on, on ? 2.6 : 5, dt);
      site.ribbon.update(this.time + i * 3.1);
      site.texts.forEach((t, k) => {
        // Stagger the letters' arrival a little.
        const o = THREE.MathUtils.clamp(site.activity * 1.6 - k * 0.12, 0, 1);
        t.update(this.night, o);
      });
    });
    this.updateBeams();
    this.updatePost(this.night);
    this.placeSpot();

    this.renderer.shadowMap.needsUpdate = true;
    this.renderBeam(); // other time of day -> otherRT (also refreshes the shadow map)
    this.applyTime(this.night);
    this.composer.render(dt);
  }
}
