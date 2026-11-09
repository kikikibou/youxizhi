import * as THREE from 'three';

/**
 * Sky dome: vertical gradient + two layers of drifting fbm clouds + stars.
 * `uNight` blends between the poster's flat blue day sky and the navy night.
 */
const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // stick to the far plane
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  uniform vec3 uDayTop;
  uniform vec3 uDayHor;
  uniform vec3 uNightTop;
  uniform vec3 uNightHor;
  uniform vec2 uWind;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    vec3 day = mix(uDayHor, uDayTop, pow(h, 0.45));
    vec3 night = mix(uNightHor, uNightTop, pow(h, 0.4));
    vec3 col = mix(day, night, uNight);

    if (d.y > 0.0) {
      vec2 uv = d.xz / (d.y + 0.18);
      vec2 w = uWind * uTime;
      // Large, slow cloud masses + smaller faster detail = clouds that drift AND morph.
      float base = fbm(uv * 0.8 + w);
      float detail = fbm(uv * 1.6 + w * 1.9 + 7.3);
      float c = base * 0.78 + detail * 0.32;
      float density = smoothstep(0.43, 0.68, c);
      // Self-shadowing: sample slightly "toward the sun".
      float s = fbm(uv * 0.8 + w + vec2(0.05, 0.035)) * 0.78 + detail * 0.32;
      float shade = smoothstep(0.42, 0.85, s) - smoothstep(0.43, 0.68, c) * 0.35;
      vec3 cloudDay = mix(vec3(1.02, 1.02, 1.0), vec3(0.66, 0.73, 0.84), clamp(shade, 0.0, 1.0) * 0.75);
      vec3 cloudNight = mix(vec3(0.82, 0.85, 0.93), vec3(0.14, 0.18, 0.3), clamp(shade, 0.0, 1.0) * 0.85);
      vec3 cloud = mix(cloudDay, cloudNight, uNight);
      float fade = smoothstep(0.02, 0.22, d.y);
      col = mix(col, cloud, density * fade);

      // Stars.
      vec2 sp = d.xz / (d.y + 0.35) * 70.0;
      vec2 cell = floor(sp);
      float r = hash(cell);
      float star = step(0.986, r) * smoothstep(0.12, 0.0, length(fract(sp) - 0.5));
      star *= 0.6 + 0.4 * sin(uTime * (0.8 + r * 2.0) + r * 60.0);
      col += star * uNight * (1.0 - density) * fade * 1.4;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const SKY = {
  dayTop: new THREE.Color(0x4a82ba),
  dayHor: new THREE.Color(0xa9c8e4),
  nightTop: new THREE.Color(0x050d24),
  nightHor: new THREE.Color(0x1a2c55),
};

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 0 },
      uDayTop: { value: SKY.dayTop },
      uDayHor: { value: SKY.dayHor },
      uNightTop: { value: SKY.nightTop },
      uNightHor: { value: SKY.nightHor },
      uWind: { value: new THREE.Vector2(0.022, 0.009) },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}
