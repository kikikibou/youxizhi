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
 * The World renders the mask, renders the scene a second time at the other
 * time of day, and swaps that render in wherever the mask is white. 3D text
 * reads the same mask to change colour.
 */
export const MASK_LAYER = 1;

class Device {
  constructor() {
    this.group = new THREE.Group();
    this.mask = new THREE.Group();
    this.group.add(this.mask);
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

  /** Called once per frame. `reveal` (0..1) is how strongly the mask shows. */
  update(time, dt, night, activity) {
    this.setReveal(activity);
  }

  setReveal(v) {
    this.maskMat.color.setScalar(v);
    this.mask.visible = v > 0.002;
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
    this.glow = { pos: new THREE.Vector3(p[0], this.lamp.topY, p[1]), radius: this.lamp.topRadius, day: 0, night: 1.1 };
    this.spotAnchor = { top: new THREE.Vector3(p[0], this.lamp.topY, p[1]), base: new THREE.Vector3(p[0], 0, p[1]) };
  }

  applyTime(night, activity) {
    this.lamp.update(night, activity);
  }
}

/* -------------------------------------------------------------------------- */
/* 05 · Lighthouse beacon: a long beam sweeping round from the lantern          */
/* -------------------------------------------------------------------------- */
const haloVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vNormalV = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;
// Soft luminous halo hugging the revealed band (clamped inputs: no NaN).
const haloFrag = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  void main() {
    float along = clamp(vUv.y, 0.0, 1.0); // 1 at the lantern
    float facing = clamp(abs(dot(normalize(vNormalV), normalize(-vViewPos))), 0.0, 1.0);
    float a = pow(facing, 1.4) * (0.25 + 0.75 * pow(along, 1.5)) * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export class BeaconDevice extends Device {
  /**
   * @param {object} cfg
   *   p       lantern centre (local)
   *   length  beam length (m)
   *   r0, r1  beam radius at the lantern / at the far end
   *   speed   turns per second (radians/s)
   *   tilt    downward tilt (radians) so the far end grazes the sea
   */
  constructor({ p, length = 190, r0 = 1.1, r1 = 15, speed = 0.32, tilt = 0.035, phase = 2.2 }) {
    super();
    this.speed = speed;
    this.phase = phase;
    // Two identical rotating rigs: one for the visible halo, one (inside the
    // mask group, so it can be hidden and measured) for the mask.
    const rig = (parent) => {
      const pivot = new THREE.Group();
      pivot.position.set(...p);
      const arm = new THREE.Group();
      arm.rotation.z = -tilt;
      pivot.add(arm);
      parent.add(pivot);
      return { pivot, arm };
    };
    ({ pivot: this.pivot, arm: this.arm } = rig(this.group));
    ({ pivot: this.maskPivot, arm: this.maskArm } = rig(this.mask));

    // Frustum along +X: narrow at the lantern, wide far out.
    const g = new THREE.CylinderGeometry(r1, r0, length, 48, 1, true);
    g.translate(0, length / 2, 0);
    g.rotateZ(-Math.PI / 2);
    this.addMask(g, this.maskArm);

    // A slightly fatter halo so the revealed band reads as a beam of light.
    const hg = new THREE.CylinderGeometry(r1 * 1.25, r0 * 1.4, length, 48, 1, true);
    hg.translate(0, length / 2, 0);
    hg.rotateZ(-Math.PI / 2);
    // uv.y runs 1 → 0 from the cylinder's top (far end) to its base (lantern);
    // flip so 1 = lantern.
    const uv = hg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    this.halo = new THREE.Mesh(
      hg,
      new THREE.ShaderMaterial({
        vertexShader: haloVert,
        fragmentShader: haloFrag,
        uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xffd9a0) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.halo.renderOrder = 5;
    this.arm.add(this.halo);

    this.glow = { pos: new THREE.Vector3(...p), radius: 2.2, day: 0.35, night: 1.2 };
    this._dir = new THREE.Vector3();
    this._toCam = new THREE.Vector3();
    this._pos = new THREE.Vector3();
  }

  update(time, dt, night, activity, camera) {
    this.pivot.rotation.y = this.phase + time * this.speed;
    this.maskPivot.rotation.y = this.pivot.rotation.y;
    this.pivot.updateMatrixWorld(true);
    this.maskPivot.updateMatrixWorld(true);
    // When the beam swings straight at the camera its projection would cover
    // the whole screen; fade it out for that moment instead of flashing.
    this.pivot.getWorldPosition(this._pos);
    this._dir.set(1, 0, 0).applyQuaternion(this.pivot.getWorldQuaternion(new THREE.Quaternion()));
    this._toCam.copy(camera.position).sub(this._pos).setY(0).normalize();
    this._dir.setY(0).normalize();
    const facing = this._dir.dot(this._toCam);
    const fade = 1 - THREE.MathUtils.smoothstep(facing, 0.25, 0.7);
    this.setReveal(activity * fade);
    this.fade = fade;
  }

  applyTime(night, activity) {
    const u = this.halo.material.uniforms;
    u.uOpacity.value = (0.06 + 0.32 * night) * activity * (this.fade ?? 1);
    this.halo.visible = u.uOpacity.value > 0.002;
  }
}
