import * as THREE from 'three';
import { SKY_SHARED } from './sky.js';

/**
 * Open sea behind the About page: a big flat plane whose colour is a Fresnel
 * mix of deep water and the reflected sky gradient, with a few layers of
 * moving sine waves for the normals and a sun (or moon) glint. It joins the
 * sky at the horizon through the scene fog.
 */
const vert = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const frag = /* glsl */ `
  uniform float uTime;
  uniform float uNight;
  uniform vec3 uDayTop;
  uniform vec3 uDayHor;
  uniform vec3 uNightTop;
  uniform vec3 uNightHor;
  uniform vec3 uSunDir;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    vec2 p = vWorld.xz;
    float t = uTime;
    vec2 d = vec2(
      sin(p.x * 0.07 + t * 0.55) + 0.6 * sin((p.x + p.y) * 0.12 - t * 0.8) + 0.3 * sin(p.y * 0.23 + t * 1.2),
      cos(p.y * 0.08 - t * 0.5) + 0.6 * cos((p.x - p.y) * 0.1 + t * 0.7) + 0.3 * cos(p.x * 0.25 - t * 1.1)
    ) * 0.05;
    vec3 N = normalize(vec3(d.x, 1.0, d.y));
    vec3 R = reflect(-V, N);
    float h = clamp(R.y, 0.0, 1.0);
    vec3 skyDay = mix(uDayHor, uDayTop, pow(h, 0.45));
    vec3 skyNight = mix(uNightHor, uNightTop, pow(h, 0.4));
    vec3 sky = mix(skyDay, skyNight, uNight);
    vec3 deep = mix(vec3(0.02, 0.1, 0.18), vec3(0.004, 0.012, 0.035), uNight);
    float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);
    vec3 col = mix(deep, sky * 0.9, fres);
    float spec = pow(clamp(dot(R, normalize(uSunDir)), 0.0, 1.0), 220.0);
    col += spec * mix(vec3(2.2, 2.0, 1.7), vec3(0.6, 0.7, 1.0), uNight);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

/** Sea footprint in the About page's local frame (quay line at z = quay). */
export const SEA = { quay: -24, width: 720, depth: 900 };

/** Is a point (About-local) inside the sea, e.g. to keep skyline blocks out of it? */
export function inSea(x, z) {
  return Math.abs(x) < SEA.width / 2 + 20 && z < SEA.quay + 4;
}

export function createSea() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...SKY_SHARED, // shares time and sky colours with the sky dome
      uNight: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    },
    fog: true,
  });
  // Covers the ground behind the quay; local frame of the About page.
  const geo = new THREE.PlaneGeometry(SEA.width, SEA.depth);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.04, SEA.quay - SEA.depth / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  return mesh;
}
