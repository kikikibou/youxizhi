/** 座位怎么摆在岛上：大厅和夜晚围着圆桌（一个椭圆），投票和第二阶段摆在海岸线上。座位 0 在最上面，顺时针。 */

export interface Pt {
  x: number;
  y: number;
}

/** 椭圆上第 i / n 个位置（大厅、夜晚：围着岛中间的圆桌）。 */
export function ringPoint(i: number, n: number, cx = 195, cy = 312, rx = 120, ry = 102): Pt & { a: number } {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), a };
}

/** 从 (cx, cy) 朝 deg 方向射出去，和海岸线的最远交点。pts 是海岸线的顶点。 */
export function coastPoint(pts: number[][], cx: number, cy: number, a: number): Pt {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let best = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const ex = x2 - x1;
    const ey = y2 - y1;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((x1 - cx) * ey - (y1 - cy) * ex) / den;
    const s = ((x1 - cx) * dy - (y1 - cy) * dx) / den;
    if (t > 0 && s >= 0 && s <= 1 && t > best) best = t;
  }
  return { x: cx + dx * best, y: cy + dy * best };
}

/** 第 i / n 个座位在海岸线上的位置，以及往外推一点放名字的位置。 */
export function coastSeat(pts: number[][], i: number, n: number, cx: number, cy: number, out = 20): { at: Pt; label: Pt; a: number; anchor: 'start' | 'middle' | 'end' } {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
  const at = coastPoint(pts, cx, cy, a);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const anchor = Math.abs(c) < 0.38 ? 'middle' : c > 0 ? 'start' : 'end';
  const label = { x: at.x + c * (out - 6) + (anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0), y: at.y + s * out + (anchor === 'middle' ? (s < 0 ? -2 : 10) : 4) };
  return { at, label, a, anchor };
}

/** 椭圆上的座位往外放名字的位置和对齐方式。 */
export function ringLabel(p: { x: number; y: number; a: number }, out = 18): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const c = Math.cos(p.a);
  const s = Math.sin(p.a);
  const anchor = Math.abs(c) < 0.38 ? 'middle' : c > 0 ? 'start' : 'end';
  return {
    x: p.x + c * (anchor === 'middle' ? 0 : out - 4),
    y: p.y + s * out + (anchor === 'middle' ? (s < 0 ? -2 : 10) : 4.5),
    anchor,
  };
}

/** 扇形（从圆心出去的一块），给投票分区图用：和海岸线做 clip。 */
export function wedge(cx: number, cy: number, a0: number, a1: number, r = 400): string {
  const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  const mid = (a0 + a1) / 2;
  return `M${cx} ${cy} L${p(a0)} L${p(mid)} L${p(a1)} Z`;
}

/** 圆心附近的一点（扇形中线上，离圆心 k 倍到海岸的距离）。 */
export function along(pts: number[][], cx: number, cy: number, a: number, k: number): Pt {
  const c = coastPoint(pts, cx, cy, a);
  return { x: cx + (c.x - cx) * k, y: cy + (c.y - cy) * k };
}

/**
 * 名字放在座位外侧；靠左右两边放不下（会出图框）时，改放到座位的正上方或正下方。
 * at：座位点；a：座位方向（弧度）；out：离座位多远；w：名字宽度。
 */
export function labelSpot(at: Pt, a: number, out: number, w: number, minX = 22, maxX = 368): { x: number; y: number; anchor: 'start' | 'middle' | 'end'; below: boolean } {
  const c = Math.cos(a);
  const s = Math.sin(a);
  let anchor: 'start' | 'middle' | 'end' = Math.abs(c) < 0.38 ? 'middle' : c > 0 ? 'start' : 'end';
  let x = at.x + c * (anchor === 'middle' ? 0 : out - 4);
  let y = at.y + s * out + (anchor === 'middle' ? (s < 0 ? -2 : 10) : 4.5);
  if ((anchor === 'end' && x - w < minX) || (anchor === 'start' && x + w > maxX)) {
    anchor = 'middle';
    const up = s < 0.2;
    x = Math.min(maxX - w / 2, Math.max(minX + w / 2, at.x));
    y = up ? at.y - 13 : at.y + 22;
  }
  if (anchor === 'middle') x = Math.min(maxX - w / 2, Math.max(minX + w / 2, x));
  return { x, y, anchor, below: y > at.y };
}
