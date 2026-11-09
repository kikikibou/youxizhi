import * as THREE from 'three';

/**
 * Sky: vertical gradient + two layers of drifting fbm clouds + stars.
 * `uNight` picks the time of day; `uCloud` scales cloud cover (the view seen
 * through the hero beam uses fewer clouds at night).
 */
export const SKY = {
  dayTop: new THREE.Color(0x4a82ba),
  dayHor: new THREE.Color(0xa9c8e4),
  nightTop: new THREE.Color(0x050d24),
  nightHor: new THREE.Color(0x1a2c55),
};

export const SKY_SHARED = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0.022, 0.009) },
  uDayTop: { value: SKY.dayTop },
  uDayHor: { value: SKY.dayHor },
  uNightTop: { value: SKY.nightTop },
  uNightHor: { value: SKY.nightHor },
};

export const SKY_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWind;
  uniform vec3 uDayTop;
  uniform vec3 uDayHor;
  uniform vec3 uNightTop;
  uniform vec3 uNightHor;

  float skyHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float skyNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(skyHash(i), skyHash(i + vec2(1, 0)), u.x), mix(skyHash(i + vec2(0, 1)), skyHash(i + vec2(1, 1)), u.x), u.y);
  }
  // Fewer octaves for the finer layers: the sky covers half the screen and is
  // drawn twice per frame (main view + beam), so every octave counts.
  float skyFbm(vec2 p, int octaves) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      v += a * skyNoise(p); p = r * p * 2.03 + 11.7; a *= 0.5;
    }
    return v;
  }

  // d: view direction, night: 0 = day sky, 1 = night sky, cloudAmt: cloud density scale
  vec3 skyColor(vec3 d, float night, float cloudAmt) {
    float h = max(d.y, 0.0);
    vec3 day = mix(uDayHor, uDayTop, pow(h, 0.45));
    vec3 nite = mix(uNightHor, uNightTop, pow(h, 0.4));
    vec3 col = mix(day, nite, night);
    if (d.y <= 0.0) return col;

    vec2 uv = d.xz / (d.y + 0.18);
    vec2 w = uWind * uTime;
    // Large slow masses + smaller faster detail = clouds that drift AND morph.
    float base = skyFbm(uv * 0.8 + w, 5);
    float detail = skyFbm(uv * 1.6 + w * 1.9 + 7.3, 4);
    float c = base * 0.78 + detail * 0.32;
    float density = smoothstep(0.43, 0.68, c) * cloudAmt;
    float s = skyFbm(uv * 0.8 + w + vec2(0.05, 0.035), 4) * 0.78 + detail * 0.32;
    float shade = clamp(smoothstep(0.42, 0.85, s) - smoothstep(0.43, 0.68, c) * 0.35, 0.0, 1.0);
    vec3 cloudDay = mix(vec3(1.02, 1.02, 1.0), vec3(0.66, 0.73, 0.84), shade * 0.75);
    vec3 cloudNight = mix(vec3(0.82, 0.85, 0.93), vec3(0.14, 0.18, 0.3), shade * 0.85);
    float fade = smoothstep(0.02, 0.22, d.y);
    col = mix(col, mix(cloudDay, cloudNight, night), density * fade);

    // Stars: steady, with only a slow, faint shimmer.
    vec2 sp = d.xz / (d.y + 0.35) * 70.0;
    float r = skyHash(floor(sp));
    float star = step(0.986, r) * smoothstep(0.12, 0.0, length(fract(sp) - 0.5));
    star *= 0.85 + 0.15 * sin(uTime * (0.3 + r * 0.4) + r * 60.0);
    col += star * night * (1.0 - density) * fade * 1.3;
    return col;
  }
`;

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // stick to the far plane
  }
`;

const frag = /* glsl */ `
  uniform float uNight;
  uniform float uCloud;
  varying vec3 vDir;
  ${SKY_GLSL}
  void main() {
    gl_FragColor = vec4(skyColor(normalize(vDir), uNight, uCloud), 1.0);
  }
`;

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { ...SKY_SHARED, uNight: { value: 0 }, uCloud: { value: 1 } },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}
