/**
 * 大辩题库's LED dots, for its pieces in the town (its pass's stub in ui.js,
 * its takeoff in ledveil.js): text drawn small in a canvas and thresholded
 * into dots, one per pixel, as on a quote board's dot matrix. The colours
 * are the page's own (src/dbtk/DESIGN.md).
 */
export const LED = { screen: '#070807', off: '#1b1f1c', yellow: '#ffcc33', white: '#f1eedf', red: '#ff3b30', green: '#33d17a' };

const SANS = '"Noto Sans SC Variable", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif';

/**
 * `text` as dots `rows` high: { cols, rows, on(r, i) }. (A Chinese character
 * is about `rows` columns wide. Thin strokes read best in so few dots, as on
 * a real board: 400 at 16 rows, 500 at 24.)
 */
export function textDots(text, rows = 16, weight = 400) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const font = `${weight} ${Math.round(rows * 0.95)}px ${SANS}`;
  ctx.font = font;
  c.width = Math.max(1, Math.ceil(ctx.measureText(text).width));
  c.height = rows;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 0, rows / 2 + rows * 0.05);
  const d = ctx.getImageData(0, 0, c.width, rows).data;
  const cols = c.width;
  const lit = new Uint8Array(cols * rows);
  for (let k = 0; k < lit.length; k++) lit[k] = d[k * 4 + 3] > 110 ? 1 : 0;
  return { cols, rows, on: (r, i) => r >= 0 && r < rows && i >= 0 && i < cols && lit[r * cols + i] === 1 };
}

/**
 * Lines of text as one block of dots, each line centred, `gap` rows between:
 * a PNG data URL drawn `pitch` px per dot, lit dots in `color` over unlit ones.
 */
export function dotsImage(lines, { rows = 22, gap = 2, pitch = 6, color = LED.yellow, pad = 1, weight = 500 } = {}) {
  const blocks = lines.map((t) => textDots(t, rows, weight));
  const cols = Math.max(...blocks.map((b) => b.cols)) + pad * 2;
  const total = blocks.length * rows + (blocks.length - 1) * gap + pad * 2;
  const c = document.createElement('canvas');
  c.width = cols * pitch;
  c.height = total * pitch;
  const ctx = c.getContext('2d');
  const r = pitch * 0.38;
  const dot = (x, y, rad) => {
    ctx.moveTo(x + rad, y);
    ctx.arc(x, y, rad, 0, Math.PI * 2);
  };
  const isOn = (row, i) => {
    let y = row - pad;
    for (const b of blocks) {
      if (y >= 0 && y < rows) return b.on(y, i - pad - Math.floor((cols - pad * 2 - b.cols) / 2));
      y -= rows + gap;
    }
    return false;
  };
  for (const [fill, lit] of [[LED.off, false], [color, true]]) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let row = 0; row < total; row++) for (let i = 0; i < cols; i++) if (isOn(row, i) === lit) dot(i * pitch + pitch / 2, row * pitch + pitch / 2, r);
    ctx.fill();
  }
  return { url: c.toDataURL('image/png'), cols, rows: total };
}
