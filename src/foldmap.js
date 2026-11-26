/**
 * 大国小国's way in (board() in app.js, takeoff kind 'fold'): a folded map
 * comes out of the cabin's window, its cover to the front (foldCoverHtml in
 * ui.js). It opens like a road map: the cover flips over and the accordion
 * opens panel by panel, then the cross fold, each panel lit as it faces,
 * until its sea, the grey-green 大国小国 opens on, lies over the whole screen.
 *
 * The sheet is the screen cut into 4 × 2 panels: an accordion of 4 along the
 * screen's long side, folded once across. Nested in CSS 3D: the far half
 * hangs from the near half by their shared edge, folded behind it; in each
 * half each accordion panel hangs from the one before it, folded zigzag in
 * front of the first, the last one's back being the cover. Folded leaves keep
 * a few pixels apart (translateZ) so none passes through another. Driven
 * frame by frame (render), so each panel's shade can follow the way it faces.
 */

const A = 4; // panels in the accordion
const GAP = 2; // px between folded leaves
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const RAD = Math.PI / 180;
// (the light: from the upper left, in front; CSS axes, y down, z to the viewer)
const LIGHT = (() => {
  const v = [-0.45, -0.55, 0.7];
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
})();

// Rotations as CSS applies them (y down, z towards the viewer), in place on v.
const rot = {
  X(v, a) {
    const [c, s] = [Math.cos(a), Math.sin(a)];
    [v[1], v[2]] = [v[1] * c - v[2] * s, v[1] * s + v[2] * c];
  },
  Y(v, a) {
    const [c, s] = [Math.cos(a), Math.sin(a)];
    [v[0], v[2]] = [v[0] * c + v[2] * s, -v[0] * s + v[2] * c];
  },
  Z(v, a) {
    const [c, s] = [Math.cos(a), Math.sin(a)];
    [v[0], v[1]] = [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
  },
};

/**
 * Build the folded map in `host` (at the start: the packet in the cabin's
 * window). `cover`: the cover's markup; `source()`: where the cabin's window
 * is on the screen now ({ x, y }, CSS pixels), followed while the map comes
 * out of it (and goes back in, playing backwards).
 */
export function foldMap(host, { cover, source }) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tall = H > W; // (the accordion runs down an upright screen, across a wide one)
  const [C, R] = tall ? [2, A] : [A, 2];
  const w = W / C;
  const h = H / R;
  const P = Math.max(W, H) * 1.4; // (the perspective's distance)
  // The accordion's folds turn about the axis across it, the cross fold's
  // about the other; which way each turns to fold to the front or behind.
  const inner = tall ? 'X' : 'Y';
  const outer = tall ? 'Y' : 'X';
  const FRONT = tall ? 1 : -1; // (sign of a turn that folds the panel to the front)

  // The timeline, in seconds: out of the window, then the accordion's folds
  // one after another (the first carries the rest over with it, the cover
  // first), then the cross fold.
  const EMERGE = [0, 0.65];
  const SETTLE = [0.5, 0.95];
  const DUR = 0.42;
  const innerAt = (k) => 0.6 + (k - 1) * 0.22; // k = 1 … A-1
  const OUTER = innerAt(A - 1) + DUR - 0.14;
  const END = OUTER + DUR + 0.06;

  const box = document.createElement('div');
  box.className = `fold${tall ? ' is-tall' : ''}`;
  box.setAttribute('aria-hidden', 'true');
  box.style.perspective = `${P}px`;
  box.style.setProperty('--w', `${w}px`);
  box.style.setProperty('--h', `${h}px`);
  box.style.setProperty('--u', `${Math.min(w, h) / 100}px`);
  const panels = [];
  let base = null;
  for (let o = 0; o < 2; o++) {
    let parent = null;
    for (let k = 0; k < A; k++) {
      const [c, r] = tall ? [o, k] : [k, o];
      const el = document.createElement('div');
      // (.fold-col: hung by its left edge; .fold-row: by its top edge)
      const along = (axis) => (axis === 'Y' ? 'fold-col' : 'fold-row');
      el.className = `fold-panel ${k ? along(inner) : o ? along(outer) : 'fold-root'}`;
      // (the sea's grid runs on across the panels, as over the screen in the end)
      const isCover = o === 0 && k === A - 1;
      // (+0.5: the face reaches half a pixel over each seam, see .fold-face)
      el.innerHTML = `<div class="fold-face is-front" style="background-position:${(0.5 - c * w).toFixed(2)}px ${(0.5 - r * h).toFixed(2)}px"><i class="fold-shade"></i></div><div class="fold-face is-back">${isCover ? cover : ''}<i class="fold-shade"></i></div>`;
      if (k) parent.appendChild(el);
      else (o ? base : box).appendChild(el);
      if (!k && !o) base = el;
      parent = el;
      panels.push({ el, o, k, shades: [...el.querySelectorAll(':scope > .fold-face > .fold-shade')] });
    }
  }
  const root = panels[0].el;
  host.prepend(box);

  /** The map at time T (seconds into the timeline). */
  function render(T) {
    const p = easeOut(clamp01((T - EMERGE[0]) / (EMERGE[1] - EMERGE[0])));
    const q = easeInOut(clamp01((T - SETTLE[0]) / (SETTLE[1] - SETTLE[0])));
    const ie = [0];
    for (let k = 1; k < A; k++) ie[k] = easeInOut(clamp01((T - innerAt(k)) / DUR));
    const oe = easeInOut(clamp01((T - OUTER) / DUR));
    const ip = ie.reduce((a, b) => a + b, 0) / (A - 1);
    // the folds' turns, in degrees: the accordion zigzag to the front, the
    // cross fold behind
    const ia = ie.map((e, k) => (k % 2 ? FRONT : -FRONT) * 180 * (1 - e));
    const oa = FRONT * 180 * (1 - oe); // (about the other axis, the same sign folds behind)

    // The packet's centre: out of the depth from the cabin's window to the
    // screen's middle; then, as it opens, the first panel goes to the top
    // left corner, so the opened part stays about the middle.
    const s = source() || { x: W / 2, y: H / 2 };
    const Z = -P * 2.6 * (1 - p);
    const kz = (P - Z) / P; // (at depth Z a point shows 1 / kz as far from the middle)
    const [px, py] = tall ? [oe, ip] : [ip, oe];
    const cx = W / 2 + (s.x - W / 2) * (1 - p) * kz - (W / 2 - w / 2) * px;
    const cy = H / 2 + (s.y - H / 2) * (1 - p) * kz - (H / 2 - h / 2) * py;
    const rx = 46 * (1 - p) + 6 * (1 - q);
    const rz = -14 * (1 - p) - 3 * (1 - q);
    root.style.transform = `translate3d(${(cx - w / 2).toFixed(2)}px, ${(cy - h / 2).toFixed(2)}px, ${Z.toFixed(1)}px) rotateZ(${rz.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)`;

    let sum = 0;
    for (const pn of panels) {
      if (pn.k) {
        // (folded leaves a hair apart, each in front of the last)
        const lift = (pn.k % 2 ? -1 : 1) * GAP * (1 - ie[pn.k]);
        pn.el.style.transform = `rotate${inner}(${ia[pn.k].toFixed(2)}deg) translateZ(${lift.toFixed(2)}px)`;
        sum += ia[pn.k];
      } else {
        sum = 0;
        if (pn.o) pn.el.style.transform = `rotate${outer}(${oa.toFixed(2)}deg) translateZ(${(GAP * (1 - oe)).toFixed(2)}px)`;
      }
      // which way it faces, so how much light it gets (flat: none to add)
      const n = [0, 0, 1];
      rot[inner](n, sum * RAD);
      if (pn.o) rot[outer](n, oa * RAD);
      rot.X(n, rx * RAD);
      rot.Z(n, rz * RAD);
      const lit = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / LIGHT[2];
      pn.shades.forEach((sh, f) => {
        const b = f ? -lit : lit; // (the back faces the other way)
        sh.style.background = b < 1 ? `rgba(30, 27, 23, ${Math.min(0.55, (1 - b) * 0.42).toFixed(3)})` : `rgba(255, 255, 255, ${Math.min(0.25, (b - 1) * 0.5).toFixed(3)})`;
      });
    }
  }

  // Played by the clock, not by frames: a slow machine sees fewer of them,
  // not a slower map; and a timer finishes it even where no frames come (a
  // tab in the background), so the way on is never held up.
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
    el: box,
    end: END,
    /** Play forwards (1, to open) or backwards (-1, back into the window); resolves at the end. */
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
    /** Show the map at time t (seconds), stopped there. */
    seek(t) {
      stop();
      T = t;
      render(T);
    },
    remove() {
      stop();
      box.remove();
    },
  };
}
