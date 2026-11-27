import { LED, textDots } from './leddots.js';

/**
 * 大辩题库's way in (board() in app.js, takeoff kind 'led'): the camera has
 * dived into the street bin's opening, and the black inside turns into a
 * quote board. Its dots come up dim over the whole screen, a flash of news
 * runs across it (快讯 大辩题库开盘), and as it passes, the page's name lights
 * up in yellow dots from the middle outwards, each dot flaring white first.
 * The board then stays on the black the page opens on (#070807), under the
 * motto (CSS, .takeoff[data-kind='led']).
 *
 * Drawn on a canvas frame by frame, played by the clock (a slow machine sees
 * fewer frames, not a slower board; a timer finishes it where no frames
 * come), forwards to light up, backwards to go dark again and fade, as the
 * camera rises out of the bin. Without motion: the board and the name just
 * fade in.
 */

const END = 1.55; // seconds
const FADE = 0.3; // the black and the dim dots come up
const NEWS = [0.12, 0.92]; // the news runs across
const NAME = [0.62, 1.32]; // the name lights up, from the middle out
const FLARE = 0.12; // how long a dot flares white as it lights

export function ledVeil(host) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const k = Math.min(window.devicePixelRatio || 1, 2);
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'led';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  const ctx = canvas.getContext('2d');
  host.prepend(canvas);

  // The name: on one line on a wide screen, 大辩 over 题库 on a narrow one;
  // the dots as large as lets it take most of the width.
  const wide = W / H > 0.9 && W >= 640;
  const lines = (wide ? ['大辩题库'] : ['大辩', '题库']).map((t) => textDots(t, 24, 500));
  const nCols = Math.max(...lines.map((l) => l.cols));
  const nRows = lines.length * 24 + (lines.length - 1) * 3;
  const pitch = Math.max(5, Math.min(wide ? 13 : 11, Math.floor(Math.min((W * 0.74) / nCols, (H * 0.34) / nRows)))) * k;
  const cols = Math.ceil(canvas.width / pitch) + 1;
  const rows = Math.ceil(canvas.height / pitch) + 1;
  const ox = (canvas.width - cols * pitch) / 2; // (the grid centred on the screen)
  const oy = (canvas.height - rows * pitch) / 2;
  const c0 = Math.floor((cols - nCols) / 2);
  const r0 = Math.floor(rows / 2 - nRows / 2 - rows * 0.05); // (a little above the middle: the motto goes under it)
  const R = pitch * 0.36;

  // Which dots the name lights, and when each one does (by its distance from the middle).
  const name = [];
  const mid = [c0 + nCols / 2, r0 + nRows / 2];
  let far = 1;
  lines.forEach((l, j) => {
    const top = r0 + j * 27;
    const left = c0 + Math.floor((nCols - l.cols) / 2);
    for (let r = 0; r < l.rows; r++) for (let i = 0; i < l.cols; i++) {
      if (!l.on(r, i)) continue;
      const d = Math.hypot(left + i - mid[0], (top + r - mid[1]) * 1.4);
      far = Math.max(far, d);
      name.push({ c: left + i, r: top + r, d });
    }
  });
  for (const n of name) n.at = NAME[0] + (NAME[1] - NAME[0] - FLARE) * (n.d / far) ** 0.8;

  // The news: 16 rows high, through the middle of the name's band.
  const news = [textDots('快讯 ', 16, 400), textDots('大辩题库开盘   快讯 ', 16, 400), textDots('大辩题库开盘', 16, 400)];
  const newsColors = [LED.yellow, LED.white, LED.white];
  const newsCols = news.reduce((a, n) => a + n.cols, 0);
  const newsTop = Math.round(mid[1] - 8);

  // The unlit dots, drawn once.
  const grid = document.createElement('canvas');
  grid.width = canvas.width;
  grid.height = canvas.height;
  const g = grid.getContext('2d');
  g.fillStyle = LED.screen;
  g.fillRect(0, 0, grid.width, grid.height);
  g.fillStyle = LED.off;
  g.beginPath();
  for (let i = 0; i < cols; i++) for (let r = 0; r < rows; r++) {
    const x = ox + i * pitch + pitch / 2;
    const y = oy + r * pitch + pitch / 2;
    g.moveTo(x + R, y);
    g.arc(x, y, R, 0, Math.PI * 2);
  }
  g.fill();

  const at = (i, r) => [ox + i * pitch + pitch / 2, oy + r * pitch + pitch / 2];
  // Lit dots in batches by colour and size: a soft halo under each, then its core.
  const paint = (batches) => {
    for (const [color, list, big] of batches) {
      if (!list.length) continue;
      ctx.fillStyle = color;
      for (const [rad, alpha] of [[R * (big ? 2 : 1.5), 0.22], [R * (big ? 1.25 : 1), 1]]) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (const [x, y] of list) {
          ctx.moveTo(x + rad, y);
          ctx.arc(x, y, rad, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  let T = 0;
  /** The board at time T (seconds into its lighting up). */
  function render(T) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const a = Math.min(1, Math.max(0, T / FADE));
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.drawImage(grid, 0, 0);
    ctx.globalAlpha = 1;
    if (still) {
      // (no running news and no spreading: the name comes up with the board)
      paint([[LED.yellow, name.map((n) => at(n.c, n.r)), false]]);
      canvas.style.opacity = String(a);
      return;
    }
    const lit = { y: [], w: [], flare: [] };
    const taken = new Set();
    for (const n of name) {
      if (T < n.at) continue;
      taken.add(n.r * cols + n.c);
      (T < n.at + FLARE ? lit.flare : lit.y).push(at(n.c, n.r));
    }
    // (the news, in whole columns as on a board: in from the right, out at the left)
    const f = (T - NEWS[0]) / (NEWS[1] - NEWS[0]);
    if (f > 0 && f < 1) {
      let x = Math.round(cols - f * (cols + newsCols));
      news.forEach((n, j) => {
        const list = newsColors[j] === LED.yellow ? lit.y : lit.w;
        for (let i = 0; i < n.cols; i++) {
          const c = x + i;
          if (c < 0 || c >= cols) continue;
          for (let r = 0; r < 16; r++) if (n.on(r, i) && !taken.has((newsTop + r) * cols + c)) list.push(at(c, newsTop + r));
        }
        x += n.cols;
      });
    }
    paint([[LED.white, lit.w, false], [LED.yellow, lit.y, false], ['#fff6d6', lit.flare, true]]);
  }

  let raf = 0;
  let timer = 0;
  let done = null;
  const stop = () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  };
  render(0);

  return {
    el: canvas,
    end: END,
    /** Play forwards (1, to light up) or backwards (-1, to go dark and fade); resolves at the end. */
    play(d = 1) {
      stop();
      const goal = d > 0 ? END : 0;
      const from = T;
      const t0 = performance.now();
      return new Promise((resolve) => {
        done = resolve;
        const finish = () => {
          stop();
          T = goal;
          render(T);
          done?.();
          done = null;
        };
        const tick = (now) => {
          T = Math.min(END, Math.max(0, from + (d * (now - t0)) / 1000));
          if (T === goal) return finish();
          render(T);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        timer = setTimeout(finish, Math.abs(goal - from) * 1000 + 250);
      });
    },
    /** Show the board at time t (seconds), stopped there. */
    seek(t) {
      stop();
      T = t;
      render(T);
    },
    remove() {
      stop();
      canvas.remove();
    },
  };
}
