import * as THREE from 'three';

/**
 * 大辩题库's street bin, in front of Tower B's lobby on the 辩论 plaza: two
 * compartments in the town's white with grapefruit lids, 「可回收辩题」 and
 * 「其他辩题」 on their doors, and across their fronts a black LED ticker in
 * 大辩题库's own colours (its only colours in the town, as 攻错's black and
 * gold are on its helipad): yellow dots running the day's quotes. A slip of
 * paper sticks out under the right lid and flutters; paper balls lie round it;
 * at night the ticker throws a faint yellow pool on the paving.
 *
 * At the card's close-up (pages.js) boarding opens the left lid (set(true)),
 * the ticker speeds up and the camera dives into the opening; coming back, the
 * camera rises out of it again and the lid shuts.
 *
 * Built facing +z with its foot at the origin. update() says whether anything
 * that casts a shadow moved (the lid), so the shadow map is redrawn.
 */

const W = 0.54; // one compartment's width
const GAP = 0.02; // half the seam between them
const X = W + GAP; // half the whole width
const D = 0.5;
const H = 0.84; // the body's top (the lids sit on it)
const OPEN = 1.85; // how far the left lid opens (radians)

// 大辩题库's LED colours (src/dbtk/DESIGN.md): growth is yellow, words white.
const LED = { screen: '#070807', off: '#1b1f1c', yellow: '#ffcc33', white: '#f1eedf' };
const ROWS = 16;
const COLS = 136;
const PITCH = 6; // texture pixels per dot

// The ticker's text: segments in their colours, the launch topics' codes in
// yellow like the growth they stand for. (Fixed: the town doesn't call
// 大辩题库's API.)
const TICKER = [
  ['快讯 ', LED.yellow],
  ['大辩题库开盘中', LED.white],
  ['   DB0001 ', LED.yellow],
  ['手机掉进马桶，应该先捞手机/先提裤子 ', LED.white],
  ['▲', LED.yellow],
  ['   DB0002 ', LED.yellow],
  ['孙悟空打妖怪产生开销，应该找唐僧/如来报账 ', LED.white],
  ['▲', LED.yellow],
  ['   看涨一次 ', LED.white],
  ['+1~99', LED.yellow],
  [' 票   只是请千万不要忘记题库   ', LED.white],
];
// (thin strokes read best in 16 dots, as on a real board)
const FONT = `500 15px "Noto Sans SC Variable", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif`;

const box = (a, b) => new THREE.BoxGeometry(b[0] - a[0], b[1] - a[1], b[2] - a[2]).translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
const easeOutBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * The ticker's text as LED dots: per column, the colour of each of its ROWS
 * dots (null: off). Drawn once into a canvas ROWS px high and thresholded.
 */
function tickerDots() {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = FONT;
  const widths = TICKER.map(([t]) => Math.ceil(ctx.measureText(t).width));
  c.width = widths.reduce((a, b) => a + b, 0);
  c.height = ROWS;
  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  let x = 0;
  TICKER.forEach(([t, col], i) => {
    ctx.fillStyle = col;
    ctx.fillText(t, x, ROWS / 2 + 1);
    x += widths[i];
  });
  const img = ctx.getImageData(0, 0, c.width, c.height).data;
  const cols = [];
  for (let i = 0; i < c.width; i++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) {
      const k = (r * c.width + i) * 4;
      // (the brighter channel tells yellow from white)
      col.push(img[k + 3] > 120 ? (img[k + 2] > 150 ? LED.white : LED.yellow) : null);
    }
    cols.push(col);
  }
  return cols;
}

/** A label plate for a compartment's door: its name, a band of colour over it. */
function labelTexture(cn, en, band) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 300;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f4ee';
  ctx.fillRect(0, 0, 512, 300);
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, 512, 54);
  ctx.fillStyle = '#f7f4ee';
  ctx.font = `600 26px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(en, 256, 28);
  ctx.fillStyle = '#26221d';
  ctx.font = `900 ${cn.length > 4 ? 84 : 96}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.fillText(cn, 256, 172);
  ctx.strokeStyle = 'rgba(38, 34, 29, 0.35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 66, 484, 220);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A slip of paper with a motion half-written on it (both faces). */
function slipTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 176;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f6f1e4';
  ctx.fillRect(0, 0, 128, 176);
  ctx.strokeStyle = 'rgba(60, 80, 140, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 34; y < 176; y += 22) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(120, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#2b2a33';
  ctx.font = `700 17px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.fillText('辩题：', 10, 27);
  ctx.fillStyle = 'rgba(43, 42, 51, 0.75)';
  // (scribbled lines for the rest)
  for (const [y, w] of [[50, 96], [72, 104], [94, 70]]) ctx.fillRect(12, y - 4, w, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The ticker's glow on the paving at night: a soft yellow ellipse. */
function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255, 204, 51, 0.9)');
  g.addColorStop(0.45, 'rgba(255, 190, 60, 0.35)');
  g.addColorStop(1, 'rgba(255, 180, 60, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A crumpled paper ball: an icosahedron pushed in and out at random. */
function paperBall(r, seed, mat) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  // (shared corners move together, so the ball stays closed)
  const moved = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    if (!moved.has(key)) moved.set(key, 0.72 + rand() * 0.5);
    v.multiplyScalar(moved.get(key));
    p.setXYZ(i, v.x, v.y * 0.86, v.z);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function createBin(mats) {
  const group = new THREE.Group();
  const shadowed = (m) => ((m.castShadow = m.receiveShadow = true), m);
  const mesh = (geo, mat, parent = group) => {
    const m = shadowed(new THREE.Mesh(geo, mat));
    parent.add(m);
    return m;
  };
  const hole = new THREE.MeshBasicMaterial({ color: LED.screen });
  const paper = new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.95, flatShading: true });

  // Two compartments on a dark plinth, a seam between them; on each door a
  // slightly proud panel, its label, and a handle.
  mesh(box([-X + 0.03, 0, -D / 2 + 0.03], [X - 0.03, 0.06, D / 2 - 0.03]), mats.metal);
  const xs = [-W / 2 - GAP, W / 2 + GAP]; // the compartments' centres
  const labels = [labelTexture('可回收辩题', 'RECYCLABLE', '#e2562b'), labelTexture('其他辩题', 'OTHER MOTIONS', '#6f757c')];
  xs.forEach((cx, i) => {
    mesh(box([cx - W / 2, 0.06, -D / 2], [cx + W / 2, H, D / 2]), mats.white);
    mesh(box([cx - W / 2 + 0.04, 0.1, D / 2], [cx + W / 2 - 0.04, 0.6, D / 2 + 0.014]), mats.whiteShade);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.234), new THREE.MeshStandardMaterial({ map: labels[i], roughness: 0.7 }));
    plate.position.set(cx, 0.36, D / 2 + 0.016);
    plate.receiveShadow = true;
    group.add(plate);
    mesh(box([cx - 0.08, 0.13, D / 2 + 0.014], [cx + 0.08, 0.155, D / 2 + 0.045]), mats.metal);
  });
  mesh(box([-GAP, 0.06, -D / 2 + 0.02], [GAP, H - 0.01, D / 2 - 0.02]), mats.metal);
  // (the side panels a shade darker, so the box reads in the flat light)
  for (const s of [-1, 1]) mesh(box([s * X - 0.008, 0.1, -D / 2 + 0.04], [s * X + 0.008, H - 0.06, D / 2 - 0.04]), mats.whiteShade);

  // The ticker: a black housing across both fronts under the lids, its
  // screen a canvas of dots.
  const tx0 = -X + 0.02;
  const tx1 = X - 0.02;
  mesh(box([tx0, 0.63, D / 2], [tx1, 0.8, D / 2 + 0.035]), new THREE.MeshStandardMaterial({ color: 0x141614, roughness: 0.5, metalness: 0.3 }));
  const canvas = document.createElement('canvas');
  canvas.width = COLS * PITCH;
  canvas.height = ROWS * PITCH;
  const tctx = canvas.getContext('2d');
  const screenTex = new THREE.CanvasTexture(canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 4;
  const sw = tx1 - tx0 - 0.04;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, (sw * ROWS) / COLS), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(0, 0.715, D / 2 + 0.036);
  group.add(screen);
  // (the unlit dots, drawn once)
  const back = document.createElement('canvas');
  back.width = canvas.width;
  back.height = canvas.height;
  const bctx = back.getContext('2d');
  bctx.fillStyle = LED.screen;
  bctx.fillRect(0, 0, back.width, back.height);
  bctx.fillStyle = LED.off;
  bctx.beginPath();
  for (let i = 0; i < COLS; i++) for (let r = 0; r < ROWS; r++) {
    bctx.moveTo(i * PITCH + PITCH / 2 + 2.2, r * PITCH + PITCH / 2);
    bctx.arc(i * PITCH + PITCH / 2, r * PITCH + PITCH / 2, 2.2, 0, Math.PI * 2);
  }
  bctx.fill();
  // (made when first shown; again once the page's Chinese font is in, if it wasn't yet)
  let dots = null;
  const makeDots = () => {
    dots = tickerDots();
    shown = -1;
  };
  const drawTicker = (shift) => {
    tctx.drawImage(back, 0, 0);
    const n = dots.length;
    for (const color of [LED.yellow, LED.white]) {
      // (a soft halo under each lit dot, then its core)
      for (const [rad, alpha] of [[3, 0.35], [2.3, 1]]) {
        tctx.globalAlpha = alpha;
        tctx.fillStyle = color;
        tctx.beginPath();
        for (let i = 0; i < COLS; i++) {
          const col = dots[(i + shift) % n];
          for (let r = 0; r < ROWS; r++) {
            if (col[r] !== color) continue;
            const x = i * PITCH + PITCH / 2;
            const y = r * PITCH + PITCH / 2;
            tctx.moveTo(x + rad, y);
            tctx.arc(x, y, rad, 0, Math.PI * 2);
          }
        }
        tctx.fill();
      }
    }
    tctx.globalAlpha = 1;
    screenTex.needsUpdate = true;
  };

  // The lids, grapefruit: a slab, a narrower step on it, a lip at the front
  // with a grip. The left one is hinged at the back (lid.pivot) and opens;
  // under it the opening, black.
  const lids = xs.map((cx) => {
    const pivot = new THREE.Group();
    pivot.position.set(cx, H, -D / 2 - 0.01);
    group.add(pivot);
    const z = (v) => v + D / 2 + 0.01; // (from the body's frame into the hinge's)
    mesh(box([-W / 2 - 0.012, 0, z(-D / 2 - 0.01)], [W / 2 + 0.012, 0.05, z(D / 2 + 0.025)]), mats.orange, pivot);
    mesh(box([-W / 2 + 0.05, 0.05, z(-D / 2 + 0.04)], [W / 2 - 0.05, 0.075, z(D / 2 - 0.05)]), mats.orange, pivot);
    mesh(box([-W / 2 - 0.012, -0.045, z(D / 2 + 0.005)], [W / 2 + 0.012, 0.0, z(D / 2 + 0.025)]), mats.orange, pivot);
    mesh(box([-0.07, -0.035, z(D / 2 + 0.025)], [0.07, -0.012, z(D / 2 + 0.04)]), mats.metal, pivot);
    return pivot;
  });
  const opening = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.07, D - 0.07).rotateX(-Math.PI / 2), hole);
  opening.position.set(xs[0], H + 0.002, 0);
  group.add(opening);

  // A slip sticking out under the right lid's lip, fluttering.
  const slipPivot = new THREE.Group();
  slipPivot.position.set(xs[1] + 0.09, H - 0.01, D / 2 + 0.03);
  slipPivot.rotation.set(0.35, 0.22, -0.12);
  group.add(slipPivot);
  const slip = mesh(new THREE.PlaneGeometry(0.12, 0.165).translate(0, 0.06, 0), new THREE.MeshStandardMaterial({ map: slipTexture(), roughness: 0.95, side: THREE.DoubleSide }), slipPivot);
  slip.castShadow = false;

  // Paper balls round its foot, one missed shot near the plaza.
  for (const [x, z, r, s] of [[-0.78, 0.42, 0.065, 11], [0.74, 0.56, 0.055, 23], [-0.2, 0.92, 0.06, 37]]) {
    const ball = paperBall(r, s, paper);
    ball.position.set(x, r * 0.8, z);
    ball.rotation.set(s, s * 2, 0);
    group.add(ball);
  }

  // The night pool, on the paving in front.
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5).rotateX(-Math.PI / 2), poolMat);
  pool.position.set(0, 0.012, D / 2 + 0.55);
  pool.renderOrder = 1;
  group.add(pool);

  let lid = 0; // 0 shut … 1 open
  let want = 0;
  let from = 0;
  let k = 1; // the lid's tween, 0 … 1
  let shift = 0; // the ticker's position, in columns
  let shown = -1;

  return {
    group,
    /** Open (true) or shut the left lid; `instant`: there already. */
    set(open, instant = false) {
      const to = open ? 1 : 0;
      if (instant) {
        lid = want = to;
        k = 1;
        return;
      }
      if (to === want) return;
      from = lid;
      want = to;
      k = 0;
    },
    get open() {
      return want === 1;
    },
    /** `here`: its site is the one in view (the ticker's dots are drawn only then). */
    update(dt, time, night, here) {
      let moved = false;
      if (k < 1) {
        k = Math.min(1, k + dt / (want ? 0.5 : 0.6));
        lid = from + (want - from) * (want ? easeOutBack(k) : easeInOut(k));
        moved = true;
      }
      lids[0].rotation.x = -OPEN * lid;
      // (the slip in the breeze; a jolt as the lid next to it flies open)
      slipPivot.rotation.x = 0.35 + Math.sin(time * 6.3) * 0.05 + Math.sin(time * 2.1) * 0.04 + (k < 1 && want ? Math.sin(k * Math.PI) * 0.25 : 0);
      poolMat.opacity = night * 0.55;
      // The ticker runs faster with the lid open, as if the market just opened.
      shift += dt * (want ? 64 : 17);
      if (here) {
        if (!dots) {
          makeDots();
          document.fonts?.load(FONT, TICKER.map(([t]) => t).join('')).then(makeDots, () => {});
        }
        const s = Math.floor(shift) % dots.length;
        if (s !== shown) {
          shown = s;
          drawTicker(s);
        }
      }
      return moved;
    },
  };
}
