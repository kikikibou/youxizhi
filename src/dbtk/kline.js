/**
 * 主窗口里的 K 线（SVG 字符串）。
 *
 * 每天一根：开盘 = 当天零点的累计票数，收盘 = 当天结束（今天就是现在）的累计票数。
 * 票数只涨不跌，所以全是黄色阳线，烛身高度就是当天新增的票数。
 * 下面的柱子是当天看正（红）、看反（绿）的设备数。
 * 一共 14 个位置，靠右排：新股只有右边几根，像刚上市的股票。
 */
const SLOTS = 14;
const W = 340;
const H = 80; // 蜡烛区
const GAP = 6;
const VH = 24; // 站队柱
const AXIS = 30; // 右边的刻度

/** hist：{ days: [{ day, gain, pro, con }] }（可以是 null，只画网格）；votes：现在的累计票数。 */
export function klineSvg(hist, votes) {
  const cw = W - AXIS;
  const step = cw / SLOTS;
  const bw = Math.max(4, step * 0.6);
  const days = (hist?.days ?? []).slice(-SLOTS);

  // 从现在的累计票数往回推每天的开盘和收盘
  const bars = [];
  let close = votes;
  for (let i = days.length - 1; i >= 0; i--) {
    const open = Math.max(0, close - days[i].gain);
    bars.unshift({ ...days[i], open, close });
    close = open;
  }

  let lo = bars.length ? bars[0].open : Math.max(0, votes - 10);
  let hi = Math.max(votes, lo + 1);
  if (hi - lo < 12) {
    const pad = (12 - (hi - lo)) / 2;
    lo = Math.max(0, lo - pad);
    hi = lo + 12;
  }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.08);
  hi += span * 0.14;
  const y = (v) => H - ((v - lo) / (hi - lo)) * H;
  const f = (n) => n.toFixed(1);

  const out = [];
  for (let i = 0; i <= 3; i++) {
    const gy = Math.round((H / 3) * i) + 0.5;
    out.push(`<line class="k-grid" x1="0" x2="${cw}" y1="${gy}" y2="${gy}"/>`);
    out.push(`<text class="k-axis" x="${W - 2}" y="${Math.min(H - 2, Math.max(9, gy + 4))}">${Math.round(hi - ((hi - lo) / 3) * i)}</text>`);
  }
  const base = H + GAP + VH;
  out.push(`<line class="k-grid is-solid" x1="0" x2="${cw}" y1="${base + 0.5}" y2="${base + 0.5}"/>`);

  const vmax = Math.max(1, ...bars.map((b) => b.pro + b.con));
  const first = SLOTS - bars.length;
  bars.forEach((b, i) => {
    const x = step * (first + i) + (step - bw) / 2;
    const top = y(b.close);
    const bot = y(b.open);
    out.push(`<rect class="k-up" x="${f(x)}" y="${f(top)}" width="${f(bw)}" height="${f(Math.max(1.5, bot - top))}"/>`);
    const ph = (b.pro / vmax) * VH;
    const ch = (b.con / vmax) * VH;
    if (ph) out.push(`<rect class="k-pro" x="${f(x)}" y="${f(base - ph)}" width="${f(bw)}" height="${f(ph)}"/>`);
    if (ch) out.push(`<rect class="k-con" x="${f(x)}" y="${f(base - ph - ch)}" width="${f(bw)}" height="${f(ch)}"/>`);
  });
  const last = bars.at(-1);
  if (last?.gain) {
    const x = step * (SLOTS - 1) + (step - bw) / 2 - 3;
    out.push(`<text class="k-last" x="${f(x)}" y="${f(Math.max(10, y(last.close) - 4))}">+${last.gain}</text>`);
  }
  return `<svg viewBox="0 0 ${W} ${base + 1}" aria-hidden="true">${out.join('')}</svg>`;
}
