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

const coneVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying vec3 vLocal;
  void main() {
    vUv = uv;
    vLocal = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * wp;
    vViewPos = mv.xyz;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

// Daytime: the beam is a slice of night carved out of the day.
const dayConeFrag = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vLocal;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float a = mix(0.95, 1.0, smoothstep(0.0, 0.5, vUv.y));
    vec3 col = uColor;
    // Sparse stars living inside the beam.
    vec2 g = vec2(atan(vLocal.x, vLocal.z) * 9.0, vLocal.y * 1.4);
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    float r = hash(cell);
    float star = step(0.93, r) * smoothstep(0.09, 0.0, length(f));
    star *= 0.55 + 0.45 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
    col += star * vec3(1.0, 0.92, 0.8) * smoothstep(0.15, 0.6, vUv.y);
    gl_FragColor = vec4(col, a * uOpacity);
  }
`;

// Night: a soft volumetric beam of warm light.
const nightConeFrag = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    vec3 v = normalize(-vViewPos);
    float facing = abs(dot(normalize(vNormalV), v));
    float edge = pow(facing, 1.6);
    float fall = pow(vUv.y, 2.4) * 0.55 + 0.03;
    float a = edge * fall * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export class Lamp {
  constructor(mats, { height = 14, beam = false, beamRadius = null, spot = false } = {}) {
    this.group = new THREE.Group();
    this.height = height;
    const poleMat = mats.metal;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, height + 0.3, 14), poleMat);
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
    const bulb = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.04, 56), mats.bulb);
    bulb.position.y = height - 0.04;
    this.group.add(bulb);

    this.apex = new THREE.Vector3(0, height - 0.08, 0);
    const radius = beamRadius ?? height * 0.42;
    this.beamRadius = radius;

    const coneGeo = new THREE.ConeGeometry(radius, height - 0.08, 72, 1, true);
    coneGeo.translate(0, (height - 0.08) / 2, 0);

    this.nightCone = new THREE.Mesh(
      coneGeo,
      new THREE.ShaderMaterial({
        vertexShader: coneVert,
        fragmentShader: nightConeFrag,
        uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xffc98c) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.nightCone.renderOrder = 5;
    this.group.add(this.nightCone);

    if (beam) {
      this.dayCone = new THREE.Mesh(
        coneGeo,
        new THREE.ShaderMaterial({
          vertexShader: coneVert,
          fragmentShader: dayConeFrag,
          uniforms: {
            uOpacity: { value: 0 },
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0x0b1a38) },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.FrontSide,
        }),
      );
      this.dayCone.renderOrder = 4;
      this.group.add(this.dayCone);
    }

    if (spot) {
      this.spot = new THREE.SpotLight(0xffc580, 0, 46, 0.72, 0.75, 1.4);
      this.spot.position.copy(this.apex);
      this.spot.target.position.set(0, 0, 0);
      this.group.add(this.spot, this.spot.target);
    }
  }

  /** Beam apex in world space. */
  apexWorld(target) {
    return this.group.localToWorld(target.copy(this.apex));
  }

  update(time, night, active) {
    this.nightCone.material.uniforms.uOpacity.value = night * (0.3 + active * 0.5);
    this.nightCone.visible = this.nightCone.material.uniforms.uOpacity.value > 0.002;
    if (this.dayCone) {
      const o = (1 - night) * active;
      this.dayCone.material.uniforms.uOpacity.value = o;
      this.dayCone.material.uniforms.uTime.value = time;
      this.dayCone.visible = o > 0.002;
    }
    if (this.spot) this.spot.intensity = night * 260;
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
