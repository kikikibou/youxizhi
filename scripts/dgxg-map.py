"""
生成《大国小国》背景地图 game/client/map.svg：一块可以无缝平铺的「领土图」。

- 领土：环面上的泰森多边形（每个点复制成 3×3 再切），所以四边接得上。
- 国界：点划线；部分领土加斜线阴影。
- 等高线：几处不规则的同心圈（离边远，不会被切断）。
- 经纬网：等距直线（间距整除边长，接缝处对得上）、坐标小字、城市小方块。

网页里把它当遮罩用（只看不透明度），颜色由 CSS 决定，白天和夜晚各配一种色。
用法：python scripts/dgxg-map.py
"""

import math
import random

SIZE = 900
random.seed(20261125)
OUT = 'game/client/map.svg'


def clip(poly, a, b, c):
    """保留 a*x + b*y <= c 的一侧（Sutherland–Hodgman）。"""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp = a * p[0] + b * p[1] - c
        fq = a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


# 领土的中心点：抖动的网格，大小不一
sites = []
grid = 5
for gy in range(grid):
    for gx in range(grid):
        if random.random() < 0.12:
            continue
        cx = (gx + 0.5 + random.uniform(-0.38, 0.38)) * SIZE / grid
        cy = (gy + 0.5 + random.uniform(-0.38, 0.38)) * SIZE / grid
        sites.append((cx % SIZE, cy % SIZE))
for _ in range(4):
    sites.append((random.uniform(0, SIZE), random.uniform(0, SIZE)))

reps = [(x + dx * SIZE, y + dy * SIZE, i) for i, (x, y) in enumerate(sites) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]

edges = set()
cells = []
for (x, y, i) in reps:
    if not (-SIZE * 0.4 < x < SIZE * 1.4 and -SIZE * 0.4 < y < SIZE * 1.4):
        continue
    poly = [(x - SIZE, y - SIZE), (x + SIZE, y - SIZE), (x + SIZE, y + SIZE), (x - SIZE, y + SIZE)]
    for (ox, oy, _j) in reps:
        if (ox, oy) == (x, y):
            continue
        if abs(ox - x) > SIZE * 0.9 or abs(oy - y) > SIZE * 0.9:
            continue
        # 离 (x,y) 比离 (ox,oy) 近的那一侧
        a, b = ox - x, oy - y
        c = (ox * ox + oy * oy - x * x - y * y) / 2
        poly = clip(poly, a, b, c)
        if not poly:
            break
    if not poly:
        continue
    cells.append((i, poly))
    for k in range(len(poly)):
        p, q = poly[k], poly[(k + 1) % len(poly)]
        key = tuple(sorted([(round(p[0], 1), round(p[1], 1)), (round(q[0], 1), round(q[1], 1))]))
        if key[0] != key[1]:
            edges.add(key)

hatched = set(random.sample(range(len(sites)), k=max(3, len(sites) // 4)))

parts = []
parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" width="{SIZE}" height="{SIZE}">')
parts.append(
    '<defs><pattern id="h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
    '<rect width="1.3" height="7" fill="#000"/></pattern></defs>'
)

# 经纬网
step = SIZE // 6
grat = ' '.join(f'M{x} 0 V{SIZE} M0 {x} H{SIZE}' for x in range(0, SIZE, step))
parts.append(f'<path d="{grat}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1" stroke-dasharray="2 6"/>')

# 阴影领土
for i, poly in cells:
    if i in hatched:
        d = 'M' + ' L'.join(f'{p[0]:.1f} {p[1]:.1f}' for p in poly) + ' Z'
        parts.append(f'<path d="{d}" fill="url(#h)" fill-opacity=".38"/>')

# 等高线：离边远的几处
for _ in range(4):
    cx, cy = random.uniform(160, SIZE - 160), random.uniform(160, SIZE - 160)
    base = random.uniform(26, 40)
    phase = [random.uniform(0, math.tau) for _ in range(3)]
    amp = [random.uniform(0.08, 0.2) for _ in range(3)]
    for ring in range(1, 6):
        r0 = base * ring * 0.62
        pts = []
        for t in range(72):
            a = t / 72 * math.tau
            r = r0 * (1 + sum(amp[k] * math.sin((k + 2) * a + phase[k]) for k in range(3)))
            pts.append((cx + r * math.cos(a), cy + r * 0.82 * math.sin(a)))
        d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'
        parts.append(f'<path d="{d}" fill="none" stroke="#000" stroke-opacity=".42" stroke-width="1"/>')

# 国界：点划线
d = ' '.join(f'M{a[0]} {a[1]} L{b[0]} {b[1]}' for a, b in edges)
parts.append(f'<path d="{d}" fill="none" stroke="#000" stroke-opacity=".85" stroke-width="1.6" stroke-dasharray="9 4 2 4" stroke-linecap="round"/>')

# 城市：小方块（离边远一点），首都加一圈
for i, (x, y) in enumerate(sites):
    x2 = x + random.uniform(-30, 30)
    y2 = y + random.uniform(-30, 30)
    if not (12 < x2 < SIZE - 12 and 12 < y2 < SIZE - 12):
        continue
    parts.append(f'<rect x="{x2 - 3:.1f}" y="{y2 - 3:.1f}" width="6" height="6" fill="#000" fill-opacity=".8"/>')
    if i % 4 == 0:
        parts.append(f'<circle cx="{x2:.1f}" cy="{y2:.1f}" r="9" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="1.2"/>')

# 坐标小字
for gx in range(1, 6):
    for gy in range(1, 6):
        if random.random() < 0.55:
            continue
        x, y = gx * step, gy * step
        lat = 20 + gy * 3
        lon = 100 + gx * 4
        parts.append(
            f'<text x="{x + 5}" y="{y - 5}" font-family="monospace" font-size="10" font-weight="700" fill="#000" fill-opacity=".55">N{lat}° E{lon}°</text>'
        )
        parts.append(f'<path d="M{x - 6} {y} H{x + 6} M{x} {y - 6} V{y + 6}" stroke="#000" stroke-opacity=".7" stroke-width="1.2"/>')

parts.append('</svg>')
open(OUT, 'w', encoding='utf-8').write('\n'.join(parts))
print(f'{OUT}: {len(sites)} territories, {len(edges)} border segments, {sum(len(p) for p in parts) // 1024} KB')
