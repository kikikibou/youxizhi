/** 第二阶段和结算共用的图：圆桌岛分成大国（黄）、小国（绿）两块，一条斜的国界；名牌、钉住的提问、界碑、海岸上的座位。 */

import type { ComponentChildren } from 'preact';
import { P2 } from './art.ts';
import { BIG, INK, MUTED, SMALL } from './board.tsx';
import { coastSeat, labelSpot } from './seats.ts';

export const WL = '#5f8f93';
export const SEA = '#d8e3df';
export const HALO = `paint-order: stroke; stroke: ${SEA}; stroke-width: 4px; stroke-linejoin: round`;
export const [[BX0, BY0], [BX1, BY1]] = P2.border as [[number, number], [number, number]];
export const MIDX = (BX0 + BX1) / 2;
export const MIDY = (BY0 + BY1) / 2;

/** 海图底：围着岛的水线 + 北箭头。 */
export function AtlasSheet() {
  return (
    <g>
      <defs>
        <pattern id="q-hb" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 V7" stroke="#d9b54a" stroke-width="0.7" />
        </pattern>
        <pattern id="q-hs" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <path d="M0 0 V7" stroke="#87b46c" stroke-width="0.7" />
        </pattern>
        <clipPath id="c6-b">
          <path d={P2.big} />
        </clipPath>
        <clipPath id="c6-s">
          <path d={P2.small} />
        </clipPath>
      </defs>
      <g fill="none" stroke={WL} stroke-width="0.7">
        {P2.waterlines.map((w) => (
          <path d={w.d} opacity={w.op} />
        ))}
      </g>
      <g transform="translate(34 160)">
        <circle r="13" fill="none" stroke={INK} stroke-width="0.6" />
        <path d="M0 -11 L4 4 L0 1.5 Z" fill={INK} />
        <path d="M0 -11 L-4 4 L0 1.5 Z" fill="none" stroke={INK} stroke-width="0.8" stroke-linejoin="round" />
        <text y="-16" text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 10px; fill: #1e1b17">
          N
        </text>
      </g>
    </g>
  );
}

/** 两块国土。ribbon：结算时的历史疆域图画法（国界内侧一圈深色带）；否则是细斜线。 */
export function Territories({ ribbon }: { ribbon?: boolean }) {
  return (
    <g>
      <path d={P2.big} fill={BIG} />
      <path d={P2.small} fill={SMALL} />
      {ribbon ? (
        <>
          <path d={P2.big} fill="none" stroke="#c99a2e" stroke-width="12" opacity="0.5" clip-path="url(#c6-b)" />
          <path d={P2.small} fill="none" stroke="#6f9e58" stroke-width="12" opacity="0.5" clip-path="url(#c6-s)" />
        </>
      ) : (
        <>
          <path d={P2.big} fill="url(#q-hb)" opacity="0.55" />
          <path d={P2.small} fill="url(#q-hs)" opacity="0.55" />
        </>
      )}
      <path d={P2.coastIn} fill="none" stroke={INK} stroke-width="0.5" opacity="0.3" />
    </g>
  );
}

/** 国界：未定（虚线）或已定（点划线）。 */
export function Border({ settled }: { settled?: boolean }) {
  return settled ? (
    <g>
      <path d={`M${BX0} ${BY0} L${BX1} ${BY1}`} stroke="#fbf6e8" stroke-width="8" stroke-linecap="round" />
      <path d={`M${BX0} ${BY0} L${BX1} ${BY1}`} stroke={INK} stroke-width="2.2" stroke-dasharray="14 3 2.5 3" />
    </g>
  ) : (
    <g>
      <path d={`M${BX0} ${BY0} L${BX1} ${BY1}`} stroke="#fbf6e8" stroke-width="7" stroke-linecap="round" />
      <path d={`M${BX0} ${BY0} L${BX1} ${BY1}`} stroke={INK} stroke-width="1.5" stroke-dasharray="9 3 1.6 3" />
    </g>
  );
}

export function Coast() {
  return <path d={P2.coast} fill="none" stroke={INK} stroke-width="1.5" stroke-linejoin="round" />;
}

/** 一国的名牌：没公开时是虚线上的「?」，公开了就写词；mark 时外面一圈强调色虚线框。 */
export function Plate({ x, y, cap, word, mark, size = 25 }: { x: number; y: number; cap: string; word?: string | null; mark?: boolean; size?: number }) {
  const fs = word ? Math.min(size, Math.floor(130 / Math.max(1, Array.from(word).length))) : size;
  return (
    <g>
      <text x={x} y={word ? y + 12 - fs - 4 : y - 12} text-anchor="middle" style="font-family: var(--serif); font-weight: 700; font-size: 10.5px; letter-spacing: 0.3em; fill: #3b362f">
        {cap}
      </text>
      {word ? (
        <text x={x} y={y + 12} text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: ${fs}px; letter-spacing: 0.16em; fill: #1e1b17; paint-order: stroke; stroke: #fbf3dc; stroke-width: 5px; stroke-linejoin: round`}>
          {word}
        </text>
      ) : (
        <>
          <path d={`M${x - 26} ${y + 15} H${x + 26}`} stroke={INK} stroke-width="1" stroke-dasharray="1.5 2.5" />
          <text x={x} y={y + 11} text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 21px; fill: #1e1b17; opacity: 0.55">
            ?
          </text>
        </>
      )}
      {mark ? <rect x={x - 44} y={y - 28} width="88" height="50" fill="none" stroke="var(--acc)" stroke-width="1.5" stroke-dasharray="4 3" /> : null}
    </g>
  );
}

/** 公开的提问，像一张纸条钉在被问的那块地上。 */
export function QPin({ x, y, who, q, ans, rot = -2 }: { x: number; y: number; who: string; q: string; ans: string; rot?: number }) {
  const qs = Array.from(q).length > 11 ? Array.from(q).slice(0, 10).join('') + '…' : q;
  const w = Math.max(96, Math.min(150, Array.from(qs).length * 11.5 + 22 + Array.from(ans).length * 11));
  const aw = Array.from(ans).length * 11 + 6;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="3" y="3" width={w} height="36" fill={INK} opacity="0.13" />
      <rect width={w} height="36" fill="#fffaf0" stroke={INK} stroke-width="0.8" />
      <text x="8" y="13" style={`font-size: 8.5px; fill: ${MUTED}`}>
        {who}问
      </text>
      <text x="8" y="28" style="font-family: var(--serif); font-weight: 700; font-size: 11.5px; fill: #1e1b17">
        {qs}
      </text>
      <rect x={w - aw - 7} y="9" width={aw} height="19" fill={INK} />
      <text x={w - 7 - aw / 2} y="23" text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 11px; fill: #ffffff">
        {ans}
      </text>
      <circle cx={w / 2} cy="0" r="3.4" fill="#6f6252" stroke={INK} stroke-width="0.6" />
    </g>
  );
}

/** 钉提问纸条的位置（每国最近两条），避开名牌、国界和界碑。 */
export const PINS: Record<'big' | 'small', [number, number, number][]> = {
  big: [
    [64, 294, -2.5],
    [84, 344, 2],
  ],
  small: [
    [232, 350, 2],
    [222, 392, -2],
  ],
};

/** 国界上的一块界碑（提示）：done 已立、new 刚立（强调色闪）、todo 还没立。 */
export function Stone({ x, y, n, state }: { x: number; y: number; n: number; state: 'done' | 'new' | 'todo' }) {
  const shape = 'M-7 7 V-4 Q-7 -9 0 -9 Q7 -9 7 -4 V7 Z';
  if (state === 'todo') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <path d={shape} fill="#fbf6e8" stroke={INK} stroke-width="0.9" stroke-dasharray="2 1.6" />
        <text y="4" text-anchor="middle" style={`font-family: var(--cond); font-weight: 500; font-size: 10px; fill: ${MUTED}`}>
          {n}
        </text>
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      {state === 'new' ? (
        <>
          <circle r="11" fill="none" stroke="var(--acc)" stroke-width="1.6" class="b-pulse" />
          <circle r="12.5" fill="none" stroke="var(--acc)" stroke-width="1.6" />
        </>
      ) : null}
      <path d={shape} fill={INK} />
      <path d="M-7 7 H7" stroke={INK} stroke-width="2.4" />
      <text y="4" text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 10.5px; fill: #ffffff">
        {n}
      </text>
    </g>
  );
}

/** 第 k 块界碑的位置：沿国界从上往下；多于 5 块时往两头挤。 */
export function markerAt(k: number, total: number) {
  const m = P2.markers as number[][];
  if (total <= m.length && k < m.length) return { x: m[k][0], y: m[k][1] };
  const f = 0.1 + (0.8 * k) / Math.max(1, total - 1);
  return { x: BX0 + (BX1 - BX0) * f, y: BY0 + (BY1 - BY0) * f };
}

/** 海岸上的座位：位置、名字的位置和说明文字的位置。w：名字（连同序号、「你」）大约多宽，靠边放不下时改放到点的上方或下方。 */
export function seatPlace(seat: number, n: number, w = 44) {
  const s = coastSeat(P2.pts, seat, n, 195, 300, 18);
  const l = labelSpot(s.at, s.a, 18, w, 20, 370);
  const top = l.anchor === 'middle' && !l.below;
  return { at: s.at, label: { x: l.x, y: l.y }, anchor: l.anchor, capY: top ? l.y - 15 : l.y + 13 };
}

/**
 * 一圈座位一起排：每个座位的名字（和下面 / 上面的一行说明）先各放各的，
 * 互相压住的再上下推开一点。nameW / capW：名字、说明大约多宽；cap：有没有说明。
 */
export function placeSeats(list: { seat: number; nameW: number; capW: number; cap: boolean }[], n: number) {
  const spots = list.map((it) => {
    const s = seatPlace(it.seat, n, Math.max(it.nameW, it.cap ? it.capW : 0));
    return { ...s, label: { ...s.label } };
  });
  const box = (k: number) => {
    const s = spots[k];
    const it = list[k];
    const w = Math.max(it.nameW, it.cap ? it.capW : 0);
    const x0 = s.anchor === 'start' ? s.label.x : s.anchor === 'end' ? s.label.x - w : s.label.x - w / 2;
    const y0 = Math.min(s.label.y - 13, it.cap ? s.capY - 10 : Infinity);
    const y1 = Math.max(s.label.y + 3, it.cap ? s.capY + 3 : -Infinity);
    return { x0, x1: x0 + w, y0, y1 };
  };
  const shift = (k: number, d: number) => {
    spots[k].label.y += d;
    spots[k].capY += d;
  };
  for (let round = 0; round < 8; round++) {
    let moved = false;
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const a = box(i);
        const b = box(j);
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
          const d = a.y0 <= b.y0 ? a.y1 - b.y0 + 2 : -(b.y1 - a.y0 + 2);
          shift(j, d / 2);
          shift(i, -d / 2);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return spots;
}

export function SeatLabel({
  x,
  y,
  anchor,
  name,
  me,
  dim,
  num,
  numHot,
}: {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  name: string;
  me?: boolean;
  dim?: boolean;
  num?: number;
  numHot?: boolean;
}) {
  return (
    <text x={x} y={y} text-anchor={anchor} style={`font-family: var(--serif); font-weight: 700; font-size: 14px; fill: ${dim ? '#8b8273' : INK}; ${HALO}`}>
      {num ? <tspan style={`font-family: var(--cond); font-weight: 500; font-size: 12px; fill: ${numHot ? 'var(--acc-text)' : MUTED}`}>{num} </tspan> : null}
      {name}
      {me ? (
        <tspan dx="3" style="font-family: var(--sans); font-weight: 700; font-size: 10px; fill: var(--acc-text)">
          你
        </tspan>
      ) : null}
    </text>
  );
}

export function Caption({ x, y, anchor, children, hot }: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; children: ComponentChildren; hot?: boolean }) {
  return (
    <text x={x} y={y} text-anchor={anchor} style={`font-size: 10px; font-weight: ${hot ? 700 : 400}; fill: ${hot ? 'var(--acc-text)' : MUTED}; ${HALO}`}>
      {children}
    </text>
  );
}

export function MeRing({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="10" fill="none" stroke="var(--acc)" stroke-width="1.8" />
      <circle cx={x} cy={y} r="14" fill="none" stroke="var(--acc)" stroke-width="0.8" />
    </g>
  );
}

export function Dot({ x, y, out }: { x: number; y: number; out?: boolean }) {
  return out ? (
    <g>
      <circle cx={x} cy={y} r="5.5" fill="#fbf8f0" stroke="#8b8273" stroke-width="1.1" />
      <path d={`M${x - 4} ${y + 4} L${x + 4} ${y - 4}`} stroke="#8b8273" stroke-width="1.1" />
    </g>
  ) : (
    <circle cx={x} cy={y} r="5.5" fill={INK} stroke="#fbf8f0" stroke-width="1.2" />
  );
}

/** 按阵营上色的座位（结算、主持人）。 */
export function FactionDot({ x, y, f, out }: { x: number; y: number; f: 'big' | 'small' | 'blank'; out?: boolean }) {
  const fill = f === 'big' ? BIG : f === 'small' ? SMALL : '#ffffff';
  return (
    <g>
      <circle cx={x} cy={y} r="6" fill={fill} stroke={INK} stroke-width="1.3" stroke-dasharray={f === 'blank' ? '2.4 1.6' : undefined} />
      {out ? <path d={`M${x - 4.5} ${y + 4.5} L${x + 4.5} ${y - 4.5}`} stroke={INK} stroke-width="1.1" /> : null}
    </g>
  );
}
