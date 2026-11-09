import * as THREE from 'three';

/**
 * Shared architectural materials. Every material that reacts to day/night is
 * updated from `updateMaterials(mats, night)` once per frame.
 */
export function createMaterials() {
  const white = new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.86, metalness: 0 });
  const whiteShade = new THREE.MeshStandardMaterial({ color: 0xe2ded6, roughness: 0.9, metalness: 0 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xbdb7ad, roughness: 0.95, metalness: 0 });

  // Glass that lights up warm at night.
  const glass = new THREE.MeshStandardMaterial({
    color: 0x22303f,
    roughness: 0.12,
    metalness: 0.55,
    emissive: new THREE.Color(0xffa95a),
    emissiveIntensity: 0,
  });
  // Glass that mostly stays dark (some windows are "unoccupied" at night).
  const glassDark = new THREE.MeshStandardMaterial({
    color: 0x1b2633,
    roughness: 0.1,
    metalness: 0.6,
    emissive: new THREE.Color(0x6f8fc9),
    emissiveIntensity: 0,
  });
  // Warm timber interiors (always a little lit, like the poster's ground floor).
  const warm = new THREE.MeshStandardMaterial({
    color: 0xd98a3e,
    roughness: 0.65,
    emissive: new THREE.Color(0xff8a2e),
    emissiveIntensity: 0.25,
  });
  // Light strips / soffit lights.
  const strip = new THREE.MeshStandardMaterial({
    color: 0xffd2a0,
    roughness: 0.4,
    emissive: new THREE.Color(0xffb46a),
    emissiveIntensity: 0.6,
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x6f757c, roughness: 0.45, metalness: 0.7 });
  const lampHead = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.8 });
  const bulb = new THREE.MeshStandardMaterial({
    color: 0xfff1d6,
    roughness: 0.3,
    emissive: new THREE.Color(0xffe2b0),
    emissiveIntensity: 1.2,
  });
  const orange = new THREE.MeshStandardMaterial({
    color: 0xff7a12,
    roughness: 0.55,
    emissive: new THREE.Color(0xff6a00),
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2e4630, roughness: 0.95, flatShading: true });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x3a2f28, roughness: 0.9 });

  return { white, whiteShade, concrete, glass, glassDark, warm, strip, metal, lampHead, bulb, orange, leaf, trunk };
}

export function updateMaterials(m, night) {
  m.glass.emissiveIntensity = night * 1.2;
  m.glassDark.emissiveIntensity = night * 0.12;
  m.warm.emissiveIntensity = 0.22 + night * 0.75;
  m.strip.emissiveIntensity = 0.5 + night * 1.2;
  m.bulb.emissiveIntensity = 1.0 + night * 5.0;
  m.orange.emissiveIntensity = 0.3 + night * 0.8;
}
