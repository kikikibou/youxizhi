/**
 * 按住看词：一张竖着对折的身份图。按住时折好的图放到切割垫上、沿中间的折痕打开；
 * 松手就折回去、收走。
 * 国家玩家：岛上写着你的词，旁边一块虚线的「?」是另一国；①② 两条规则提示；下面是本局人数。
 * 白板：空白的图上写身份，下面是要做的事、今晚的任务、裁判私下的回答。
 */

import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import { PRESETS } from '../engine/rules.ts';
import type { PlayerView } from '../engine/view.ts';
import type { Snapshot } from './net.ts';
import { ANSWER, ROLE, ROLE_DUTY } from './text.ts';
import { BIG, INK, MUTED, SMALL, Stage, WL } from './board.tsx';
import { flags } from './flags.ts';

const W = 350;
const H = 664;
const HALF = W / 2;
const SEA = '#d4e3e1';

/** 按住的手势：按下打开，松手 / 取消 / 失去捕获就合上。展开到任何按钮上。 */
export function holdHandlers(set: (on: boolean) => void) {
  return {
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* 不支持就算了 */
      }
      set(true);
    },
    onPointerUp: () => set(false),
    onPointerCancel: () => set(false),
    onLostPointerCapture: () => set(false),
    onKeyDown: (e: KeyboardEvent) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && set(true),
    onKeyUp: () => set(false),
    onContextMenu: (e: Event) => e.preventDefault(),
  };
}

/** 一块不规则的陆地（和设计稿一样的做法：椭圆上叠几道正弦）。 */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number, grow = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 96; i++) {
    const t = (2 * Math.PI * i) / 96;
    const r = 1 + 0.09 * Math.sin(3 * t + seed) + 0.06 * Math.sin(5 * t + 2 * seed) + 0.035 * Math.sin(9 * t + seed * 3);
    pts.push(`${(cx + (rx * r + grow) * Math.cos(t)).toFixed(1)} ${(cy + (ry * r + grow) * Math.sin(t)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

function mark(x: number, y: number, n: number) {
  return (
    <g>
      <circle cx={x} cy={y} r="8.5" fill={INK} stroke="#fbf3dc" stroke-width="2" />
      <text x={x} y={y + 3.6} text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 11px; fill: #ffffff">
        {n}
      </text>
    </g>
  );
}

function wordSize(word: string, room: number, max: number) {
  return Math.max(16, Math.min(max, Math.floor(room / Math.max(1, Array.from(word).length) / 1.5)));
}

interface Info {
  v: PlayerView;
  code: string;
  comp: { big: number; small: number; blank: number } | null;
}

function headCount(y: number, comp: Info['comp']) {
  if (!comp) return null;
  const people: [string, number, string][] = [
    ['大国', comp.big, BIG],
    ['小国', comp.small, SMALL],
    ['白板', comp.blank, '#fdfaf2'],
  ];
  const n = comp.big + comp.small + comp.blank;
  const x0 = 16;
  const x1 = 334;
  const seg = (x1 - x0) / n;
  const barY = y + 34;
  const out: ComponentChildren[] = [];
  let i = 0;
  for (const [name, c, fill] of people) {
    const gx0 = x0 + i * seg;
    const gx1 = x0 + (i + c) * seg;
    for (let k = 0; k < c; k++) out.push(<rect x={x0 + (i + k) * seg} y={barY} width={seg} height="18" fill={fill} stroke={INK} stroke-width="0.6" />);
    out.push(
      <text x={(gx0 + gx1) / 2} y={barY - 7} text-anchor="middle" style={`fill: ${INK}`}>
        <tspan style="font-family: var(--serif); font-weight: 900; font-size: 13px">{name}</tspan>
        <tspan dx="5" style="font-family: var(--cond); font-weight: 500; font-size: 18px">
          {c}
        </tspan>
      </text>,
    );
    out.push(<path d={`M${gx0} ${barY - 4} V${barY + 22}`} stroke={INK} stroke-width="1.4" />);
    i += c;
  }
  return (
    <g>
      <path d={`M${x0} ${y - 16} H${x1}`} stroke={INK} stroke-width="1.4" />
      <text x={x0} y={y} style="font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: 0.3em; fill: #1e1b17">
        本局人数
      </text>
      <text x={x1} y={y} text-anchor="end" style={`font-family: var(--mono); font-size: 10px; fill: ${MUTED}`}>
        共 {n} 人
      </text>
      {out}
      <path d={`M${x1} ${barY - 4} V${barY + 22}`} stroke={INK} stroke-width="1.4" />
      <rect x={x0} y={barY} width={x1 - x0} height="18" fill="none" stroke={INK} stroke-width="1.2" />
      {Array.from({ length: n + 1 }, (_, k) => (
        <text x={x0 + k * seg} y={barY + 31} text-anchor="middle" style={`font-family: var(--mono); font-size: 8px; fill: ${MUTED}`}>
          {k}
        </text>
      ))}
    </g>
  );
}

/** 打开的身份图（350 × 664 的 SVG）。 */
function Inside({ v, code, comp }: Info) {
  const blank = v.me.blank;
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  const fx0 = 16;
  const fy0 = 104;
  const fx1 = 334;
  const fy1 = blank ? 322 : 404;
  const grid: string[] = [];
  for (let x = fx0 + 53; x < fx1; x += 53) grid.push(`M${x} ${fy0} V${fy1}`);
  for (let y = fy0 + 52; y < fy1; y += 52) grid.push(`M${fx0} ${y} H${fx1}`);
  const mates = blank?.teammates ?? [];
  const cells: ComponentChildren[] = [];
  const slots = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ];
  const mateAt = [2, 0, 7, 5];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x = 16 + c * 25;
      const y = 16 + r * 17;
      const mid = r === 1 && c === 1;
      const si = slots.findIndex(([a, b]) => a === r && b === c);
      const mi = mateAt.indexOf(si);
      const mate = !mid && mi >= 0 && mi < mates.length ? mates[mi] : null;
      const label = mid ? '你' : mate ? Array.from(name(mate.id)).slice(0, 2).join('') : '?';
      cells.push(
        <g key={`${r}${c}`}>
          <rect x={x} y={y} width="25" height="17" fill={mid ? INK : mate ? '#e9dcc0' : 'none'} stroke={INK} stroke-width="0.7" />
          <text x={x + 12.5} y={y + 12} text-anchor="middle" style={`font-size: ${mate ? 8.5 : 9}px; font-weight: 700; fill: ${mid ? '#ffffff' : mate ? INK : '#a59b88'}`}>
            {label}
          </text>
        </g>,
      );
    }
  }
  const matesLine = blank ? (mates.length ? mates.map((m) => `${name(m.id)}${m.role ? ` · ${ROLE[m.role]}` : ''}`).join('、') : '看不到队友') : '不知道';
  const halo = 'paint-order: stroke; stroke: #fbf3dc; stroke-linejoin: round';
  let body: ComponentChildren;
  let countY: number;
  if (blank) {
    const cy = (fy0 + fy1) / 2;
    const len = blank.bigLen ?? 0;
    const bs = Math.max(9, Math.min(20, Math.floor(190 / Math.max(1, len)) - 4));
    const bx0 = 175 - (len * (bs + 4) - 4) / 2;
    const night = v.step.k === 'night' ? v.step : null;
    const answers = v.log.filter((e): e is Extract<typeof e, { t: 'answer' }> => e.t === 'answer');
    const rows: { k: string; v: ComponentChildren; ans?: string }[] = [
      { k: '要做的', v: ROLE_DUTY[blank.role] },
      { k: '目标', v: len ? `猜中大国的词（${len} 个字）` : '猜中大国的词' },
    ];
    if (night?.decides.length) {
      rows.push({
        k: '今晚',
        v: <tspan style="font-weight: 700; fill: var(--acc-text)">由你决定：明天{night.decides.map((d) => (d === 'start' ? '从谁开始' : '按什么方向')).join('、')}</tspan>,
      });
    }
    for (const a of answers.slice(-3)) rows.push({ k: '裁判', v: `私下回答你：「${a.question}」`, ans: ANSWER[a.answer] });
    const ry = fy1 + 20;
    const role = ROLE[blank.role];
    body = (
      <g>
        <rect x={fx0} y={fy0} width={fx1 - fx0} height={fy1 - fy0} fill="#fdfaf2" />
        <path d={grid.join(' ')} fill="none" stroke="#b9b09d" stroke-width="0.5" stroke-dasharray="2 3" />
        <rect x="66" y={cy - 62} width="218" height="124" fill="none" stroke="#a59b88" stroke-width="1" stroke-dasharray="6 4" />
        <text x="179" y={cy - 18} text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 32px; letter-spacing: 0.24em; fill: #1e1b17">
          {role}
        </text>
        <text x="175" y={cy + 4} text-anchor="middle" style={`font-size: 11px; fill: ${MUTED}`}>
          你没有词，但知道大国的词有几个字
        </text>
        {len ? (
          <g>
            {Array.from({ length: len }, (_, k) => (
              <rect key={k} x={bx0 + k * (bs + 4)} y={cy + 14} width={bs} height={bs} fill="#ffffff" stroke={INK} stroke-width="1.2" />
            ))}
            <text x="175" y={cy + 14 + bs + 17} text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 13px; fill: #1e1b17">
              大国的词 · {len} 个字
            </text>
          </g>
        ) : null}
        <path d={`M16 ${ry} H334`} stroke={INK} stroke-width="1.4" />
        {rows.map((row, k) => {
          const top = ry + k * 36;
          const ansW = row.ans ? Array.from(row.ans).length * 12 + 8 : 0;
          return (
            <g key={k}>
              <text x="16" y={top + 23} style={`font-size: 10.5px; letter-spacing: 0.1em; fill: ${MUTED}`}>
                {row.k}
              </text>
              <text x="66" y={top + 23} style="font-size: 12px; fill: #1e1b17">
                {row.v}
              </text>
              {row.ans ? (
                <g>
                  <rect x={334 - ansW} y={top + 10} width={ansW} height="17" fill={INK} />
                  <text x={334 - ansW / 2} y={top + 23} text-anchor="middle" style="font-size: 11.5px; font-weight: 700; fill: #ffffff">
                    {row.ans}
                  </text>
                </g>
              ) : null}
              <path d={`M16 ${top + 36} H334`} stroke="#d8ceb7" stroke-width="0.75" />
            </g>
          );
        })}
      </g>
    );
    countY = ry + rows.length * 36 + 44;
  } else {
    const word = v.me.word ?? '';
    const land = blob(146, 240, 100, 74, 1.3);
    const other = blob(340, 394, 84, 64, 2.1);
    const fs = wordSize(word, 220, 46);
    const ny = fy1 + 30;
    body = (
      <g>
        <defs>
          <pattern id="id-unk" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="12" fill={BIG} />
            <rect x="6" width="6" height="12" fill={SMALL} />
          </pattern>
          <pattern id="id-oth" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <path d="M0 3.5 H7" stroke="#b9b09d" stroke-width="0.8" />
          </pattern>
          <clipPath id="id-frame">
            <rect x={fx0} y={fy0} width={fx1 - fx0} height={fy1 - fy0} />
          </clipPath>
        </defs>
        <g clip-path="url(#id-frame)">
          <rect x={fx0} y={fy0} width={fx1 - fx0} height={fy1 - fy0} fill={SEA} />
          <g fill="none" stroke={WL} stroke-width="0.6">
            {[5, 10, 15, 20, 26].map((k) => (
              <path d={blob(146, 240, 100, 74, 1.3, k)} opacity={(1 - k / 30).toFixed(2)} />
            ))}
          </g>
          <g fill="none" stroke={WL} stroke-width="0.6" stroke-dasharray="3 3">
            {[6, 13].map((k) => (
              <path d={blob(340, 394, 84, 64, 2.1, k)} opacity={(0.8 - k / 30).toFixed(2)} />
            ))}
          </g>
          <path d={other} fill="#f3ecda" />
          <path d={other} fill="url(#id-oth)" />
          <path d={other} fill="none" stroke={INK} stroke-width="1.2" stroke-dasharray="6 3.5" />
          <path d={land} fill="url(#id-unk)" />
          <g fill="none" stroke={INK} stroke-width="0.6" opacity="0.35">
            {[12, 24, 36, 48].map((k) => (
              <path d={blob(146, 240, 100, 74, 1.3, -k)} />
            ))}
          </g>
          <path d={land} fill="none" stroke={INK} stroke-width="1.4" />
          <path d="M232 290 C252 300 262 318 270 340" fill="none" stroke={INK} stroke-width="1.3" stroke-linecap="round" stroke-dasharray="0.1 4.5" />
          <path d={grid.join(' ')} fill="none" stroke={WL} stroke-width="0.4" stroke-dasharray="2 3" opacity="0.7" />
          <text x="300" y="386" text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: 30px; fill: ${MUTED}`}>
            ?
          </text>
        </g>
        <text x={146 + fs * 0.25} y={240 + fs * 0.36} text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: ${fs}px; letter-spacing: 0.5em; fill: #1e1b17; ${halo}; stroke-width: 7px`}>
          {word}
        </text>
        {mark(54, 196, 1)}
        {mark(276, 352, 2)}
        <g transform={`translate(28 ${fy1 - 38})`}>
          <rect width="166" height="28" fill="#fbf6ea" stroke={INK} stroke-width="0.7" />
          <rect x="7" y="7" width="20" height="14" fill="url(#id-unk)" stroke={INK} stroke-width="0.6" />
          <text x="34" y="18.5" style="font-size: 10.5px; font-weight: 700; fill: #1e1b17">
            你有可能是大国或者小国
          </text>
        </g>
        <path d={`M16 ${ny - 16} H334`} stroke={INK} stroke-width="1.4" />
        <text x="16" y={ny} style="font-family: var(--serif); font-weight: 700; font-size: 12px; letter-spacing: 0.3em; fill: #1e1b17">
          规则提示
        </text>
        {mark(24, ny + 20, 1)}
        <text x="40" y={ny + 24} style="font-size: 12px; fill: #1e1b17">
          与你同一国的玩家，会拿到与你相同的词语：「<tspan style="font-weight: 700">{word}</tspan>」
        </text>
        {mark(24, ny + 46, 2)}
        <text x="40" y={ny + 50} style="font-size: 12px; fill: #1e1b17">
          与你不同国的玩家，会拿到另一个与「<tspan style="font-weight: 700">{word}</tspan>」
        </text>
        <text x="40" y={ny + 68} style="font-size: 12px; fill: #1e1b17">
          存在微妙联系的词语
        </text>
      </g>
    );
    countY = ny + 116;
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden="true">
      <defs>
        <pattern id="id-bh" x={fx0 - 4} y="0" width="32" height="10" patternUnits="userSpaceOnUse">
          <rect width="16" height="10" fill={INK} />
        </pattern>
        <pattern id="id-bv" x="0" y={fy0} width="10" height="32" patternUnits="userSpaceOnUse">
          <rect y="16" width="10" height="16" fill={INK} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#f6efdd" />
      {cells}
      <text x="16" y="83" style={`font-size: 8.5px; fill: ${MUTED}`}>
        队友：{matesLine}
      </text>
      <text x="183" y="48" text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 24px; letter-spacing: 0.35em; fill: #1e1b17">
        你的词语
      </text>
      <text x="175" y="70" text-anchor="middle" style={`font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.08em; fill: ${MUTED}`}>
        {code} · {v.me.name} · 第 {v.day} {v.step.k === 'night' ? '夜' : '天'}
      </text>
      <rect x="268" y="16" width="66" height="20" fill="none" stroke={INK} stroke-width="1" />
      <rect x="270" y="18" width="62" height="16" fill="none" stroke={INK} stroke-width="0.5" />
      <text x="301" y="30" text-anchor="middle" style="font-size: 10.5px; font-weight: 700; letter-spacing: 0.2em; fill: #1e1b17">
        仅你可见
      </text>
      <rect x={fx0 - 6} y={fy0 - 6} width={fx1 - fx0 + 12} height={fy1 - fy0 + 12} fill="none" stroke={INK} stroke-width="1.3" />
      <rect x={fx0 - 4} y={fy0 - 4} width={fx1 - fx0 + 8} height="4" fill="url(#id-bh)" />
      <rect x={fx0 - 4} y={fy1} width={fx1 - fx0 + 8} height="4" fill="url(#id-bh)" />
      <rect x={fx0 - 4} y={fy0} width="4" height={fy1 - fy0} fill="url(#id-bv)" />
      <rect x={fx1} y={fy0} width="4" height={fy1 - fy0} fill="url(#id-bv)" />
      <rect x={fx0} y={fy0} width={fx1 - fx0} height={fy1 - fy0} fill="none" stroke={INK} stroke-width="0.6" />
      {body}
      {headCount(countY, comp)}
      {v.me.alive ? null : (
        <g transform="translate(250 82) rotate(-8)">
          <rect x="-36" y="-14" width="72" height="24" fill="none" stroke="var(--acc)" stroke-width="1.6" />
          <text y="3" text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 13px; letter-spacing: 0.3em; fill: var(--acc-text)">
            已出局
          </text>
        </g>
      )}
      <text x="334" y={H - 14} text-anchor="end" style="font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: 0.3em; fill: #1e1b17">
        大国小国 · 圆桌岛
      </text>
      <text x="16" y={H - 14} style={`font-family: var(--mono); font-size: 8px; fill: ${MUTED}`}>
        图幅 {code}-{v.day}
      </text>
    </svg>
  );
}

/** 封面（合上时看到的一面）：每个人都一样。 */
function Cover({ v, code }: { v: PlayerView; code: string }) {
  return (
    <svg width={HALF} height={H} viewBox={`0 0 ${HALF} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden="true">
      <rect width={HALF} height={H} fill="#ede1c6" />
      <rect x="8" y="8" width={HALF - 16} height={H - 16} fill="none" stroke={INK} stroke-width="1.3" />
      <rect x="12" y="12" width={HALF - 24} height={H - 24} fill="none" stroke={INK} stroke-width="0.5" />
      <path d="M12 12 H104 L70 76 H12 Z" fill={BIG} />
      <path d={`M104 12 H${HALF - 12} V76 H70 Z`} fill={SMALL} />
      <path d="M104 12 L70 76" stroke={INK} stroke-width="1.6" />
      <path d={`M12 76 H${HALF - 12}`} stroke={INK} stroke-width="1.2" />
      {Array.from('你的词语').map((ch, i) => (
        <text x={HALF / 2} y={150 + i * 54} text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 46px; fill: #1e1b17">
          {ch}
        </text>
      ))}
      <text x={HALF / 2} y="358" text-anchor="middle" style="font-size: 12.5px; fill: #1e1b17">
        持图人 <tspan style="font-family: var(--serif); font-weight: 900; font-size: 16px">{v.me.name}</tspan>
      </text>
      <text x={HALF / 2} y="378" text-anchor="middle" style={`font-family: var(--mono); font-size: 9px; fill: ${MUTED}`}>
        {code} 号房 · 第 {v.day} 天
      </text>
    </svg>
  );
}

/** 不想看动画的设置。 */
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 收起要多久（折回去 + 收走），和 game.css 里 .b-id 的过渡一致。 */
const CLOSE_MS = 480;

/** 按住时的整屏：切割垫上，身份图放上来、从中间的折痕打开。open = false 时折回去、收走。 */
export function IdentityOverlay({ v, snap, open }: { v: PlayerView; snap: Snapshot; open: boolean }) {
  const code = snap.room?.code ?? '····';
  const n = v.players.length;
  const comp = snap.room?.settings.composition ?? PRESETS[n] ?? null;
  return (
    <div class={`b-overlay b-id ${open ? 'is-open' : ''}`} aria-live="polite" aria-hidden={!open}>
      <Stage bg="mat" frame={false} label="你的身份（只在按住时显示）">
        <div class="b-id-lift">
          <div class="b-id-sheet">
            <div class="b-id-half">
              <Inside v={v} code={code} comp={comp} />
            </div>
            <div class="b-id-flap">
              <div class="b-id-face">
                <div style={{ position: 'absolute', left: `-${HALF}px`, top: 0, width: `${W}px`, height: `${H}px` }}>
                  <Inside v={v} code={code} comp={comp} />
                </div>
              </div>
              <div class="b-id-face b-id-back">
                <Cover v={v} code={code} />
              </div>
            </div>
            <i class="b-id-crease" aria-hidden="true" />
          </div>
        </div>
        <div class="b-id-bar" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round">
            <path d="M3 7 L15 10 L27 7 V24 L15 27 L3 24 Z" />
            <path d="M15 10 V27" stroke-dasharray="2.5 2" />
          </svg>
          <span>
            <b>看着呢</b>
            <small>松手就合上，别让旁边的人瞄到</small>
          </span>
        </div>
      </Stage>
    </div>
  );
}

/**
 * 管身份图什么时候在屏幕上：按下时先放上来（合着），下一帧开始打开；
 * 松手后折回去，折完再拿掉。预览里一开始就按着的（flags.hold）直接是打开的样子。
 */
export function IdentityLayer({ on, v, snap }: { on: boolean; v: PlayerView; snap: Snapshot }) {
  const [shown, setShown] = useState(on);
  const [open, setOpen] = useState(on && (flags.hold || flags.still));
  useLayoutEffect(() => {
    if (on) {
      setShown(true);
      return;
    }
    setOpen(false);
    const t = window.setTimeout(() => setShown(false), reduced() ? 0 : CLOSE_MS);
    return () => clearTimeout(t);
  }, [on]);
  useLayoutEffect(() => {
    if (!on || !shown || open) return;
    // 先让浏览器把「合着」的样子算出来，再换成打开，过渡才会从合着开始
    void document.body.offsetWidth;
    setOpen(true);
  }, [on, shown, open]);
  return shown ? <IdentityOverlay v={v} snap={snap} open={open} /> : null;
}
