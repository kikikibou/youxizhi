/**
 * Debate timer: single-speaker presets + a two-clock free-debate mode.
 * mount(el) renders into the drawer and returns a cleanup function.
 */
const PRESETS = [
  { label: '立论', sec: 210 },
  { label: '质询', sec: 90 },
  { label: '驳论', sec: 150 },
  { label: '总结', sec: 210 },
];

const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

let audio;
function beep(freq = 880, dur = 0.18) {
  try {
    audio ||= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + dur);
  } catch {
    /* audio is optional */
  }
}

export function mountTimer(el) {
  el.innerHTML = `
    <div class="tool-head">
      <div class="tool-kicker">TOOL 01 · DEBATE</div>
      <h2 class="tool-title">TIMER<small>辩论计时器</small></h2>
    </div>
    <div class="seg" role="tablist">
      <button type="button" class="seg-btn is-on" data-mode="single">单方计时</button>
      <button type="button" class="seg-btn" data-mode="dual">自由辩 · 双计时</button>
    </div>

    <div class="tm" data-view="single">
      <div class="tm-presets">
        ${PRESETS.map((p, i) => `<button type="button" class="chip ${i === 0 ? 'is-on' : ''}" data-sec="${p.sec}">${p.label} ${fmt(p.sec * 1000)}</button>`).join('')}
        <button type="button" class="chip" data-adj="-30">−30s</button>
        <button type="button" class="chip" data-adj="30">+30s</button>
      </div>
      <div class="tm-clock" data-clock="single">3:30</div>
      <div class="tm-bar"><i data-bar="single"></i></div>
    </div>

    <div class="tm" data-view="dual" hidden>
      <div class="tm-duo">
        <button type="button" class="tm-side" data-side="0"><span>正方 PRO</span><b data-clock="0">4:00</b></button>
        <button type="button" class="tm-side" data-side="1"><span>反方 CON</span><b data-clock="1">4:00</b></button>
      </div>
      <p class="tm-tip">点击一方或按 <kbd>空格</kbd> 交换发言权；一方用完后另一方可继续。</p>
    </div>

    <div class="tm-ctrl">
      <button type="button" class="btn btn-main" data-act="toggle">开始</button>
      <button type="button" class="btn" data-act="reset">重置</button>
    </div>
    <p class="tm-tip">快捷键：<kbd>空格</kbd> 开始/暂停（双计时下为交换），<kbd>R</kbd> 重置。最后 30 秒与结束时会有提示音。</p>
  `;

  const $ = (s) => el.querySelector(s);
  const state = {
    mode: 'single',
    total: 210000,
    left: 210000,
    duo: [240000, 240000],
    duoTotal: 240000,
    side: 0,
    running: false,
    last: 0,
    warned: {},
  };

  const toggleBtn = $('[data-act="toggle"]');

  function render() {
    if (state.mode === 'single') {
      const c = $('[data-clock="single"]');
      c.textContent = fmt(state.left);
      c.classList.toggle('is-warn', state.left <= 30000 && state.left > 0);
      c.classList.toggle('is-over', state.left <= 0);
      $('[data-bar="single"]').style.transform = `scaleX(${state.left / state.total})`;
    } else {
      state.duo.forEach((ms, i) => {
        const b = $(`[data-clock="${i}"]`);
        b.textContent = fmt(ms);
        b.classList.toggle('is-warn', ms <= 30000 && ms > 0);
        b.classList.toggle('is-over', ms <= 0);
        $(`[data-side="${i}"]`).classList.toggle('is-on', state.side === i);
      });
    }
    toggleBtn.textContent = state.running ? '暂停' : '开始';
  }

  function warn(key) {
    if (state.warned[key]) return;
    state.warned[key] = true;
    if (key.endsWith('end')) {
      beep(660, 0.35);
      setTimeout(() => beep(660, 0.35), 420);
    } else beep(880, 0.15);
  }

  function tick() {
    if (!state.running) return;
    const now = performance.now();
    const dt = now - state.last;
    state.last = now;
    if (state.mode === 'single') {
      state.left -= dt;
      if (state.left <= 30000) warn('s30');
      if (state.left <= 0) {
        state.left = 0;
        state.running = false;
        warn('send');
      }
    } else {
      const i = state.side;
      state.duo[i] -= dt;
      if (state.duo[i] <= 30000) warn(`d${i}30`);
      if (state.duo[i] <= 0) {
        state.duo[i] = 0;
        warn(`d${i}end`);
        if (state.duo[1 - i] > 0) state.side = 1 - i;
        else state.running = false;
      }
    }
    render();
  }

  const interval = setInterval(tick, 100);

  function start() {
    state.running = true;
    state.last = performance.now();
    render();
  }
  function pause() {
    tick();
    state.running = false;
    render();
  }
  function reset() {
    state.running = false;
    state.left = state.total;
    state.duo = [state.duoTotal, state.duoTotal];
    state.side = 0;
    state.warned = {};
    render();
  }
  function swap() {
    if (state.running) tick();
    const next = 1 - state.side;
    if (state.duo[next] > 0) state.side = next;
    if (!state.running) start();
    render();
  }

  el.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.mode) {
      state.mode = t.dataset.mode;
      el.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('is-on', b === t));
      el.querySelectorAll('.tm').forEach((v) => (v.hidden = v.dataset.view !== state.mode));
      reset();
    } else if (t.dataset.sec) {
      state.total = +t.dataset.sec * 1000;
      el.querySelectorAll('.chip[data-sec]').forEach((b) => b.classList.toggle('is-on', b === t));
      reset();
    } else if (t.dataset.adj) {
      state.total = Math.max(30000, state.total + +t.dataset.adj * 1000);
      reset();
    } else if (t.dataset.side) {
      const i = +t.dataset.side;
      if (state.running) tick();
      if (state.duo[i] > 0) state.side = i;
      if (!state.running) start();
      render();
    } else if (t.dataset.act === 'toggle') {
      state.running ? pause() : start();
    } else if (t.dataset.act === 'reset') reset();
  });

  function onKey(e) {
    if (e.target.closest('input, textarea')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (state.mode === 'dual' && state.running) swap();
      else state.running ? pause() : start();
    } else if (e.key === 'r' || e.key === 'R') reset();
  }
  window.addEventListener('keydown', onKey);
  render();

  return () => {
    clearInterval(interval);
    window.removeEventListener('keydown', onKey);
  };
}
