import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { createMaterials, updateMaterials } from './materials.js';
import { BUILDERS } from './buildings.js';
import { createGround, createTree, Lamp, Ribbon, PaperPlane } from './props.js';
import { LampDevice, BeaconDevice, SplitDevice, SlideDevice, RibbonDevice, MASK_LAYER, PUNCH_LAYER } from './devices.js';
import { createSea, inSea } from './sea.js';
import { createSky, SKY, SKY_SHARED } from './sky.js';
import { TextBlock, buildCluster, loadFonts, setTextColors, isCJK, MASK, MASK_GLSL, TEXT_LAYER, CRISP } from './typography.js';
import { GpuTimer, QUALITY_DEFAULTS } from './perf.js';
import { buildDetails, WIND, rng } from './details.js';

const PLAZA_RADIUS = 56;
const GRASS = new THREE.Color(0xb5d77a);
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

/**
 * The whole post chain in one full-screen pass, straight to the screen:
 *   - adds the night glow (bloom) when it is on
 *   - wherever the reveal mask is white, shows the scene at the *opposite*
 *     time of day (tOther: a second render, see devices.js)
 *   - the device's light source glows like a sun
 *   - tone mapping and sRGB (three.js chunks, since this renders to the screen)
 *   - static paper grain and a vignette
 * (It replaces separate copy / reveal / output / grade passes: three fewer
 * full-screen passes over a half-float image every frame.)
 */
const finalShader = {
  uniforms: {
    tScene: { value: null },
    tOther: { value: null },
    tBloom: { value: null },
    tText: { value: null },
    tMask: MASK.tMask,
    uMaskRes: MASK.uMaskRes,
    uBloom: { value: 0 },
    uMix: { value: 0 },
    uSunPos: { value: new THREE.Vector2() },
    uSunR: { value: 10 },
    uSun: { value: 0 },
    uGrain: { value: 0.03 },
    uVignette: { value: 0.55 },
    uSunColor: { value: new THREE.Vector3(1.0, 0.86, 0.62) },
    toneMappingExposure: { value: 1 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tScene;
    uniform sampler2D tOther;
    uniform sampler2D tBloom;
    uniform sampler2D tText;
    uniform float uBloom;
    uniform float uMix;
    uniform vec2 uSunPos;
    uniform float uSunR;
    uniform float uSun;
    uniform vec3 uSunColor;
    uniform float uGrain;
    uniform float uVignette;
    varying vec2 vUv;
    ${MASK_GLSL}
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      // (the 3D is drawn at its own resolution, which "auto" may set below
      // the canvas's: the reveal mask and the light source are in its pixels)
      vec2 px = vUv * uMaskRes;
      vec4 scene = texture2D(tScene, vUv);
      vec3 c = scene.rgb;
      // (no glow lands on the letters themselves: they are laid over after it)
      if (uBloom > 0.5) c += texture2D(tBloom, vUv).rgb;
      if (uMix > 0.5) {
        float k = beamCoverage(px);
        if (k > 0.0) c = mix(c, texture2D(tOther, vUv).rgb, k);
      }
      // The lettering, drawn sharp in its own pass (premultiplied: renderText).
      vec4 t = texture2D(tText, vUv);
      c = c * (1.0 - t.a) + t.rgb;
      c += uSunColor * uSun * exp(-length(px - uSunPos) / uSunR);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      // Static paper grain (animated grain read as flicker) and a vignette.
      gl_FragColor.rgb += (h(floor(gl_FragCoord.xy)) - 0.5) * uGrain;
      vec2 q = vUv - 0.5;
      gl_FragColor.rgb *= 1.0 - dot(q, q) * uVignette;
    }`,
};

export class World {
  constructor(canvas, pages) {
    this.canvas = canvas;
    this.pages = pages;
    this.night = 0;
    this.nightTarget = 0;
    this.time = 0;
    this.overlays = []; // { render(renderer, night) } drawn over each finished frame
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
    // Resolution: in "auto" mode the pixel ratio follows the GPU's measured
    // frame time, down when it plainly can't keep up and back up when it has
    // room (see trackFrame, adapt). The 画质 menu (the polaroid at the top
    // left, app.js) or the debug panel can pin it instead.
    this.dpr = window.devicePixelRatio || 1;
    this.pixelRatio = this.autoStartRatio;
    this.quality = { ...QUALITY_DEFAULTS };
    this.perf = {
      history: [], // recent frame intervals (ms) and GPU times, for the debug graph
      gpuHistory: [],
      raw: [], // every animation-frame interval, for the refresh-rate estimate
      win: [],
      gpuWin: [],
      winStart: 0,
      started: 0,
      settleUntil: 0,
      fps: 0,
      frameMs: 0,
      worstMs: 0,
      gpuMs: null,
      refreshHz: 0,
      calls: 0,
      triangles: 0,
      slow: 0,
      fast: 0,
      ceiling: 0,
      ceilingAt: 0,
      log: [],
    };
    r.setPixelRatio(this.canvasRatio);
    r.info.autoReset = false; // counted per frame (all passes) for the debug panel
    this.gpu = new GpuTimer(r);
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
    this.ground = createGround();
    this.scene.add(this.ground);
    this.buildSites();
    this.buildPlazaFurniture();
    this.buildDetails();
    this.buildSkyline();
    this.buildPost();

    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._focus = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._euler = new THREE.Euler();
    this._moon = new THREE.Color(0.55, 0.65, 1.0);
    this._sunDay = new THREE.Color(1, 0.94, 0.87);
    this._hemiDay = new THREE.Color(0xc4dcf2);
    this._hemiNight = new THREE.Color(0x24345e);
    this._groundDay = new THREE.Color(0xd9c6ae);
    this._groundNight = new THREE.Color(0x8a5a32);
    this._size = new THREE.Vector2();
    this._box = new THREE.Box3();
    this._corners = Array.from({ length: 8 }, () => new THREE.Vector3());
    this._clear = new THREE.Color();
    this._lastSun = new THREE.Vector3();
    this.shadowDirty = true;
    this.setQuality();
    window.addEventListener('resize', () => this.resize(true));
  }

  /**
   * Apply a colour scheme (see palettes.js) to everything in the scene:
   * materials, sky, clouds, sea, lights, lettering and reveal devices.
   */
  setPalette(p) {
    const m = this.mats;
    const set = (mat, base, glow) => {
      mat.color.set(base);
      if (glow) mat.emissive.set(glow);
    };
    set(m.white, p.building);
    set(m.whiteShade, p.buildingShade);
    set(m.concrete, p.concrete);
    set(m.metal, p.metal);
    set(m.lampPole, p.metal);
    set(m.glass, p.glass, p.glassGlow);
    set(m.glassDark, p.glassDark, p.glassDarkGlow);
    set(m.warm, p.warm, p.warmGlow);
    set(m.strip, p.strip, p.stripGlow);
    set(m.bulb, p.bulb, p.bulbGlow);
    set(m.orange, p.accent, p.accentGlow);
    m.tube.userData.day.set(p.accent);
    m.tube.userData.night.set(p.strip);
    m.tube.emissive.set(p.stripGlow);
    set(m.leaf, p.leaf);
    set(m.trunk, p.trunk);
    set(m.bush, p.leaf);
    m.grass.color.set(p.leaf).lerp(GRASS, 0.38); // (fresher than the trees)
    set(m.paneNight, p.glassDark, p.glassGlow);
    m.blind.emissive.set(p.glassGlow);
    m.skyWin.color.copy(m.whiteShade.color).lerp(m.glassDark.color, 0.42);
    m.skyWinLit.color.copy(m.skyWin.color);
    m.skyWinLit.emissive.set(p.glassGlow);
    this.ground.material.color.set(p.groundTint);
    // Sky colours are shared Color objects (sky dome, sea, fog).
    SKY.dayTop.set(p.sky.dayTop);
    SKY.dayHor.set(p.sky.dayHor);
    SKY.nightTop.set(p.sky.nightTop);
    SKY.nightHor.set(p.sky.nightHor);
    SKY_SHARED.uCloudDayHi.value.fromArray(p.clouds.dayHi);
    SKY_SHARED.uCloudDayLo.value.fromArray(p.clouds.dayLo);
    SKY_SHARED.uCloudNightHi.value.fromArray(p.clouds.nightHi);
    SKY_SHARED.uCloudNightLo.value.fromArray(p.clouds.nightLo);
    SKY_SHARED.uSeaDay.value.fromArray(p.sea.day);
    SKY_SHARED.uSeaNight.value.fromArray(p.sea.night);
    const l = p.lights;
    this._hemiDay.set(l.hemiDay);
    this._hemiNight.set(l.hemiNight);
    this._groundDay.set(l.groundDay);
    this._groundNight.set(l.groundNight);
    this._sunDay.set(l.sun);
    this._moon.setRGB(...l.moon);
    this.spot.color.set(l.spot);
    Lamp.glowColor.set(l.lampGlow);
    this.final.material.uniforms.uSunColor.value.fromArray(l.sourceGlow);
    setTextColors(p);
    for (const site of this.sites) site.device.setColors?.(p);
    this.palette = p;
  }

  /** Pixel-ratio range for "auto": never softer than one pixel per CSS pixel on a desktop. */
  // (a visit starts at the screen's full resolution on a desktop, up to 2;
  // "auto" turns it down within a second or two if the GPU can't keep up)
  get autoStartRatio() {
    return this.lowPower ? Math.min(this.dpr, 1.25) : this.maxPixelRatio;
  }
  get maxPixelRatio() {
    return Math.min(this.dpr, 2);
  }
  get minPixelRatio() {
    return Math.min(this.dpr, this.lowPower ? 0.8 : 1);
  }
  /**
   * The canvas's own pixel ratio. The 3D is drawn at pixelRatio (which
   * "auto" turns down when the GPU can't keep up) and scaled up in the final
   * pass, but the canvas stays at the screen's (up to 2), so what is drawn
   * over the finished frame (the poems, poemink.js) stays sharp. (Phones,
   * which don't show the poems, keep the canvas at the 3D's.)
   */
  get canvasRatio() {
    return this.lowPower ? this.pixelRatio : this.maxPixelRatio;
  }

  /** The 3D's own size in pixels (its render targets', the mask's), into v. */
  renderSize(v) {
    this.renderer.getSize(v);
    return v.set(Math.floor(v.x * this.pixelRatio), Math.floor(v.y * this.pixelRatio));
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
    // Lights are seen by every layer: the mask and depth-punch passes then
    // keep the same light setup as the real renders, so three.js doesn't
    // treat every lit material as changed after each of them.
    for (const l of [this.hemi, this.sun, this.spot]) l.layers.enableAll();
  }

  buildSites() {
    const n = this.pages.length;
    this.pages.forEach((page, i) => {
      // Clockwise around the plaza: the next page's building is to the camera's
      // right, so → / wheel-down / swipe-left turn right and ← turns left.
      const a = -(i / n) * Math.PI * 2;
      const group = BUILDERS[page.building](this.mats);
      group.position.set(Math.sin(a) * PLAZA_RADIUS, 0, Math.cos(a) * PLAZA_RADIUS);
      group.rotation.y = a + Math.PI;
      this.scene.add(group);
      group.updateMatrixWorld(true);

      const sc = page.scene;
      const device = this.makeDevice(sc);
      group.add(device.group);
      if (sc.sea) group.add((this.sea = createSea()));

      // The small decorative ribbon (optional: Games has big ones as its device).
      let ribbon = null;
      if (sc.ribbon) {
        ribbon = new Ribbon(this.mats.orange, sc.ribbon);
        ribbon.mesh.castShadow = false; // see QUALITY_DEFAULTS.ribbonShadow
        ribbon.mesh.position.set(...sc.ribbon.p);
        ribbon.mesh.rotation.set(...sc.ribbon.r);
        group.add(ribbon.mesh);
      }
      // Home's paper plane.
      const plane = sc.plane ? new PaperPlane(sc.plane) : null;
      if (plane) group.add(plane.mesh);

      for (const [x, z, s] of sc.trees) {
        const t = createTree(this.mats, s);
        t.position.set(x, 0, z);
        group.add(t);
      }
      group.updateMatrixWorld(true);


      this.sites.push({ page, group, device, ribbon, plane, texts: [], view: this.viewFor(group, sc.view), activity: 0, box: new THREE.Vector4() });
    });
  }

  /** The page's reveal device (see devices.js): a street lamp unless configured otherwise. */
  makeDevice(sc) {
    if (sc.device?.type === 'beacon') return new BeaconDevice(sc.device);
    if (sc.device?.type === 'split') return new SplitDevice(sc.device);
    if (sc.device?.type === 'slide') return new SlideDevice(this.mats.orange, sc.device);
    if (sc.device?.type === 'ribbons') return new RibbonDevice(sc.device);
    return new LampDevice(this.mats, sc.lamp);
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
    if (lamp && sc.lamp) {
      Object.assign(sc.lamp, lamp);
      site.group.remove(site.device.group);
      site.device = this.makeDevice(sc);
      site.group.add(site.device.group);
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
      const a = -((i + 0.5) / n) * Math.PI * 2;
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

  /** Each page's planting, flower boxes and the like, low-poly (see details.js). */
  buildDetails() {
    const R = rng(20261118);
    for (const site of this.sites) {
      const g = buildDetails(site, { R, mats: this.mats });
      if (g) site.group.add(g);
    }
  }

  buildSkyline() {
    // A ring of quiet distant blocks so the horizon is never empty.
    const geos = [];
    const wins = [];
    const lit = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // (the windows draw from a sequence of their own: the blocks stay where they were)
    let seed2 = 90211;
    const r2 = () => ((seed2 = (seed2 * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + rnd() * 0.05;
      const d = 170 + rnd() * 120;
      const w = 14 + rnd() * 26;
      const h = 10 + rnd() * 45;
      const dd = 10 + rnd() * 20;
      // No blocks standing in the sea behind the lighthouse.
      const sea = this.sites.find((x) => x.page.scene.sea);
      if (sea) {
        const local = sea.group.worldToLocal(new THREE.Vector3(Math.sin(a) * d, 0, Math.cos(a) * d));
        if (inSea(local.x, local.z)) continue;
      }
      // In the block's own frame (centred; -z faces the plaza), then put in place.
      const place = (g) => {
        g.rotateY(a);
        g.translate(Math.sin(a) * d, h / 2, Math.cos(a) * d);
        return g;
      };
      geos.push(place(new THREE.BoxGeometry(w, h, dd)));
      // Windows on the face towards the plaza: punched, in ribbons, or none.
      const pane = (pw, ph, x, y, list) => {
        const p = new THREE.PlaneGeometry(pw, ph);
        p.rotateY(Math.PI);
        p.translate(x, y - h / 2, -dd / 2 - 0.15);
        list.push(place(p));
      };
      const style = r2();
      const fh = 3.2 + r2() * 0.8; // storey height
      if (style < 0.5) {
        const sx = 2.4 + r2() * 1.2;
        const pw = sx * (0.42 + r2() * 0.2);
        const ph = fh * (0.45 + r2() * 0.15);
        const cols = Math.floor((w - 3) / sx);
        const x0 = -((cols - 1) * sx) / 2;
        for (let y = 3; y + ph < h - 1.5; y += fh) {
          for (let c = 0; c < cols; c++) pane(pw, ph, x0 + c * sx, y + ph / 2, r2() < 0.22 ? lit : wins);
        }
      } else if (style < 0.85) {
        const pw = w - 2.4 - r2() * 2;
        const ph = fh * (0.35 + r2() * 0.15);
        for (let y = 3; y + ph < h - 1.5; y += fh) pane(pw, ph, 0, y + ph / 2, r2() < 0.18 ? lit : wins);
      }
      // A plant room or two on the roof, so the skyline isn't all flat tops.
      for (let k = Math.floor(r2() * 3); k > 0; k--) {
        const bw = 2 + r2() * 4;
        const bh = 1 + r2() * 3;
        const bd = 2 + r2() * 4;
        const g = new THREE.BoxGeometry(bw, bh, bd);
        g.translate((r2() - 0.5) * (w - bw - 1), h / 2 + bh / 2, (r2() - 0.5) * (dd - bd - 1));
        geos.push(place(g));
      }
    }
    const mesh = new THREE.Mesh(mergeGeometries(geos), this.mats.whiteShade);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.skyline = mesh;
    for (const [list, mat] of [[wins, this.mats.skyWin], [lit, this.mats.skyWinLit]]) {
      if (list.length) this.scene.add(new THREE.Mesh(mergeGeometries(list), mat));
    }
  }

  buildPost() {
    const r = this.renderer;
    const size = this.renderSize(new THREE.Vector2());
    this.msaaSamples = this.lowPower ? 2 : 4;
    const samples = this.msaaSamples;
    // (its depth is kept: the sharp lettering tests itself against it, see CRISP)
    this.sceneRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples, depthTexture: new THREE.DepthTexture(size.x, size.y) });
    // The other time of day, rendered separately and swapped in inside the reveal.
    this.otherRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples });
    // Reveal mask: white where the opposite time shows (drawn from MASK_LAYER).
    this.maskRT = new THREE.WebGLRenderTarget(size.x, size.y, { samples, depthBuffer: false });
    // Nothing reads these targets' depth: skip resolving it (~2 ms a frame).
    for (const rt of [this.sceneRT, this.otherRT, this.maskRT]) {
      rt.resolveDepthBuffer = false;
      rt.resolveStencilBuffer = false;
    }
    this.sceneRT.resolveDepthBuffer = true;
    // The sharp lettering, at the canvas's own resolution (renderText), and
    // the scene with it laid in, at the 3D's, for the bloom to glow from.
    const full = r.getDrawingBufferSize(new THREE.Vector2());
    this.textRT = new THREE.WebGLRenderTarget(full.x, full.y, { type: THREE.HalfFloatType, depthBuffer: false });
    this.bloomSrcRT = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, depthBuffer: false });
    this.bloomSrc = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: { tScene: { value: this.sceneRT.texture }, tText: { value: this.textRT.texture } },
        vertexShader: finalShader.vertexShader,
        fragmentShader: /* glsl */ `
          uniform sampler2D tScene;
          uniform sampler2D tText;
          varying vec2 vUv;
          void main() {
            vec4 s = texture2D(tScene, vUv);
            vec4 t = texture2D(tText, vUv);
            gl_FragColor = vec4(s.rgb * (1.0 - t.a) + t.rgb, s.a);
          }`,
        depthTest: false,
        depthWrite: false,
      }),
    );
    CRISP.tDepth.value = this.sceneRT.depthTexture;
    CRISP.tSceneColor.value = this.sceneRT.texture;
    CRISP.uViewRes.value.copy(full);
    CRISP.uNear.value = this.camera.near;
    CRISP.uFar.value = this.camera.far;
    MASK.tMask.value = this.maskRT.texture;
    MASK.uMaskRes.value.copy(size);
    this.bloom = new UnrealBloomPass(size.clone(), 0.15, 0.45, 0.95);
    this.bloomQuad = new FullScreenQuad(null);
    this.final = new FullScreenQuad(
      new THREE.ShaderMaterial({ ...finalShader, uniforms: finalShader.uniforms, depthTest: false, depthWrite: false }),
    );
    const u = this.final.material.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tOther.value = this.otherRT.texture;
    u.tBloom.value = this.bloom.renderTargetsHorizontal[0].texture;
    u.tText.value = this.textRT.texture;
  }

  /**
   * UnrealBloomPass without its last step: the glow is left in its own
   * target and added in the final pass, instead of being blended back onto
   * a copy of the scene (saves a full-screen copy).
   */
  renderBloom(texture) {
    const b = this.bloom;
    const r = this.renderer;
    const quad = this.bloomQuad;
    const autoClear = r.autoClear;
    r.getClearColor(this._clear);
    const alpha = r.getClearAlpha();
    r.autoClear = false;
    r.setClearColor(0x000000, 0);
    b.highPassUniforms.tDiffuse.value = texture;
    b.highPassUniforms.luminosityThreshold.value = b.threshold;
    quad.material = b.materialHighPassFilter;
    r.setRenderTarget(b.renderTargetBright);
    r.clear();
    quad.render(r);
    let input = b.renderTargetBright;
    for (let i = 0; i < b.nMips; i++) {
      const m = b.separableBlurMaterials[i];
      quad.material = m;
      m.uniforms.colorTexture.value = input.texture;
      m.uniforms.direction.value = UnrealBloomPass.BlurDirectionX;
      r.setRenderTarget(b.renderTargetsHorizontal[i]);
      r.clear();
      quad.render(r);
      m.uniforms.colorTexture.value = b.renderTargetsHorizontal[i].texture;
      m.uniforms.direction.value = UnrealBloomPass.BlurDirectionY;
      r.setRenderTarget(b.renderTargetsVertical[i]);
      r.clear();
      quad.render(r);
      input = b.renderTargetsVertical[i];
    }
    const cm = b.compositeMaterial;
    quad.material = cm;
    cm.uniforms.bloomStrength.value = b.strength;
    cm.uniforms.bloomRadius.value = b.radius;
    cm.uniforms.bloomTintColors.value = b.bloomTintColors;
    r.setRenderTarget(b.renderTargetsHorizontal[0]);
    r.clear();
    quad.render(r);
    r.setClearColor(this._clear, alpha);
    r.autoClear = autoClear;
  }

  /** Scene (multisampled) -> optional bloom -> one final pass to the screen. */
  renderPost(forceBloom = false) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(this.scene, this.camera);
    this.renderText();
    const u = this.final.material.uniforms;
    const bloom = forceBloom || (this.bloom.enabled && this.quality.bloom);
    if (bloom) {
      r.setRenderTarget(this.bloomSrcRT);
      this.bloomSrc.render(r);
      this.renderBloom(this.bloomSrcRT.texture);
    }
    u.uBloom.value = bloom ? 1 : 0;
    u.toneMappingExposure.value = r.toneMappingExposure;
    r.setRenderTarget(null);
    this.final.render(r);
    // Drawn over the finished frame, e.g. the poems' letters (poemink.js).
    for (const o of this.overlays) o.render(r, this.night);
  }

  /**
   * The lettering, kept sharp (TEXT_LAYER: the titles, the facade signs,
   * the lettering on the ground) into textRT, at the
   * canvas's full resolution however coarse "auto" draws the scene; laid
   * over it in the final pass. (So a lamp's beam no longer veils a sign:
   * none of the views has one crossing a sign.)
   */
  renderText() {
    const r = this.renderer;
    r.getClearColor(this._clear);
    const alpha = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.textRT);
    r.clear();
    const layers = this.camera.layers.mask;
    this.camera.layers.set(TEXT_LAYER);
    r.render(this.scene, this.camera);
    this.camera.layers.mask = layers;
    r.setClearColor(this._clear, alpha);
  }

  async buildTypography() {
    const grounds = (page) => page.cards.flatMap((c) => c.spot?.ground?.items || []);
    const all = this.sites.flatMap(({ page, page: { scene: sc } }) => [
      ...sc.texts,
      ...grounds(page),
      { t: sc.cluster.title, f: 'display' },
      { t: sc.cluster.of || '', f: isCJK(sc.cluster.of) ? 'cn' : 'display' },
      { t: sc.cluster.cn, f: 'cn' },
      { t: sc.cluster.caps, f: 'caps' },
      { t: sc.cluster.script, f: 'script' },
      { t: sc.cluster.decor || '', f: 'script' },
    ]);
    await loadFonts(all);
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    for (const site of this.sites) {
      const cluster = buildCluster(site.page.scene.cluster, aniso);
      cluster.blocks.forEach((b) => b.crisp());
      site.group.add(cluster.group);
      site.cluster = cluster.group;
      site.texts.push(...cluster.blocks);
      for (const spec of site.page.scene.texts) {
        const block = new TextBlock(spec, aniso).crisp();
        block.mesh.renderOrder = 3; // (facade lettering first, under the rest)
        site.group.add(block.mesh);
        site.texts.push(block);
      }
      // Lettering laid flat on the ground round a card's close-up (its
      // spot.ground in pages.js: a group placed and turned on the ground,
      // each item at [across, away] in it), shown only while the camera is
      // there. (On a screen held upright, its `portrait` placing, without
      // the items marked portrait: false; see update.)
      site.grounds = [];
      for (const card of site.page.cards) {
        const g = card.spot?.ground;
        if (!g) continue;
        const group = new THREE.Group();
        const blocks = g.items.map((it) => {
          const block = new TextBlock({ ...it, p: [it.at[0], 0, -it.at[1]], r: [-Math.PI / 2, 0, it.turn || 0] }, aniso).crisp();
          if (it.under) block.mesh.renderOrder = 5; // (a watermark, beneath the rest)
          group.add(block.mesh);
          return block;
        });
        site.group.add(group);
        site.grounds.push({ spot: card.spot, ground: g, group, blocks, shown: 0, tall: false });
      }
    }
    this.fitClusters();
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
    this.renderMask();
    r.setRenderTarget(null);
    // Run the post chain once with bloom on, so the first switch to night
    // doesn't compile the bloom shaders mid-animation.
    this.renderPost(true);
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
    this.closeUp = null;
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
    this.closeUp = null; // (back from a close-up, if the camera was at one)
    return this.fly(from, to, mid, duration * (0.75 + Math.min(dist, 110) / 440));
  }

  /** Start a flight along a curve through `mid` (see updateCamera). */
  fly(from, to, mid, duration) {
    if (this.flight) this.flight.resolve();
    return new Promise((resolve) => {
      this.flight = { from, to, mid, t: 0, duration, resolve };
    });
  }

  /**
   * A card's close-up (its `spot` in pages.js): from the page's view the
   * camera cranes up to a view of the page's building given in its local
   * frame (`portrait`: the view for a screen held upright). Meanwhile the
   * page's titles and reveal fade (see update). flyTo() brings it back.
   */
  flyToSpot(spot, duration = 3.4) {
    const tall = this.camera.aspect < 0.9 && !!spot.portrait;
    const group = this.sites[this.active].group;
    const to = this.viewFor(group, tall ? spot.portrait : spot.view);
    const from = { pos: this.basePos.clone(), quat: this.baseQuat.clone(), fov: this.baseFov };
    // (straight up the tower first, then over to the view: the curve's
    // middle point stands near the start, a little above the end)
    const mid = from.pos.clone().lerp(to.pos, 0.3);
    mid.y = to.pos.y + 4;
    // (tall: which view it took, so the ground lettering goes with it)
    this.closeUp = { spot, tall, dive: group.localToWorld(new THREE.Vector3(...spot.dive)) };
    return this.fly(from, to, mid, duration);
  }

  /** Put the camera where dive() ends at a close-up (back from the card's site, to rise again). */
  placeAtDive(spot) {
    const group = this.sites[this.active].group;
    const v = this.viewFor(group, this.camera.aspect < 0.9 && spot.portrait ? spot.portrait : spot.view);
    const target = group.localToWorld(new THREE.Vector3(...spot.dive));
    this.basePos.copy(v.pos).sub(target).setLength(2.6).add(target);
    this.baseQuat.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.basePos, target, UP));
    this.baseFov = v.fov - 6;
    this.flight = null;
    this.sites[this.active].activity = 0; // (the page's titles don't show for a moment first)
  }

  /** From a close-up, drop towards its `dive` point (leaving for the card's site). */
  dive(duration = 1.5) {
    const target = this.closeUp.dive;
    const from = { pos: this.basePos.clone(), quat: this.baseQuat.clone(), fov: this.baseFov };
    const pos = from.pos.clone().sub(target).setLength(2.6).add(target);
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, target, UP));
    const to = { pos, quat, fov: this.baseFov - 6 };
    return this.fly(from, to, from.pos.clone().lerp(pos, 0.5), duration);
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
    // Moving the window to another screen can change the device pixel ratio.
    if (fromWindow && (window.devicePixelRatio || 1) !== this.dpr) {
      this.dpr = window.devicePixelRatio || 1;
      if (this.quality.scale === 'auto') this.pixelRatio = this.autoStartRatio;
      this.applyScale();
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitClusters();
    // At a close-up, a screen turned between upright and wide takes the
    // close-up's other view (its ground lettering follows, see update).
    const c = this.closeUp;
    if (c && !this.flight && (w / h < 0.9 && !!c.spot.portrait) !== c.tall) {
      c.tall = !c.tall;
      const v = this.viewFor(this.sites[this.active].group, c.tall ? c.spot.portrait : c.spot.view);
      this.basePos.copy(v.pos);
      this.baseQuat.copy(v.quat);
      this.baseFov = v.fov;
    }
    this.renderer.setSize(w, h, false);
    const size = this.renderSize(this._size);
    this.sceneRT.setSize(size.x, size.y);
    this.otherRT.setSize(size.x, size.y);
    this.maskRT.setSize(size.x, size.y);
    this.bloom.setSize(size.x, size.y);
    this.bloomSrcRT.setSize(size.x, size.y);
    MASK.uMaskRes.value.copy(size);
    const full = this.renderer.getDrawingBufferSize(CRISP.uViewRes.value);
    this.textRT.setSize(full.x, full.y);
  }

  /**
   * Title stacks with a `portrait` setting move (and shrink) towards it as
   * the screen gets narrower: a phone held upright sees only the middle of
   * a view composed for a wide screen.
   */
  fitClusters() {
    const t = 1 - THREE.MathUtils.smoothstep(this.camera.aspect, 0.62, 1.1); // 0 wide … 1 upright
    for (const site of this.sites) {
      const c = site.page.scene.cluster;
      if (!site.cluster) continue;
      const p = c.portrait;
      site.cluster.position.fromArray(c.p);
      site.cluster.scale.setScalar(1);
      if (!p || t <= 0) continue;
      site.cluster.position.lerp(this._v.fromArray(p.p), t);
      site.cluster.scale.setScalar(THREE.MathUtils.lerp(1, p.scale ?? 1, t));
    }
  }

  setPixelRatio(pr) {
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(this.canvasRatio);
    this.resize(false);
    this.perf.settleUntil = performance.now() + 1500; // judge the new size afresh
    this.perf.slow = 0;
    this.perf.fast = 0;
  }

  /**
   * Apply quality.scale: 'auto' keeps the adaptive ratio, a number pins it,
   * as a share of the highest (maxPixelRatio: the screen's own, up to 2).
   */
  applyScale() {
    const s = this.quality.scale;
    const pr = s === 'auto' ? THREE.MathUtils.clamp(this.pixelRatio, this.minPixelRatio, this.maxPixelRatio) : this.maxPixelRatio * s;
    this.setPixelRatio(pr);
  }

  /** How sharp the 3D is drawn now, as a share of the highest (for the 画质 menu, the debug panel). */
  get scaleNow() {
    return this.pixelRatio / this.maxPixelRatio;
  }

  /** Change quality switches (see QUALITY_DEFAULTS); used by the 画质 menu and the debug panel. */
  setQuality(patch = {}) {
    const q = Object.assign(this.quality, patch);
    if ('scale' in patch) {
      if (q.scale === 'auto') this.pixelRatio = this.autoStartRatio;
      this.applyScale();
      this.note(q.scale === 'auto' ? '分辨率：自动' : `分辨率：固定 ${Math.round(q.scale * 100)}%`);
    }
    this.sun.castShadow = q.shadows;
    const samples = q.msaa ? this.msaaSamples : 0;
    for (const rt of [this.sceneRT, this.otherRT, this.maskRT]) {
      if (rt.samples !== samples) {
        rt.samples = samples;
        rt.dispose(); // re-created with the new sample count on next use
      }
    }
    for (const site of this.sites) {
      if (!site.ribbon) continue;
      site.ribbon.mesh.visible = q.ribbons;
      site.ribbon.mesh.castShadow = q.ribbonShadow;
    }
    const u = this.final.material.uniforms;
    u.uGrain.value = q.grain ? 0.03 : 0;
    u.uVignette.value = q.grain ? 0.55 : 0;
    if (!q.reveal) this.clearMask();
    this.shadowDirty = true;
  }

  /** A line in the debug panel's log. */
  note(msg) {
    const p = this.perf;
    const t = p.started ? (performance.now() - p.started) / 1000 : 0;
    p.log.push({ t, msg });
    if (p.log.length > 8) p.log.shift();
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
    // Shadows only need redrawing when the sun (or a shadow caster) moves.
    this.sunMoved = this._lastSun.distanceToSquared(this.sun.position) > 1e-8 || this.sunMoved === undefined;
    this._lastSun.copy(this.sun.position);
  }

  /**
   * Everything that depends on the time of day, for one render pass.
   * `inBeam` is the pass seen through the hero beam: its night sky keeps fewer
   * clouds, so by day the beam reads as the poster's deep navy.
   */
  applyTime(n, inBeam = false) {
    this.sun.intensity = THREE.MathUtils.lerp(3.3, 0.35, n);
    this.sun.color.copy(this._sunDay).lerp(this._moon, n);
    this.hemi.intensity = THREE.MathUtils.lerp(1.25, 0.55, n);
    this.hemi.color.copy(this._hemiDay).lerp(this._hemiNight, n);
    this.hemi.groundColor.copy(this._groundDay).lerp(this._groundNight, n);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.55, 0.12, n);
    this.fog.color.copy(SKY.dayHor).lerp(SKY.nightHor, n);
    this.sky.material.uniforms.uNight.value = n;
    this.sky.material.uniforms.uCloud.value = inBeam ? 1 - 0.65 * n : 1;
    updateMaterials(this.mats, n);
    this.spot.intensity = this.spotSite?.device.spotAnchor ? n * 260 * this.spotSite.activity : 0;
    this.sites.forEach((site) => site.device.applyTime(n, site.activity));
    if (this.sea) this.sea.material.uniforms.uNight.value = n;
    this.plazaLamps.forEach((l) => l.update(n, 0));
  }

  /** Post-processing follows the *current* time of day only. */
  updatePost(n) {
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.08, 1.05, n);
    // Night keeps a steady glow. While the light changes (either way) a soft
    // haze swells over the bright facades and then fades out *smoothly*;
    // by full day bloom is at zero and switched off to save the cost.
    const haze = Math.pow(Math.sin(Math.PI * n), 1.5);
    this.bloom.strength = 0.45 * n + 0.42 * haze;
    this.bloom.threshold = THREE.MathUtils.lerp(0.9, 0.78, haze);
    // At night a soft knee: lights only a little over the threshold (the
    // long strip lights) glow gently instead of in full, so their haze
    // doesn't wash out the lettering near them, while small bright lights
    // still bloom fully. The transition haze keeps the hard knee.
    this.bloom.highPassUniforms.smoothWidth.value = THREE.MathUtils.lerp(0.9, 0.01, haze);
    this.bloom.radius = THREE.MathUtils.lerp(0.4, 0.6, Math.max(n, haze));
    this.bloom.enabled = this.bloom.strength > 0.004;
    this.sky.material.uniforms.uTime.value = this.time;
  }

  /**
   * Screen-space bounding box of a page's mask (to scissor the opposite-time
   * render), and the on-screen position/size of its glowing light source.
   */
  updateReveal(site) {
    const size = this.renderSize(this._size);
    const cam = this.camera;
    if (site.device.screenBox) site.device.screenBox(size, site.box);
    else this.maskBox(site, size);

    const g = site.device.glow;
    if (!g) return null;
    const c = site.group.localToWorld(this._v.copy(g.pos));
    const e = this._v2.copy(cam.position).sub(c).cross(cam.up).normalize().multiplyScalar(g.radius).add(c);
    c.project(cam);
    e.project(cam);
    return {
      x: (c.x * 0.5 + 0.5) * size.x,
      y: (c.y * 0.5 + 0.5) * size.y,
      r: Math.max(4, Math.hypot((e.x - c.x) * 0.5 * size.x, (e.y - c.y) * 0.5 * size.y)),
      visible: c.z < 1,
    };
  }

  /** Pixel bbox of a 3D mask (its Box3 corners, clipped against the near plane). */
  maskBox(site, size) {
    const cam = this.camera;
    const box = this._box.setFromObject(site.device.mask);
    // Box corners in view space, clipped against the near plane (a steeply
    // up-looking camera often has the bottom of a beam behind it).
    const near = -cam.near - 1e-3;
    const cv = this._corners;
    for (let i = 0; i < 8; i++) {
      cv[i].set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(cam.matrixWorldInverse);
    }
    const pts = [];
    for (let i = 0; i < 8; i++) {
      if (cv[i].z < near) pts.push(cv[i].clone());
      for (const bit of [1, 2, 4]) {
        const j = i | bit;
        if (j === i) continue;
        const a = cv[i];
        const b = cv[j];
        if (a.z < near !== b.z < near) pts.push(a.clone().lerp(b, (near - a.z) / (b.z - a.z)));
      }
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const q of pts) {
      q.applyMatrix4(cam.projectionMatrix);
      const x = (q.x * 0.5 + 0.5) * size.x;
      const y = (q.y * 0.5 + 0.5) * size.y;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    if (!pts.length) site.box.set(0, 0, 1, 1);
    else {
      x0 = Math.max(0, Math.floor(x0) - 2);
      y0 = Math.max(0, Math.floor(y0) - 2);
      x1 = Math.min(size.x, Math.ceil(x1) + 2);
      y1 = Math.min(size.y, Math.ceil(y1) + 2);
      site.box.set(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    }
  }

  /** Empty mask (reveal switched off): lettering reads it too. */
  clearMask() {
    const r = this.renderer;
    r.getClearColor(this._clear);
    const alpha = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.maskRT);
    r.clear();
    r.setRenderTarget(null);
    r.setClearColor(this._clear, alpha);
  }

  /** Draw every visible device mask into maskRT (white = show the other time). */
  renderMask() {
    const r = this.renderer;
    const layers = this.camera.layers.mask;
    this.camera.layers.set(MASK_LAYER);
    r.getClearColor(this._clear);
    const alpha = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.maskRT);
    r.clear();
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    r.setClearColor(this._clear, alpha);
    this.camera.layers.mask = layers;
  }

  /**
   * Dev tool for composing views: renders the active page's mask small, and
   * ray-casts each masked pixel to see whether it shows sky or something
   * solid. Reports coverage and how much of the mask's upper half is sky.
   */
  probeMask(w = 96, h = 60) {
    const rt = new THREE.WebGLRenderTarget(w, h);
    const keep = this.maskRT;
    this.maskRT = rt;
    this.renderMask();
    this.maskRT = keep;
    const px = new Uint8Array(w * h * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    rt.dispose();
    const targets = [];
    const site = this.sites[this.active];
    const skip = new Set();
    site.device.group.traverse((o) => skip.add(o));
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.visible || o === this.sky || o === this.sea || skip.has(o)) return;
      if (o.material.isShaderMaterial || o.layers.mask !== 1) return;
      targets.push(o);
    });
    const ray = new THREE.Raycaster();
    const rows = [];
    for (let y = h - 1; y >= 0; y--) {
      let n = 0;
      let sky = 0;
      for (let x = 0; x < w; x += 2) {
        if (px[(y * w + x) * 4] < 128) continue;
        n++;
        ray.setFromCamera(new THREE.Vector2(((x + 0.5) / w) * 2 - 1, ((y + 0.5) / h) * 2 - 1), this.camera);
        if (!ray.intersectObjects(targets, false).length) sky++;
      }
      if (n) rows.push(sky / n);
    }
    const half = Math.ceil(rows.length / 2);
    const avg = (a) => a.reduce((x, v) => x + v, 0) / Math.max(1, a.length);
    let covered = 0;
    for (let i = 0; i < w * h; i++) if (px[i * 4] >= 128) covered++;
    return {
      coverage: +((covered / (w * h)) * 100).toFixed(1), // % of the frame inside the mask
      skyUpperHalf: +avg(rows.slice(0, half)).toFixed(2),
      skyAll: +avg(rows).toFixed(2),
    };
  }

  /** Hang the single spotlight in the most "on" hero lamp. */
  placeSpot() {
    const site = this.sites.reduce((best, x) => (x.activity > best.activity ? x : best));
    this.spotSite = site;
    const a = site.device.spotAnchor;
    if (!a) return;
    site.group.localToWorld(this.spot.position.copy(a.top));
    site.group.localToWorld(this.spot.target.position.copy(a.base));
    this.spot.target.updateMatrixWorld();
  }

  /**
   * Frames a second to render (0: one per display refresh). The cap, or with
   * 'auto' every n-th refresh of a fast display, at 55 a second or more:
   * 144 Hz → 72, 120 → 60, 165 → 55, 240 → 60; up to 100 Hz, every refresh.
   */
  get fpsTarget() {
    const cap = this.quality.fpsCap;
    if (cap !== 'auto') return cap || 0;
    const hz = this.perf.refreshHz;
    if (!hz || hz <= 100) return 0;
    return hz / Math.floor(hz / 55);
  }

  /** Every animation-frame interval (rendered or skipped by an fps cap). */
  trackRaw(ms) {
    const r = this.perf.raw;
    r.push(ms);
    if (r.length > 240) r.shift();
  }

  /**
   * Called after each rendered frame with the time since the previous one.
   * Keeps one-second statistics for the debug panel and, in "auto" mode,
   * adapts the resolution. With a GPU timer the decision uses the GPU's own
   * time (a slow moment on the main thread, e.g. while the page is still
   * loading, no longer drops the resolution for good), and it steps back up
   * when there is room. Without one it steps down after three slow seconds
   * in a row, and tries a step up after ten good ones (see adapt).
   */
  trackFrame(ms) {
    const p = this.perf;
    const now = performance.now();
    const gpu = this.gpu.take();
    p.history.push(ms);
    if (p.history.length > 180) p.history.shift();
    for (const g of gpu) {
      p.gpuHistory.push(g);
      if (p.gpuHistory.length > 180) p.gpuHistory.shift();
    }
    if (!p.started) {
      p.started = now;
      p.winStart = now;
      p.settleUntil = now + 2500;
    }
    if (document.hidden || ms > 250) {
      p.win.length = 0;
      p.gpuWin.length = 0;
      p.winStart = now;
      return;
    }
    p.win.push(ms);
    p.gpuWin.push(...gpu);
    if (now - p.winStart < 1000 || p.win.length < 20) return;

    const win = p.win.slice().sort((a, b) => a - b);
    const sum = win.reduce((a, b) => a + b, 0);
    p.fps = (win.length * 1000) / sum;
    p.frameMs = sum / win.length;
    p.worstMs = win[win.length - 1];
    const median = win[win.length >> 1];
    const gpuAvg = p.gpuWin.length ? p.gpuWin.reduce((a, b) => a + b, 0) / p.gpuWin.length : null;
    if (gpuAvg !== null) p.gpuMs = gpuAvg;
    const raw = p.raw.slice().sort((a, b) => a - b);
    if (raw.length > 30) p.refreshHz = 1000 / raw[Math.floor(raw.length * 0.1)];
    p.win.length = 0;
    p.gpuWin.length = 0;
    p.winStart = now;

    // (during a flight only downwards: a slow opening flight shouldn't
    // stutter to its end first, and a step up mid-flight would show)
    if (this.quality.scale === 'auto' && now > p.settleUntil) this.adapt(median, gpuAvg, now, !!this.flight);
  }

  /**
   * "auto": the best picture unless it plainly can't keep up. Down only after
   * three seconds in a row of a real slowdown (under ~45 frames a second on
   * average, and with a GPU timer the GPU itself well over a frame's time, so
   * a busy main thread doesn't cost resolution), and then by a small step;
   * back up as soon as the next step up, by its estimated cost, still leaves
   * room.
   */
  adapt(median, gpu, now, flying = false) {
    const p = this.perf;
    const budget = 1000 / Math.min(60, this.fpsTarget || 60); // ms per frame we aim for
    const mean = p.frameMs;
    // Don't climb straight back to a ratio that was too slow a moment ago.
    const top = p.ceiling && now - p.ceilingAt < 20000 ? Math.min(this.maxPixelRatio, p.ceiling * 0.95) : this.maxPixelRatio;
    const tooSlow = () => {
      p.ceiling = this.pixelRatio;
      p.ceilingAt = now;
    };
    let next = this.pixelRatio;
    let why = '';
    if (gpu !== null) {
      // GPU time grows roughly with the number of pixels (ratio squared):
      // back up a step when the step's cost, so estimated, still leaves room.
      const step = Math.min(1.15, top / this.pixelRatio);
      p.slow = gpu > budget * 1.15 && mean > budget * 1.33 ? p.slow + 1 : 0;
      p.fast = step > 1.01 && gpu * step * step < budget * 0.85 ? p.fast + 1 : 0;
      if (p.slow >= 3) {
        next = this.pixelRatio * THREE.MathUtils.clamp(Math.sqrt((budget * 0.9) / gpu), 0.8, 0.93);
        why = `GPU 每帧 ${gpu.toFixed(1)} ms，平均 ${(1000 / mean).toFixed(0)} fps，偏慢`;
        tooSlow();
      } else if (p.fast >= 3) {
        next = this.pixelRatio * step;
        why = `GPU 每帧 ${gpu.toFixed(1)} ms，有余量`;
      }
    } else {
      // Without a GPU timer only the frame interval tells, and at the
      // display's own rate it can't tell how much room is left: after ten
      // good seconds in a row, try a step up (a slow one comes back down and
      // isn't tried again for a while).
      p.slow = mean > Math.max(24, budget * 1.4) ? p.slow + 1 : 0;
      p.fast = mean < budget * 1.15 ? p.fast + 1 : 0;
      if (p.slow >= 3) {
        next = this.pixelRatio * 0.88;
        why = `平均帧间隔 ${mean.toFixed(1)} ms`;
        tooSlow();
      } else if (p.fast >= 10 && top > this.pixelRatio * 1.03) {
        next = Math.min(top, this.pixelRatio * 1.1);
        why = `帧间隔 ${median.toFixed(1)} ms，试着调高`;
      }
    }
    next = THREE.MathUtils.clamp(next, this.minPixelRatio, this.maxPixelRatio);
    if (flying && next > this.pixelRatio) return;
    if (Math.abs(next - this.pixelRatio) < 0.03) return;
    this.note(`自动分辨率 ${this.pixelRatio.toFixed(2)} → ${next.toFixed(2)}（${why}）`);
    this.setPixelRatio(next);
  }

  /** Render the mask and, if anything is revealed, the scene at the opposite time of day. */
  renderBeam() {
    const site = this.sites.reduce((best, x) => (x.activity > best.activity ? x : best));
    const u = this.final.material.uniforms;
    u.uMix.value = 0;
    u.uSun.value = 0;
    if (site.activity < 0.002 || !this.quality.reveal) return;
    const glow = this.updateReveal(site);
    this.renderMask();
    u.uMix.value = 1;
    const g = site.device.glow;
    if (glow && glow.visible) {
      u.uSunPos.value.set(glow.x, glow.y);
      u.uSunR.value = glow.r * 0.9;
      u.uSun.value = THREE.MathUtils.lerp(g.day, g.night, this.night) * site.activity;
    }

    this.applyTime(1 - this.night, true);
    const r = this.renderer;
    this.otherRT.scissor.copy(site.box);
    this.otherRT.scissorTest = true;
    r.setRenderTarget(this.otherRT);
    // Only pixels inside the reveal are worth shading: clear depth to "near"
    // so everything fails the depth test, then punch the device's shape back
    // to "far" (PUNCH_LAYER), then draw the scene.
    const depth = r.state.buffers.depth;
    r.state.buffers.color.setMask(true);
    depth.setClear(0);
    r.clear();
    depth.setClear(1);
    const autoClear = r.autoClear;
    r.autoClear = false;
    const layers = this.camera.layers.mask;
    this.camera.layers.set(PUNCH_LAYER);
    r.render(this.scene, this.camera);
    this.camera.layers.mask = layers;
    r.render(this.scene, this.camera);
    r.autoClear = autoClear;
    r.setRenderTarget(null);
  }

  update(dt) {
    this.renderer.info.reset();
    this.time += dt;
    this.night = damp(this.night, this.nightTarget, 2.2, dt);
    if (Math.abs(this.night - this.nightTarget) < 0.001) this.night = this.nightTarget;

    this.updateCamera(dt);
    this.updateSun();

    const p = this.progress;
    this.sites.forEach((site, i) => {
      // (at a card's close-up the page's titles and reveal stand down)
      const on = i === this.active && p > 0.62 && !this.closeUp ? 1 : 0;
      site.activity = damp(site.activity, on, on ? 2.6 : 5, dt);
      if (this.quality.ribbons) site.ribbon?.update(this.time + i * 3.1);
      site.plane?.update(this.time);
      site.device.update(this.time, dt, this.night, site.activity, this.camera);
      site.group.userData.animate?.(this.time, dt, this.night);
      site.texts.forEach((t, k) => {
        // Stagger the letters' arrival a little.
        const o = THREE.MathUtils.clamp(site.activity * 1.6 - k * 0.12, 0, 1);
        t.update(this.night, o);
      });
      // (a close-up's ground lettering: in as the camera rises to it, out as it leaves)
      for (const g of site.grounds || []) {
        const on = this.closeUp?.spot === g.spot ? 1 : 0;
        g.shown = damp(g.shown, on, on ? 1.1 : 3.5, dt);
        const at = this.closeUp?.spot === g.spot ? this.closeUp.tall : this.camera.aspect < 0.9;
        const tall = at && g.ground.portrait;
        const v = tall || g.ground;
        g.group.position.set(v.p[0], 0.05, v.p[1]);
        g.group.rotation.y = v.r || 0;
        g.group.scale.setScalar(v.scale || 1);
        g.blocks.forEach((t, k) => {
          const hide = tall && g.ground.items[k].portrait === false;
          t.update(this.night, hide ? 0 : THREE.MathUtils.clamp(g.shown * 1.8 - k * 0.12, 0, 1));
        });
      }
    });
    this.updatePost(this.night);
    WIND.value = this.time;
    if (this.sea) this.sea.material.uniforms.uSunDir.value.copy(this.sun.position).sub(this.sun.target.position).normalize();
    this.placeSpot();

    // Both time-of-day renders share one shadow map, redrawn only when a
    // shadow moves: the sun follows the camera's heading and the time of day.
    const q = this.quality;
    if (this.sunMoved || this.shadowDirty || (q.ribbonShadow && q.ribbons)) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
    }
    this.gpu.begin();
    this.renderBeam(); // other time of day -> otherRT
    this.applyTime(this.night);
    this.renderPost();
    this.gpu.end();
    const info = this.renderer.info.render;
    this.perf.calls = info.calls;
    this.perf.triangles = info.triangles;
  }
}
