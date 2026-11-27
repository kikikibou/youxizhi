import * as THREE from 'three';

/**
 * A route drawn on the ground like a campaign arrow on a map: a brush stroke
 * in one colour along a path of [x, z] points (its corners rounded), thin
 * where it starts, with an arrowhead at its tip. setProgress(t) draws it so
 * far (0: nothing, 1: the whole way). Unlit, so it reads as ink laid on the
 * scene rather than as a thing in it. (The 问答 close-up's way through the
 * hedge maze to the door: World.drawRoute.)
 */
export function createRoute(points, { color = 0xb5321f, width = 0.34, y = 0.07 } = {}) {
  // Corners rounded off (Chaikin), the ends kept; then even steps along it.
  let pts = points.map(([x, z]) => new THREE.Vector2(x, z));
  for (let it = 0; it < 3; it++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      if (i > 0) next.push(a.clone().lerp(b, 0.25));
      if (i < pts.length - 2) next.push(a.clone().lerp(b, 0.75));
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  const STEP = 0.08;
  const samples = [pts[0].clone()];
  const along = [0];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = pts[i + 1].clone().sub(pts[i]);
    const len = seg.length();
    let d = STEP - (total - along[along.length - 1]);
    for (; d < len; d += STEP) {
      samples.push(pts[i].clone().addScaledVector(seg, d / len));
      along.push(total + d);
    }
    total += len;
  }
  samples.push(pts[pts.length - 1].clone());
  along.push(total);

  // The stroke: both edges of each step, the width breathing a little like
  // a brush's, tapering in at the start and drawn in under the arrowhead.
  const n = samples.length;
  const pos = new Float32Array(n * 2 * 3);
  const dist = new Float32Array(n * 2);
  const tangent = (i) => samples[Math.min(n - 1, i + 1)].clone().sub(samples[Math.max(0, i - 1)]).normalize();
  for (let i = 0; i < n; i++) {
    const t = tangent(i);
    const s = along[i];
    const w = width * (0.35 + 0.65 * Math.min(1, s / 0.9)) * (1 + 0.1 * Math.sin(s * 1.3) + 0.05 * Math.sin(s * 3.7 + 1));
    const nx = -t.y * (w / 2);
    const nz = t.x * (w / 2);
    pos.set([samples[i].x + nx, y, samples[i].y + nz, samples[i].x - nx, y, samples[i].y - nz], i * 6);
    dist[i * 2] = dist[i * 2 + 1] = s;
  }
  const index = [];
  for (let i = 0; i < n - 1; i++) {
    const [a, b, c, d] = [i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 3];
    index.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlong', new THREE.BufferAttribute(dist, 1));
  geo.setIndex(index);

  const draw = { value: 0 };
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDraw = draw;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAlong;\nvarying float vAlong;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlong = aAlong;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uDraw;\nvarying float vAlong;')
      .replace('void main() {', 'void main() {\n  if (vAlong > uDraw) discard;');
  };
  mat.customProgramCacheKey = () => 'route';
  const stroke = new THREE.Mesh(geo, mat);

  // The arrowhead, its tip at the origin pointing along +x.
  const L = width * 2.6;
  const head = new THREE.Shape([new THREE.Vector2(0.18 * L, 0), new THREE.Vector2(-L * 0.82, width * 1.45), new THREE.Vector2(-L * 0.62, 0), new THREE.Vector2(-L * 0.82, -width * 1.45)]);
  const headGeo = new THREE.ShapeGeometry(head).rotateX(Math.PI / 2);
  const arrow = new THREE.Mesh(headGeo, mat.clone());
  arrow.material.onBeforeCompile = () => {};
  arrow.material.customProgramCacheKey = () => 'route-head';
  arrow.position.y = y + 0.004;

  const group = new THREE.Group();
  group.add(stroke, arrow);
  for (const m of [stroke, arrow]) {
    m.castShadow = false;
    m.renderOrder = 2;
  }
  group.visible = false;

  const at = (s) => {
    // (the sample at distance s along, and the way it goes there)
    let i = Math.min(n - 1, Math.max(0, Math.round(s / STEP)));
    while (i < n - 1 && along[i] < s) i++;
    return { p: samples[i], t: tangent(i) };
  };
  return {
    group,
    length: total,
    /** Draw it so far: 0 nothing … 1 the whole way. */
    setProgress(t) {
      group.visible = t > 0;
      const s = total * t;
      draw.value = Math.max(0, s - L * 0.45);
      const { p, t: dir } = at(s);
      arrow.position.x = p.x;
      arrow.position.z = p.y;
      arrow.rotation.y = -Math.atan2(dir.y, dir.x);
      arrow.scale.setScalar(Math.min(1, s / 0.6));
    },
  };
}
