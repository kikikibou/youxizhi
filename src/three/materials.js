import * as THREE from 'three';
import { WIND } from './details.js';
import { overTitles } from './typography.js';

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
  // Lamp parts are flagged transparent (at full opacity) only so they can be
  // drawn *after* the beam: the lamp stays visible as the source of its light.
  const lampHead = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.8, transparent: true });
  const lampPole = metal.clone();
  lampPole.transparent = true;
  const bulb = new THREE.MeshStandardMaterial({
    color: 0xfff1d6,
    roughness: 0.3,
    emissive: new THREE.Color(0xffe2b0),
    emissiveIntensity: 1.2,
    transparent: true,
  });
  const orange = new THREE.MeshStandardMaterial({
    color: 0xff7a12,
    roughness: 0.55,
    emissive: new THREE.Color(0xff6a00),
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  // A light tube on a facade: an accent stripe by day, a pale glowing tube
  // at night (so it doesn't read as one more piece of accent lettering).
  const tube = new THREE.MeshStandardMaterial({ color: 0xff7a12, roughness: 0.5, emissive: new THREE.Color(0xffe08a), emissiveIntensity: 0 });
  tube.userData = { day: new THREE.Color(0xff7a12), night: new THREE.Color(0xfff1c4) };
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2e4630, roughness: 0.95, flatShading: true });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x3a2f28, roughness: 0.9 });

  // Planting round the buildings (see details.js): low-poly and flat-shaded
  // like the trees; vertex colours vary the shade of each piece.
  const pot = new THREE.MeshStandardMaterial({ color: 0xc8714f, roughness: 0.85 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 1 });
  const bush = new THREE.MeshStandardMaterial({ color: 0x3c6e57, roughness: 0.95, flatShading: true, vertexColors: true });
  const grass = new THREE.MeshStandardMaterial({ color: 0x7aa070, roughness: 0.95, flatShading: true, vertexColors: true, side: THREE.DoubleSide });
  const flower = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true, vertexColors: true, side: THREE.DoubleSide });
  sways(grass);
  sways(flower);

  // A window lit at night only: by day the same as the dark glass round it
  // (so a facade doesn't look patchy), warm like `glass` at night.
  const paneNight = new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.1, metalness: 0.6, emissive: new THREE.Color(0xffa95a), emissiveIntensity: 0 });
  // Blinds drawn part way down a lit window: pale by day, lit from inside at night.
  const blind = new THREE.MeshStandardMaterial({ color: 0xece3d3, roughness: 0.9, emissive: new THREE.Color(0xffc98a), emissiveIntensity: 0 });
  // An aircraft warning light on a mast: blinks at night (userData.on, set by its building).
  const beacon = new THREE.MeshStandardMaterial({ color: 0x8a2a20, roughness: 0.4, emissive: new THREE.Color(0xff2a14), emissiveIntensity: 0 });
  beacon.userData.on = 1;
  // The distant blocks' windows (World.buildSkyline): a soft tone between wall
  // and glass (set with the scheme), some lit at night.
  const skyWin = new THREE.MeshStandardMaterial({ color: 0x8f98a3, roughness: 0.8 });
  const skyWinLit = new THREE.MeshStandardMaterial({ color: 0x8f98a3, roughness: 0.8, emissive: new THREE.Color(0xffb46a), emissiveIntensity: 0 });

  // 攻错's own colours (debatestone.com), painted on the helipad its card
  // flies to (see debate() in buildings.js): gold leaf, the black touchstone,
  // bone. Kept out of the colour schemes: they belong to the other site.
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b04b, roughness: 0.42, metalness: 0.35, emissive: new THREE.Color(0xc8862f), emissiveIntensity: 0 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x211c17, roughness: 0.92 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xece4d2, roughness: 0.85 });
  // The pad's rim lights: a pale gold by day, lit at night.
  const padLight = new THREE.MeshStandardMaterial({ color: 0xf3d79a, roughness: 0.4, emissive: new THREE.Color(0xffc45e), emissiveIntensity: 0 });

  // Gravel for garden paths (the 问答 hedge maze's bed, details.js): a warm sand, not in the schemes.
  const gravel = new THREE.MeshStandardMaterial({ color: 0xcdb994, roughness: 1 });

  // (the lamps stand over the titles, which are drawn sharp in a pass of their own)
  [lampHead, lampPole, bulb].forEach(overTitles);

  return { white, whiteShade, concrete, glass, glassDark, warm, strip, metal, lampPole, lampHead, bulb, orange, tube, leaf, trunk, pot, soil, bush, grass, flower, paneNight, blind, beacon, skyWin, skyWinLit, gold, stone, bone, padLight, gravel };
}

/** Blades and petals sway in the wind, as far as their uv.y says (0 at the root). */
function sways(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      transformed.x += sin(uWind * 1.7 + position.x * 0.9 + position.z * 0.7) * 0.06 * uv.y;
      transformed.z += sin(uWind * 1.3 + position.z * 1.1 + position.x * 0.4) * 0.04 * uv.y;`,
    );
  };
  m.customProgramCacheKey = () => 'sway';
}

export function updateMaterials(m, night) {
  m.glass.emissiveIntensity = night * 1.2;
  m.glassDark.emissiveIntensity = night * 0.12;
  m.warm.emissiveIntensity = 0.22 + night * 0.75;
  m.strip.emissiveIntensity = 0.5 + night * 1.2;
  m.bulb.emissiveIntensity = 1.0 + night * 5.0;
  m.orange.emissiveIntensity = 0.3 + night * 0.8;
  m.tube.color.copy(m.tube.userData.day).lerp(m.tube.userData.night, night);
  m.tube.emissiveIntensity = night * 1.8;
  m.paneNight.emissiveIntensity = night * 1.2;
  m.blind.emissiveIntensity = night * 0.85;
  m.beacon.emissiveIntensity = night * (m.beacon.userData.on ? 5 : 0.25);
  m.skyWinLit.emissiveIntensity = night * 0.9;
  m.gold.emissiveIntensity = night * 0.45;
  m.padLight.emissiveIntensity = 0.15 + night * 3.5;
}
