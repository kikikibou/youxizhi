import { LED } from './leddots.js';

/**
 * The board 大辩题库's way in ends on (ledveil.js, in the town) and its page
 * opens on (src/dbtk/arrive.js): the screen's black over the whole window,
 * its unlit dots, and the page's name lit in yellow dots a little above the
 * middle. Both lay it out here, from the window's size alone, so that the
 * page comes up on the very same dots the town left lit.
 *
 * The name's dots are kept here, not drawn from a font: 大辩题库 in Noto Sans
 * SC 500, 24 rows (textDots in leddots.js, in the town, where that font is
 * loaded), one bit a dot, each row in hex. The page has no such font; this
 * way both light exactly these. On a narrow screen it goes on two lines,
 * 大辩 over 题库: the first 46 columns and the rest.
 */
const NAME = [
  '00000000000000000000000', '00000000000000000000000', '00380000000000000000400', '0038003841c0ff7ff000e00',
  '00380038e0c0fffff000f00', '003800ff77f8e3fff1ffffe', '003800ff77f8ff8701ffffe', '003800ff37f8ffbfe1c1c00',
  '003800660338e3bfe1c1c00', '7ffffc6e03b0ffb061dfffe', '7ffffc7ff3b0ffb761ffffe', '007c007ff3f0003761c7800',
  '007c00ff77fdfff761c7380', '007e00ff77f9fff761cf380', '00fe003870e01c3761cfffc', '00ef003870e0fc3761cfffc',
  '01e700ff77f8ffbe61cfffc', '03c780ff77f8ff8fc1c0380', '03c3c0387ff8fc1de1ffffe', '0781e0387ce0fc78f3ffffe',
  '1f01f03878e1fc7033bfffe', '7e00fc70f0e1ffe7f380380', '7c003ce060e38ffff780380', '3000184000e180fff300380',
];
const NAME_COLS = 92;
const NAME_SPLIT = 46;
export const NAME_ROWS = 24;
const LINE_GAP = 3; // rows between 大辩 and 题库

const bit = (r, i) => (parseInt(NAME[r][i >> 2], 16) >> (3 - (i & 3))) & 1;

/** The name's lines: [{ cols, from }] (from: its first column in NAME). */
const nameLines = (wide) => (wide ? [{ cols: NAME_COLS, from: 0 }] : [{ cols: NAME_SPLIT, from: 0 }, { cols: NAME_COLS - NAME_SPLIT, from: NAME_SPLIT }]);

/**
 * The board for a window W × H css px at k device px each: its grid (cols,
 * rows, pitch, offsets, all in device px, the grid centred) and the name's
 * dots: { c, r } on the grid, { line, i, row } in its own lines, d its
 * distance from the name's middle (the town lights them from the middle out).
 */
export function nameBoard(W, H, k) {
  const wide = W / H > 0.9 && W >= 640;
  const lines = nameLines(wide);
  const nCols = Math.max(...lines.map((l) => l.cols));
  const nRows = lines.length * NAME_ROWS + (lines.length - 1) * LINE_GAP;
  const pitch = Math.max(5, Math.min(wide ? 13 : 11, Math.floor(Math.min((W * 0.74) / nCols, (H * 0.34) / nRows)))) * k;
  const width = Math.round(W * k);
  const height = Math.round(H * k);
  const cols = Math.ceil(width / pitch) + 1;
  const rows = Math.ceil(height / pitch) + 1;
  const ox = (width - cols * pitch) / 2;
  const oy = (height - rows * pitch) / 2;
  const c0 = Math.floor((cols - nCols) / 2);
  const r0 = Math.floor(rows / 2 - nRows / 2 - rows * 0.05); // (a little above the middle: the town's motto goes under it)
  const mid = [c0 + nCols / 2, r0 + nRows / 2];
  const name = [];
  let far = 1;
  lines.forEach((l, line) => {
    const top = r0 + line * (NAME_ROWS + LINE_GAP);
    const left = c0 + Math.floor((nCols - l.cols) / 2);
    for (let row = 0; row < NAME_ROWS; row++) {
      for (let i = 0; i < l.cols; i++) {
        if (!bit(row, l.from + i)) continue;
        const d = Math.hypot(left + i - mid[0], (top + row - mid[1]) * 1.4);
        far = Math.max(far, d);
        name.push({ c: left + i, r: top + row, d, line, i, row });
      }
    }
  });
  const at = (i, r) => [ox + i * pitch + pitch / 2, oy + r * pitch + pitch / 2];
  return { wide, width, height, pitch, cols, rows, ox, oy, R: pitch * 0.36, mid, name, far, lines, at };
}

/** The screen's black and its unlit dots, drawn once into a canvas of their own. */
export function gridCanvas(b) {
  const grid = document.createElement('canvas');
  grid.width = b.width;
  grid.height = b.height;
  const g = grid.getContext('2d');
  g.fillStyle = LED.screen;
  g.fillRect(0, 0, grid.width, grid.height);
  g.fillStyle = LED.off;
  g.beginPath();
  for (let i = 0; i < b.cols; i++) {
    for (let r = 0; r < b.rows; r++) {
      const [x, y] = b.at(i, r);
      g.moveTo(x + b.R, y);
      g.arc(x, y, b.R, 0, Math.PI * 2);
    }
  }
  g.fill();
  return grid;
}

/**
 * Lit dots, in batches of [color, [[x, y], …], big]: a soft halo under each,
 * then its core (big: the flare as a dot lights). R: a dot's radius, or a
 * function of its index in the batch.
 */
export function paintDots(ctx, R, batches) {
  for (const [color, list, big] of batches) {
    if (!list.length) continue;
    ctx.fillStyle = color;
    for (const [grow, alpha] of [[big ? 2 : 1.5, 0.22], [big ? 1.25 : 1, 1]]) {
      ctx.globalAlpha *= alpha;
      ctx.beginPath();
      list.forEach(([x, y], n) => {
        const rad = (typeof R === 'function' ? R(n) : R) * grow;
        ctx.moveTo(x + rad, y);
        ctx.arc(x, y, rad, 0, Math.PI * 2);
      });
      ctx.fill();
      ctx.globalAlpha /= alpha;
    }
  }
}
