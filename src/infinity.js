/**
 * The home ticket's "00" drawn as an infinity sign. It is built from Anton's
 * zero (font units, 2048 to the em): the outer half of each zero is kept as it
 * is, and the inner halves give way to two strokes that cross. The one from top
 * left to bottom right passes over the other, which has a gap cut round it.
 * The SVG takes the place of the text: 1em tall, two zeros wide, with the same
 * baseline at line-height 1, so the stub's spacing doesn't change.
 */
const ADV = 1012; // the zero's advance width
const CX = 506; // its centre line
const BASE = 1891.5; // baseline from the top of a line-height: 1 box (half-leading + ascent)
const TOP = 1614; // centre of the zero's top arc (324 thick) where it crosses CX
const BOTTOM = 146; // and of its bottom arc
const ARC = 324; // stroke at the ends (as thick as the arcs)
const SIDE = 380; // where the stroke runs steep (as thick as the zero's sides)
const HANDLE = 680; // how far each stroke runs level before it turns
const GAP = 125; // the gap round the stroke on top

const num = (v) => Math.round(v * 10) / 10;
const pt = (x, y) => `${num(x)},${num(BASE - y)}`;

/** The zero's outer half (TrueType quadratics, implied on-curve points written out); mirrored for the right one. */
function half(mirror) {
  const segs = [
    ['M', 506, -16], ['Q', 283, -16, 161.5, 109], ['Q', 40, 234, 40, 469], ['L', 40, 1263],
    ['Q', 40, 1511, 155.5, 1643.5], ['Q', 271, 1776, 506, 1776], ['L', 506, 1452],
    ['Q', 446, 1452, 432.5, 1405.5], ['Q', 419, 1359, 419, 1297], ['L', 419, 428],
    ['Q', 419, 382, 442.5, 345], ['Q', 466, 308, 506, 308],
  ];
  return (
    segs
      .map(([op, ...v]) => {
        const xy = [];
        for (let i = 0; i < v.length; i += 2) xy.push(pt(mirror ? 2 * ADV - v[i] : v[i], v[i + 1]));
        return op + xy.join(' ');
      })
      .join('') + 'Z'
  );
}

/**
 * A stroke from (CX, y0) to (ADV + CX, y1), level at both ends where it meets
 * the halves (and running a little way into them, so no seam shows), thicker
 * where it runs steep. extra widens it on both sides (for the gap).
 */
function stroke(y0, y1, extra = 0, n = 36) {
  const p = [[CX, y0], [CX + HANDLE, y0], [ADV + CX - HANDLE, y1], [ADV + CX, y1]];
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const d = [-3 * u * u, 3 * u * u - 6 * u * t, 6 * u * t - 3 * t * t, 3 * t * t];
    const x = b.reduce((s, k, j) => s + k * p[j][0], 0);
    const y = b.reduce((s, k, j) => s + k * p[j][1], 0);
    const dx = d.reduce((s, k, j) => s + k * p[j][0], 0);
    const dy = d.reduce((s, k, j) => s + k * p[j][1], 0);
    const len = Math.hypot(dx, dy);
    const h = (ARC + (SIDE - ARC) * Math.abs(dy / len)) / 2 + extra;
    left.push([x - (dy / len) * h, y + (dx / len) * h]);
    right.push([x + (dy / len) * h, y - (dx / len) * h]);
  }
  const run = 24;
  const [l0, ln, r0, rn] = [left[0], left[n], right[0], right[n]];
  const poly = [
    [l0[0] - run, l0[1]], ...left, [ln[0] + run, ln[1]],
    [rn[0] + run, rn[1]], ...right.reverse(), [r0[0] - run, r0[1]],
  ];
  return 'M' + poly.map(([x, y]) => pt(x, y)).join(' ') + 'Z';
}

let markup = null;
/** The SVG (built once; its mask id must stay unique, so use it in one place). */
export function infinity00() {
  if (!markup) {
    const w = 2 * ADV;
    markup =
      `<svg class="stub-inf" viewBox="0 0 ${w} 2048" role="img" aria-label="00">` +
      `<defs><mask id="stub-inf-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="2048">` +
      `<rect width="${w}" height="2048" fill="#fff"/><path d="${stroke(TOP, BOTTOM, GAP)}" fill="#000"/></mask></defs>` +
      `<g fill="currentColor"><path d="${half(false)}"/><path d="${half(true)}"/>` +
      `<path d="${stroke(BOTTOM, TOP)}" mask="url(#stub-inf-gap)"/><path d="${stroke(TOP, BOTTOM)}"/></g></svg>`;
  }
  return markup;
}
