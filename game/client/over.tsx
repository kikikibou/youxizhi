/**
 * 结算：圆桌岛变成一张历史疆域图，两国写上了词。揭晓前，国界中段挂着一个小注记「联系 ？」；
 * 大家一起按住按钮揭晓：先是每个人从海岸上的座位走回自己的阵营（大国、小国各回各的国土，
 * 白板阵营没有国家，上了海上挂白旗的木筏），然后国界往北接上一条横跨全岛的尺线，联系写在尺线上。
 * 名次是印在图纸上的一条地质剖面：每一方一座山，山越高名次越前，这一方的人写在山下的岩层里。
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { factionScore } from '../engine/engine.ts';
import type { Faction } from '../engine/rules.ts';
import { ROLE } from './text.ts';
import { P2 } from './art.ts';
import { AtlasSheet, BX0, BX1, BY0, BY1, Border, Caption, Coast, Dot, MIDX, MIDY, MeRing, Plate, SeatLabel, Territories, placeSeats } from './atlas.tsx';
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

const RAFT_X = 286;
const RAFT_Y = 106;
const RAFT_W = 82;

/** 木筏上每个人站在哪：一人一块木板；人多（自定义人数）就两列、字小一点。白板的分工在下面名次里写。 */
function raft(list: Member[]): { at: Placed[]; rows: number; rowH: number } {
  const two = list.length > 3;
  const fs = two ? 10.5 : 12.5;
  const rowH = two ? 17 : 19;
  const rows = Math.max(1, two ? Math.ceil(list.length / 2) : list.length);
  const at = list.map((m, k) => {
    const col = two ? Math.floor(k / rows) : 0;
    const row = two ? k % rows : k;
    const room = (two ? RAFT_W / 2 : RAFT_W) - 28 - (m.me ? 12 : 0);
    let n = Array.from(m.name).length;
    while (n > 1 && textWidth(clip(m.name, n), fs) > room) n--;
    return { ...m, label: clip(m.name, n), fs, x: RAFT_X + 13 + col * (RAFT_W / 2), y: RAFT_Y + row * rowH + (rowH - 2) / 2 };
  });
  return { at, rows, rowH };
}

/** 白板阵营没有国家：海上一只木筏，一人一块板，两道绳子捆着，桅杆上挂一面白旗「白板」。 */
function Raft({ rows, rowH, play }: { rows: number; rowH: number; play: boolean }) {
  const H = rows * rowH - 2;
  const planks = Array.from({ length: rows }, (_, k) => {
    const off = [1, -2, 2, -1, 0, 2, -2][k % 7];
    const dw = [0, 3, -2, 2, -1, 1, 3][k % 7];
    return <rect key={k} x={RAFT_X + off} y={RAFT_Y + k * rowH} width={RAFT_W + dw} height={rowH - 2} rx="2.5" fill="#fdfaf2" stroke={INK} stroke-width="1" />;
  });
  const rope = (x: number) => {
    const ticks = [];
    for (let y = RAFT_Y + 1; y < RAFT_Y + H; y += 4) ticks.push(`M${x - 1.6} ${y} l3.2 2.4`);
    return (
      <g>
        <path d={`M${x} ${RAFT_Y - 2} V${RAFT_Y + H + 2}`} stroke="#8b7a5c" stroke-width="3" />
        <path d={ticks.join(' ')} stroke={INK} stroke-width="0.6" />
      </g>
    );
  };
  const mx = RAFT_X + RAFT_W - 12;
  return (
    <g class={play ? 'b-o-raft' : undefined}>
      <path d={`M${RAFT_X - 10} ${RAFT_Y + H + 6} Q${RAFT_X + RAFT_W / 2} ${RAFT_Y + H + 12} ${RAFT_X + RAFT_W + 10} ${RAFT_Y + H + 6}`} fill="none" stroke={WL} stroke-width="0.8" />
      <path d={`M${RAFT_X - 2} ${RAFT_Y + H + 11} Q${RAFT_X + RAFT_W / 2} ${RAFT_Y + H + 16} ${RAFT_X + RAFT_W + 2} ${RAFT_Y + H + 11}`} fill="none" stroke={WL} stroke-width="0.6" opacity="0.6" />
      <rect x={RAFT_X + 3} y={RAFT_Y + 3} width={RAFT_W} height={H} fill={INK} opacity="0.12" />
      {planks}
      {rope(RAFT_X + 5)}
      {rope(RAFT_X + RAFT_W - 5)}
      <path d={`M${mx} ${RAFT_Y + 2} V${RAFT_Y - 31}`} stroke={INK} stroke-width="1.5" stroke-linecap="round" />
      <path d={`M${mx} ${RAFT_Y - 30} H${mx - 42} L${mx - 35} ${RAFT_Y - 22.5} L${mx - 42} ${RAFT_Y - 15} H${mx} Z`} fill="#ffffff" stroke={INK} stroke-width="1" stroke-dasharray="3 2" stroke-linejoin="round" />
      <text x={mx - 17} y={RAFT_Y - 18.5} text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: 10.5px; letter-spacing: 0.15em; fill: ${INK}`}>
        白板
      </text>
    </g>
  );
}

/* ================================================================ 联系：国界通向的那条线 */

/*
 * 「两国共用的那段国界，就是两个词之间的联系」：国界一路往北走到海岸，在那里接上一条横跨全岛的尺线，
 * 尺线两头写着两个词（左边大国的词、右边小国的词），联系像地图注记一样写在尺线上方。
 * 揭晓时：一道光沿国界往北跑，到海岸亮起一个测站点，尺线从这里往两边伸出去，两头的词出现，
 * 最后联系从中间往两边显出来。揭晓前只在国界中段挂一个小注记「联系 ？」。
 */

const JX = BX0; // 国界北端，在海岸上
const JY = BY0;
const LX0 = 36;
const LX1 = 354;

/** 按词折行（浏览器会分词的话不拆开词，英文单词也不拆）；行首不放收尾的标点，行尾不放开头的括号。 */
function wrapText(text: string, fs: number, maxW: number): string[] {
  const segs: string[] =
    typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter('zh', { granularity: 'word' }).segment(text), (s) => s.segment)
      : (text.match(/[A-Za-z0-9]+|./gu) ?? []);
  const lines: string[] = [];
  let cur = '';
  for (const seg of segs) {
    const closing = /^[，。、；：！？）」』)”》,.;:!?]/.test(seg);
    if (!cur || closing || textWidth(cur + seg, fs) <= maxW) {
      cur += seg;
      continue;
    }
    let carry = '';
    const m = cur.match(/[（「『(“《]+$/);
    if (m) {
      carry = m[0];
      cur = cur.slice(0, -carry.length);
    }
    lines.push(cur.trimEnd());
    cur = (carry + seg).trimStart();
  }
  if (cur) lines.push(cur.trimEnd());
  return lines;
}

/** 联系怎么排：一行放得下（字不小于 15）就一行；否则在窄一点的宽度里折成两三行（右上角有白板的木筏）。 */
function linkLayout(link: string): { lines: string[]; fs: number; cx: number } {
  const text = link.trim();
  const one = 286 / Math.max(1, textWidth(text, 1));
  if (one >= 15) return { lines: [text], fs: Math.min(24, Math.floor(one)), cx: 207 };
  // 往上长的字不能碰到左上角的图名框（下沿 139）
  for (const fs of [18, 17, 16, 15, 14, 13]) {
    const lines = wrapText(text, fs, 204);
    const top = JY - 10 - (lines.length - 1) * (fs + 5) - fs * 0.85;
    if (lines.length <= 3 && top >= 145) return { lines, fs, cx: 180 };
  }
  return { lines: wrapText(text, 12, 204), fs: 12, cx: 180 };
}

const HALO_PAGE = 'paint-order: stroke; stroke: #fbf3dc; stroke-linejoin: round';

/** 揭晓前：国界中段一个小注记「联系 ？」。fading：揭晓时淡掉。 */
function LinkTag({ fading }: { fading?: boolean }) {
  const x = 170;
  const y = 340;
  return (
    <g class={fading ? 'b-o-untie' : undefined}>
      <path d={`M${MIDX} ${MIDY} L${x + 8} ${y - 6}`} stroke={INK} stroke-width="0.9" />
      <circle cx={MIDX} cy={MIDY} r="3.6" fill="#fbf6e8" stroke={INK} stroke-width="1.3" />
      <text x={x + 4} y={y + 6} text-anchor="end" style={`font-family: var(--serif); font-weight: 900; font-size: 13px; letter-spacing: 0.12em; fill: ${INK}; ${HALO_PAGE}; stroke-width: 5px`}>
        联系 ？
      </text>
    </g>
  );
}

/** 揭晓后：国界接上尺线，两头是两个词，联系写在上面。 */
function LinkLine({ link, big, small, play }: { link: string; big: string; small: string; play: boolean }) {
  const { lines, fs, cx } = linkLayout(link);
  const len = Math.hypot(JX - MIDX, JY - MIDY);
  // 尺线：黑白相间的刻度条，和比例尺一个画法
  const seg = 12;
  const blocks: string[] = [];
  for (let x = LX0, k = 0; x < LX1; x += seg, k++) if (k % 2 === 0) blocks.push(`M${x} ${JY - 1.8} h${Math.min(seg, LX1 - x)} v3.6 h${-Math.min(seg, LX1 - x)} Z`);
  const endW = (w: string) => Math.max(10, Math.min(13, Math.floor(96 / Math.max(1, textWidth(w, 1)))));
  return (
    <g class={play ? 'b-o-link is-play' : 'b-o-link'}>
      {play ? (
        <path
          class="b-o-trace"
          d={`M${MIDX} ${MIDY} L${JX} ${JY}`}
          stroke={INK}
          stroke-width="3.4"
          stroke-linecap="round"
          stroke-dasharray={`22 ${Math.ceil(len) + 60}`}
          style={{ '--len': `${Math.ceil(len)}px` }}
        />
      ) : null}
      <g class="b-o-rule" style={{ '--l': `${(JX - LX0 + 6).toFixed(1)}px`, '--r': `${(LX1 - JX + 6).toFixed(1)}px` }}>
        <path d={`M${LX0} ${JY} H${LX1}`} stroke="#fbf6e8" stroke-width="9" stroke-linecap="round" />
        <rect x={LX0} y={JY - 1.8} width={LX1 - LX0} height="3.6" fill="#fbf6e8" stroke={INK} stroke-width="0.9" />
        <path d={blocks.join(' ')} fill={INK} />
        <path d={`M${LX0} ${JY - 7} V${JY + 7} M${LX1} ${JY - 7} V${JY + 7}`} stroke={INK} stroke-width="1.6" />
      </g>
      <g class="b-o-node">
        <circle cx={JX} cy={JY} r="6.5" fill="#fbf6e8" stroke={INK} stroke-width="1.4" />
        <circle cx={JX} cy={JY} r="2" fill={INK} />
      </g>
      <g class="b-o-ends">
        <text x={LX0} y={JY + 20} style={`font-family: var(--serif); font-weight: 900; font-size: ${endW(big)}px; fill: ${INK}; ${HALO_PAGE}; stroke-width: 4px`}>
          {clip(big, 7)}
        </text>
        <text x={LX1} y={JY + 20} text-anchor="end" style={`font-family: var(--serif); font-weight: 900; font-size: ${endW(small)}px; fill: ${INK}; ${HALO_PAGE}; stroke-width: 4px`}>
          {clip(small, 7)}
        </text>
      </g>
      <g class="b-o-kick">
        <text x={LX0 + 10} y={JY - 22} text-anchor="middle" style={`font-family: var(--serif); font-weight: 700; font-size: 11px; fill: ${MUTED}; ${HALO_PAGE}; stroke-width: 3px`}>
          联
        </text>
        <text x={LX0 + 10} y={JY - 9} text-anchor="middle" style={`font-family: var(--serif); font-weight: 700; font-size: 11px; fill: ${MUTED}; ${HALO_PAGE}; stroke-width: 3px`}>
          系
        </text>
      </g>
      <g class="b-o-words">
        {lines.map((l, i) => (
          <text
            key={i}
            x={cx}
            y={JY - 10 - (lines.length - 1 - i) * (fs + 5)}
            text-anchor="middle"
            style={`font-family: var(--serif); font-weight: 900; font-size: ${fs}px; letter-spacing: 0.06em; fill: ${INK}; ${HALO_PAGE}; stroke-width: 6px`}
          >
            {l}
          </text>
        ))}
      </g>
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
  let raftRows: [number, number] = [1, 19];
  if (open) {
    const members = (f: Faction): Member[] =>
      [...v.players]
        .sort((a, b) => a.seat - b.seat)
        .filter((p) => fOf.get(p.id)?.faction === f)
        .map((p) => ({ id: p.id, name: p.name, me: p.id === v.me.id, out: !p.alive, f }));
    const onRaft = raft(members('blank'));
    raftRows = [onRaft.rows, onRaft.rowH];
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
      {open ? <Raft rows={raftRows[0]} rowH={raftRows[1]} play={play} /> : null}
      {people}
      {open ? null : <LinkTag />}
      {play ? <LinkTag fading /> : null}
      {open ? <LinkLine link={rv.link} big={rv.big} small={rv.small} play={play} /> : null}
    </>
  );
}

/* ================================================================ 名次：地质剖面 */

/*
 * 名次是一张装在图框里的地质剖面：海平面一条线，两头是海；
 * 每一方一座山，山高 = 得分，山顶立一个三角点（测量用的那个 △），上面写名次；
 * 山体是这一方的岩层（大国黄色砂岩的点、小国绿色页岩的短横、白板白色的十字），层理顺着山形弯；
 * 这一方的人挂着一张张小标签（像岩石标本的标签）放在海平面以下的岩层里。三方之间是斜的断层虚线。
 */

const FT = 452; // 图框上沿
const FB = 722; // 图框下沿
const SL = 634; // 海平面
const GB = 712; // 剖面底
const U = 28; // 1 分多高
const SX0 = 24;
const SX1 = 366;
const ZX0 = 54;
const ZX1 = 336;
const SLANT = 9; // 断层往下斜多少

const ROCK: Record<Faction | 'none', { fill: string; mark: string; id: string }> = {
  big: { fill: BIG, mark: '#b98f2c', id: 'pz-big' },
  small: { fill: SMALL, mark: '#5f8b4b', id: 'pz-small' },
  blank: { fill: '#fbf8ef', mark: '#a59b88', id: 'pz-blank' },
  none: { fill: '#e9dfc7', mark: '#c4b592', id: 'pz-none' },
};

function RockPatterns() {
  return (
    <defs>
      <pattern id="pz-big" width="7" height="7" patternUnits="userSpaceOnUse">
        <rect width="7" height="7" fill={ROCK.big.fill} />
        <circle cx="1.8" cy="2" r="0.75" fill={ROCK.big.mark} />
        <circle cx="5.3" cy="5.4" r="0.75" fill={ROCK.big.mark} />
      </pattern>
      <pattern id="pz-small" width="12" height="8" patternUnits="userSpaceOnUse">
        <rect width="12" height="8" fill={ROCK.small.fill} />
        <path d="M1 2.5 H6 M7 6.5 H12" stroke={ROCK.small.mark} stroke-width="0.8" />
      </pattern>
      <pattern id="pz-blank" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill={ROCK.blank.fill} />
        <path d="M2.5 1 V4 M1 2.5 H4 M7.5 6 V9 M6 7.5 H9" stroke={ROCK.blank.mark} stroke-width="0.6" />
      </pattern>
      <pattern id="pz-base" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#d9cfb8" />
        <path d="M0 0 V6" stroke={INK} stroke-width="0.8" opacity="0.55" />
      </pattern>
      <pattern id="pz-none" width="14" height="8" patternUnits="userSpaceOnUse">
        <rect width="14" height="8" fill={ROCK.none.fill} />
        <path d="M0 0.5 H14 M0 4.5 H14 M4 0.5 V4.5 M11 4.5 V8.5" stroke={ROCK.none.mark} stroke-width="0.6" />
      </pattern>
    </defs>
  );
}

/** 一座山的轮廓（高度 h，相对海平面）：折线，不是圆滑的钟形；同一个 seed 每次一样。 */
function ridge(a: number, b: number, h: number, seed: number): [number, number][] {
  const w = b - a;
  const j = (k: number) => {
    const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x) - 0.5;
  };
  const shape: [number, number][] = [
    [0.08, 0.06],
    [0.2, 0.3],
    [0.29, 0.26],
    [0.38, 0.62],
    [0.46, 0.93],
    [0.5, 1],
    [0.55, 0.88],
    [0.62, 0.6],
    [0.7, 0.64],
    [0.8, 0.3],
    [0.91, 0.08],
  ];
  return shape.map(([fx, fh], k) => [a + w * (fx + j(k) * 0.02), Math.max(2, h * fh + (fh < 1 ? j(k + 20) * Math.min(6, h * 0.12) : 0))]);
}

interface Zone {
  f: Faction;
  a: number;
  b: number;
  cx: number;
  pts: number;
  rank: number;
  h: number;
}

function Podium({ g, open, play }: { g: G; open: boolean; play: boolean }) {
  const { v } = g;
  const r = v.result!;
  const rv = v.reveal!;
  const order: Faction[] = [];
  for (const f of r.second) order.push(f);
  if (r.first) order.push(r.first);
  for (const f of r.third) order.push(f);
  for (const f of ['big', 'small', 'blank'] as Faction[]) if (!order.includes(f)) order.push(f);
  // 第一名放中间：第二名们在左，第三名在右
  const zoneW = (ZX1 - ZX0) / order.length;
  const zones: Zone[] = order.map((f, i) => {
    const pts = factionScore(r, f);
    const rank = r.first === f ? 1 : r.second.includes(f) ? 2 : r.third.includes(f) ? 3 : 0;
    return { f, a: ZX0 + i * zoneW, b: ZX0 + (i + 1) * zoneW, cx: ZX0 + (i + 0.5) * zoneW, pts, rank, h: open ? (pts ? pts * U : 13) : 20 };
  });

  // 地表：左边海底 → 三座山（之间是低的鞍部）→ 右边海底
  const surf: [number, number][] = [
    [SX0, SL + 30],
    [SX0 + 12, SL + 26],
    [ZX0 - 8, SL + 9],
    [ZX0 + 2, SL + 2],
  ];
  zones.forEach((z, i) => {
    surf.push(...ridge(z.a, z.b, z.h, i + (open ? 3 : 9)).map(([x, h]) => [x, SL - h] as [number, number]));
    if (i < zones.length - 1) surf.push([z.b, SL - 4]);
  });
  surf.push([ZX1 - 2, SL + 2], [ZX1 + 8, SL + 9], [SX1 - 12, SL + 26], [SX1, SL + 30]);
  const line = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;
  const ground = `${line(surf)} L${SX1} ${GB} L${SX0} ${GB} Z`;
  // 层理：山里顺着山形弯，海平面以下大致水平
  const folds = [0.64, 0.32].map((k) => line(surf.map(([x, y]) => [x, y < SL ? SL - (SL - y) * k : SL + (y - SL) * 0.4])));
  const beds = [16, 33, 52, 71].map((d, i) => `M${SX0} ${SL + d} Q${SX0 + 90} ${SL + d - 3 + i} ${195} ${SL + d} T${SX1} ${SL + d}`);
  // 每一方的岩层：两边是斜的断层
  const cuts = zones.map((z, i) => ({ x0: i === 0 ? SX0 - 1 : z.a, x1: i === zones.length - 1 ? SX1 + 1 : z.b }));
  const block = (c: { x0: number; x1: number }, i: number) =>
    `M${c.x0} ${SL - 120} L${c.x1} ${SL - 120} L${i === zones.length - 1 ? c.x1 : c.x1 + SLANT} ${GB} L${i === 0 ? c.x0 : c.x0 + SLANT} ${GB} Z`;

  const me = rv.players.find((p) => p.id === v.me.id);
  const myZone = zones.find((z) => z.f === me?.faction);
  const top = (z: Zone) => SL - Math.max(...surf.filter(([x]) => x > z.a && x < z.b).map(([, y]) => SL - y));

  const land = (
    <g>
      <RockPatterns />
      <clipPath id="pz-ground">
        <path d={ground} />
      </clipPath>
      {/* 两头的海 */}
      <rect x={SX0} y={SL} width={ZX0 - SX0 + 4} height="32" fill="#c9dcd8" />
      <rect x={ZX1 - 4} y={SL} width={SX1 - ZX1 + 4} height="32" fill="#c9dcd8" />
      <path
        d={`M${SX0 + 2} ${SL + 7} H${ZX0 - 6} M${SX0 + 2} ${SL + 14} H${ZX0 - 16} M${SX0 + 2} ${SL + 21} H${ZX0 - 26} M${ZX1 + 6} ${SL + 7} H${SX1 - 2} M${ZX1 + 16} ${SL + 14} H${SX1 - 2} M${ZX1 + 26} ${SL + 21} H${SX1 - 2}`}
        stroke={WL}
        stroke-width="0.7"
      />
      <path d={`M${SX0} ${SL} H${ZX0 + 4} M${ZX1 - 4} ${SL} H${SX1}`} stroke={WL} stroke-width="1.1" />
      <g clip-path="url(#pz-ground)">
        {zones.map((z, i) => (
          <path d={block(cuts[i], i)} fill={`url(#${(open ? ROCK[z.f] : ROCK.none).id})`} />
        ))}
        <g fill="none" stroke={INK} stroke-width="0.6" opacity="0.32">
          {folds.map((d) => (
            <path d={d} />
          ))}
          {beds.map((d) => (
            <path d={d} />
          ))}
        </g>
        {zones.slice(1).map((z) => (
          <path d={`M${z.a} ${SL - 6} L${z.a + SLANT} ${GB}`} stroke={INK} stroke-width="0.9" stroke-dasharray="4 2.5" />
        ))}
        {/* 最下面一层基岩：三方共用 */}
        <rect x={SX0} y={GB - 11} width={SX1 - SX0} height="11" fill="url(#pz-base)" />
        <path d={`M${SX0} ${GB - 11} H${SX1}`} stroke={INK} stroke-width="0.8" />
      </g>
      <path d={line(surf)} fill="none" stroke={INK} stroke-width={open ? 1.7 : 1.2} stroke-dasharray={open ? undefined : '5 3'} stroke-linejoin="round" />
      <path d={`M${SX0} ${GB} H${SX1}`} stroke={INK} stroke-width="1.3" />
    </g>
  );

  const labels: ComponentChildren[] = [];
  if (open) {
    for (const z of zones) {
      const sy = top(z);
      labels.push(
        <path d={`M${z.cx - 6.5} ${sy + 1} L${z.cx} ${sy - 10} L${z.cx + 6.5} ${sy + 1} Z`} fill={PAGE} stroke={INK} stroke-width="1.3" stroke-linejoin="round" />,
        <circle cx={z.cx} cy={sy - 3.2} r="1.5" fill={INK} />,
        z.rank ? (
          <text x={z.cx} y={sy - 33} text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 20px; fill: #1e1b17">
            {String(z.rank).padStart(2, '0')}
          </text>
        ) : null,
        <text x={z.cx} y={sy - 16} text-anchor="middle" style="fill: #1e1b17">
          <tspan style="font-family: var(--serif); font-weight: 900; font-size: 13px">{FNAME[z.f]}</tspan>
          <tspan dx="4" style="font-family: var(--cond); font-weight: 500; font-size: 13px">
            {z.pts ? `+${z.pts}` : '0'}
          </tspan>
        </text>,
      );
      // 这一方的人：每人一张小标签，按这一格的宽度排成几行；名字太长就截短，白板的分工放得下就写上
      const maxW = zoneW - 8;
      const members = rv.players.filter((p) => p.faction === z.f);
      const build = (fs: number, max: number) => {
        const tags = members.map((p) => {
          const mine = p.id === v.me.id;
          const label = clip(g.name(p.id), max);
          let role = z.f === 'blank' && p.role && p.role !== 'both' ? ROLE[p.role].replace('白板', '') : '';
          const base = 15 + textWidth(label, fs) + (mine ? 12 : 0);
          if (role && base + 3 + textWidth(role, fs - 1.5) > maxW) role = '';
          return { id: p.id, me: mine, out: !v.players.find((x) => x.id === p.id)?.alive, label, role, fs, w: Math.min(maxW, base + (role ? 3 + textWidth(role, fs - 1.5) : 0)) };
        });
        const rows: (typeof tags)[] = [];
        let row: typeof tags = [];
        let used = 0;
        for (const t of tags) {
          if (row.length && used + 4 + t.w > maxW) {
            rows.push(row);
            row = [];
            used = 0;
          }
          used += (row.length ? 4 : 0) + t.w;
          row.push(t);
        }
        if (row.length) rows.push(row);
        return rows;
      };
      let rows = build(11.5, 6);
      if (rows.length > 3) rows = build(10.5, 4);
      if (rows.length > 3) rows = build(10, 3);
      const step = rows.length > 3 ? 16 : 19;
      const th = rows.length > 3 ? 14 : 16;
      rows.forEach((ln, i) => {
        const total = ln.reduce((acc, t) => acc + t.w, 0) + (ln.length - 1) * 4;
        let x = z.cx + SLANT / 2 - total / 2;
        const y = SL + 9 + i * step;
        for (const t of ln) {
          labels.push(
            <g key={t.id}>
              <rect x={x} y={y} width={t.w} height={th} rx="2" fill={PAGE} stroke={t.me ? 'var(--acc)' : INK} stroke-width={t.me ? 1.4 : 0.8} stroke-dasharray={t.out && !t.me ? '2.5 1.5' : undefined} />
              <circle cx={x + 5} cy={y + th / 2} r="1.6" fill="none" stroke={INK} stroke-width="0.7" />
              <text x={x + 9.5} y={y + th / 2 + t.fs * 0.36} style={`font-family: var(--serif); font-weight: 700; font-size: ${t.fs}px; fill: ${t.out ? '#6f6656' : INK}`}>
                {t.label}
                {t.me ? (
                  <tspan dx="1.5" style="font-family: var(--sans); font-size: 9.5px; fill: var(--acc-text)">
                    你
                  </tspan>
                ) : null}
                {t.role ? (
                  <tspan dx="3" style={`font-family: var(--sans); font-weight: 400; font-size: ${t.fs - 1.5}px; fill: ${MUTED}`}>
                    {t.role}
                  </tspan>
                ) : null}
              </text>
            </g>,
          );
          x += t.w + 4;
        }
      });
    }
  } else {
    for (const z of zones) {
      labels.push(
        <text x={z.cx} y={top(z) - 10} text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: 18px; fill: ${MUTED}`}>
          ?
        </text>,
      );
    }
    labels.push(
      <text x="195" y={SL + 40} text-anchor="middle" style={`font-size: 11.5px; fill: ${INK}; paint-order: stroke; stroke: ${ROCK.none.fill}; stroke-width: 4px; stroke-linejoin: round`}>
        揭晓联系之后，名次和每个人的身份一起公布
      </text>,
    );
  }

  return (
    <Layer label={open ? '名次：一张地质剖面，山越高名次越前' : '名次还没揭晓'}>
      {/* 图框（双线）、标题和竖向比例尺 */}
      <rect x="20" y={FT} width="350" height={FB - FT} fill={PAGE} stroke={INK} stroke-width="1.2" />
      <rect x="23.5" y={FT + 3.5} width="343" height={FB - FT - 7} fill="none" stroke={INK} stroke-width="0.5" />
      <text x="36" y={FT + 25} style="font-family: var(--serif); font-weight: 900; font-size: 17px; letter-spacing: 0.35em; fill: #1e1b17">
        名次
      </text>
      <text x="94" y={FT + 24} style={`font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.06em; fill: ${MUTED}`}>
        剖面 · 山越高名次越前
      </text>
      {open && myZone ? (
        <text x="354" y={FT + 24} text-anchor="end" style="font-size: 11px; fill: #1e1b17">
          <tspan style="font-weight: 700; fill: var(--acc-text)">你</tspan> {FNAME[myZone.f]} · {myZone.rank ? `第${'一二三'[myZone.rank - 1]}名` : '平局'} {myZone.pts ? `+${myZone.pts}` : '0'}
        </text>
      ) : (
        <text x="354" y={FT + 24} text-anchor="end" style={`font-size: 11px; fill: ${MUTED}`}>
          {open ? '' : '还没揭晓'}
        </text>
      )}
      <path d={`M36 ${FT + 33} H354`} stroke={INK} stroke-width="0.8" />
      <g stroke={WL} stroke-width="0.7">
        <path d={`M${SX0 + 8} ${SL} V${SL - 3 * U}`} />
        {[0, 1, 2, 3].map((k) => (
          <path d={`M${SX0 + 8} ${SL - k * U} h${k === 1 || k === 3 || k === 0 ? 6 : 3}`} />
        ))}
      </g>
      {[
        [1, '+1'],
        [3, '+3'],
      ].map(([k, t]) => (
        <text x={SX0 + 17} y={SL - (k as number) * U + 3} style={`font-family: var(--mono); font-size: 8px; fill: ${WL}`}>
          {t}
        </text>
      ))}
      <g class={play ? 'b-o-land' : undefined}>{land}</g>
      <g class={play ? 'b-o-tags' : undefined}>{labels}</g>
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
          <path d="M3 13 H27 M3 8 V18 M27 8 V18" />
          <path d="M19 13 L12 26" stroke-dasharray="2.5 2" />
          <circle cx="19" cy="13" r="2.6" fill="#ffffff" />
        </svg>
        <span class="b-o-label">
          <b>{holding ? '再按一会儿…' : '按住揭晓联系'}</b>
          <small>按满 1.4 秒，揭开两个词之间的联系 · 大家一起看</small>
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
      <Layer label={open ? `结算：大国的词${v.reveal.big}，小国的词${v.reveal.small}，联系是${v.reveal.link}` : `结算：大国的词${v.reveal.big}，小国的词${v.reveal.small}，联系还没揭晓`}>
        <ResultMap g={g} open={open} play={play} />
      </Layer>
      <Podium g={g} open={open} play={play} />
      {open ? (
        <TitleBlock kicker="游戏结束" title={TITLE_OF(v.result)} sub="大家回到了各自的阵营；国界通向的那条线上，写着两个词之间的联系" size={26} />
      ) : (
        <TitleBlock kicker="游戏结束" title="谜底" sub="两个词都摆在这儿了，它们之间的联系还没揭晓" />
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
