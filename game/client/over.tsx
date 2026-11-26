/**
 * 结算：圆桌岛变成一张历史疆域图，两国写上了词。揭晓前，岛上方挂着一卷卷起来的横幅，联系写在里面；
 * 大家一起按住按钮揭晓：先是每个人从海岸上的座位走回自己的阵营（大国、小国各回各的国土，
 * 白板阵营没有国家，上了海上的一块白木筏），然后横幅从中间往两边展开，上面写着联系。
 * 名次是一张剖面图：山越高，名次越前。
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { factionScore } from '../engine/engine.ts';
import type { Faction } from '../engine/rules.ts';
import { ROLE } from './text.ts';
import { P2 } from './art.ts';
import { AtlasSheet, BX0, BX1, BY0, BY1, Border, Caption, Coast, Dot, MeRing, Plate, SeatLabel, Territories, placeSeats } from './atlas.tsx';
import { BIG, Btn, INK, Layer, MUTED, PAGE, SMALL, Stage, TitleBlock, textWidth } from './board.tsx';
import { flags } from './flags.ts';
import { Chips, type G } from './game.tsx';

const FNAME: Record<Faction, string> = { big: '大国', small: '小国', blank: '白板' };
const FCOL: Record<Faction, string> = { big: BIG, small: SMALL, blank: '#ffffff' };
const WL = '#5f8f93';

/* ================================================================ 两国的名牌、各国的人站在哪 */

const PLATE: Record<'big' | 'small', { x: number; y: number; cap: string }> = {
  big: { x: 146, y: 262, cap: '大国的词' },
  small: { x: 272, y: 302, cap: '小国的词' },
};
const PLATE_SIZE = 28;

/** 名牌占的地方（摆人时要让开）。 */
function plateBox(side: 'big' | 'small', word: string) {
  const { x, y } = PLATE[side];
  const fs = Math.min(PLATE_SIZE, Math.floor(130 / Math.max(1, Array.from(word).length)));
  const half = Math.max(32, (Array.from(word).length * fs * 1.16) / 2) + 4;
  return { x0: x - half, x1: x + half, y0: y + 12 - fs - 4 - 12, y1: y + 16 };
}

/** 一条横线和海岸的交点：最左、最右。 */
function coastAt(y: number): [number, number] | null {
  const pts = P2.pts as number[][];
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
  }
  return xs.length >= 2 ? [Math.min(...xs), Math.max(...xs)] : null;
}
const borderX = (y: number) => BX0 + ((y - BY0) / (BY1 - BY0)) * (BX1 - BX0);

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** 第 y 行（以点的中心算，上下各留 9）在这一国里能放东西的几段。 */
function rowSpans(side: 'big' | 'small', y: number, avoid: Box[]): [number, number][] {
  const a = coastAt(y - 9);
  const b = coastAt(y + 9);
  if (!a || !b) return [];
  let x0 = Math.max(a[0], b[0]) + 7;
  let x1 = Math.min(a[1], b[1]) - 7;
  // 国界是斜的：大国在左上，小国在右下
  if (side === 'big') x1 = Math.min(x1, borderX(y + 9) - 11);
  else x0 = Math.max(x0, borderX(y - 9) + 11);
  let spans: [number, number][] = x1 - x0 > 24 ? [[x0, x1]] : [];
  for (const bx of avoid) {
    if (bx.y1 < y - 9 || bx.y0 > y + 9) continue;
    spans = spans.flatMap(([s, e]) => {
      const out: [number, number][] = [];
      if (bx.x0 > s) out.push([s, Math.min(e, bx.x0 - 4)]);
      if (bx.x1 < e) out.push([Math.max(s, bx.x1 + 4), e]);
      return out.filter(([p, q]) => q - p > 24);
    });
  }
  return spans;
}

/** 按行往这一国里排人：每行从左往右，排得下几个放几个，整行居中。放不下返回 null。 */
function pack(side: 'big' | 'small', widths: number[], rows: number[], avoid: Box[], gap: number) {
  const at: { x: number; y: number }[] = [];
  let i = 0;
  for (const y of rows) {
    if (i >= widths.length) break;
    for (const [s, e] of rowSpans(side, y, avoid)) {
      const start = i;
      let used = 0;
      while (i < widths.length && used + (i > start ? gap : 0) + widths[i] <= e - s) {
        used += (i > start ? gap : 0) + widths[i];
        i++;
      }
      let x = s + (e - s - used) / 2;
      for (let k = start; k < i; k++) {
        at[k] = { x: x + 6, y };
        x += widths[k] + gap;
      }
      if (i >= widths.length) break;
    }
  }
  return i >= widths.length ? at : null;
}

const clip = (s: string, n: number) => (Array.from(s).length > n ? Array.from(s).slice(0, n).join('') + '…' : s);

interface Member {
  id: string;
  name: string;
  me: boolean;
  out: boolean;
  f: Faction;
}

interface Placed extends Member {
  label: string;
  fs: number;
  x: number;
  y: number;
}

/** 名牌下面一行一行往下排，再不够就排到名牌旁边。 */
const ROWS: Record<'big' | 'small', number[]> = {
  big: [292, 311, 330, 349, 368, 387, 243, 262],
  small: [336, 354, 372, 390, 270, 251],
};

/** 每一国的人站在哪：字号从大到小试，名字太长就截短。 */
function camp(side: 'big' | 'small', list: Member[], word: string): Placed[] {
  const avoid = [plateBox(side, word)];
  const tries: [number, number, number][] = [
    [13.5, 10, 10],
    [12, 8, 5],
    [11, 6, 3],
  ];
  for (const [fs, gap, max] of tries) {
    const labels = list.map((m) => clip(m.name, max));
    const widths = list.map((m, k) => 16 + textWidth(labels[k], fs) + (m.me ? 13 : 0));
    const at = pack(side, widths, ROWS[side], avoid, gap);
    if (at) return list.map((m, k) => ({ ...m, label: labels[k], fs, ...at[k] }));
  }
  // 实在放不下（自定义人数、名字又特别长）：按最小字号硬排，可能会挤
  const fs = 11;
  const labels = list.map((m) => clip(m.name, 3));
  const rows = ROWS[side];
  return list.map((m, k) => ({ ...m, label: labels[k], fs, x: (side === 'big' ? 100 : 220) + (k % 2) * 52, y: rows[Math.floor(k / 2) % rows.length] }));
}

/* ================================================================ 白板的木筏 */

const RAFT_X = 284;
const RAFT_Y = 78;
const RAFT_W = 86;

/** 木筏上每个人的位置：一列；人多（自定义人数）就两列、字小一点。白板的分工在下面名次里写。 */
function raft(list: Member[]): { at: Placed[]; h: number } {
  const two = list.length > 4;
  const fs = two ? 10.5 : 12.5;
  const rowH = two ? 17 : 19;
  const perCol = two ? Math.ceil(list.length / 2) : list.length;
  const at = list.map((m, k) => {
    const col = two ? Math.floor(k / perCol) : 0;
    const row = two ? k % perCol : k;
    const room = (two ? RAFT_W / 2 : RAFT_W) - 22 - (m.me ? 12 : 0);
    let n = Array.from(m.name).length;
    while (n > 1 && textWidth(clip(m.name, n), fs) > room) n--;
    return { ...m, label: clip(m.name, n), fs, x: RAFT_X + 11 + col * (RAFT_W / 2), y: RAFT_Y + 33 + row * rowH };
  });
  return { at, h: 33 + perCol * rowH - 4 };
}

function Raft({ h, play }: { h: number; play: boolean }) {
  const planks = [];
  for (let y = 24; y < h - 4; y += 9) planks.push(`M3 ${y} H${RAFT_W - 3}`);
  return (
    <g class={play ? 'b-o-raft' : undefined} transform={`translate(${RAFT_X} ${RAFT_Y})`}>
      <path d={`M-8 ${h + 5} Q${RAFT_W / 2} ${h + 11} ${RAFT_W + 8} ${h + 5}`} fill="none" stroke={WL} stroke-width="0.8" />
      <path d={`M-2 ${h + 10} Q${RAFT_W / 2} ${h + 15} ${RAFT_W + 2} ${h + 10}`} fill="none" stroke={WL} stroke-width="0.6" opacity="0.6" />
      <rect x="3" y="4" width={RAFT_W} height={h} fill={INK} opacity="0.13" />
      <rect width={RAFT_W} height={h} fill="#fdfaf2" stroke={INK} stroke-width="1.2" />
      <path d={planks.join(' ')} stroke="#d6ccb6" stroke-width="0.6" />
      <path d={`M0 20 H${RAFT_W}`} stroke={INK} stroke-width="0.8" />
      <text x="8" y="14.5" style={`font-family: var(--serif); font-weight: 900; font-size: 11.5px; letter-spacing: 0.3em; fill: ${INK}`}>
        白板
      </text>
      <text x={RAFT_W - 6} y="14" text-anchor="end" style={`font-size: 8px; fill: ${MUTED}`}>
        没有国家
      </text>
    </g>
  );
}

/* ================================================================ 横幅 */

const BNY = 197;
const BAND_W = 300;

/** 横幅上的字：一行放得下（字不小于 15）就一行；否则拆两行，只在不拆开英文单词、不把括号标点甩到行首行尾的地方断。 */
function linkLayout(link: string): { lines: string[]; fs: number } {
  const text = link.trim();
  const room = 236;
  const one = room / Math.max(1, textWidth(text, 1));
  if (one >= 15) return { lines: [text], fs: Math.min(23, Math.floor(one)) };
  const chars = Array.from(text);
  // 浏览器会分词的话，只在词和词之间断（「比赛」不会被拆开）
  let words: Set<number> | null = null;
  if (typeof Intl.Segmenter === 'function') {
    words = new Set();
    let at = 0;
    for (const sg of new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)) words.add((at += Array.from(sg.segment).length));
  }
  let best: string[] = [];
  let bestW = Infinity;
  let bestScore = Infinity;
  for (const strict of [true, false]) {
    for (let i = 1; i < chars.length; i++) {
      const a = chars[i - 1];
      const b = chars[i];
      if (/[A-Za-z0-9]/.test(a) && /[A-Za-z0-9]/.test(b)) continue;
      if (/[（「『(“《]/.test(a)) continue;
      if (/[，。、；：！？）」』)”》,.;:!?/]/.test(b)) continue;
      if (strict && words && !words.has(i)) continue;
      const l1 = chars.slice(0, i).join('').trimEnd();
      const l2 = chars.slice(i).join('').trimStart();
      const w = Math.max(textWidth(l1, 1), textWidth(l2, 1));
      // 逗号、空格后面断最自然，宽一点也优先
      const score = /[，。、；：,;\s]/.test(a) ? w * 0.85 : w;
      if (l1 && l2 && score < bestScore) {
        bestScore = score;
        bestW = w;
        best = [l1, l2];
      }
    }
    if (best.length) break;
  }
  if (!best.length) {
    const mid = Math.ceil(chars.length / 2);
    best = [chars.slice(0, mid).join(''), chars.slice(mid).join('')];
    bestW = Math.max(textWidth(best[0], 1), textWidth(best[1], 1));
  }
  return { lines: best, fs: Math.max(11, Math.min(18, Math.floor(room / bestW))) };
}

/** 揭晓前横幅卷着、捆好，搁在国界的中段上（联系就在两国之间）；揭晓时升到岛的上方再展开。 */
const ROLLED_X = 190;
const ROLLED_Y = 348;

/** 卷着的横幅：两卷挨在一起，用绳子捆着，挂一张小签。tieOnly：揭晓时只剩绳子和签（两卷已经交给展开的横幅），淡掉。 */
function Rolled({ tieOnly }: { tieOnly?: boolean }) {
  return (
    <g transform={`translate(${ROLLED_X} ${ROLLED_Y})`} class={tieOnly ? 'b-o-untie' : undefined}>
      {tieOnly ? null : (
        <>
          <rect x="-15" y="-23" width="34" height="54" fill={INK} opacity="0.15" />
          <Roll x={-8} h={42} />
          <Roll x={8} h={42} />
        </>
      )}
      <path d="M-18 -4 H18 M-18 4 H18" stroke={INK} stroke-width="1.4" />
      <path d="M-16 4 L-35 14" stroke={INK} stroke-width="0.9" />
      <g transform="translate(-82 8) rotate(-4)">
        <rect width="52" height="20" fill={PAGE} stroke={INK} stroke-width="0.9" />
        <circle cx="46" cy="7" r="2.2" fill={PAGE} stroke={INK} stroke-width="0.8" />
        <text x="22" y="14.5" text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: 11.5px; letter-spacing: 0.15em; fill: ${INK}`}>
          联系 ?
        </text>
      </g>
    </g>
  );
}

function Roll({ x, h, cls }: { x: number; h: number; cls?: string }) {
  return (
    <g class={cls}>
      <rect x={x - 8} y={-h / 2 - 5} width="16" height={h + 10} rx="6" fill="#e9dcb9" stroke={INK} stroke-width="1.1" />
      <path d={`M${x - 4} ${-h / 2 - 1} V${h / 2 + 1} M${x + 2} ${-h / 2 - 2} V${h / 2 + 2}`} stroke={INK} stroke-width="0.5" opacity="0.5" />
    </g>
  );
}

/** 展开的横幅：联系写在中间；play 时从中间往两边展开（两卷往外滚，滚到头就收起来，露出燕尾）。 */
function Banner({ link, play }: { link: string; play: boolean }) {
  const { lines, fs } = linkLayout(link);
  const H = lines.length > 1 ? 56 : 44;
  const t = H / 2;
  const half = BAND_W / 2;
  const cx = 12;
  const tail = (s: 1 | -1) => `M${s * (half - 16)} ${-t + 9} H${s * (half + 28)} L${s * (half + 17)} 9 L${s * (half + 28)} ${t + 9} H${s * (half - 16)} Z`;
  const fold = (s: 1 | -1) => `M${s * half} ${t} L${s * (half - 16)} ${t + 9} L${s * half} ${t + 9} Z`;
  return (
    <g transform={`translate(195 ${BNY})`} class={play ? 'b-o-banner is-play' : 'b-o-banner'}>
      <g class="b-o-tails">
        <path d={tail(-1)} fill="#d9c79c" stroke={INK} stroke-width="1" stroke-linejoin="round" />
        <path d={tail(1)} fill="#d9c79c" stroke={INK} stroke-width="1" stroke-linejoin="round" />
        <path d={fold(-1)} fill="#8f7a52" stroke={INK} stroke-width="0.8" stroke-linejoin="round" />
        <path d={fold(1)} fill="#8f7a52" stroke={INK} stroke-width="0.8" stroke-linejoin="round" />
      </g>
      <g class="b-o-band">
        <rect x={-half + 3} y={-t + 4} width={BAND_W} height={H} fill={INK} opacity="0.15" />
        <rect x={-half} y={-t} width={BAND_W} height={H} fill="#fbf3dc" stroke={INK} stroke-width="1.3" />
        <path d={`M${-half + 4} ${-t + 4} H${half - 4} M${-half + 4} ${t - 4} H${half - 4}`} stroke={INK} stroke-width="0.5" />
        <path d={`M${-half + 30} ${-t + 8} V${t - 8}`} stroke={INK} stroke-width="0.7" />
        <text x={-half + 16} y={-3} text-anchor="middle" style={`font-family: var(--serif); font-weight: 700; font-size: 10.5px; fill: ${MUTED}`}>
          联
        </text>
        <text x={-half + 16} y={11} text-anchor="middle" style={`font-family: var(--serif); font-weight: 700; font-size: 10.5px; fill: ${MUTED}`}>
          系
        </text>
        {lines.map((l, i) => (
          <text
            key={i}
            x={cx}
            y={(i - (lines.length - 1) / 2) * (fs + 6) + fs * 0.36}
            text-anchor="middle"
            style={`font-family: var(--serif); font-weight: 900; font-size: ${fs}px; letter-spacing: 0.06em; fill: ${INK}`}
          >
            {l}
          </text>
        ))}
      </g>
      {play ? (
        <>
          <Roll x={-half} h={H} cls="b-o-roll is-l" />
          <Roll x={half} h={H} cls="b-o-roll is-r" />
        </>
      ) : null}
    </g>
  );
}

/* ================================================================ 结算图 */

function ResultMap({ g, open, play }: { g: G; open: boolean; play: boolean }) {
  const { v } = g;
  const rv = v.reveal!;
  const n = v.players.length;
  const fOf = new Map(rv.players.map((p) => [p.id, p] as const));

  // 海岸上的座位（揭晓前的样子，也是揭晓时每个人出发的地方）
  const coastCap = (p: (typeof v.players)[number]) => (p.alive ? '' : '出局');
  const spots = placeSeats(
    v.players.map((p) => ({ seat: p.seat, nameW: Array.from(p.name).length * 14 + (p.id === v.me.id ? 14 : 0), capW: Array.from(coastCap(p)).length * 10, cap: !!coastCap(p) })),
    n,
  );
  const seatOf = new Map(v.players.map((p, k) => [p.id, spots[k]] as const));

  const coast = (
    <g class={play ? 'b-o-old' : undefined}>
      {v.players.map((p) => {
        const pl = seatOf.get(p.id)!;
        const me = p.id === v.me.id;
        const cap = coastCap(p);
        return (
          <g key={p.id}>
            {open ? null : <Dot x={pl.at.x} y={pl.at.y} out={!p.alive} />}
            {open || !me ? null : <MeRing x={pl.at.x} y={pl.at.y} />}
            <SeatLabel x={pl.label.x} y={pl.label.y} anchor={pl.anchor} name={p.name} me={me} dim={!p.alive} />
            {cap ? (
              <Caption x={pl.label.x} y={pl.capY} anchor={pl.anchor}>
                {cap}
              </Caption>
            ) : null}
          </g>
        );
      })}
    </g>
  );

  let people: ComponentChildren = null;
  let raftH = 0;
  if (open) {
    const members = (f: Faction): Member[] =>
      [...v.players]
        .sort((a, b) => a.seat - b.seat)
        .filter((p) => fOf.get(p.id)?.faction === f)
        .map((p) => ({ id: p.id, name: p.name, me: p.id === v.me.id, out: !p.alive, f }));
    const onRaft = raft(members('blank'));
    raftH = onRaft.h;
    const placed = [...camp('big', members('big'), rv.big), ...camp('small', members('small'), rv.small), ...onRaft.at];
    const order = new Map([...v.players].sort((a, b) => a.seat - b.seat).map((p, k) => [p.id, k] as const));
    people = placed.map((m) => {
      const from = seatOf.get(m.id)!.at;
      const k = order.get(m.id) ?? 0;
      const style = play ? { '--dx': `${(from.x - m.x).toFixed(1)}px`, '--dy': `${(from.y - m.y).toFixed(1)}px`, '--d': `${(0.15 + k * 0.045).toFixed(3)}s` } : undefined;
      return (
        <g key={m.id} class={play ? 'b-o-walk' : undefined} style={style}>
          <Dot x={m.x} y={m.y} out={m.out} />
          {m.me ? <MeRing x={m.x} y={m.y} /> : null}
          <text
            class={play ? 'b-o-nm' : undefined}
            x={m.x + 10}
            y={m.y + m.fs * 0.36}
            style={`font-family: var(--serif); font-weight: 700; font-size: ${m.fs}px; fill: ${m.out ? '#7d7466' : INK}; paint-order: stroke; stroke: ${m.f === 'blank' ? '#fdfaf2' : m.f === 'big' ? BIG : SMALL}; stroke-width: 3px; stroke-linejoin: round`}
          >
            {m.label}
            {m.me ? (
              <tspan dx="2" style="font-family: var(--sans); font-weight: 700; font-size: 10px; fill: var(--acc-text)">
                你
              </tspan>
            ) : null}
          </text>
        </g>
      );
    });
  }

  return (
    <>
      <AtlasSheet />
      <Territories ribbon />
      <Border settled />
      <Coast />
      <Plate x={PLATE.big.x} y={PLATE.big.y} cap={PLATE.big.cap} word={rv.big} size={PLATE_SIZE} />
      <Plate x={PLATE.small.x} y={PLATE.small.y} cap={PLATE.small.cap} word={rv.small} size={PLATE_SIZE} />
      {!open || play ? coast : null}
      {open ? <Raft h={raftH} play={play} /> : null}
      {people}
      {open ? null : <Rolled />}
      {play ? <Rolled tieOnly /> : null}
      {open ? <Banner link={rv.link} play={play} /> : null}
    </>
  );
}

/* ================================================================ 名次 */

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
function Podium({ g, open, play, T }: { g: G; open: boolean; play: boolean; T: number }) {
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
  const frame: ComponentChildren[] = [
    <rect x="20" y={T} width="350" height="250" fill={PAGE} stroke={INK} stroke-width="1.2" />,
    <rect x="23.5" y={T + 3.5} width="343" height="243" fill="none" stroke={INK} stroke-width="0.5" />,
    <text x="36" y={T + 25} style="font-family: var(--serif); font-weight: 900; font-size: 16px; letter-spacing: 0.35em; fill: #1e1b17">
      名次
    </text>,
    <text x="88" y={T + 25} style={`font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.06em; fill: ${MUTED}`}>
      剖面 · 越高名次越前
    </text>,
    <path d={`M36 ${T + 34} H354`} stroke={INK} stroke-width="1" />,
  ];
  for (const [lv, lab] of [
    [0, '0'],
    [1, '+1'],
    [3, '+3'],
  ] as const) {
    const y = B - lv * U;
    frame.push(
      <path d={`M${X0} ${y} H${X1}`} stroke={WL} stroke-width={lv === 0 ? 0.9 : 0.5} stroke-dasharray={lv === 0 ? undefined : '2 3'} />,
      <text x={X0 - 6} y={y + 3} text-anchor="end" style={`font-family: var(--mono); font-size: 8.5px; fill: ${WL}`}>
        {lab}
      </text>,
    );
  }
  const out: ComponentChildren[] = [];
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
      // 山下写这一方的人：按这一格的宽度折行，名字太长就截短；白板的分工放得下就写上
      const maxW = zoneW - 8;
      const items = rv.players
        .filter((p) => p.faction === z.f)
        .map((p) => {
          const me = p.id === v.me.id;
          const nm = g.name(p.id);
          const role = z.f === 'blank' && p.role && p.role !== 'both' ? ` · ${ROLE[p.role].replace('白板', '')}` : '';
          const width = (k: number, withRole: boolean) => textWidth(clip(nm, k) + (withRole ? role : ''), 12) + (me ? 10 : 0);
          let k = Array.from(nm).length;
          const withRole = !!role && width(k, true) <= maxW;
          while (k > 1 && width(k, withRole) > maxW) k--;
          return { id: p.id, me, label: clip(nm, k), role: withRole ? role : '', w: width(k, withRole) };
        });
      const lines: (typeof items)[] = [];
      let line: typeof items = [];
      let used = 0;
      for (const it of items) {
        if (line.length && used + 12 + it.w > maxW) {
          lines.push(line);
          line = [];
          used = 0;
        }
        used += (line.length ? 12 : 0) + it.w;
        line.push(it);
      }
      if (line.length) lines.push(line);
      lines.forEach((ln, i) => {
        out.push(
          <text x={z.cx} y={B + 20 + i * 16} text-anchor="middle" style="font-family: var(--serif); font-weight: 700; font-size: 12px; fill: #1e1b17">
            {ln.map((it, j) => (
              <tspan key={it.id} style={it.me ? 'font-weight: 900' : undefined}>
                {j ? '、' : ''}
                {it.label}
                {it.me ? <tspan style="font-family: var(--sans); font-size: 10px; fill: var(--acc-text)">你</tspan> : null}
                {it.role}
              </tspan>
            ))}
          </text>,
        );
      });
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
  return (
    <Layer label={open ? '名次剖面图' : '名次还没揭晓'}>
      {frame}
      <g class={play ? 'b-o-rise' : undefined}>{out}</g>
    </Layer>
  );
}

/* ================================================================ 揭晓按钮 */

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
          <rect x="3" y="9" width="7" height="14" rx="3" />
          <rect x="20" y="9" width="7" height="14" rx="3" />
          <path d="M10 12 H20 M10 20 H20" stroke-dasharray="2.5 2" />
        </svg>
        <span class="b-o-label">
          <b>{holding ? '再按一会儿…' : '按住揭晓联系'}</b>
          <small>按满 1.4 秒，展开岛上的横幅 · 大家一起看</small>
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
  // 自己按出来的揭晓才播动画；预览里一开始就是揭晓后的样子、不想看动画的设置都不播
  const [play, setPlay] = useState(false);
  if (!v.reveal || !v.result) return null;
  const reveal = () => {
    setPlay(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    setOpen(true);
  };
  return (
    <Stage bg="atlas" label="结算">
      <Layer label={open ? `结算：大国的词${v.reveal.big}，小国的词${v.reveal.small}，联系是${v.reveal.link}` : `结算：大国的词${v.reveal.big}，小国的词${v.reveal.small}，联系还卷在横幅里`}>
        <ResultMap g={g} open={open} play={play} />
      </Layer>
      <Podium g={g} open={open} play={play} T={470} />
      {open ? (
        <TitleBlock kicker="游戏结束" title={TITLE_OF(v.result)} sub="大家回到了各自的阵营；横幅上是两个词之间的联系" size={26} />
      ) : (
        <TitleBlock kicker="游戏结束" title="谜底" sub="两个词都摆在这儿了，它们之间的联系还卷在横幅里" />
      )}
      <Chips g={g} hold={false} />
      {open ? (
        <div class="b-o-go">
          <Btn onClick={g.onLeave}>回到房间</Btn>
        </div>
      ) : (
        <>
          <RevealBar onDone={reveal} />
          <button type="button" class="b-o-skip" onClick={g.onLeave}>
            先回房间（不看谜底）
          </button>
        </>
      )}
    </Stage>
  );
}
