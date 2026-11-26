/**
 * 结算：圆桌岛变成一张历史疆域图。两国写上了词，国界已定；「两国共用的那段国界，就是两个词之间的联系」，
 * 所以联系竖着写在国界上。揭晓前国界上贴着一条胶带，大家一起按住按钮把它撕开。
 * 揭晓后每个座位按阵营上色，名次是一张剖面图：山越高，名次越前。
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { factionScore } from '../engine/engine.ts';
import type { Faction } from '../engine/rules.ts';
import { ROLE } from './text.ts';
import { AtlasSheet, BX0, BX1, BY0, BY1, Border, Caption, Coast, Dot, FactionDot, MIDX, MIDY, MeRing, Plate, SeatLabel, Territories, placeSeats } from './atlas.tsx';
import { BIG, Btn, INK, Layer, MUTED, PAGE, SMALL, Stage, TitleBlock } from './board.tsx';
import { flags } from './flags.ts';
import { Chips, type G } from './game.tsx';

const FNAME: Record<Faction, string> = { big: '大国', small: '小国', blank: '白板' };
const FCOL: Record<Faction, string> = { big: BIG, small: SMALL, blank: '#ffffff' };
const WL = '#5f8f93';
const ANG = (Math.atan2(BY0 - BY1, BX0 - BX1) * 180) / Math.PI;

/** 联系竖着写在国界上：一个字一个字往下排；「」里的字用画出来的直角括号框住。 */
function LinkOnBorder({ link }: { link: string }) {
  const L = Math.hypot(BX0 - BX1, BY0 - BY1);
  const ux = (BX0 - BX1) / L;
  const uy = (BY0 - BY1) / L;
  const chars: { ch: string; q: boolean }[] = [];
  let inQ = false;
  for (const ch of Array.from(link)) {
    if (ch === '「' || ch === '『') inQ = true;
    else if (ch === '」' || ch === '』') inQ = false;
    else if (ch.trim()) chars.push({ ch, q: inQ });
  }
  const n = chars.length;
  const step = Math.min(22, 180 / Math.max(1, n));
  const fs = Math.min(20, step * 0.95);
  const halo = 'paint-order: stroke; stroke: #fbf3dc; stroke-width: 6px; stroke-linejoin: round';
  const pos = (i: number) => {
    const k = ((n - 1) / 2 - i) * step;
    return { x: MIDX + ux * k, y: MIDY + uy * k };
  };
  const out: ComponentChildren[] = [];
  chars.forEach((c, i) => {
    const p = pos(i);
    out.push(
      <text x={p.x} y={p.y + fs * 0.35} text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: ${fs}px; fill: #1e1b17; ${halo}`}>
        {c.ch}
      </text>,
    );
  });
  // 括号：一段连续的引号字，上面一个 ﹁、下面一个 ﹂
  for (let i = 0; i < n; i++) {
    if (!chars[i].q || (i > 0 && chars[i - 1].q)) continue;
    let j = i;
    while (j + 1 < n && chars[j + 1].q) j++;
    const a = pos(i);
    const b = pos(j);
    const h = fs * 0.45;
    const br = `M${(a.x - h).toFixed(1)} ${(a.y - h * 1.75).toFixed(1)} H${(a.x + h).toFixed(1)} V${(a.y - h * 1.1).toFixed(1)} M${(b.x - h).toFixed(1)} ${(b.y + h * 1.1).toFixed(1)} V${(b.y + h * 1.75).toFixed(1)} H${(b.x + h).toFixed(1)}`;
    out.push(<path d={br} fill="none" stroke="#fbf3dc" stroke-width="5" />, <path d={br} fill="none" stroke={INK} stroke-width="1.6" />);
    i = j;
  }
  return <g>{out}</g>;
}

function Tape() {
  const tape = 'M-78 -13 L78 -13 L83 -6.5 L78 0 L83 6.5 L78 13 L-78 13 L-83 6.5 L-78 0 L-83 -6.5 Z';
  return (
    <g transform={`translate(${MIDX.toFixed(1)} ${MIDY.toFixed(1)}) rotate(${ANG.toFixed(1)})`}>
      <path d={tape} fill={INK} opacity="0.15" transform="translate(2 3)" />
      <path d={tape} fill="#e9dcb9" stroke={INK} stroke-width="0.8" />
      <path d="M-70 -8 H70 M-70 8 H70" stroke={INK} stroke-width="0.4" stroke-dasharray="1 3" opacity="0.5" />
      <text y="4.5" text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 12.5px; letter-spacing: 0.3em; fill: #1e1b17">
        联系 ？？？
      </text>
    </g>
  );
}

function ResultMap({ g, open }: { g: G; open: boolean }) {
  const { v } = g;
  const rv = v.reveal!;
  const n = v.players.length;
  const fOf = new Map(rv.players.map((p) => [p.id, p] as const));
  return (
    <>
      <AtlasSheet />
      <Territories ribbon />
      <Border settled />
      <Coast />
      <Plate x={146} y={262} cap="大国的词" word={rv.big} size={28} />
      <Plate x={272} y={318} cap="小国的词" word={rv.small} size={28} />
      {open ? <LinkOnBorder link={rv.link} /> : <Tape />}
      {(() => {
        const capOf = (p: (typeof v.players)[number]) => {
          const info = fOf.get(p.id);
          return open && info ? (info.faction === 'blank' ? `白板${info.role && info.role !== 'both' ? ` · ${ROLE[info.role].replace('白板', '')}` : ''}` : FNAME[info.faction]) : p.alive ? '' : '出局';
        };
        const spots = placeSeats(
          v.players.map((p) => ({ seat: p.seat, nameW: Array.from(p.name).length * 14 + (p.id === v.me.id ? 14 : 0), capW: Array.from(capOf(p)).length * 10, cap: !!capOf(p) })),
          n,
        );
        return v.players.map((p, k) => ({ p, pl: spots[k], cap: capOf(p) }));
      })().map(({ p, pl, cap }) => {
        const me = p.id === v.me.id;
        const info = fOf.get(p.id);
        return (
          <g key={p.id}>
            {open && info ? <FactionDot x={pl.at.x} y={pl.at.y} f={info.faction} /> : <Dot x={pl.at.x} y={pl.at.y} out={!p.alive} />}
            {me ? <MeRing x={pl.at.x} y={pl.at.y} /> : null}
            <SeatLabel x={pl.label.x} y={pl.label.y} anchor={pl.anchor} name={p.name} me={me} dim={!open && !p.alive} />
            {cap ? (
              <Caption x={pl.label.x} y={pl.capY} anchor={pl.anchor}>
                {cap}
              </Caption>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

/** Catmull-Rom 平滑成贝塞尔。 */
function smooth(pts: [number, number][]): string {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** 名次：一张剖面图。每一方一座山，山高 = 得分；山下写这一方的人。 */
function Podium({ g, open, T }: { g: G; open: boolean; T: number }) {
  const { v } = g;
  const r = v.result!;
  const rv = v.reveal!;
  const X0 = 62;
  const X1 = 356;
  const B = T + 152;
  const U = 24;
  const order: Faction[] = [];
  for (const f of r.second) order.push(f);
  if (r.first) order.push(r.first);
  for (const f of r.third) order.push(f);
  for (const f of ['big', 'small', 'blank'] as Faction[]) if (!order.includes(f)) order.push(f);
  // 第一名放中间：第二名们在左，第三名在右
  const firstI = r.first ? order.indexOf(r.first) : -1;
  const arranged = firstI >= 0 ? [...order.slice(0, firstI), order[firstI], ...order.slice(firstI + 1)] : order;
  const zoneW = (X1 - X0) / arranged.length;
  const zones = arranged.map((f, i) => {
    const pts = factionScore(r, f);
    const rank = r.first === f ? 1 : r.second.includes(f) ? 2 : r.third.includes(f) ? 3 : 0;
    return { f, a: X0 + i * zoneW, b: X0 + (i + 1) * zoneW, cx: X0 + (i + 0.5) * zoneW, pts, rank };
  });
  const me = rv.players.find((p) => p.id === v.me.id);
  const myZone = zones.find((z) => z.f === me?.faction);
  const out: ComponentChildren[] = [];
  out.push(
    <rect x="20" y={T} width="350" height="250" fill={PAGE} stroke={INK} stroke-width="1.2" />,
    <rect x="23.5" y={T + 3.5} width="343" height="243" fill="none" stroke={INK} stroke-width="0.5" />,
    <text x="36" y={T + 25} style="font-family: var(--serif); font-weight: 900; font-size: 16px; letter-spacing: 0.35em; fill: #1e1b17">
      名次
    </text>,
    <text x="88" y={T + 25} style={`font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.06em; fill: ${MUTED}`}>
      剖面 · 越高名次越前
    </text>,
    <path d={`M36 ${T + 34} H354`} stroke={INK} stroke-width="1" />,
  );
  for (const [lv, lab] of [
    [0, '0'],
    [1, '+1'],
    [3, '+3'],
  ] as const) {
    const y = B - lv * U;
    out.push(
      <path d={`M${X0} ${y} H${X1}`} stroke={WL} stroke-width={lv === 0 ? 0.9 : 0.5} stroke-dasharray={lv === 0 ? undefined : '2 3'} />,
      <text x={X0 - 6} y={y + 3} text-anchor="end" style={`font-family: var(--mono); font-size: 8.5px; fill: ${WL}`}>
        {lab}
      </text>,
    );
  }
  if (open) {
    const h: [number, number][] = [[X0, 0]];
    zones.forEach((z, i) => {
      const peak = z.pts === 0 ? 2 : z.pts * U;
      if (i > 0) h.push([z.a, 6]);
      h.push([z.a + zoneW * 0.25, Math.max(4, peak * 0.4)]);
      h.push([z.cx, peak]);
      h.push([z.b - zoneW * 0.25, Math.max(4, peak * 0.4)]);
    });
    h.push([X1, 0]);
    const prof = smooth(h.map(([x, hh]) => [x, B - hh]));
    const area = `${prof} L${X1} ${B} L${X0} ${B} Z`;
    out.push(
      <defs>
        {zones.map((z) => (
          <clipPath id={`pz-${z.f}`}>
            <rect x={z.a} y={T} width={zoneW} height="250" />
          </clipPath>
        ))}
        <pattern id="pz-dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="0.7" fill={MUTED} />
        </pattern>
      </defs>,
    );
    for (const z of zones) {
      out.push(<path d={area} fill={FCOL[z.f]} clip-path={`url(#pz-${z.f})`} />);
      if (z.f === 'blank') out.push(<path d={area} fill="url(#pz-dots)" opacity="0.5" clip-path={`url(#pz-${z.f})`} />);
    }
    zones.slice(1).forEach((z) => out.push(<path d={`M${z.a} ${B} V${B - 6}`} stroke={INK} stroke-width="0.7" stroke-dasharray="2 2" />));
    out.push(<path d={prof} fill="none" stroke={INK} stroke-width="1.6" stroke-linejoin="round" />, <path d={`M${X0} ${B} H${X1}`} stroke={INK} stroke-width="1.2" />);
    for (const z of zones) {
      const sy = B - (z.pts === 0 ? 2 : z.pts * U);
      out.push(<path d={`M${z.cx} ${sy - 1} l-4.5 -7.5 h9 Z`} fill={INK} />);
      out.push(
        <text x={z.cx} y={sy - 28} text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 17px; fill: #1e1b17">
          {z.rank ? String(z.rank).padStart(2, '0') : '—'}
        </text>,
        <text x={z.cx} y={sy - 12} text-anchor="middle" style="fill: #1e1b17">
          <tspan style="font-family: var(--serif); font-weight: 900; font-size: 13px">{FNAME[z.f]}</tspan>
          <tspan dx="4" style="font-family: var(--cond); font-weight: 500; font-size: 13px">
            {z.pts ? `+${z.pts}` : '0'}
          </tspan>
        </text>,
      );
      const members = rv.players.filter((p) => p.faction === z.f);
      const perLine = members.length > 3 ? 2 : 1;
      for (let k = 0; k < members.length; k += perLine) {
        const line = members.slice(k, k + perLine);
        out.push(
          <text x={z.cx} y={B + 20 + (k / perLine) * 16} text-anchor="middle" style="font-family: var(--serif); font-weight: 700; font-size: 12px; fill: #1e1b17">
            {line.map((p, j) => (
              <tspan key={p.id} style={p.id === v.me.id ? 'font-weight: 900' : undefined}>
                {j ? '、' : ''}
                {g.name(p.id)}
                {p.id === v.me.id ? <tspan style="font-family: var(--sans); font-size: 10px; fill: var(--acc-text)">你</tspan> : null}
                {z.f === 'blank' && p.role && p.role !== 'both' && perLine === 1 ? ` · ${ROLE[p.role].replace('白板', '')}` : ''}
              </tspan>
            ))}
          </text>,
        );
      }
    }
    if (!r.first) {
      out.push(
        <text x="209" y={B - 62} text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 16px; fill: #1e1b17">
          无人猜中，平局
        </text>,
      );
    }
    if (myZone) {
      out.push(
        <text x="354" y={T + 25} text-anchor="end" style="font-size: 11px; fill: #1e1b17">
          <tspan style="font-weight: 700; fill: var(--acc-text)">你</tspan> {FNAME[myZone.f]} · {myZone.rank ? `第${'一二三'[myZone.rank - 1]}名` : '平局'} {myZone.pts ? `+${myZone.pts}` : '0'}
        </text>,
      );
    }
  } else {
    const hh: [number, number][] = [
      [X0, 0],
      [84, 10],
      [105, 22],
      [128, 10],
      [150, 4],
      [176, 12],
      [200, 22],
      [226, 12],
      [252, 4],
      [278, 12],
      [304, 22],
      [330, 10],
      [X1, 0],
    ];
    out.push(
      <path d={smooth(hh.map(([x, h]) => [x, B - h]))} fill="none" stroke={INK} stroke-width="1.2" stroke-dasharray="4 3" />,
      <path d={`M${X0} ${B} H${X1}`} stroke={INK} stroke-width="1.2" />,
      ...[105, 200, 304].map((sx) => (
        <text x={sx} y={B - 30} text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: 18px; fill: ${MUTED}`}>
          ?
        </text>
      )),
      <text x="200" y={B + 34} text-anchor="middle" style={`font-size: 11.5px; fill: ${MUTED}`}>
        揭晓联系之后，名次和每个人的身份一起公布
      </text>,
      <text x="354" y={T + 25} text-anchor="end" style={`font-size: 11px; fill: ${MUTED}`}>
        还没揭晓
      </text>,
    );
  }
  return <Layer label={open ? '名次剖面图' : '名次还没揭晓'}>{out}</Layer>;
}

/** 长按揭晓：按满 ms 才算，中途松手就清零；按住时一层深色从左往右涨满。 */
function RevealBar({ onDone, ms = 1400 }: { onDone: () => void; ms?: number }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const start = (e?: Event) => {
    e?.preventDefault();
    if (timer.current) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setHolding(false);
      onDone();
    }, ms);
  };
  const stop = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      class={`b-o-reveal ${holding ? 'is-holding' : ''}`}
      style={{ '--ms': `${ms}ms` }}
      onPointerDown={(e) => {
        try {
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
        } catch {
          /* 不支持就算了 */
        }
        start(e);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && start()}
      onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <i class="b-o-fill" aria-hidden="true" />
      <span class="b-o-in">
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round">
          <path d="M3 20 L19 4 L26 11 L10 27 Z" />
          <path d="M19 4 C23 2 27 4 28 8" stroke-dasharray="2.5 2" />
          <path d="M8 18 L14 12 M11 21 L17 15" />
        </svg>
        <span class="b-o-label">
          <b>{holding ? '再按一会儿…' : '按住揭晓联系'}</b>
          <small>按满 1.4 秒，把国界上的胶带撕开 · 大家一起看</small>
        </span>
      </span>
    </button>
  );
}

const TITLE_OF = (r: NonNullable<G['v']['result']>) => {
  if (!r.first) return '无人猜中，平局';
  return `${FNAME[r.first]}拿到第一`;
};

export function OverScreen({ g }: { g: G }) {
  const { v } = g;
  const [open, setOpen] = useState(flags.revealed);
  if (!v.reveal || !v.result) return null;
  return (
    <Stage bg="atlas" label="结算">
      <Layer label={open ? `结算：大国的词${v.reveal.big}，小国的词${v.reveal.small}，联系是${v.reveal.link}` : `结算：大国的词${v.reveal.big}，小国的词${v.reveal.small}，联系还盖着`}>
        <ResultMap g={g} open={open} />
      </Layer>
      <Podium g={g} open={open} T={470} />
      {open ? (
        <TitleBlock kicker="游戏结束" title={TITLE_OF(v.result)} sub="两国共用的那段国界，就是两个词之间的联系" size={26} />
      ) : (
        <TitleBlock kicker="游戏结束" title="谜底" sub="两个词都摆在这儿了，它们之间的联系还盖着" />
      )}
      <Chips g={g} hold={false} />
      {open ? (
        <div class="b-o-go">
          <Btn onClick={g.onLeave}>回到房间</Btn>
        </div>
      ) : (
        <>
          <RevealBar onDone={() => setOpen(true)} />
          <button type="button" class="b-o-skip" onClick={g.onLeave}>
            先回房间（不看谜底）
          </button>
        </>
      )}
    </Stage>
  );
}
