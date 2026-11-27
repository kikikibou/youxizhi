import * as THREE from 'three';

/**
 * A treasure chest, low-poly like the planting: a wooden box with gold
 * corners, straps and lock, a faceted barrel lid on a hinge at the back, a
 * bed of gold and three gems inside. Opened (toggle()), the lid swings up
 * and back, a ring of light bursts from it, and a beam rises from it in the
 * rainbow of the 问答 page's blank "Q" when it's solved (.blank in style.css:
 * the same seven colours, running up it), sparkles spiralling up inside.
 *
 * Built facing +z with its foot at the origin; `group` goes wherever it's
 * wanted (the 问答 maze's far dead end: mazeChest in details.js, World).
 */

// The "Q"'s colours (style.css, .blank.is-solved .blank-letter), in turn.
const STOPS = ['#ff5f6d', '#ffb35c', '#ffe76a', '#6fe3a5', '#5cc8ff', '#a58bff', '#ff7ec8'].map((c) => new THREE.Color(c));
const RAINBOW_GLSL = /* glsl */ `
  uniform vec3 uStops[7];
  vec3 rainbow(float t) {
    t = fract(t) * 7.0;
    int i = int(floor(t));
    return mix(uStops[i], uStops[(i + 1) % 7], smoothstep(0.0, 1.0, fract(t)));
  }
`;

const W = 0.82; // width (along x)
const D = 0.54; // depth (along z)
const H = 0.4; // the box's height (the lid sits on it)
const R = D / 2; // the lid's radius
const OPEN = 1.95; // how far the lid opens (radians)
const BEAM = 6.5; // the beam's height

const box = (a, b) => new THREE.BoxGeometry(b[0] - a[0], b[1] - a[1], b[2] - a[2]).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
/** Half a cylinder along x, its flat side down (its centre line at y 0, z 0). */
const barrel = (r, len, segs = 6, open = false) => new THREE.CylinderGeometry(r, r, len, segs, 1, open, 0, Math.PI).rotateZ(Math.PI / 2);

const easeOutBack = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createChest(mats) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a5a32, roughness: 0.85, flatShading: true });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.95 });
  const gold = mats.gold;
  // (the bed of gold and the gems light up as it opens)
  const hoard = new THREE.MeshStandardMaterial({ color: 0xf2c357, roughness: 0.35, metalness: 0.4, emissive: new THREE.Color(0xffb84a), emissiveIntensity: 0, flatShading: true });
  const gems = ['#ff5f6d', '#5cc8ff', '#6fe3a5'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.2, emissive: new THREE.Color(c), emissiveIntensity: 0.2, flatShading: true }));
  const shadowed = (m) => ((m.castShadow = m.receiveShadow = true), m);
  const mesh = (geo, mat, parent = group) => {
    const m = shadowed(new THREE.Mesh(geo, mat));
    parent.add(m);
    return m;
  };

  // The box: a floor and four walls (so it's hollow when the lid's up).
  const t = 0.05;
  mesh(box([-W / 2, 0, -D / 2], [W / 2, t, D / 2]), wood);
  mesh(box([-W / 2, 0, D / 2 - t], [W / 2, H, D / 2]), wood);
  mesh(box([-W / 2, 0, -D / 2], [W / 2, H, -D / 2 + t]), wood);
  mesh(box([-W / 2, 0, -D / 2 + t], [-W / 2 + t, H, D / 2 - t]), wood);
  mesh(box([W / 2 - t, 0, -D / 2 + t], [W / 2, H, D / 2 - t]), wood);
  // Gold at its corners, a strap down the front and back either side, the lock.
  const c = 0.035;
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) mesh(box([x - c, 0, z - c], [x + c, H, z + c]), gold);
  for (const x of [-0.24, 0.24]) {
    mesh(box([x - 0.035, 0, D / 2], [x + 0.035, H, D / 2 + 0.014]), gold);
    mesh(box([x - 0.035, 0, -D / 2 - 0.014], [x + 0.035, H, -D / 2]), gold);
  }
  mesh(box([-0.075, H - 0.17, D / 2], [0.075, H - 0.02, D / 2 + 0.022]), gold);
  mesh(box([-0.012, H - 0.13, D / 2 + 0.02], [0.012, H - 0.07, D / 2 + 0.026]), woodDark);
  // Inside: a bed of gold, heaped a little, and three gems on it.
  mesh(box([-W / 2 + t, t, -D / 2 + t], [W / 2 - t, H - 0.1, D / 2 - t]), hoard);
  for (const [x, z, s] of [[-0.2, 0.06, 0.13], [0.05, -0.05, 0.15], [0.22, 0.08, 0.11], [-0.05, 0.1, 0.1]]) {
    mesh(new THREE.IcosahedronGeometry(s, 0).scale(1, 0.45, 1).translate(x, H - 0.1, z), hoard);
  }
  [[-0.14, -0.06], [0.12, 0.09], [0.27, -0.07]].forEach(([x, z], i) => {
    mesh(new THREE.OctahedronGeometry(0.05, 0).scale(1, 1.3, 1).translate(x, H - 0.02, z), gems[i]);
  });

  // The lid, on its hinge along the back of the top (rotation.x opens it).
  const lid = new THREE.Group();
  lid.position.set(0, H, -D / 2);
  group.add(lid);
  mesh(barrel(R, W).translate(0, 0, R), wood, lid);
  mesh(box([-W / 2 + 0.01, 0, 0.01], [W / 2 - 0.01, 0.012, D - 0.01]), woodDark, lid);
  for (const x of [-0.24, 0.24]) mesh(barrel(R + 0.014, 0.07).translate(x, 0, R), gold, lid);
  for (const x of [-W / 2, W / 2]) mesh(barrel(R + 0.01, 0.05).translate(x, 0, R), gold, lid);
  mesh(box([-0.05, -0.08, D], [0.05, 0.05, D + 0.026]), gold, lid); // (the hasp, over the lock)

  // What can be clicked: a little more than the chest, open or shut.
  const hit = new THREE.Mesh(box([-W / 2 - 0.15, 0, -D / 2 - 0.2], [W / 2 + 0.15, H + R + 0.25, D / 2 + 0.15]), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(hit);

  // The light: a beam up from it, sparkles in it, a ring bursting out once.
  const uniforms = {
    uStops: { value: STOPS },
    uTime: { value: 0 },
    uOpen: { value: 0 }, // (the beam's strength)
    uGrow: { value: 0 }, // (how far up it has reached)
    uNight: { value: 0 },
    uPx: { value: 1 }, // (a sparkle's size in pixels at 1 m)
  };
  const beamGeo = new THREE.CylinderGeometry(1.25, 0.3, BEAM, 40, 12, true).translate(0, BEAM / 2, 0);
  const beam = new THREE.Mesh(
    beamGeo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        uniform float uGrow;
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vView;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.y *= uGrow;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpen;
        uniform float uNight;
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vView;
        ${RAINBOW_GLSL}
        void main() {
          float v = vUv.y;
          // (soft at its sides: strongest where it faces the camera)
          float face = pow(abs(dot(normalize(vN), normalize(vView))), 1.6);
          float fade = smoothstep(0.0, 0.05, v) * pow(1.0 - v, 1.4);
          // the colours run up it, turning round it; streaks rise through
          vec3 c = rainbow(v * 1.4 - uTime * 0.45 + vUv.x * 2.0);
          float streak = 0.75 + 0.25 * sin(vUv.x * 6.2832 * 7.0 + v * 9.0 - uTime * 3.0);
          // (a white core near the chest, like the Q's glow: by night; by
          // day, on the pale paving, the colours as they are, and stronger)
          c = mix(c, vec3(1.0), mix(0.0, 0.25, uNight) + mix(0.2, 0.55, uNight) * smoothstep(0.25, 0.0, v) * face);
          float a = uOpen * fade * face * streak * mix(1.15, 0.9, uNight);
          gl_FragColor = vec4(c * mix(0.92, 1.5, uNight), clamp(a, 0.0, 1.0));
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.y = H;
  beam.renderOrder = 3;
  group.add(beam);

  const N = 70;
  const seeds = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) seeds.set([i / N, ((i * 0.6180339) % 1) * 0.9 + 0.1], i * 2);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));
  sparkGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, BEAM / 2, 0), BEAM);
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        attribute vec2 aSeed;
        uniform float uTime;
        uniform float uOpen;
        uniform float uGrow;
        uniform float uPx;
        varying float vA;
        varying float vHue;
        void main() {
          float k = aSeed.y;
          float t = fract(aSeed.x * 3.7 + uTime * (0.16 + 0.14 * k));
          float ang = aSeed.x * 40.0 + uTime * (0.9 + k);
          float r = (0.1 + 0.55 * t) * (0.5 + 0.5 * k);
          vec3 p = vec3(cos(ang) * r, t * ${(BEAM * 0.85).toFixed(2)} * uGrow, sin(ang) * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * (0.12 + 0.16 * k) * (1.0 - 0.4 * t) / -mv.z;
          vA = uOpen * smoothstep(0.0, 0.08, t) * (1.0 - t) * (0.6 + 0.4 * sin(uTime * 9.0 + aSeed.x * 50.0));
          vHue = aSeed.x * 3.0 + uTime * 0.3;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        varying float vHue;
        ${RAINBOW_GLSL}
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          // a four-pointed twinkle: a soft dot and a thin cross
          float dot_ = smoothstep(0.5, 0.0, length(q) * 1.6);
          float cross = smoothstep(0.06, 0.0, abs(q.x)) * smoothstep(0.5, 0.0, abs(q.y)) + smoothstep(0.06, 0.0, abs(q.y)) * smoothstep(0.5, 0.0, abs(q.x));
          float a = clamp(dot_ + cross, 0.0, 1.0) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(mix(rainbow(vHue), vec3(1.0), 0.45 + 0.4 * dot_), a);
        }`,
      transparent: true,
      depthWrite: false,
    }),
  );
  sparks.position.y = H;
  sparks.renderOrder = 4;
  group.add(sparks);

  const ringU = { uStops: { value: STOPS }, uT: { value: 1 }, uTime: uniforms.uTime };
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1, 56).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: ringU,
      vertexShader: /* glsl */ `
        varying float vAng;
        void main() {
          vAng = atan(position.z, position.x) / 6.2832;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uT;
        uniform float uTime;
        varying float vAng;
        ${RAINBOW_GLSL}
        void main() {
          gl_FragColor = vec4(mix(rainbow(vAng + uTime * 0.5), vec3(1.0), 0.3), (1.0 - uT) * 0.95);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  ring.position.y = H + 0.05;
  ring.renderOrder = 4;
  group.add(ring);

  // Shut, now and then a glint on its lid catches the eye.
  const glintU = { uGlint: { value: 0 }, uPx: uniforms.uPx };
  const glint = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.16, H + R + 0.04, 0.05]), 3)),
    new THREE.ShaderMaterial({
      uniforms: glintU,
      vertexShader: /* glsl */ `
        uniform float uGlint;
        uniform float uPx;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uPx * 1.1 * (0.4 + 0.6 * uGlint) / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uGlint;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float core = smoothstep(0.17, 0.0, length(q));
          float rays = smoothstep(0.05, 0.0, abs(q.x)) * smoothstep(0.5, 0.0, abs(q.y)) + smoothstep(0.05, 0.0, abs(q.y)) * smoothstep(0.5, 0.0, abs(q.x));
          float a = clamp(core + rays, 0.0, 1.0) * uGlint;
          if (a < 0.01) discard;
          // (white at its heart, gold along its rays: it shows on the pale paving too)
          gl_FragColor = vec4(mix(vec3(1.0, 0.78, 0.3), vec3(1.0), core), a);
        }`,
      transparent: true,
      depthWrite: false,
    }),
  );
  glint.renderOrder = 4;
  group.add(glint);
  const lights = [beam, sparks, ring, glint];

  let open = false;
  let k = 0; // 0 shut .. 1 open (the lid), eased as it goes
  let glow = 0; // the beam's strength
  let burst = 1; // the ring: 0 just burst .. 1 gone
  let hop = 1; // the lid's little jump as it comes free: 0 .. 1 done
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  return {
    group,
    hit,
    get open() {
      return open;
    },
    toggle() {
      open = !open;
      if (open) burst = hop = 0;
    },
    /** Shut it at once (the camera has gone). */
    reset() {
      open = false;
      k = glow = 0;
      burst = hop = 1;
    },
    /**
     * Each frame while it's shown. `px`: pixels per metre at 1 m off (the
     * render target's height / 2 / tan(fov / 2)), for the sparkles. Returns
     * whether the lid moved (its shadow wants redrawing).
     */
    update(dt, time, night, px) {
      const k0 = k;
      k = THREE.MathUtils.clamp(k + (open ? dt / 0.55 : -dt / 0.4), 0, 1);
      glow = THREE.MathUtils.clamp(glow + (open && k > 0.35 ? dt / 0.7 : -dt / 0.3), 0, 1);
      burst = Math.min(1, burst + dt / 0.9);
      hop = Math.min(1, hop + dt / 0.35);
      lid.rotation.x = -OPEN * (open ? easeOutBack(k) : easeInOut(k));
      lid.position.y = H + (reduce.matches ? 0 : Math.sin(Math.PI * hop) * 0.035);
      uniforms.uTime.value = time;
      uniforms.uOpen.value = easeInOut(glow);
      uniforms.uGrow.value = 1 - (1 - glow) ** 3;
      uniforms.uNight.value = night;
      uniforms.uPx.value = px;
      ringU.uT.value = burst;
      // (a glint every few seconds while it's shut)
      const ph = (time % 2.8) / 0.5;
      glintU.uGlint.value = k === 0 && !open && ph < 1 ? Math.sin(Math.PI * ph) ** 2 : 0;
      glint.visible = glintU.uGlint.value > 0.001;
      ring.scale.setScalar(0.35 + 2.6 * (1 - (1 - burst) ** 3));
      hoard.emissiveIntensity = glow * (0.35 + night * 0.6);
      gems.forEach((m) => (m.emissiveIntensity = 0.2 + glow * (0.8 + night)));
      beam.visible = sparks.visible = glow > 0.001;
      ring.visible = burst < 1;
      return k !== k0;
    },
    lights,
  };
}
