/**
 * Debug panel: frame rate, GPU time, resolution, and quality switches.
 * Loaded only when the site is opened with ?debug (see app.js); the choices
 * are remembered on this device so a reload keeps them. ` (backquote) folds it.
 */
import { QUALITY_DEFAULTS } from './three/perf.js';

const STORE = 'youxizhi-quality';

const CSS = `
.dbg { position: fixed; left: 12px; bottom: 72px; z-index: 60; width: 272px; max-width: calc(100vw - 24px);
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #f3efe6;
  background: rgba(11, 26, 56, 0.9); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 8px;
  padding: 8px 10px 10px; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25); user-select: none; }
.dbg * { box-sizing: border-box; }
.dbg-head { display: flex; align-items: baseline; gap: 8px; cursor: pointer; }
.dbg-fps { font-size: 18px; font-weight: 700; letter-spacing: 0.02em; }
.dbg-fps small { font-size: 10px; font-weight: 400; opacity: 0.7; margin-left: 2px; }
.dbg-head .dbg-sub { opacity: 0.75; flex: 1; }
.dbg-head .dbg-fold { opacity: 0.6; }
.dbg.is-folded { width: auto; padding: 6px 10px; }
.dbg.is-folded .dbg-body, .dbg.is-folded .dbg-sub { display: none; }
.dbg canvas { display: block; width: 100%; height: 46px; margin: 6px 0 4px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; }
.dbg-stats div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dbg-stats b { color: #ffb070; font-weight: 600; }
.dbg-row { margin-top: 8px; }
.dbg-row > span { display: block; opacity: 0.7; margin-bottom: 3px; }
.dbg-seg { display: flex; flex-wrap: wrap; gap: 3px; }
.dbg button { font: inherit; color: inherit; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px; padding: 2px 7px; cursor: pointer; }
.dbg button.is-on { background: #ff7d10; border-color: #ff7d10; color: #10213f; font-weight: 700; }
.dbg-toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; }
.dbg-toggles label { display: flex; align-items: center; gap: 5px; cursor: pointer; }
.dbg-toggles input { accent-color: #ff7d10; margin: 0; }
.dbg-log { margin-top: 8px; max-height: 76px; overflow: auto; opacity: 0.85; }
.dbg-log div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dbg-foot { display: flex; gap: 6px; margin-top: 8px; }
.dbg-legend { display: flex; gap: 10px; opacity: 0.7; font-size: 10px; }
.dbg-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 3px; vertical-align: -1px; }
`;

const SCALES = [
  ['auto', '自动'],
  [1, '100%'],
  [0.85, '85%'],
  [0.7, '70%'],
  [0.5, '50%'],
];
const CAPS = [
  [0, '不限'],
  [60, '60'],
  [30, '30'],
];
const TOGGLES = [
  ['shadows', '阴影'],
  ['ribbons', '飘带'],
  ['ribbonShadow', '飘带影子'],
  ['bloom', '夜间光晕'],
  ['msaa', '抗锯齿'],
  ['reveal', '反差效果'],
  ['grain', '颗粒/暗角'],
];

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}');
  } catch {
    return {};
  }
}
function save(q) {
  try {
    localStorage.setItem(STORE, JSON.stringify(q));
  } catch {
    /* storage unavailable */
  }
}

export function mountDebug(world) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const saved = load();
  if (Object.keys(saved).length) world.setQuality(saved);

  const el = document.createElement('div');
  el.className = 'dbg';
  el.innerHTML = `
    <div class="dbg-head" title="点击或按 \` 收起/展开">
      <span class="dbg-fps">--<small>fps</small></span>
      <span class="dbg-sub"></span>
      <span class="dbg-fold">▾</span>
    </div>
    <div class="dbg-body">
      <canvas width="252" height="46"></canvas>
      <div class="dbg-legend"><span><i style="background:#7fd18b"></i>帧间隔</span><span><i style="background:#ffb070"></i>GPU</span><span>线：60 / 30 fps</span></div>
      <div class="dbg-stats"></div>
      <div class="dbg-row"><span>分辨率</span><div class="dbg-seg" data-k="scale"></div></div>
      <div class="dbg-row"><span>帧率上限</span><div class="dbg-seg" data-k="fpsCap"></div></div>
      <div class="dbg-row"><span>效果开关</span><div class="dbg-toggles"></div></div>
      <div class="dbg-log"></div>
      <div class="dbg-foot"><button data-act="reset">恢复默认</button><button data-act="copy">复制数据</button></div>
    </div>`;
  document.body.appendChild(el);
  // Scrolling or swiping over the panel shouldn't change pages.
  for (const ev of ['wheel', 'touchstart', 'touchend']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  const $ = (s) => el.querySelector(s);
  const fpsEl = $('.dbg-fps');
  const subEl = $('.dbg-sub');
  const statsEl = $('.dbg-stats');
  const logEl = $('.dbg-log');
  const canvas = $('canvas');
  const k = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 252 * k;
  canvas.height = 46 * k;
  const ctx = canvas.getContext('2d');

  const segs = { scale: SCALES, fpsCap: CAPS };
  for (const [k, opts] of Object.entries(segs)) {
    const box = el.querySelector(`[data-k="${k}"]`);
    for (const [v, label] of opts) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.v = String(v);
      b.addEventListener('click', () => set({ [k]: v }));
      box.appendChild(b);
    }
  }
  const toggles = $('.dbg-toggles');
  for (const [k, label] of TOGGLES) {
    const l = document.createElement('label');
    l.innerHTML = `<input type="checkbox" data-k="${k}"> ${label}`;
    l.querySelector('input').addEventListener('change', (e) => set({ [k]: e.target.checked }));
    toggles.appendChild(l);
  }

  function set(patch) {
    world.setQuality(patch);
    const q = world.quality;
    const changed = {};
    for (const k of Object.keys(QUALITY_DEFAULTS)) if (q[k] !== QUALITY_DEFAULTS[k]) changed[k] = q[k];
    save(changed);
    sync();
  }

  function sync() {
    const q = world.quality;
    for (const k of Object.keys(segs)) {
      el.querySelectorAll(`[data-k="${k}"] button`).forEach((b) => b.classList.toggle('is-on', b.dataset.v === String(q[k])));
    }
    el.querySelectorAll('.dbg-toggles input').forEach((i) => (i.checked = !!q[i.dataset.k]));
  }
  sync();

  const fold = () => {
    el.classList.toggle('is-folded');
    $('.dbg-fold').textContent = el.classList.contains('is-folded') ? '▸' : '▾';
  };
  $('.dbg-head').addEventListener('click', fold);
  if (window.innerWidth < 700) fold(); // phones: start as a small fps chip
  window.addEventListener('keydown', (e) => {
    if (e.key === '`') fold();
  });

  el.querySelector('[data-act="reset"]').addEventListener('click', () => {
    try {
      localStorage.removeItem(STORE);
    } catch {
      /* ignore */
    }
    world.setQuality({ ...QUALITY_DEFAULTS });
    sync();
  });

  const report = () => {
    const p = world.perf;
    const r = world.renderer;
    const size = r.getDrawingBufferSize(world._size);
    return [
      `FPS ${p.fps.toFixed(1)}，平均帧 ${p.frameMs.toFixed(1)} ms，最慢 ${p.worstMs.toFixed(1)} ms`,
      `GPU ${p.gpuMs == null ? '无法计时' : p.gpuMs.toFixed(1) + ' ms'}，显示器约 ${Math.round(p.refreshHz)} Hz`,
      `像素比 ${world.pixelRatio.toFixed(2)}（屏幕 ${world.dpr}），画布 ${size.x}×${size.y}`,
      `绘制 ${p.calls} 次，${(p.triangles / 1e6).toFixed(2)} M 三角形`,
      `设置 ${JSON.stringify(world.quality)}`,
      `浏览器 ${navigator.userAgent}`,
      ...p.log.map((l) => `${l.t.toFixed(1)}s ${l.msg}`),
    ].join('\n');
  };
  el.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try {
      await navigator.clipboard.writeText(report());
      b.textContent = '已复制';
    } catch {
      b.textContent = '复制失败';
    }
    setTimeout(() => (b.textContent = '复制数据'), 1500);
  });

  function draw() {
    const p = world.perf;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const max = 50; // ms at the top of the graph
    const y = (ms) => h - Math.min(1, ms / max) * h;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (const ms of [1000 / 60, 1000 / 30]) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y(ms)) + 0.5);
      ctx.lineTo(w, Math.round(y(ms)) + 0.5);
      ctx.stroke();
    }
    const hist = p.history;
    const n = hist.length;
    const bw = w / 180;
    for (let i = 0; i < n; i++) {
      const ms = hist[i];
      ctx.fillStyle = ms < 20 ? '#7fd18b' : ms < 36 ? '#ffb070' : '#ff6a5a';
      const x = w - (n - i) * bw;
      ctx.fillRect(x, y(ms), Math.max(1, bw - 0.3), h - y(ms));
    }
    const g = p.gpuHistory;
    if (g.length > 1) {
      ctx.strokeStyle = '#ffb070';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      g.forEach((ms, i) => {
        const x = w - (g.length - i) * bw;
        if (i) ctx.lineTo(x, y(ms));
        else ctx.moveTo(x, y(ms));
      });
      ctx.stroke();
    }
  }

  function tick() {
    const p = world.perf;
    const size = world.renderer.getDrawingBufferSize(world._size);
    fpsEl.innerHTML = `${p.fps ? p.fps.toFixed(0) : '--'}<small>fps</small>`;
    subEl.textContent = `${p.frameMs.toFixed(1)} ms · ${Math.round((world.pixelRatio / world.dpr) * 100)}%`;
    const pct = Math.round((world.pixelRatio / world.dpr) * 100);
    const gpu = p.gpuMs != null ? `<b>${p.gpuMs.toFixed(1)}</b> ms` : world.gpu.available ? '…' : '此浏览器无法计时';
    statsEl.innerHTML = [
      `帧 <b>${p.frameMs.toFixed(1)}</b> ms，最慢 <b>${p.worstMs.toFixed(1)}</b> ms`,
      `GPU ${gpu}，显示器 ≈ <b>${Math.round(p.refreshHz) || '…'}</b> Hz`,
      `分辨率 <b>${pct}%</b>（像素比 ${world.pixelRatio.toFixed(2)} / 屏幕 ${world.dpr}）`,
      `画布 ${size.x}×${size.y} · 绘制 ${p.calls} 次 · ${(p.triangles / 1e6).toFixed(2)}M 面`,
    ]
      .map((line) => `<div>${line}</div>`)
      .join('');
    logEl.innerHTML = p.log.length ? p.log.map((l) => `<div>${l.t.toFixed(1)}s ${l.msg}</div>`).join('') : '<div style="opacity:.6">（分辨率变化会记在这里）</div>';
    if (!el.classList.contains('is-folded')) draw();
  }
  setInterval(tick, 250);
  tick();
}
