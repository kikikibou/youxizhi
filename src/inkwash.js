/**
 * 解码与三国知识问答's way in (board() in app.js, takeoff kind 'ink'): from
 * the door the camera goes in at, its map paper spreads over the screen like
 * water and ink on xuan paper, a blot with a ragged edge and a darker tide
 * line along it, until the screen is the paper its page opens on (#ece2c8);
 * then its seal is stamped there (CSS, .takeoff[data-kind='ink']).
 *
 * Drawn on a canvas frame by frame, played by the clock (a slow machine sees
 * fewer frames, not a slower blot; a timer finishes it where no frames come),
 * forwards to cover the screen, backwards to draw back into the door.
 */

const PAPER = '#ece2c8';
const INK = '43, 38, 34';
const END = 1.15; // seconds

// An uneven outline: the blot's radius at angle a, as a factor round 1.
function outline(seed) {
  let x = seed;
  const rand = () => ((x = (x * 16807) % 2147483647) / 2147483647);
  const waves = (from, to, amp) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ k: from + i, a: (amp * (0.5 + rand())) / Math.sqrt(from + i), p: rand() * Math.PI * 2 }));
  const big = waves(2, 7, 0.14);
  const fine = waves(9, 26, 0.06);
  return (a, grow) => {
    let r = 1;
    for (const w of big) r += w.a * Math.sin(w.k * a + w.p + grow * 0.6);
    for (const w of fine) r += w.a * Math.sin(w.k * a + w.p);
    return r;
  };
}

/**
 * Build the blot in `host`. `source()`: where the door is on the screen now
 * ({ x, y }, CSS pixels), followed as the camera moves.
 */
export function inkWash(host, { source }) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const k = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75; // (soft edges need no more)
  const canvas = document.createElement('canvas');
  canvas.className = 'ink';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  const ctx = canvas.getContext('2d');
  const shape = outline(20261127);
  const tide = outline(907);
  host.prepend(canvas);

  const path = (cx, cy, R, f, grow) => {
    ctx.beginPath();
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = R * f(a, grow);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };

  /** The blot at time T (seconds into its spreading). */
  function render(T) {
    const t = Math.min(1, Math.max(0, T / END));
    const s = source() || { x: W / 2, y: H / 2 };
    const [cx, cy] = [s.x * k, s.y * k];
    // (far enough that even its deepest bays are past every corner)
    const far = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x * k - cx, y * k - cy))) * 1.6;
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const R = far * e;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (R <= 0.5) return;
    if (t >= 1) {
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    // the paper
    ctx.fillStyle = PAPER;
    path(cx, cy, R, shape, t);
    ctx.fill();
    // a paler bloom a little inside the edge, and the darker tide line on it
    ctx.lineJoin = 'round';
    path(cx, cy, R * 0.9, tide, t);
    ctx.strokeStyle = `rgba(${INK}, 0.05)`;
    ctx.lineWidth = 10 * k;
    ctx.stroke();
    path(cx, cy, R, shape, t);
    for (const [w, a] of [[22, 0.04], [11, 0.07], [4.5, 0.16], [1.6, 0.32]]) {
      ctx.strokeStyle = `rgba(${INK}, ${a})`;
      ctx.lineWidth = w * k;
      ctx.stroke();
    }
  }

  let T = 0;
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
    /** Play forwards (1, to cover the screen) or backwards (-1, back into the door); resolves at the end. */
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
    /** Show the blot at time t (seconds), stopped there. */
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
