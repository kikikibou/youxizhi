import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* --------------------------------- Ground -------------------------------- */

function pavingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#cfcac1';
  g.fillRect(0, 0, 512, 512);
  // Subtle stone variation.
  for (let i = 0; i < 2200; i++) {
    const v = 190 + Math.random() * 30;
    g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.25)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
  g.strokeStyle = 'rgba(120,112,100,0.35)';
  g.lineWidth = 2;
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * 512;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, 512);
    g.moveTo(0, p);
    g.lineTo(512, p);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(150, 150);
  t.anisotropy = 8;
  return t;
}

export function createGround() {
  const mat = new THREE.MeshStandardMaterial({ map: pavingTexture(), roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------ Street lamp ------------------------------ */

const beamVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vViewPos = mv.xyz;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

// Ordinary lamps at night: a soft additive glow.
// NOTE: with MSAA, varyings can be extrapolated slightly past a triangle's
// edge, so every pow() base is clamped (a negative base gives NaN, which bloom
// would smear into a big rectangle).
const glowFrag = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    float v = clamp(vUv.y, 0.0, 1.0);
    vec3 view = normalize(-vViewPos);
    float facing = clamp(abs(dot(normalize(vNormalV), view)), 0.0, 1.0);
    float a = pow(facing, 1.6) * (pow(v, 2.4) * 0.55 + 0.03) * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export class Lamp {
  /** Glow colour shared by every lamp (set per colour scheme). */
  static glowColor = new THREE.Color(0xffc98c);

  /**
   * @param {object} opts
   *   height      pole height (m)
   *   beamRadius  radius of the light pool on the ground
   *   hero        the page's main lamp: its beam is where the scene switches to
   *               the opposite time of day (see BEAM_GLSL / World.renderBeam)
   */
  constructor(mats, { height = 14, beamRadius = null, hero = false } = {}) {
    this.hero = hero;
    this.group = new THREE.Group();
    this.height = height;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, height + 0.3, 14), mats.lampPole);
    pole.position.y = (height + 0.3) / 2;
    pole.castShadow = true;
    this.group.add(pole);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.35, 0.36, 56), mats.lampHead);
    head.position.y = height + 0.12;
    head.castShadow = true;
    this.group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 0.2, 24), mats.lampHead);
    cap.position.y = height + 0.4;
    this.group.add(cap);
    // The lens hangs clearly *below* the head (head underside is at height - 0.06).
    // When the two discs shared a plane they z-fought, and the 56 wedge segments
    // flickered like a spinning fan whenever the camera swayed.
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.08, 56), mats.bulb);
    bulb.position.y = height - 0.1;
    this.group.add(bulb);
    for (const m of [pole, head, cap, bulb]) m.renderOrder = 7; // after the beam (4/5) and text (6)

    // The beam leaves the whole width of the lamp, not a single point.
    this.topY = height - 0.14; // underside of the lens
    this.topRadius = 1.25;
    this.beamRadius = beamRadius ?? height * 0.42;
    const beamGeo = new THREE.CylinderGeometry(this.topRadius, this.beamRadius, this.topY, 72, 1, true);
    beamGeo.translate(0, this.topY / 2, 0);
    this.beamGeo = beamGeo;

    this.glow = new THREE.Mesh(
      beamGeo,
      new THREE.ShaderMaterial({
        vertexShader: beamVert,
        fragmentShader: glowFrag,
        uniforms: { uOpacity: { value: 0 }, uColor: { value: Lamp.glowColor } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.glow.renderOrder = 5;
    this.group.add(this.glow);

  }

  /** Called once per render pass with that pass's time of day. */
  update(night, active) {
    // A hero lamp's ordinary glow gives way to its day/night beam.
    const glow = night * 0.3 * (this.hero ? 1 - active : 1);
    this.glow.material.uniforms.uOpacity.value = glow;
    this.glow.visible = glow > 0.002;
  }
}

/* --------------------------------- Trees --------------------------------- */

let treeVariants = null;
function makeTreeVariants() {
  const variants = [];
  for (let v = 0; v < 4; v++) {
    const blobs = [];
    const count = 5 + v;
    for (let i = 0; i < count; i++) {
      const r = 1.1 + Math.random() * 1.0;
      const g = new THREE.IcosahedronGeometry(r, 1);
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 1.6;
      g.translate(Math.cos(a) * d, 4.2 + Math.random() * 2.6, Math.sin(a) * d);
      blobs.push(g);
    }
    const foliage = mergeGeometries(blobs);
    const trunk = new THREE.CylinderGeometry(0.14, 0.22, 4.6, 8);
    trunk.translate(0, 2.3, 0);
    variants.push({ foliage, trunk });
  }
  return variants;
}

export function createTree(mats, scale = 1) {
  treeVariants ||= makeTreeVariants();
  const v = treeVariants[Math.floor(Math.random() * treeVariants.length)];
  const g = new THREE.Group();
  const f = new THREE.Mesh(v.foliage, mats.leaf);
  const t = new THREE.Mesh(v.trunk, mats.trunk);
  f.castShadow = t.castShadow = true;
  f.receiveShadow = true;
  g.add(f, t);
  g.scale.setScalar(scale);
  g.rotation.y = Math.random() * Math.PI * 2;
  return g;
}

/* ------------------------------ Orange ribbon ---------------------------- */

export class Ribbon {
  constructor(mat, { length = 30, width = 1.2, segments = 180, seed = 0 } = {}) {
    this.length = length;
    this.width = width;
    this.segments = segments;
    this.seed = seed;
    const geo = new THREE.BufferGeometry();
    const n = (segments + 1) * 2;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.update(0);
  }

  update(t) {
    const pos = this.mesh.geometry.attributes.position.array;
    const s = this.seed;
    for (let i = 0; i <= this.segments; i++) {
      const u = i / this.segments;
      const x = -this.length / 2 + u * this.length;
      const amp = 1 - u * 0.75; // calmer where it is "tied" to the letters
      const y = (Math.sin(u * 7.0 + t * 0.9 + s) * 1.5 + Math.sin(u * 15.0 - t * 0.55 + s * 2) * 0.45) * amp;
      const z = Math.sin(u * 4.2 + t * 0.7 + s) * 2.4 * amp;
      const tw = Math.sin(u * 5.5 + t * 0.8 + s) * 1.25 + u * 0.8;
      const w = this.width * (1 - u * 0.7) * 0.5;
      const oy = Math.cos(tw) * w;
      const oz = Math.sin(tw) * w;
      const k = i * 6;
      pos[k] = x;
      pos[k + 1] = y + oy;
      pos[k + 2] = z + oz;
      pos[k + 3] = x;
      pos[k + 4] = y - oy;
      pos[k + 5] = z - oz;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}
