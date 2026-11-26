/**
 * The map behind the worksheet: a light ink-wash campaign map of the Three
 * Kingdoms in the manner of a strategy game's world map. Rivers, mountain
 * ranges in ink and blue-green, walled cities with banners, the three realms
 * in soft washes, a hex grid, campaign arrows and battle marks, a compass and
 * a title cartouche. Drawn once on a canvas (geography is rough: longitude /
 * latitude straight onto the plane) and slowly panned along a Lissajous path.
 */
const LON0 = 100.5;
const LON1 = 123.5;
const LAT0 = 21.5;
const LAT1 = 41.5;
const KX = Math.cos((31 * Math.PI) / 180); // narrows degrees of longitude
const ASPECT = ((LON1 - LON0) * KX) / (LAT1 - LAT0);

const FONT = '"Noto Serif SC Variable", "Noto Serif SC", "Songti SC", serif';
const PAPER = '239, 229, 205';
const INK = '46, 40, 34';
const ZHU = '176, 52, 34';
const REALMS = {
  wei: { rgb: '63, 95, 143', name: '魏', at: [114.6, 37.4] },
  shu: { rgb: '77, 122, 73', name: '蜀', at: [104.3, 29.6] },
  wu: { rgb: '176, 85, 58', name: '吴', at: [116.4, 27.0] },
};

// Borders between the realms (around 220–230), west to east. Shapes that
// meet the map's edge run past it, so the smoothing in path() rounds their
// corners off the map rather than on it.
const WEI_SHU = [[97, 36.6], [100.5, 35.8], [102.5, 35.2], [104.0, 34.3], [105.2, 33.9], [106.3, 33.6], [107.8, 33.5], [109.4, 33.2]];
const WEI_WU = [[109.4, 33.2], [110.6, 32.6], [111.6, 31.9], [112.6, 31.4], [113.8, 31.2], [115.0, 31.3], [116.3, 31.2], [117.4, 31.35], [118.3, 31.7], [119.2, 32.5], [120.5, 33.5]];
const SHU_WU = [[109.4, 33.2], [109.8, 32.3], [109.9, 31.2], [109.6, 30.0], [109.0, 28.8], [108.3, 27.2], [107.0, 25.5], [105.5, 24.5], [103.5, 23.5], [101.5, 23.0], [100.5, 23.0], [97, 22.6]];
const TERRITORY = {
  wei: [[97, 45], [127, 45], [127, 37], ...WEI_WU.slice().reverse(), ...WEI_SHU.slice().reverse()],
  shu: [...WEI_SHU, ...SHU_WU],
  wu: [...WEI_WU, [127, 37], [127, 18], [97, 18], ...SHU_WU.slice().reverse()],
};

const COAST = [
  [123.5, 39.95], [122.8, 39.6], [122.0, 39.2], [121.3, 38.85], [121.6, 39.5], [121.9, 40.2], [121.6, 40.85], [121.0, 40.9],
  [120.4, 40.3], [119.6, 39.9], [118.8, 39.2], [117.8, 38.9], [117.7, 38.4], [118.5, 38.0], [118.9, 37.6], [119.6, 37.15],
  [120.4, 37.55], [121.4, 37.6], [122.5, 37.25], [121.9, 36.9], [120.8, 36.4], [120.0, 35.9], [119.3, 35.1], [119.6, 34.5],
  [120.3, 33.6], [120.8, 32.7], [121.4, 32.2], [121.9, 31.7], [121.9, 31.0], [121.3, 30.6], [121.7, 30.1], [122.0, 29.6],
  [121.6, 28.9], [121.2, 28.2], [120.6, 27.5], [120.2, 26.8], [119.7, 26.1], [119.2, 25.4], [118.6, 24.7], [117.9, 24.2],
  [117.0, 23.6], [116.3, 23.1], [115.3, 22.8], [114.3, 22.4], [113.6, 22.2], [113.0, 22.0], [112.0, 21.7], [111.0, 21.5], [110.4, 21.5],
];
const ISLAND = [[121.0, 25.3], [121.9, 25.0], [121.6, 24.0], [121.2, 22.8], [120.8, 21.9], [120.2, 22.7], [120.1, 23.6], [120.6, 24.6]];

const RIVERS = [
  { w: 1.25, rgb: '196, 160, 98', pts: [[100.5, 36.1], [101.8, 36.0], [103.8, 36.1], [104.8, 37.0], [105.9, 37.6], [106.4, 38.7], [106.8, 39.6], [107.8, 40.5], [109.0, 40.6], [110.4, 40.4], [111.1, 39.8], [110.7, 38.6], [110.4, 37.3], [110.5, 36.0], [110.3, 35.0], [110.4, 34.6], [111.3, 34.8], [112.5, 34.85], [113.6, 34.95], [114.6, 35.3], [115.4, 35.8], [116.3, 36.5], [117.2, 37.2], [118.2, 37.6], [118.9, 37.65]] },
  { w: 1.45, rgb: '112, 150, 165', pts: [[100.5, 26.8], [101.8, 26.6], [102.9, 27.0], [103.7, 28.3], [104.6, 28.8], [105.5, 28.9], [106.5, 29.55], [107.5, 29.9], [108.4, 30.8], [109.5, 31.05], [110.4, 30.95], [111.3, 30.7], [112.2, 30.3], [112.9, 29.6], [113.2, 29.4], [114.3, 30.6], [115.1, 30.2], [116.0, 29.8], [117.0, 30.5], [117.8, 31.0], [118.4, 31.35], [118.8, 32.1], [119.5, 32.25], [120.3, 32.0], [121.0, 31.8], [121.9, 31.4]] },
  { w: 0.85, rgb: '112, 150, 165', pts: [[106.2, 33.15], [107.0, 33.05], [108.0, 32.75], [109.2, 32.7], [110.6, 32.6], [111.5, 32.35], [112.15, 32.05], [112.5, 31.4], [112.9, 30.9], [113.6, 30.55], [114.3, 30.6]] },
  { w: 0.8, rgb: '112, 150, 165', pts: [[113.2, 32.55], [114.3, 32.45], [115.4, 32.5], [116.4, 32.75], [117.3, 32.95], [118.5, 33.45], [119.4, 33.9], [119.9, 34.25]] },
  { w: 0.75, rgb: '196, 160, 98', pts: [[104.6, 34.85], [105.7, 34.6], [106.8, 34.38], [107.9, 34.3], [108.9, 34.4], [109.7, 34.5], [110.3, 34.6]] },
  { w: 0.7, rgb: '112, 150, 165', pts: [[111.0, 25.5], [111.7, 26.5], [112.5, 27.4], [112.9, 28.2], [112.9, 29.0]] },
  { w: 0.7, rgb: '112, 150, 165', pts: [[114.6, 25.8], [115.0, 26.9], [115.3, 27.8], [115.9, 28.7], [116.1, 29.1]] },
  { w: 0.7, rgb: '112, 150, 165', pts: [[106.0, 33.5], [105.9, 32.5], [106.1, 31.5], [106.3, 30.5], [106.5, 29.55]] },
  { w: 0.7, rgb: '112, 150, 165', pts: [[103.5, 32.8], [103.6, 31.5], [103.9, 30.9], [104.0, 29.8], [104.6, 28.8]] },
];
const LAKES = [
  [112.8, 29.15, 0.55, 0.32, 0.2],
  [116.25, 29.1, 0.3, 0.55, -0.3],
  [120.2, 31.15, 0.28, 0.24, 0],
  [117.55, 31.6, 0.2, 0.12, 0.3],
];

// Mountain ranges: a line to scatter peaks along, and how many.
const RANGES = [
  [[[105.2, 34.0], [107.2, 33.9], [109.0, 33.85], [110.6, 34.0], [111.5, 33.8]], 24],
  [[[106.0, 32.3], [107.5, 32.2], [109.0, 31.9], [110.3, 31.7]], 14],
  [[[109.6, 31.4], [110.5, 31.3]], 5],
  [[[113.3, 35.3], [113.6, 36.4], [113.8, 37.6], [114.3, 38.7], [114.8, 39.6]], 16],
  [[[110.8, 36.5], [111.2, 37.6], [111.6, 38.6]], 8],
  [[[115.2, 40.6], [116.6, 40.75], [118.0, 40.6], [119.2, 40.4]], 11],
  [[[101.0, 38.2], [102.3, 37.5], [103.4, 36.8], [104.9, 35.8], [106.2, 35.3]], 15],
  [[[102.4, 32.8], [102.6, 31.5], [102.3, 30.2], [102.4, 28.8], [101.8, 27.4]], 16],
  [[[102.8, 28.6], [103.3, 27.4], [103.0, 26.3]], 6],
  [[[108.6, 29.6], [109.8, 28.9], [110.7, 28.3]], 8],
  [[[110.4, 27.2], [110.9, 26.3]], 4],
  [[[110.0, 25.4], [111.6, 25.1], [113.0, 25.2], [114.4, 25.0], [115.5, 24.8]], 14],
  [[[116.4, 25.6], [117.2, 26.6], [117.9, 27.5], [118.4, 28.2]], 10],
  [[[117.8, 30.1], [118.6, 30.2], [119.4, 30.4]], 6],
  [[[114.3, 31.3], [115.2, 31.15], [116.2, 31.0]], 7],
  [[[116.9, 36.25], [117.6, 36.0], [118.2, 35.7]], 5],
  [[[110.8, 33.4], [111.8, 33.3], [112.6, 33.4]], 6],
  [[[103.5, 25.5], [104.8, 26.0], [106.0, 26.3], [107.5, 26.0]], 9],
  [[[108.0, 41.2], [110.0, 41.3], [112.0, 41.2]], 7],
];

// name, lon, lat, rank (2: capital), realm
const CITIES = [
  ['洛阳', 112.45, 34.62, 2, 'wei'], ['成都', 104.07, 30.67, 2, 'shu'], ['建业', 118.78, 32.04, 2, 'wu'],
  ['许昌', 113.85, 34.03, 1], ['邺', 114.4, 36.3, 1], ['长安', 108.94, 34.34, 1], ['汉中', 107.03, 33.07, 1],
  ['襄阳', 112.14, 32.04, 1], ['江陵', 112.19, 30.35, 1], ['合肥', 117.27, 31.86, 1], ['长沙', 112.94, 28.23, 1],
  ['柴桑', 115.99, 29.7, 1], ['宛', 112.53, 33.0, 1], ['下邳', 117.95, 34.3, 1], ['寿春', 116.78, 32.57, 1],
  ['北海', 119.1, 36.7, 1], ['永安', 109.5, 31.04, 1], ['天水', 105.7, 34.58, 1], ['吴', 120.6, 31.3, 1],
  ['会稽', 120.58, 30.0, 1], ['江夏', 114.3, 30.6, 1], ['晋阳', 112.55, 37.87, 1], ['蓟', 116.4, 39.9, 1],
  ['武威', 102.6, 37.9, 1], ['番禺', 113.3, 23.1, 1], ['建宁', 103.8, 25.5, 1], ['江州', 106.55, 29.55, 1],
];
const BATTLES = [
  ['官渡', 114.1, 34.75], ['赤壁', 113.9, 29.75], ['夷陵', 111.3, 30.7], ['五丈原', 107.6, 34.25],
  ['街亭', 105.9, 34.9], ['长坂', 111.8, 30.85], ['潼关', 110.25, 34.55],
];
const MARCHES = [
  [[113.85, 34.03], [112.53, 33.0], [112.14, 32.04], [112.19, 30.7], [113.6, 29.85]],
  [[107.03, 33.07], [106.0, 33.6], [105.4, 34.05]],
  [[107.03, 33.07], [107.3, 33.7], [107.55, 34.15]],
  [[112.19, 30.45], [112.15, 31.85]],
  [[104.07, 30.67], [106.55, 29.55], [109.5, 31.04], [111.15, 30.72]],
  [[115.99, 29.7], [114.3, 30.35], [113.0, 29.95], [112.35, 30.3]],
];
const PROVINCES = [
  ['幽州', 116.7, 40.2], ['冀州', 115.6, 37.9], ['并州', 111.9, 38.9], ['青州', 118.7, 36.2], ['兖州', 116.1, 35.4],
  ['徐州', 118.2, 33.9], ['豫州', 114.7, 33.4], ['司州', 111.4, 35.4], ['雍州', 107.4, 35.3], ['凉州', 103.3, 38.4],
  ['益州', 104.9, 31.5], ['荆州', 112.0, 28.9], ['扬州', 118.4, 29.2], ['交州', 110.6, 23.2],
];

const TEXT = [CITIES, BATTLES, PROVINCES].flat().map((c) => c[0]).join('') + '魏蜀吴北东南西三國輿圖西柚百里';

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws the whole map at height H (CSS px) onto ctx (already scaled to CSS px). */
function draw(ctx, H) {
  const W = H * ASPECT;
  const ky = H / (LAT1 - LAT0);
  const kx = ky * KX;
  const u = H / 1800; // drawing unit
  const P = ([lon, lat]) => [(lon - LON0) * kx, (LAT1 - lat) * ky];
  const rnd = rng(23);

  const path = (pts, close) => {
    const p = new Path2D();
    const q = pts.map(P);
    p.moveTo(...q[0]);
    for (let i = 1; i < q.length - 1; i++) p.quadraticCurveTo(...q[i], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    p.lineTo(...q[q.length - 1]);
    if (close) p.closePath();
    return p;
  };
  const spaced = (text, x, y, gap) => {
    const chars = [...text];
    const widths = chars.map((c) => ctx.measureText(c).width);
    let cx = x - (widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1)) / 2;
    chars.forEach((c, i) => {
      ctx.fillText(c, cx + widths[i] / 2, y);
      cx += widths[i] + gap;
    });
  };

  // paper, with broad patches of darker and lighter tone
  ctx.fillStyle = `rgb(${PAPER})`;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = (180 + rnd() * 380) * u;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() < 0.5 ? '255, 250, 238' : '214, 198, 160';
    g.addColorStop(0, `rgba(${tone}, ${0.22 + rnd() * 0.2})`);
    g.addColorStop(1, `rgba(${tone}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // the three realms in washes, soft at the edges
  for (const [id, realm] of Object.entries(REALMS)) {
    const p = path(TERRITORY[id], true);
    ctx.fillStyle = `rgba(${realm.rgb}, 0.085)`;
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.lineJoin = 'round';
    for (const [w, a] of [[70, 0.022], [32, 0.03], [12, 0.04]]) {
      ctx.lineWidth = w * u;
      ctx.strokeStyle = `rgba(${realm.rgb}, ${a})`;
      ctx.stroke(p);
    }
    ctx.restore();
  }

  // sea, with rows of wave crests
  const sea = path([[127, 39.95], ...COAST, [110.4, 18], [127, 18]], true);
  ctx.fillStyle = 'rgb(222, 226, 214)';
  ctx.fill(sea);
  ctx.save();
  ctx.clip(sea);
  ctx.strokeStyle = 'rgba(96, 130, 140, 0.22)';
  ctx.lineWidth = 1.1 * u;
  const step = 26 * u;
  for (let y = 0, row = 0; y < H; y += step * 0.75, row++) {
    for (let x = (row % 2) * step * 0.5; x < W; x += step) {
      ctx.beginPath();
      ctx.arc(x, y + step * 0.25, step * 0.32, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }
  ctx.restore();
  const island = path(ISLAND, true);
  ctx.fillStyle = `rgb(${PAPER})`;
  ctx.fill(island);
  ctx.strokeStyle = `rgba(${INK}, 0.45)`;
  ctx.lineWidth = 1.8 * u;
  ctx.stroke(path(COAST));
  ctx.stroke(island);
  ctx.save();
  ctx.setLineDash([2 * u, 5 * u]);
  ctx.strokeStyle = 'rgba(96, 130, 140, 0.5)';
  ctx.translate(7 * u, 5 * u);
  ctx.stroke(path(COAST));
  ctx.restore();

  // hex grid over everything
  ctx.strokeStyle = `rgba(${INK}, 0.055)`;
  ctx.lineWidth = 1 * u;
  const s = 36 * u;
  const hexH = Math.sqrt(3) * s;
  ctx.beginPath();
  for (let col = 0, x = 0; x < W + s; col++, x += 1.5 * s) {
    for (let y = col % 2 ? hexH / 2 : 0; y < H + hexH; y += hexH) {
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k;
        const px = x + s * Math.cos(a);
        const py = y + s * Math.sin(a);
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
    }
  }
  ctx.stroke();

  // rivers and lakes: a pale bank, the water, a darker thread
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const r of RIVERS) {
    const p = path(r.pts);
    ctx.lineWidth = (r.w * 9 + 4) * u;
    ctx.strokeStyle = 'rgba(250, 245, 230, 0.7)';
    ctx.stroke(p);
    ctx.lineWidth = r.w * 6 * u;
    ctx.strokeStyle = `rgba(${r.rgb}, 0.7)`;
    ctx.stroke(p);
    ctx.lineWidth = r.w * 1.4 * u;
    ctx.strokeStyle = `rgba(${r.rgb.split(',').map((c) => Math.round(c * 0.62)).join(',')}, 0.55)`;
    ctx.stroke(p);
  }
  for (const [lon, lat, rx, ry, rot] of LAKES) {
    const [x, y] = P([lon, lat]);
    ctx.beginPath();
    ctx.ellipse(x, y, rx * kx, ry * ky, rot, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(140, 170, 178, 0.55)';
    ctx.fill();
    ctx.lineWidth = 1.2 * u;
    ctx.strokeStyle = 'rgba(70, 100, 110, 0.5)';
    ctx.stroke();
  }

  // borders between the realms
  ctx.save();
  ctx.setLineDash([12 * u, 7 * u]);
  ctx.lineWidth = 2.2 * u;
  ctx.strokeStyle = `rgba(${ZHU}, 0.32)`;
  for (const b of [WEI_SHU, WEI_WU, SHU_WU]) ctx.stroke(path(b));
  ctx.restore();

  // mountains: peaks scattered along each range, drawn back to front
  const peaks = [];
  for (const [line, n] of RANGES) {
    const pts = line.map(P);
    const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
    const total = seg.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) {
      let d = ((i + 0.5 + (rnd() - 0.5) * 0.8) / n) * total;
      let j = 0;
      while (j < seg.length - 1 && d > seg[j]) d -= seg[j++];
      const t = Math.min(1, d / seg[j]);
      const x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t + (rnd() - 0.5) * 34 * u;
      const y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t + (rnd() - 0.5) * 30 * u;
      const w = (40 + rnd() * 38) * u;
      peaks.push({ x, y, w, h: w * (0.55 + rnd() * 0.45), teal: rnd() < 0.45, lean: (rnd() - 0.5) * 0.35 });
    }
  }
  peaks.sort((a, b) => a.y - b.y);
  for (const k of peaks) {
    const { x, y, w, h } = k;
    const px = x + k.lean * w;
    const tint = k.teal ? '64, 104, 96' : INK;
    const body = new Path2D();
    body.moveTo(x - w / 2, y);
    body.quadraticCurveTo(x - w * 0.18, y - h * 0.6, px, y - h);
    body.quadraticCurveTo(x + w * 0.2, y - h * 0.52, x + w / 2, y);
    body.closePath();
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, `rgba(${tint}, ${k.teal ? 0.42 : 0.36})`);
    g.addColorStop(0.6, `rgba(${tint}, 0.12)`);
    g.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = `rgba(${PAPER}, 0.85)`;
    ctx.fill(body);
    ctx.fillStyle = g;
    ctx.fill(body);
    // the shaded flank
    const shade = new Path2D();
    shade.moveTo(px, y - h);
    shade.quadraticCurveTo(x + w * 0.2, y - h * 0.52, x + w / 2, y);
    shade.lineTo(x + w * 0.08, y);
    shade.quadraticCurveTo(px + w * 0.04, y - h * 0.45, px, y - h);
    ctx.fillStyle = `rgba(${tint}, 0.14)`;
    ctx.fill(shade);
    // ridge
    ctx.beginPath();
    ctx.moveTo(x - w * 0.42, y - h * 0.1);
    ctx.quadraticCurveTo(x - w * 0.18, y - h * 0.6, px, y - h);
    ctx.quadraticCurveTo(x + w * 0.2, y - h * 0.52, x + w * 0.44, y - h * 0.08);
    ctx.lineWidth = 1.5 * u;
    ctx.strokeStyle = `rgba(${INK}, 0.5)`;
    ctx.stroke();
    // a few texture strokes on the shaded side
    ctx.lineWidth = 1 * u;
    ctx.strokeStyle = `rgba(${INK}, 0.22)`;
    for (let i = 1; i <= 3; i++) {
      const sx = px + (w * 0.12 * i) / 1.2;
      const sy = y - h + h * 0.28 * i;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - w * 0.08, sy + h * 0.16);
      ctx.stroke();
    }
  }

  // the realms' names, very large and faint
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const realm of Object.values(REALMS)) {
    const [x, y] = P(realm.at);
    ctx.font = `900 ${230 * u}px ${FONT}`;
    ctx.fillStyle = `rgba(${realm.rgb}, 0.1)`;
    ctx.fillText(realm.name, x, y);
    ctx.lineWidth = 1.4 * u;
    ctx.strokeStyle = `rgba(${realm.rgb}, 0.22)`;
    ctx.strokeText(realm.name, x, y);
  }
  // provinces
  ctx.font = `600 ${25 * u}px ${FONT}`;
  ctx.fillStyle = `rgba(${INK}, 0.3)`;
  for (const [name, lon, lat] of PROVINCES) spaced(name, ...P([lon, lat]), 12 * u);

  // marches: dashed vermilion arrows
  ctx.save();
  ctx.setLineDash([9 * u, 6 * u]);
  ctx.lineWidth = 2.4 * u;
  ctx.strokeStyle = `rgba(${ZHU}, 0.5)`;
  ctx.fillStyle = `rgba(${ZHU}, 0.6)`;
  for (const m of MARCHES) {
    ctx.stroke(path(m));
    const [a, b] = [P(m[m.length - 2]), P(m[m.length - 1])];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.beginPath();
    ctx.moveTo(b[0] + Math.cos(ang) * 10 * u, b[1] + Math.sin(ang) * 10 * u);
    ctx.lineTo(b[0] + Math.cos(ang + 2.5) * 12 * u, b[1] + Math.sin(ang + 2.5) * 12 * u);
    ctx.lineTo(b[0] + Math.cos(ang - 2.5) * 12 * u, b[1] + Math.sin(ang - 2.5) * 12 * u);
    ctx.fill();
  }
  ctx.restore();

  // battles: crossed blades and the name in vermilion
  ctx.lineCap = 'round';
  for (const [name, lon, lat] of BATTLES) {
    const [x, y] = P([lon, lat]);
    const r = 8 * u;
    ctx.strokeStyle = `rgba(${ZHU}, 0.75)`;
    ctx.lineWidth = 2.2 * u;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.9, y - r * 0.3);
    ctx.lineTo(x - r * 0.3, y - r * 0.9);
    ctx.moveTo(x + r * 0.9, y - r * 0.3);
    ctx.lineTo(x + r * 0.3, y - r * 0.9);
    ctx.stroke();
    ctx.font = `600 ${15 * u}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.lineWidth = 4 * u;
    ctx.strokeStyle = `rgba(${PAPER}, 0.9)`;
    ctx.strokeText(name, x + r + 5 * u, y + 1 * u);
    ctx.fillStyle = `rgba(${ZHU}, 0.85)`;
    ctx.fillText(name, x + r + 5 * u, y + 1 * u);
  }

  // cities: little walled squares; capitals bigger, with their realm's banner
  for (const [name, lon, lat, rank, realm] of CITIES) {
    const [x, y] = P([lon, lat]);
    const r = (rank === 2 ? 9 : 6) * u;
    ctx.fillStyle = `rgb(${PAPER})`;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.lineWidth = (rank === 2 ? 2.2 : 1.7) * u;
    ctx.strokeStyle = `rgba(${INK}, 0.8)`;
    ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    // battlements
    ctx.fillStyle = `rgba(${INK}, 0.8)`;
    const m = r * 0.45;
    for (const dx of [-r, -m * 0.5, r - m * 0.9]) ctx.fillRect(x + dx, y - r - 3 * u, m * 0.9, 3 * u);
    if (rank === 2) {
      ctx.strokeRect(x - r * 0.45, y - r * 0.45, r * 0.9, r * 0.9);
      const { rgb, name: realmName } = REALMS[realm];
      const fx = x + r + 2 * u;
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath();
      ctx.moveTo(fx, y + r);
      ctx.lineTo(fx, y - r - 30 * u);
      ctx.stroke();
      ctx.fillStyle = `rgba(${rgb}, 0.9)`;
      ctx.beginPath();
      ctx.moveTo(fx, y - r - 30 * u);
      ctx.lineTo(fx + 22 * u, y - r - 27 * u);
      ctx.lineTo(fx + 19 * u, y - r - 19 * u);
      ctx.lineTo(fx + 22 * u, y - r - 11 * u);
      ctx.lineTo(fx, y - r - 13 * u);
      ctx.closePath();
      ctx.fill();
      ctx.font = `700 ${11 * u}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 250, 240, 0.95)';
      ctx.fillText(realmName, fx + 10 * u, y - r - 20.5 * u);
    }
    ctx.font = `${rank === 2 ? 800 : 600} ${(rank === 2 ? 20 : 15) * u}px ${FONT}`;
    ctx.textAlign = 'left';
    const lx = x + r + (rank === 2 ? 26 : 6) * u;
    ctx.lineWidth = 4.5 * u;
    ctx.strokeStyle = `rgba(${PAPER}, 0.92)`;
    ctx.strokeText(name, lx, y + 1 * u);
    ctx.fillStyle = `rgba(${INK}, ${rank === 2 ? 0.9 : 0.78})`;
    ctx.fillText(name, lx, y + 1 * u);
  }

  // compass and scale, bottom left
  {
    const [x, y] = P([102.6, 23.9]);
    const R = 62 * u;
    ctx.strokeStyle = `rgba(${INK}, 0.5)`;
    ctx.lineWidth = 1.4 * u;
    for (const rr of [R, R * 0.82, R * 0.3]) {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let k = 0; k < 8; k++) {
      const a = (Math.PI / 4) * k - Math.PI / 2;
      const len = k % 2 ? R * 0.5 : R * 0.8;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.lineTo(x + Math.cos(a + 0.35) * R * 0.18, y + Math.sin(a + 0.35) * R * 0.18);
      ctx.lineTo(x + Math.cos(a - 0.35) * R * 0.18, y + Math.sin(a - 0.35) * R * 0.18);
      ctx.closePath();
      ctx.fillStyle = k === 0 ? `rgba(${ZHU}, 0.7)` : `rgba(${INK}, ${k % 2 ? 0.25 : 0.45})`;
      ctx.fill();
    }
    ctx.font = `700 ${17 * u}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(${INK}, 0.65)`;
    [['北', 0, -1], ['东', 1, 0], ['南', 0, 1], ['西', -1, 0]].forEach(([c, dx, dy]) => ctx.fillText(c, x + dx * (R + 16 * u), y + dy * (R + 16 * u)));
    const sx = x + R + 50 * u;
    const sy = y + R * 0.7;
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 120 * u, sy);
    for (let i = 0; i <= 4; i++) {
      ctx.moveTo(sx + i * 30 * u, sy);
      ctx.lineTo(sx + i * 30 * u, sy - (i % 2 ? 5 : 9) * u);
    }
    ctx.stroke();
    ctx.font = `600 ${13 * u}px ${FONT}`;
    ctx.fillText('百里', sx + 60 * u, sy + 16 * u);
  }

  // title cartouche, top right: 三國輿圖 down a framed panel, with a seal
  {
    const [x, y] = P([121.6, 41.25]);
    const w = 64 * u;
    const h = 250 * u;
    ctx.fillStyle = 'rgba(250, 244, 228, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = `rgba(${INK}, 0.7)`;
    ctx.lineWidth = 3 * u;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 1 * u;
    ctx.strokeRect(x + 6 * u, y + 6 * u, w - 12 * u, h - 12 * u);
    ctx.font = `900 ${36 * u}px ${FONT}`;
    ctx.fillStyle = `rgba(${INK}, 0.85)`;
    ctx.textAlign = 'center';
    [...'三國輿圖'].forEach((c, i) => ctx.fillText(c, x + w / 2, y + 38 * u + i * 48 * u));
    const sx = x + w / 2 - 20 * u;
    const sy = y + h + 14 * u;
    ctx.fillStyle = `rgba(${ZHU}, 0.85)`;
    ctx.fillRect(sx, sy, 40 * u, 40 * u);
    ctx.font = `900 ${16 * u}px ${FONT}`;
    ctx.fillStyle = 'rgba(255, 246, 236, 0.95)';
    ctx.fillText('西', sx + 20 * u, sy + 12 * u);
    ctx.fillText('柚', sx + 20 * u, sy + 29 * u);
  }

  // grain
  const grain = document.createElement('canvas');
  grain.width = grain.height = 128;
  const gx = grain.getContext('2d');
  const img = gx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rnd() < 0.5 ? 0 : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = rnd() * 26;
  }
  gx.putImageData(img, 0, 0);
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(0, 0, W, H);
  // long fibres
  ctx.lineWidth = 0.8 * u;
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const a = rnd() * Math.PI;
    const l = (12 + rnd() * 40) * u;
    ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '120, 100, 70' : '255, 255, 250'}, 0.12)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 4 * u, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

/**
 * Puts the map behind the page and keeps it drifting. The canvas is a little
 * larger than the window both ways; its size only grows (on resize) so it is
 * redrawn rarely.
 */
export function mountMap(canvas) {
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let H = 0;
  let W = 0;
  let drawn = 0;

  async function render() {
    const need = Math.min(3000, Math.max(innerWidth * 1.32 / ASPECT, innerHeight * 1.32, 900));
    if (need <= drawn) return;
    drawn = need * 1.08;
    H = drawn;
    W = H * ASPECT;
    const scale = Math.min(devicePixelRatio || 1, 2, 2800 / H);
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    try {
      await Promise.race([
        Promise.all([400, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 20px "Noto Serif SC Variable"`, TEXT))),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      /* draw with whatever font there is */
    }
    draw(ctx, H);
    canvas.classList.add('is-ready');
  }

  // A slow Lissajous drift across the part of the map outside the window.
  const t0 = performance.now() - 37000;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!W) return;
    const rx = Math.max(0, W - innerWidth);
    const ry = Math.max(0, H - innerHeight);
    const t = still.matches ? 0 : (now - t0) / 1000;
    const x = (rx / 2) * (1 + Math.sin((t / 150) * Math.PI * 2));
    const y = (ry / 2) * (1 + Math.sin((t / 205) * Math.PI * 2 + 1.3));
    canvas.style.transform = `translate3d(${-x.toFixed(1)}px, ${-y.toFixed(1)}px, 0)`;
  }

  render();
  requestAnimationFrame(frame);
  let timer = 0;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 300);
  });
}
