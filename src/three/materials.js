import * as THREE from 'three';
import { patchSurface } from './pixelart.js';
import { WIND } from './details.js';

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

  // The shop interiors seen through the ground-floor glazing: shelves of
  // books, a counter, pendant lamps (lit with the rest of the room at night).
  patchSurface(warm, { side: interiorTexture(), density: 32, defines: { PX_EMIT_SIDE: '' } });

  // Planting round the buildings (see details.js): low-poly and flat-shaded
  // like the trees; vertex colours vary the shade of each piece.
  const pot = new THREE.MeshStandardMaterial({ color: 0xc8714f, roughness: 0.85 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 1 });
  const bush = new THREE.MeshStandardMaterial({ color: 0x3c6e57, roughness: 0.95, flatShading: true, vertexColors: true });
  const grass = new THREE.MeshStandardMaterial({ color: 0x7aa070, roughness: 0.95, flatShading: true, vertexColors: true, side: THREE.DoubleSide });
  const flower = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true, vertexColors: true });
  sways(grass);
  sways(flower);

  return { white, whiteShade, concrete, glass, glassDark, warm, strip, metal, lampPole, lampHead, bulb, orange, tube, leaf, trunk, pot, soil, bush, grass, flower };
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

/** A shop interior, 8 x 4 m at 32 pixels a metre (multiplies the room's warm colour). */
function interiorTexture() {
  const W = 256;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  let seed = 11;
  const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const wall = g.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#fff8f0');
  wall.addColorStop(1, '#f0ddcc');
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#b08a74';
  g.fillRect(0, 116, W, 12); // floor
  g.fillStyle = '#dcc6b4';
  g.fillRect(0, 113, W, 3); // skirting

  // Two shelf units full of books, the odd jar.
  const goods = ['#cd5c54', '#567cb0', '#e2c05c', '#5e9870', '#ece6da', '#9a70ac', '#dc8c46', '#3e5a7a'];
  for (const [x0, x1] of [[8, 72], [184, 248]]) {
    g.fillStyle = '#8a6a5a';
    g.fillRect(x0, 14, 3, 102);
    g.fillRect(x1 - 3, 14, 3, 102);
    g.fillRect(x0, 14, x1 - x0, 3);
    for (const by of [38, 62, 86, 110]) {
      g.fillStyle = '#8f6e5c';
      g.fillRect(x0, by, x1 - x0, 3);
      let x = x0 + 4;
      while (x < x1 - 8) {
        const r = R();
        if (r < 0.08) {
          // a jar
          g.fillStyle = '#d9e6e8';
          g.beginPath();
          g.roundRect(x, by - 11, 8, 11, 2);
          g.fill();
          g.fillStyle = '#b05a48';
          g.fillRect(x + 1, by - 13, 6, 2);
          x += 10;
        } else if (r < 0.13) {
          x += 4 + R() * 6; // a gap
        } else {
          const w = 3 + Math.floor(R() * 3);
          const h = 12 + Math.floor(R() * 8);
          g.fillStyle = goods[Math.floor(R() * goods.length)];
          if (r > 0.94) {
            // a leaning book
            g.save();
            g.translate(x, by);
            g.rotate(-0.25);
            g.fillRect(0, -h, w, h);
            g.restore();
            x += w + 4;
          } else {
            g.fillRect(x, by - h, w, h);
            g.fillStyle = 'rgba(255,255,255,0.35)';
            g.fillRect(x, by - h + 3, w, 1);
            x += w + (R() < 0.3 ? 1 : 0);
          }
        }
      }
    }
  }
  // A picture on the wall.
  g.fillStyle = '#d8bea6';
  g.fillRect(118, 40, 24, 18);
  g.fillStyle = '#9fbccb';
  g.fillRect(121, 43, 18, 12);
  g.fillStyle = '#e8b45c';
  g.beginPath();
  g.arc(134, 47, 2.5, 0, Math.PI * 2);
  g.fill();
  // The counter, with a lighter top and a panelled front.
  g.fillStyle = '#b88a70';
  g.fillRect(92, 80, 76, 36);
  g.fillStyle = '#f6eadc';
  g.fillRect(90, 77, 80, 4);
  g.fillStyle = '#a07a62';
  for (let x = 98; x < 166; x += 12) g.fillRect(x, 84, 2, 28);
  // A vase of flowers on it.
  g.fillStyle = '#e9e2d6';
  g.fillRect(150, 68, 6, 9);
  for (const [dx, dy, col] of [[-2, -3, '#e86a72'], [3, -5, '#f2c45a'], [8, -2, '#e86a72'], [2, 0, '#6e9e6a']]) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(151 + dx, 66 + dy, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  // Pendant lamps over the counter.
  for (const x of [106, 130, 154]) {
    g.fillStyle = '#6e6060';
    g.fillRect(x, 0, 1, 26);
    const glow = g.createRadialGradient(x + 0.5, 36, 1, x + 0.5, 36, 18);
    glow.addColorStop(0, 'rgba(255,244,214,0.55)');
    glow.addColorStop(1, 'rgba(255,244,214,0)');
    g.fillStyle = glow;
    g.fillRect(x - 18, 18, 37, 36);
    g.fillStyle = '#4a4650';
    g.beginPath();
    g.moveTo(x - 5, 26);
    g.lineTo(x + 6, 26);
    g.lineTo(x + 8.5, 34);
    g.lineTo(x - 7.5, 34);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff6d8';
    g.beginPath();
    g.arc(x + 0.5, 35.5, 3, 0, Math.PI * 2);
    g.fill();
  }
  // A potted plant by the counter.
  g.fillStyle = '#c8714f';
  g.fillRect(76, 100, 11, 16);
  for (const [x, y, rx, ry, col] of [[81, 92, 7, 9, '#5a8a5a'], [76, 95, 5, 6, '#6e9e6a'], [87, 94, 5, 7, '#6e9e6a'], [81, 85, 4, 5, '#7cae76']]) {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return { tex, w: W, h: H };
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
}
