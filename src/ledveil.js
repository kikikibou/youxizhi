import { LED, textDots } from './leddots.js';
import { gridCanvas, nameBoard, paintDots } from './ledboard.js';

/**
 * 大辩题库's way in (board() in app.js, takeoff kind 'led'): the camera has
 * dived into the street bin's opening, and the black inside turns into a
 * quote board. Its dots come up dim over the whole screen, a flash of news
 * runs across it (快讯 大辩题库开盘), and as it passes, the page's name lights
 * up in yellow dots from the middle outwards, each dot flaring white first.
 * The board then stays lit under the motto (CSS, .takeoff[data-kind='led']);
 * the motto goes, and the page opens on this same board (src/dbtk/arrive.js)
 * and unfolds from it.
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

  // The board: its grid and the name's dots, the same the page then opens on
  // (ledboard.js); each dot lights at a time by its distance from the middle.
  const b = nameBoard(W, H, k);
  const { cols, R, at } = b;
  const name = b.name.map((n) => ({ ...n, at: NAME[0] + (NAME[1] - NAME[0] - FLARE) * (n.d / b.far) ** 0.8 }));

  // The news: 16 rows high, through the middle of the name's band.
  const news = [textDots('快讯 ', 16, 400), textDots('大辩题库开盘   快讯 ', 16, 400), textDots('大辩题库开盘', 16, 400)];
  const newsColors = [LED.yellow, LED.white, LED.white];
  const newsCols = news.reduce((a, n) => a + n.cols, 0);
  const newsTop = Math.round(b.mid[1] - 8);

  const grid = gridCanvas(b); // (the unlit dots, drawn once)
  const paint = (batches) => paintDots(ctx, R, batches);

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
