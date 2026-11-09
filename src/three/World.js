import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

import { createMaterials, updateMaterials } from './materials.js';
import { BUILDERS } from './buildings.js';
import { createGround, createTree, Lamp, Ribbon } from './props.js';
import { createSky, SKY } from './sky.js';
import { TextBlock, buildCluster, loadFonts } from './typography.js';

const PLAZA_RADIUS = 56;
const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.045 }, uVignette: { value: 0.55 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVignette; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float n = h(vUv * 1000.0 + fract(uTime) * 91.7);
      c.rgb += (n - 0.5) * uGrain;
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - dot(q, q) * uVignette;
      gl_FragColor = c;
    }`,
};

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
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.lowPower ? 1.25 : 1.75));
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
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
    this._size = new THREE.Vector2();
    window.addEventListener('resize', () => this.resize());
  }

  /* ------------------------------------------------------------------ */

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xc4dcf2, 0xd9c6ae, 1.2);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xfff1de, 3.2));
    sun.castShadow = true;
    const shadowSize = this.lowPower ? 2048 : 4096;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const s = 105;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 420 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);
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
      const lamp = new Lamp(this.mats, { height: sc.lamp.h, beam: true, spot: true });
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

      const v = sc.view;
      const pos = group.localToWorld(new THREE.Vector3(...v.pos));
      const target = group.localToWorld(new THREE.Vector3(...v.target));
      const m = new THREE.Matrix4().lookAt(pos, target, UP);
      const quat = new THREE.Quaternion().setFromRotationMatrix(m);
      quat.multiply(new THREE.Quaternion().setFromAxisAngle(Z, v.roll || 0));

      const tri = {
        a: { value: new THREE.Vector2(-1, -1) },
        b: { value: new THREE.Vector2(-1, -1) },
        c: { value: new THREE.Vector2(-1, -1) },
      };
      this.sites.push({ page, group, lamp, ribbon, tri, texts: [], view: { pos, quat, fov: v.fov }, activity: 0 });
    });
  }

  buildPlazaFurniture() {
    const n = this.pages.length;
    // Smaller lamps between the buildings, and a ring of trees.
    this.plazaLamps = [];
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      const lamp = new Lamp(this.mats, { height: 10, beamRadius: 3.6 });
      lamp.group.position.set(Math.sin(a) * 38, 0, Math.cos(a) * 38);
      this.scene.add(lamp.group);
      this.plazaLamps.push(lamp);
      for (const off of [-0.09, 0.09]) {
        const t = createTree(this.mats, 0.95 + Math.random() * 0.3);
        t.position.set(Math.sin(a + off) * 47, 0, Math.cos(a + off) * 47);
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
  }

  buildComposer() {
    const r = this.renderer;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.lowPower ? 2 : 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.15, 0.45, 0.95);
    this.composer.addPass(this.bloom);
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
      const cluster = buildCluster(site.page.scene.cluster, site.tri, aniso);
      site.group.add(cluster.group);
      site.texts.push(...cluster.blocks);
      for (const spec of site.page.scene.texts) {
        const block = new TextBlock(spec, site.tri, aniso);
        block.mesh.renderOrder = 3; // facade lettering sits *behind* the beam
        site.group.add(block.mesh);
        site.texts.push(block);
      }
    }
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

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
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
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.parallax.y * 0.022 + sway, -this.parallax.x * 0.035, 0, 'YXZ'),
    );
    this.camera.position.copy(this.basePos);
    this.camera.position.y += Math.sin(this.time * 0.4) * 0.05;
    this.camera.quaternion.copy(this.baseQuat).multiply(q);
    this.camera.fov = this.adaptFov(this.baseFov);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  updateLighting() {
    const n = this.night;
    // The sun swings with the camera so every facade is lit — and while the
    // camera travels, shadows sweep across the plaza like passing hours.
    const fwd = this._v.set(0, 0, -1).applyQuaternion(this.baseQuat);
    const yaw = Math.atan2(fwd.x, fwd.z) + Math.PI + 0.85;
    const elev = THREE.MathUtils.lerp(0.78, 0.95, n);
    this.sun.position.set(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev)).multiplyScalar(180);
    this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = THREE.MathUtils.lerp(3.3, 0.35, n);
    this.sun.color.setRGB(1, 0.94, 0.87).lerp(new THREE.Color(0.55, 0.65, 1.0), n);

    this.hemi.intensity = THREE.MathUtils.lerp(1.25, 0.55, n);
    this.hemi.color.set(0xc4dcf2).lerp(new THREE.Color(0x24345e), n);
    this.hemi.groundColor.set(0xd9c6ae).lerp(new THREE.Color(0x8a5a32), n);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.55, 0.12, n);
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(1.08, 1.05, n);

    this.fog.color.copy(SKY.dayHor).lerp(SKY.nightHor, n);
    this.sky.material.uniforms.uNight.value = n;
    this.sky.material.uniforms.uTime.value = this.time;

    this.bloom.strength = THREE.MathUtils.lerp(0.1, 0.45, n);
    this.bloom.threshold = THREE.MathUtils.lerp(0.95, 0.8, n);
    this.bloom.radius = THREE.MathUtils.lerp(0.4, 0.5, n);
    updateMaterials(this.mats, n);
  }

  /** Project each hero lamp's beam to a screen-space triangle for the text shader. */
  updateBeams() {
    const size = this.renderer.getDrawingBufferSize(this._size);
    const cam = this.camera;
    const toScreen = (v, out) => {
      v.project(cam);
      out.set((v.x * 0.5 + 0.5) * size.x, (v.y * 0.5 + 0.5) * size.y);
      return out;
    };
    const A = new THREE.Vector2();
    const P = new THREE.Vector2();
    for (const site of this.sites) {
      if (site.activity < 0.002) continue;
      const lamp = site.lamp;
      const apex = lamp.apexWorld(this._v);
      toScreen(apex, A);
      let minA = Infinity;
      let maxA = -Infinity;
      const L = new THREE.Vector2();
      const R = new THREE.Vector2();
      for (let k = 0; k < 48; k++) {
        const th = (k / 48) * Math.PI * 2;
        const w = lamp.group.localToWorld(this._v2.set(Math.cos(th) * lamp.beamRadius, 0, Math.sin(th) * lamp.beamRadius));
        const ndcZ = w.clone().project(cam).z;
        if (ndcZ > 1) continue;
        toScreen(w, P);
        const ang = Math.atan2(P.y - A.y, P.x - A.x);
        if (ang < minA) {
          minA = ang;
          L.copy(P);
        }
        if (ang > maxA) {
          maxA = ang;
          R.copy(P);
        }
      }
      // Extend the sides past the base so the split stays crisp all the way down.
      L.sub(A).multiplyScalar(1.8).add(A);
      R.sub(A).multiplyScalar(1.8).add(A);
      site.tri.a.value.copy(A);
      site.tri.b.value.copy(L);
      site.tri.c.value.copy(R);
    }
  }

  update(dt) {
    this.time += dt;
    this.night = damp(this.night, this.nightTarget, 2.2, dt);
    if (Math.abs(this.night - this.nightTarget) < 0.001) this.night = this.nightTarget;

    this.updateCamera(dt);
    this.updateLighting();

    const p = this.progress;
    this.sites.forEach((site, i) => {
      const on = i === this.active && p > 0.62 ? 1 : 0;
      site.activity = damp(site.activity, on, on ? 2.6 : 5, dt);
      site.lamp.update(this.time, this.night, site.activity);
      site.ribbon.update(this.time + i * 3.1);
      const fadeIn = site.activity;
      site.texts.forEach((t, k) => {
        // Stagger the letters' arrival a little.
        const o = THREE.MathUtils.clamp(fadeIn * 1.6 - k * 0.12, 0, 1);
        t.update(this.night, o);
      });
    });
    this.plazaLamps.forEach((l) => l.update(this.time, this.night, 0));
    this.updateBeams();
    this.grade.uniforms.uTime.value = this.time;
    this.composer.render(dt);
  }
}
