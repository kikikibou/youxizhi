/**
 * 大厅。上面一屏是设计稿：圆桌岛地形图上围着圆桌的 12 个座位（进来的人按顺序坐上去，空位是虚线圈），
 * 主持人坐在罗盘上；左下角「本局设置」图例，右边人数刻度尺；房主是「开始游戏」，其他人是一条「等房主开始」的飘带。
 * 往下滚是邀请票（二维码在存根上）、成员名册、规则说明、口令、主持人的出题表、改名和离开。
 */

import type { ComponentChildren, RefObject } from 'preact';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { renderSVG } from 'uqr';
import { DEFAULT_TIMERS, MAX_PLAYERS, MIN_PLAYERS, PRESETS, compositionError, type Composition, type Timers } from '../engine/rules.ts';
import type { CustomPair, MemberView, RoomSettings, RoomView } from '../shared/protocol.ts';
import type { RoomConnection, Snapshot } from './net.ts';
import { RULE_INFO } from './text.ts';
import { TOPO_ART } from './art.ts';
import { Art, Layer, Stage, pad2, textWidth } from './board.tsx';
import { ringPoint } from './seats.ts';
import { RulesTour } from './tour.tsx';

/* ================================================================ 节奏档位（和 A 版同一套算法） */

/** 计时档位：在默认时长上整体乘一个系数（出局最短展示、冷却、裁判等待不变）。 */
const SCALED: (keyof Timers)[] = ['night', 'clue', 'discussion', 'vote', 'exitChoice', 'turn', 'reliefAsk', 'reliefGuess', 'hintInterval', 'bigChance'];
const PACES = [
  { id: 'untimed', label: '不限时' },
  { id: 'fast', label: '紧凑', k: 2 / 3 },
  { id: 'normal', label: '标准', k: 1 },
  { id: 'slow', label: '宽松', k: 1.5 },
] as const;
function paceTimers(k: number): Timers {
  const t = { ...DEFAULT_TIMERS };
  for (const key of SCALED) t[key] = Math.round((DEFAULT_TIMERS[key] * k) / 1000) * 1000;
  return t;
}
function currentPace(s: RoomSettings): string | null {
  if (s.untimed) return 'untimed';
  return PACES.find((p) => 'k' in p && SCALED.every((key) => paceTimers(p.k)[key] === s.timers[key]))?.id ?? null;
}

/** 'anthropic/claude-opus-5.5' → 'Claude Opus 5.5' */
function modelName(id: string | null): string {
  if (!id) return '未知模型';
  return id
    .replace(/^.*\//, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function shareLink(code: string): string {
  return `${location.origin}${location.pathname}#/${code}`;
}

async function copyLink(link: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(link);
    return true;
  } catch {
    prompt('复制这个链接', link);
    return false;
  }
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ================================================================ 座位 */

/** 设计稿里 12 个座位的位置（围着岛中间的圆桌，0 号在最上面，顺时针）。 */
const SLOTS: [number, number][] = [
  [195, 209.9],
  [246.7, 228.4],
  [274.8, 272],
  [314.6, 318],
  [290.7, 373.3],
  [244.9, 404.4],
  [195, 413.9],
  [143.3, 407.5],
  [90.5, 378.3],
  [98.6, 318],
  [106.5, 266.9],
  [141.5, 225.4],
];
/** 每个座位的名字放在哪。 */
const LABELS: [number, number, 'start' | 'middle' | 'end'][] = [
  [195, 188, 'middle'],
  [262, 232, 'start'],
  [292, 276, 'start'],
  [332, 322, 'start'],
  [308, 378, 'start'],
  [262, 415, 'start'],
  [195, 443, 'middle'],
  [128, 419, 'end'],
  [73, 383, 'end'],
  [81, 322, 'end'],
  [89, 271, 'end'],
  [124, 228, 'end'],
];

function slot(i: number, n: number): { x: number; y: number; lx: number; ly: number; anchor: 'start' | 'middle' | 'end' } {
  if (n <= 12) {
    const [x, y] = SLOTS[i];
    const [lx, ly, anchor] = LABELS[i];
    return { x, y, lx, ly, anchor };
  }
  const p = ringPoint(i, n, 202, 312, 112, 102);
  const c = Math.cos(p.a);
  const s = Math.sin(p.a);
  const anchor = Math.abs(c) < 0.3 ? 'middle' : c > 0 ? 'start' : 'end';
  return { x: p.x, y: p.y, lx: p.x + (anchor === 'middle' ? 0 : c * 15), ly: p.y + s * 18 + (anchor === 'middle' ? (s < 0 ? -2 : 10) : 4.5), anchor };
}

/** 名字太长时缩小字号，免得跑出图框。 */
function fitSize(text: string, x: number, anchor: 'start' | 'middle' | 'end', base = 13.5): number {
  const avail = anchor === 'start' ? 370 - x : anchor === 'end' ? x - 20 : 2 * Math.min(x - 20, 370 - x);
  const w = textWidth(text, 1);
  return Math.max(9, Math.min(base, avail / w));
}

const LBL = 'font-family: var(--serif); font-weight: 700; paint-order: stroke; stroke: #d4e3e1; stroke-width: 3.2px; stroke-linejoin: round';
const CAP = 'font-size: 9.5px; font-weight: 500; fill: #3b362f; paint-order: stroke; stroke: #d4e3e1; stroke-width: 2.8px; stroke-linejoin: round';

function SeatMap({ room, players, moderator }: { room: RoomView; players: MemberView[]; moderator: MemberView | null }) {
  const n = players.length;
  const slots = Math.max(12, n);
  const empty = Math.max(0, MAX_PLAYERS - n);
  const meIsMod = !!moderator && moderator.id === room.me;
  return (
    <Layer label={`大厅：${n} 个人围着圆桌岛坐${empty ? `，还有 ${empty} 个空位` : ''}${meIsMod ? '；你是主持人，坐在罗盘上' : ''}`}>
      <g stroke="#5d564c" fill="none" stroke-width="1.2" stroke-dasharray="2.4 2.4" opacity="0.8">
        {Array.from({ length: slots - n }, (_, k) => {
          const p = slot(n + k, slots);
          return <circle key={k} cx={p.x} cy={p.y} r="8" />;
        })}
      </g>
      {players.map((m, i) => {
        const p = slot(i, slots);
        const me = m.id === room.me;
        const off = !m.online;
        const label = me ? `${m.name}（你）` : m.name;
        const size = fitSize(label, p.lx, p.anchor);
        const tags = [m.host ? '房主' : '', off ? '离线' : ''].filter(Boolean).join(' · ');
        const capY = p.anchor === 'middle' && p.y < 312 ? p.ly - 15 : p.ly + 13;
        const tw = textWidth(tags, 9.5);
        const triX = p.anchor === 'start' ? p.lx + 5 : p.anchor === 'end' ? p.lx - tw - 9 : p.lx - tw / 2 - 4;
        return (
          <g key={m.id}>
            {me ? (
              <>
                <circle cx={p.x} cy={p.y} r="10.5" fill="#f6efde" stroke="var(--acc)" stroke-width="2.6" />
                <circle cx={p.x} cy={p.y} r="15" fill="none" stroke="var(--acc)" stroke-width="1" opacity="0.55" />
                <circle cx={p.x} cy={p.y} r="4.8" fill="var(--acc)" />
              </>
            ) : (
              <circle cx={p.x} cy={p.y} r="9" fill={off ? '#ebe4d2' : '#f6efde'} stroke={off ? '#8b8273' : '#1e1b17'} stroke-width="1.6" stroke-dasharray={off ? '3 2' : undefined} />
            )}
            <text x={p.lx} y={p.ly} text-anchor={p.anchor} style={`${LBL}; font-size: ${size}px; fill: ${me ? 'var(--acc-text)' : off ? '#8b8273' : '#1e1b17'}`}>
              {label}
            </text>
            {tags ? (
              <>
                {m.host ? (
                  <>
                    <path d={`M${triX - 5} ${capY + 1} L${triX} ${capY - 8} L${triX + 5} ${capY + 1} Z`} fill="none" stroke="#1e1b17" stroke-width="1.1" />
                    <circle cx={triX} cy={capY - 2} r="1.1" fill="#1e1b17" />
                  </>
                ) : null}
                <text x={p.anchor === 'start' ? p.lx + (m.host ? 13 : 0) : p.anchor === 'end' ? p.lx : p.lx + (m.host ? 5 : 0)} y={capY} text-anchor={p.anchor} style={CAP}>
                  {tags}
                </text>
              </>
            ) : null}
          </g>
        );
      })}
      {empty && n < 10 ? (
        <>
          <text x="24" y="314" style="font-size: 11.5px; font-weight: 500; fill: #3b362f; paint-order: stroke; stroke: #d4e3e1; stroke-width: 3px; stroke-linejoin: round">
            还有 {empty} 个
          </text>
          <text x="24" y="329" style="font-size: 11.5px; font-weight: 500; fill: #3b362f; paint-order: stroke; stroke: #d4e3e1; stroke-width: 3px; stroke-linejoin: round">
            空位
          </text>
        </>
      ) : null}
      {moderator ? (
        <g>
          <circle cx="332" cy="502" r="27" fill="none" stroke={meIsMod ? 'var(--acc)' : '#1e1b17'} stroke-width="1.2" stroke-dasharray="3 3" />
          <circle cx="332" cy="502" r="10.5" fill="#f6efde" stroke={meIsMod ? 'var(--acc)' : '#1e1b17'} stroke-width={meIsMod ? 2.6 : 1.6} />
          {meIsMod ? <circle cx="332" cy="502" r="4.8" fill="var(--acc)" /> : null}
          <text x="296" y="500" text-anchor="end" style={`${LBL}; font-size: ${fitSize(meIsMod ? `${moderator.name}（你）` : moderator.name, 296, 'end')}px; fill: ${meIsMod ? 'var(--acc-text)' : '#1e1b17'}`}>
            {meIsMod ? `${moderator.name}（你）` : moderator.name}
          </text>
          <text x="296" y="515" text-anchor="end" style="font-size: 10.5px; font-weight: 500; fill: #3b362f; paint-order: stroke; stroke: #d4e3e1; stroke-width: 2.8px; stroke-linejoin: round">
            主持人 · 不上岛
          </text>
        </g>
      ) : null}
    </Layer>
  );
}

/* ================================================================ 图例框（凹角）和飘带标题 */

/** 凹角图框的路径（四个角往里凹一个圆角）。 */
function concave(w: number, h: number, r: number, inset = 0): string {
  const a = inset + 0.5;
  const R = r - inset * 0.75;
  return `M${a + R} ${a} H${w - a - R} A${R} ${R} 0 0 0 ${w - a} ${a + R} V${h - a - R} A${R} ${R} 0 0 0 ${w - a - R} ${h - a} H${a + R} A${R} ${R} 0 0 0 ${a} ${h - a - R} V${a + R} A${R} ${R} 0 0 0 ${a + R} ${a} Z`;
}

function useHeight<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setH(el.offsetHeight);
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, h];
}

/** 凹角图例框：外框 + 内细线 + 四角小点；高度跟着内容。 */
function Cartouche({ w, r = 10, children, title, class: cls, id }: { w: number; r?: number; children: ComponentChildren; title?: string; class?: string; id?: string }) {
  const [ref, h] = useHeight<HTMLDivElement>();
  return (
    <div class={`b-lb-cart ${cls ?? ''}`} style={{ width: `${w}px` }} ref={ref} id={id}>
      {h ? (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" class="b-lb-frame">
          <path d={concave(w, h, r)} fill="#f7f0de" stroke="#1e1b17" stroke-width="1.2" />
          <path d={concave(w, h, r, 4)} fill="none" stroke="#1e1b17" stroke-width="0.5" />
          {[
            [r * 0.55, r * 0.55],
            [w - r * 0.55, r * 0.55],
            [r * 0.55, h - r * 0.55],
            [w - r * 0.55, h - r * 0.55],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.6" fill="#1e1b17" />
          ))}
        </svg>
      ) : null}
      {title ? <Ribbon text={title} /> : null}
      <div class="b-lb-cart-body">{children}</div>
    </div>
  );
}

/** 图例框顶上的飘带标题。 */
function Ribbon({ text }: { text: string }) {
  const w = Math.round(textWidth(text, 13) * 1.4 + 24);
  return (
    <div class="b-lb-ribbon" style={{ width: `${w}px` }}>
      <svg width={w} height="24" viewBox={`0 0 ${w} 24`} aria-hidden="true">
        <path d="M-10 6 H8 V24 H-10 L-4 15 Z" fill="#e6dbc0" stroke="#1e1b17" stroke-width="0.8" />
        <path d={`M${w + 10} 6 H${w - 8} V24 H${w + 10} L${w + 4} 15 Z`} fill="#e6dbc0" stroke="#1e1b17" stroke-width="0.8" />
        <rect x="0.5" y="0.5" width={w - 1} height="19" fill="#f7f0de" stroke="#1e1b17" stroke-width="0.9" />
        <path d={`M0.5 19.5 L8 24 V19.5 Z M${w - 0.5} 19.5 L${w - 8} 24 V19.5 Z`} fill="#1e1b17" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

/* ================================================================ 本局设置图例 */

const BLOB = 'M2 9 C3 4 8 2 13 3 C18 1 24 4 24 8 C25 13 19 15 13 14 C8 16 2 14 2 9 Z';

function LegendIcon({ k }: { k: 'big' | 'small' | 'blank' | 'judge' | 'pace' | 'lock' }) {
  return (
    <svg width="26" height="16" aria-hidden="true">
      {k === 'big' ? <path d={BLOB} fill="#efc965" stroke="#a4602c" stroke-width="0.9" /> : null}
      {k === 'small' ? <path d={BLOB} fill="#a9cf8f" stroke="#3f7a31" stroke-width="0.9" /> : null}
      {k === 'blank' ? <path d={BLOB} fill="#ffffff" stroke="#1e1b17" stroke-width="0.9" stroke-dasharray="2 1.6" /> : null}
      {k === 'judge' ? <path d="M13 2 V14 M7 14 H19 M5 5 H21 M5 5 L2 10 H8 Z M21 5 L18 10 H24 Z" fill="none" stroke="#1e1b17" stroke-width="1" stroke-linejoin="round" /> : null}
      {k === 'pace' ? <path d="M8 1.5 H18 M8 14.5 H18 M9 2 C9 6 13 7 13 8 C13 9 9 10 9 14 M17 2 C17 6 13 7 13 8 C13 9 17 10 17 14" fill="none" stroke="#1e1b17" stroke-width="1" stroke-linecap="round" /> : null}
      {k === 'lock' ? (
        <>
          <path d="M9 7 V5 a4 4 0 0 1 8 0 V7" fill="none" stroke="#1e1b17" stroke-width="1.1" />
          <rect x="7" y="7" width="12" height="8" fill="none" stroke="#1e1b17" stroke-width="1.1" />
        </>
      ) : null}
    </svg>
  );
}

function SettingsLegend({ room, n, isHost }: { room: RoomView; n: number; isHost: boolean }) {
  const s = room.settings;
  const comp = s.composition ?? PRESETS[n] ?? null;
  const pace = currentPace(s);
  const rows: [Parameters<typeof LegendIcon>[0]['k'], string, string][] = [
    ['big', '大国', comp ? `${comp.big} 人` : '–'],
    ['small', '小国', comp ? `${comp.small} 人` : '–'],
    ['blank', '白板', comp ? `${comp.blank} 人` : '–'],
    ['judge', '裁判', s.judge === 'llm' ? 'AI' : '主持人'],
    ['pace', '节奏', PACES.find((p) => p.id === pace)?.label ?? '自定义'],
    ['lock', '口令', room.hasPassword ? '已设置' : '没有'],
  ];
  return (
    <div class="b-abs" style={{ left: '24px', top: '556px' }}>
      <Cartouche w={194} title="本局设置">
        <ul class="b-lb-legend">
          {rows.map(([k, label, val]) => (
            <li key={k}>
              <span class="b-lb-legend-ico">
                <LegendIcon k={k} />
              </span>
              <span class="b-lb-legend-k">{label}</span>
              <span class="b-lb-legend-v">{val}</span>
            </li>
          ))}
        </ul>
        <p class="b-lb-legend-note">
          {isHost ? (
            <button type="button" class="b-lb-link" onClick={() => scrollToId('b-lb-rules')}>
              改规则在下面 ↓
            </button>
          ) : comp ? (
            '注：房主设定，开局前还可能改'
          ) : (
            `注：${MIN_PLAYERS}–${MAX_PLAYERS} 人才能开`
          )}
        </p>
      </Cartouche>
    </div>
  );
}

/* ================================================================ 右边一栏：人数刻度尺、名字 / 邀请 */

function HeadCount({ n }: { n: number }) {
  const filled = Math.min(n, MAX_PLAYERS);
  return (
    <>
      <p class="b-lb-count-h">
        <span>人数</span>
        <small>最多 {MAX_PLAYERS} 人</small>
      </p>
      <svg width="132" height="26" viewBox="0 0 132 26" aria-hidden="true">
        <g stroke="#1e1b17" stroke-width="0.7">
          {Array.from({ length: filled }, (_, i) => (
            <rect key={i} x={6 + i * 10} y="4" width="10" height="6" fill={i % 2 === 0 ? '#1e1b17' : '#f4ecda'} />
          ))}
        </g>
        {filled < MAX_PLAYERS ? <rect x={6 + filled * 10} y="4" width={(MAX_PLAYERS - filled) * 10} height="6" fill="none" stroke="#1e1b17" stroke-width="0.7" stroke-dasharray="2 2" /> : null}
        <g style="font-family: var(--mono); font-size: 7.5px; fill: #5d564c" text-anchor="middle">
          {[0, 4, 8, 12].map((k) => (
            <text key={k} x={6 + k * 10} y="21">
              {k}
            </text>
          ))}
        </g>
      </svg>
      <p class="b-lb-count-n">
        <b>{n}</b>
        <span>{n < MIN_PLAYERS ? `人进来了，还差 ${MIN_PLAYERS - n} 人` : '人已进入房间'}</span>
      </p>
    </>
  );
}

function NameLine({ conn, name }: { conn: RoomConnection; name: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  if (editing) {
    return (
      <form
        class="b-lb-rename"
        onSubmit={(e) => {
          e.preventDefault();
          if (val.trim()) conn.send({ t: 'rename', name: val.trim() });
          setEditing(false);
        }}
      >
        <input value={val} maxLength={10} aria-label="新名字" autoFocus onInput={(e) => setVal(e.currentTarget.value)} />
        <button type="submit" class="b-lb-link">
          保存
        </button>
      </form>
    );
  }
  return (
    <div class="b-lb-name">
      <span class="b-lb-name-k">你的名字</span>
      <span class="b-lb-name-v">{name}</span>
      <button
        type="button"
        class="b-lb-link"
        onClick={() => {
          setVal(name);
          setEditing(true);
        }}
      >
        改名
      </button>
    </div>
  );
}

function MiniInvite({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div class="b-lb-mini-invite">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <g fill="#1e1b17">
          <path d="M2 2h10v10H2z M22 2h10v10H22z M2 22h10v10H2z" fill="none" stroke="#1e1b17" stroke-width="2" />
          <rect x="5" y="5" width="4" height="4" />
          <rect x="25" y="5" width="4" height="4" />
          <rect x="5" y="25" width="4" height="4" />
          <rect x="16" y="3" width="3" height="3" />
          <rect x="16" y="10" width="3" height="5" />
          <rect x="22" y="16" width="5" height="3" />
          <rect x="16" y="22" width="3" height="3" />
          <rect x="22" y="22" width="3" height="3" />
          <rect x="28" y="22" width="4" height="3" />
          <rect x="22" y="28" width="3" height="4" />
          <rect x="28" y="28" width="4" height="4" />
          <rect x="3" y="16" width="4" height="3" />
          <rect x="10" y="16" width="3" height="3" />
        </g>
      </svg>
      <p>
        <span>邀请朋友</span>
        <span class="b-lb-mini-links">
          <button
            type="button"
            class="b-lb-link"
            onClick={async () => {
              if (await copyLink(link)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? '已复制' : '复制链接'}
          </button>
          {' · '}
          <button type="button" class="b-lb-link" onClick={() => scrollToId('b-lb-invite')}>
            二维码
          </button>
        </span>
      </p>
    </div>
  );
}

/* ================================================================ 开局按钮 / 等待飘带 */

function StartBar({ room, n, conn, top }: { room: RoomView; n: number; conn: RoomConnection; top: number }) {
  return (
    <button type="button" class="b-btn b-lb-start" style={{ top: `${top}px` }} disabled={!!room.startBlocker} onClick={() => conn.send({ t: 'start' })}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 3 L17 10 L5 17 Z" fill="currentColor" />
      </svg>
      <b>{room.gameNo ? '开始下一局' : '开始游戏'}</b>
      <small>{n} 人</small>
    </button>
  );
}

function WaitRibbon({ text, sub }: { text: string; sub: string }) {
  return (
    <div class="b-lb-wait" role="status">
      <svg width="338" height="50" viewBox="0 0 338 50" aria-hidden="true">
        <path d="M0 14 H40 V50 H0 L12 32 Z" fill="#e6dbc0" stroke="#1e1b17" stroke-width="1" />
        <path d="M338 14 H298 V50 H338 L326 32 Z" fill="#e6dbc0" stroke="#1e1b17" stroke-width="1" />
        <path d="M26 40 L40 50 V40 Z M312 40 L298 50 V40 Z" fill="#1e1b17" />
        <rect x="26" y="0.5" width="286" height="40" fill="#f7f0de" stroke="#1e1b17" stroke-width="1" />
        <rect x="30" y="4.5" width="278" height="32" fill="none" stroke="#1e1b17" stroke-width="0.4" />
      </svg>
      <div>
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" class="b-lb-wait-clock">
          <circle cx="10" cy="10" r="8" fill="none" stroke="#5d564c" stroke-width="1.4" stroke-dasharray="3 2.4" />
          <path d="M10 5 V10 L13.5 12" fill="none" stroke="#1e1b17" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <b>{text}</b>
        <small>{sub}</small>
      </div>
    </div>
  );
}

/* ================================================================ 主持人的出题图例 */

type PairForm = {
  wordA: string;
  wordB: string;
  senseA: string;
  senseB: string;
  aliasesA: string;
  aliasesB: string;
  link: string;
  hints: string;
  judgeNote: string;
  /** 'A'（默认）/ 'B' 固定当大国的词，'random' 每局随机 */
  bigWord: string;
};

function initialPair(p: CustomPair | null): PairForm {
  return {
    wordA: p?.wordA ?? '',
    wordB: p?.wordB ?? '',
    senseA: p?.senseA ?? '',
    senseB: p?.senseB ?? '',
    aliasesA: p?.aliasesA?.join('、') ?? '',
    aliasesB: p?.aliasesB?.join('、') ?? '',
    link: p?.link ?? '',
    hints: p?.hints?.join('\n') ?? '',
    judgeNote: p?.judgeNote ?? '',
    bigWord: p ? (p.bigWord ?? 'random') : 'A',
  };
}

function submitPair(conn: RoomConnection, f: PairForm) {
  const list = (v: string) =>
    v
      .split(/[,，、\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  const { bigWord, ...rest } = f;
  conn.send({
    t: 'customPair',
    pair: { ...rest, aliasesA: list(f.aliasesA), aliasesB: list(f.aliasesB), hints: list(f.hints), ...(bigWord === 'A' || bigWord === 'B' ? { bigWord } : {}) },
  });
}

function PairSwatch({ k }: { k: 'a' | 'b' | 'link' }) {
  const id = useId();
  return (
    <svg width="30" height="18" aria-hidden="true">
      {k === 'a' ? (
        <>
          <defs>
            <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0 V4" stroke="#1e1b17" stroke-width="0.8" />
            </pattern>
          </defs>
          <path d="M2 10 C3 4 9 2 15 3 C21 1 28 4 28 9 C29 15 21 17 15 16 C9 18 2 16 2 10 Z" fill={`url(#${id})`} stroke="#1e1b17" stroke-width="0.9" />
        </>
      ) : k === 'b' ? (
        <>
          <defs>
            <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill="#1e1b17" />
            </pattern>
          </defs>
          <path d="M2 10 C3 4 9 2 15 3 C21 1 28 4 28 9 C29 15 21 17 15 16 C9 18 2 16 2 10 Z" fill={`url(#${id})`} stroke="#1e1b17" stroke-width="0.9" />
        </>
      ) : (
        <path d="M2 15 L28 3" stroke="var(--acc)" stroke-width="1.6" stroke-dasharray="5 2 1.2 2" stroke-linecap="round" />
      )}
    </svg>
  );
}

function PairCartouche({
  room,
  f,
  set,
  conn,
  detailsOpen,
  openDetails,
}: {
  room: RoomView;
  f: PairForm;
  set: (k: keyof PairForm, v: string) => void;
  conn: RoomConnection;
  detailsOpen: boolean;
  openDetails: () => void;
}) {
  const custom = room.settings.wordSource === 'custom';
  const p = room.customPair;
  const human = room.settings.judge === 'human';
  return (
    <div class="b-abs" style={{ left: '24px', top: '528px' }}>
      <Cartouche w={342} r={12} title={custom ? '出题' : '主持人'}>
        {custom ? (
          <form
            class="b-lb-pair"
            onSubmit={(e) => {
              e.preventDefault();
              submitPair(conn, f);
            }}
          >
            <p class="b-lb-pair-k">
              <span>把这局的两个词写进图例</span>
              <span>只有你看得到</span>
            </p>
            {(
              [
                ['a', 'wordA', '词 A', '例：雷达', 20],
                ['b', 'wordB', '词 B', '例：射手', 20],
                ['link', 'link', '联系', '例：都是蚊香的品牌', 80],
              ] as const
            ).map(([sw, key, label, ph, max]) => (
              <label class="b-lb-pair-row" key={key}>
                <span class="b-lb-pair-sw">
                  <PairSwatch k={sw} />
                </span>
                <span class="b-lb-pair-l">{label}</span>
                <input value={f[key]} maxLength={max} placeholder={ph} onInput={(e) => set(key, e.currentTarget.value)} />
              </label>
            ))}
            <button type="button" class="b-lb-link b-lb-pair-more" aria-expanded={detailsOpen} onClick={openDetails}>
              {detailsOpen ? '大国词、义项、别名、提示在下面 ↓' : '＋ 大国词、义项、别名、提示（可选）'}
            </button>
            <button type="submit" class="b-btn b-lb-pair-go" disabled={!f.wordA.trim() || !f.wordB.trim() || !f.link.trim()}>
              <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 10.5 L8.5 15 L16.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{p ? '更新题目' : '提交题目'}</span>
            </button>
            <p class="b-lb-pair-note">
              {p
                ? `已提交：${p.wordA} / ${p.wordB}。哪个词给大国，开局时随机决定；这对词开局后就用掉了，下一局要重新出题。`
                : '注：哪个词给大国，开局时随机决定。提交后房主才能开始；开局后你会看到所有人的身份和整局记录。'}
            </p>
          </form>
        ) : (
          <div class="b-lb-pair">
            <p class="b-lb-mod-text">你不参与这一局。开局后你会看到两个词、所有人的身份和整局记录{human ? '，并负责判定提问和猜词' : '；判定交给 AI 裁判，你旁观'}。</p>
            <p class="b-lb-mod-text b-lb-mod-text--muted">现在用题库出题。想自己出题，请房主把规则里的「词对来源」改成「自带词」。</p>
          </div>
        )}
      </Cartouche>
    </div>
  );
}

function PairDetails({ f, set, conn }: { f: PairForm; set: (k: keyof PairForm, v: string) => void; conn: RoomConnection }) {
  const field = (k: keyof PairForm) => ({ value: f[k], onInput: (e: { currentTarget: { value: string } }) => set(k, e.currentTarget.value) });
  return (
    <section class="b-lb-sheet" id="b-lb-pair-more" aria-label="出题的可选项">
      <SheetHead title="出题 · 可选项" sub="只有你看得到" />
      <form
        class="b-lb-sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          submitPair(conn, f);
        }}
      >
        <label class="b-lb-field">
          <span>哪个词当大国的词（白板要猜它，还会知道它有几个字；很难凭空想到的词别当大国的词）</span>
          <select value={f.bigWord} onChange={(e) => set('bigWord', e.currentTarget.value)}>
            <option value="A">词 A{f.wordA.trim() ? `：${f.wordA.trim()}` : ''}（默认）</option>
            <option value="B">词 B{f.wordB.trim() ? `：${f.wordB.trim()}` : ''}</option>
            <option value="random">每局随机</option>
          </select>
        </label>
        <div class="b-lb-cols">
          <label class="b-lb-field">
            <span>词 A 的义项（裁判按这个理解）</span>
            <input maxLength={40} placeholder="例：用无线电探测目标的装置" {...field('senseA')} />
          </label>
          <label class="b-lb-field">
            <span>词 B 的义项</span>
            <input maxLength={40} placeholder="例：射箭或射击的人" {...field('senseB')} />
          </label>
          <label class="b-lb-field">
            <span>A 的别名（顿号隔开，猜到也算对）</span>
            <input placeholder="例：雷达站" {...field('aliasesA')} />
          </label>
          <label class="b-lb-field">
            <span>B 的别名</span>
            <input placeholder="例：弓箭手、射击手" {...field('aliasesB')} />
          </label>
        </div>
        <label class="b-lb-field">
          <span>提示（抢答时按顺序公布，每行一条，越往后越直白；放完最后才公布联系）</span>
          <textarea rows={3} {...field('hints')} />
        </label>
        <label class="b-lb-field">
          <span>裁判须知（给 AI 裁判的补充说明，玩家看不到）</span>
          <textarea rows={2} maxLength={200} placeholder="例：按「装置」和「人」理解，不按蚊香品牌回答" {...field('judgeNote')} />
        </label>
        <button type="submit" class="b-btn b-btn--ghost b-lb-wide">
          <span>连同上面的两个词一起保存</span>
        </button>
      </form>
    </section>
  );
}

/* ================================================================ 往下滚的部分 */

/** 图纸上的一张说明表：黑色表头带 + 双线框。 */
/** 跳过这些题号：在别的聚会玩过的题，房主填进来就不会抽到；下面列出这个房间已经玩过的（会自动跳过）。 */
function SkipNumbers({ skip, played, editable, onSave }: { skip: string[]; played: string[]; editable: boolean; onSave: (v: string) => void }) {
  const shown = skip.join('、');
  const [text, setText] = useState(shown);
  const [focus, setFocus] = useState(false);
  const value = focus ? text : shown;
  const save = () => {
    setFocus(false);
    if (text.trim() !== shown) onSave(text);
  };
  return (
    <div class="b-lb-skip">
      <label>
        <span>跳过这些题号</span>
        {editable ? (
          <input
            value={value}
            placeholder="例：1-3、2-5（在别处玩过的）"
            onFocus={() => {
              setText(shown);
              setFocus(true);
            }}
            onInput={(e) => setText(e.currentTarget.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === 'Enter' && !e.isComposing && (e.currentTarget as HTMLInputElement).blur()}
          />
        ) : (
          <b>{shown || '没有'}</b>
        )}
      </label>
      <small class="b-lb-muted">
        题号在每局结算时显示。{played.length ? `这个房间玩过：${played.join('、')}（会自动跳过）。` : ''}
      </small>
    </div>
  );
}

function SheetHead({ title, sub }: { title: string; sub?: ComponentChildren }) {
  return (
    <header class="b-lb-sheet-head">
      <b>{title}</b>
      {sub ? <span>{sub}</span> : null}
    </header>
  );
}

/** 邀请：一张船票，二维码印在存根上，点票面复制链接。 */
function InviteTicket({ code, link }: { code: string; link: string }) {
  const qr = useMemo(() => renderSVG(link, { border: 1 }), [link]);
  const [copied, setCopied] = useState(false);
  return (
    <section class="b-lb-invite" id="b-lb-invite" aria-label="邀请朋友">
      <svg width="342" height="132" viewBox="0 0 342 132" aria-hidden="true" class="b-lb-invite-bg">
        <path d="M8 0 H232 A8 8 0 0 0 248 0 H334 Q342 0 342 8 V124 Q342 132 334 132 H248 A8 8 0 0 0 232 132 H8 Q0 132 0 124 V8 Q0 0 8 0 Z" fill="#fffaf0" stroke="#1e1b17" stroke-width="1" />
        <path d="M240 11 V121" stroke="#1e1b17" stroke-width="1" stroke-dasharray="3 3" />
        <rect x="6" y="6" width="228" height="120" fill="none" stroke="#1e1b17" stroke-width="0.5" opacity="0.5" />
        <rect x="6" y="6" width="228" height="26" fill="#1e1b17" />
        <g opacity="0.07" fill="none" stroke="#1e1b17" stroke-width="0.7">
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M6 ${42 + i * 9} Q60 ${34 + i * 9} 120 ${42 + i * 9} T234 ${42 + i * 9}`} />
          ))}
        </g>
      </svg>
      <p class="b-lb-invite-band">
        <span>船票 · 圆桌岛</span>
        <span class="b-cond">№ {code}</span>
      </p>
      <button
        type="button"
        class="b-lb-invite-main"
        onClick={async () => {
          if (await copyLink(link)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }
        }}
      >
        <b>{copied ? '已复制，发给大家吧' : '点这里复制邀请链接'}</b>
        <small>{link.replace(/^https?:\/\//, '')}</small>
        <span>或者让朋友扫右边的二维码</span>
      </button>
      <div class="b-lb-invite-qr" role="img" aria-label="房间二维码" dangerouslySetInnerHTML={{ __html: qr }} />
    </section>
  );
}

function Members({ conn, room, isHost, players }: { conn: RoomConnection; room: RoomView; isHost: boolean; players: number }) {
  return (
    <section class="b-lb-sheet" aria-label="成员">
      <SheetHead title="成员名册" sub={`${players} 位玩家${room.moderatorId ? ' + 1 位主持人' : ''}`} />
      <ol class="b-lb-roll">
        {room.members.map((m, i) => {
          const me = m.id === room.me;
          const mod = m.id === room.moderatorId;
          return (
            <li key={m.id} class={`${me ? 'is-me' : ''} ${m.online ? '' : 'is-off'}`}>
              <span class="b-lb-roll-no">{pad2(i + 1)}</span>
              <span class={`b-lb-roll-dot ${m.online ? 'is-on' : ''}`} title={m.online ? '在线' : '离线'} aria-label={m.online ? '在线' : '离线'} />
              <span class="b-lb-roll-name">
                {m.name}
                {me ? <em class="is-me">你</em> : null}
                {m.host ? <em>房主</em> : null}
                {mod ? <em>主持人</em> : null}
              </span>
              <span class="b-lb-roll-lead" aria-hidden="true" />
              <span class="b-lb-roll-score">{m.score} 分</span>
              {isHost ? (
                <span class="b-lb-roll-acts">
                  {mod ? (
                    <button type="button" class="b-lb-link" onClick={() => conn.send({ t: 'moderator', id: null })}>
                      取消主持人
                    </button>
                  ) : (
                    <button type="button" class="b-lb-link" onClick={() => conn.send({ t: 'moderator', id: m.id })}>
                      设为主持人
                    </button>
                  )}
                  {!me ? (
                    <>
                      <button type="button" class="b-lb-link" onClick={() => conn.send({ t: 'transfer', id: m.id })}>
                        设为房主
                      </button>
                      <button type="button" class="b-lb-link" onClick={() => confirm(`请 ${m.name} 离开房间？`) && conn.send({ t: 'kick', id: m.id })}>
                        请离开
                      </button>
                    </>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p class="b-lb-sheet-note">主持人不参与游戏：负责出题（自带词）或人工判定，也可以只旁观。分数是这个房间里累计的。</p>
    </section>
  );
}

function Rule({ label, info, children }: { label: string; info?: readonly string[]; children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div class="b-lb-rule">
      <div class="b-lb-rule-head">
        <span>{label}</span>
        {info ? (
          <button type="button" class={`b-lb-info ${open ? 'is-on' : ''}`} aria-expanded={open} aria-controls={id} aria-label={`${label}：规则说明`} onClick={() => setOpen(!open)}>
            i
          </button>
        ) : null}
      </div>
      {open && info ? (
        <ul class="b-lb-info-box" id={id}>
          {info.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
      <div class="b-lb-rule-body">{children}</div>
    </div>
  );
}

function Choice({ value, options, onChange, disabled, label }: { value: string; options: [string, string][]; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  return (
    <span class="b-lb-choice" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button type="button" role="radio" aria-checked={value === v} class={value === v ? 'is-on' : ''} disabled={disabled} onClick={() => onChange(v)} key={v}>
          {text}
        </button>
      ))}
    </span>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} class={`b-lb-switch ${on ? 'is-on' : ''}`} disabled={disabled} onClick={() => onChange(!on)}>
      <i aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function Stepper({ value, min, max, onChange, disabled, label }: { value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean; label: string }) {
  return (
    <span class="b-lb-stepper" role="group" aria-label={label}>
      <button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)} aria-label={`${label}减一`}>
        −
      </button>
      <b>{value}</b>
      <button type="button" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label={`${label}加一`}>
        +
      </button>
    </span>
  );
}

function CompositionEditor({ conn, current, n }: { conn: RoomConnection; current: Composition | null; n: number }) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState<Composition>(current ?? PRESETS[n] ?? { big: 3, small: 2, blank: 2 });
  const err = compositionError(c) ?? (c.big + c.small + c.blank !== n ? `加起来要等于现在的 ${n} 人` : null);
  if (!open) {
    return (
      <span class="b-lb-inline">
        <button type="button" class="b-lb-link" onClick={() => setOpen(true)}>
          自定义人数
        </button>
        {current ? (
          <button type="button" class="b-lb-link" onClick={() => conn.settings({ composition: null })}>
            恢复预设
          </button>
        ) : null}
      </span>
    );
  }
  return (
    <div class="b-lb-comp">
      <div class="b-lb-comp-row">
        {(['big', 'small', 'blank'] as const).map((k) => (
          <span class="b-lb-comp-cell" key={k}>
            <small>{{ big: '大国', small: '小国', blank: '白板' }[k]}</small>
            <Stepper value={c[k]} min={0} max={MAX_PLAYERS} label={{ big: '大国', small: '小国', blank: '白板' }[k]} onChange={(v) => setC({ ...c, [k]: v })} />
          </span>
        ))}
      </div>
      {err ? <small class="b-lb-bad">{err}</small> : null}
      <small class="b-lb-muted">约束：大国 &gt; 小国 ≥ 2，白板 ≥ 1</small>
      <span class="b-lb-inline">
        <button
          type="button"
          class="b-lb-pill is-on"
          disabled={!!compositionError(c)}
          onClick={() => {
            conn.settings({ composition: c });
            setOpen(false);
          }}
        >
          保存
        </button>
        <button type="button" class="b-lb-link" onClick={() => setOpen(false)}>
          取消
        </button>
      </span>
    </div>
  );
}

function Rules({ conn, room, n, editable }: { conn: RoomConnection; room: RoomView; n: number; editable: boolean }) {
  const s = room.settings;
  const bank = room.bank;
  const comp = s.composition ?? PRESETS[n];
  const set = (patch: Partial<RoomSettings>) => editable && conn.settings(patch);
  const pace = currentPace(s);
  const smallest = comp ? Math.min(comp.big, comp.small) : null;
  const picked = (name: string) => s.banks === null || s.banks.includes(name);
  const toggleBank = (name: string) => {
    const all = bank.banks.map((b) => b.name);
    const cur = s.banks ?? all;
    const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
    if (!next.length) return; // 至少留一个
    set({ banks: next.length === all.length ? null : next });
  };
  return (
    <section class="b-lb-sheet" id="b-lb-rules" aria-label="规则">
      <SheetHead title="规则说明" sub={editable ? '你是房主，点了就改' : '房主设置'} />
      <div class="b-lb-rules">
        <Rule label="阵营人数" info={RULE_INFO.composition}>
          <span class="b-lb-val">
            {comp ? (
              <>
                <i class="b-lb-sw b-lb-sw--big" />
                {comp.big} 大国
                <i class="b-lb-sw b-lb-sw--small" />
                {comp.small} 小国
                <i class="b-lb-sw b-lb-sw--blank" />
                {comp.blank} 白板
              </>
            ) : (
              `${MIN_PLAYERS}–${MAX_PLAYERS} 人才能开`
            )}
            <small>{s.composition ? '自定义' : '按人数预设'}</small>
          </span>
          {editable ? <CompositionEditor conn={conn} current={s.composition} n={n} /> : null}
        </Rule>

        <Rule label="白板互认" info={RULE_INFO.recognition}>
          <Choice
            label="白板互认"
            value={s.recognition}
            disabled={!editable}
            options={[
              ['auto', '自动'],
              ['group', '分组互认'],
              ['oneWay', '单向认人'],
              ['all', '全员互认'],
            ]}
            onChange={(v) => set({ recognition: v as RoomSettings['recognition'] })}
          />
        </Rule>

        <Rule label="白板提前获胜" info={RULE_INFO.wipeout}>
          <span class="b-lb-inline">
            <span>某国存活</span>
            <Stepper value={s.wipeoutThreshold} min={0} max={5} disabled={!editable} label="提前获胜的人数" onChange={(v) => set({ wipeoutThreshold: v })} />
            <span>人（含）以下</span>
          </span>
          <small class="b-lb-muted">{s.wipeoutThreshold === 0 ? '0 = 某国全部出局时白板获胜' : `某国只剩 ${s.wipeoutThreshold} 人或更少时白板获胜`}</small>
          {smallest !== null && s.wipeoutThreshold >= smallest ? <small class="b-lb-bad">现在的阵营里有一国只有 {smallest} 人：第一次投票后白板就会直接获胜</small> : null}
          <Toggle on={s.wipeoutVsBlanks} disabled={!editable} onChange={(on) => set({ wipeoutVsBlanks: on })} label="某国存活人数少于白板存活人数时，白板也获胜" />
        </Rule>

        <Rule label="第二阶段提问" info={RULE_INFO.phase2Questions}>
          <Toggle on={s.phase2Questions} disabled={!editable} onChange={(on) => set({ phase2Questions: on })} label="轮到你时可以改为向裁判问一个是非题" />
        </Rule>

        <Rule label="同桌模式" info={RULE_INFO.tableMode}>
          <Toggle on={s.tableMode} disabled={!editable} onChange={(on) => set({ tableMode: on })} label="夜晚所有人都操作手机，免得暴露白板" />
        </Rule>

        <Rule label="节奏" info={RULE_INFO.pace}>
          <Choice
            label="节奏"
            value={pace ?? 'custom'}
            disabled={!editable}
            options={[...PACES.map((p) => [p.id, p.label] as [string, string]), ...(pace ? [] : [['custom', '自定义'] as [string, string]])]}
            onChange={(v) => {
              if (v === 'untimed') return set({ untimed: true });
              const p = PACES.find((x) => x.id === v);
              if (p && 'k' in p) set({ untimed: false, timers: paceTimers(p.k) });
            }}
          />
          <small class="b-lb-muted">
            {s.untimed
              ? '每一步都等大家操作完；有人走开时，房主可以「跳过等待」。'
              : `身份提示 ${s.timers.clue / 1000} 秒 / 人 · 轮流发言 ${s.timers.discussion / 1000} 秒 / 人 · 投票 ${s.timers.vote / 1000} 秒`}
          </small>
        </Rule>

        <Rule label="词对来源" info={RULE_INFO.wordSource}>
          <Choice
            label="词对来源"
            value={s.wordSource}
            disabled={!editable}
            options={[
              ['bank', '题库'],
              ['custom', '自带词'],
            ]}
            onChange={(v) => set({ wordSource: v as RoomSettings['wordSource'] })}
          />
          {s.wordSource === 'custom' ? (
            <small class="b-lb-muted">自带词：由主持人在开局前填两个词和联系。{room.moderatorId ? (room.customPairReady ? '主持人已经出好题了。' : '主持人还没出题。') : '先在成员名册里设一位主持人。'}</small>
          ) : (
            <>
              <ul class="b-lb-banks">
                {bank.banks.map((b) => (
                  <li key={b.name}>
                    <label class={`b-lb-bank ${picked(b.name) ? 'is-on' : ''}`}>
                      <input type="checkbox" checked={picked(b.name)} disabled={!editable} onChange={() => toggleBank(b.name)} />
                      <i aria-hidden="true" />
                      {b.no ? <b class="b-lb-bank-no">{b.no}</b> : null}
                      <span>{b.name}</span>
                      <small>
                        {b.left}/{b.total}
                      </small>
                    </label>
                  </li>
                ))}
              </ul>
              <small class="b-lb-muted">
                {bank.sample ? '还没导入正式题库，现在是 5 组示例。' : ''}勾选的题库共 {bank.total} 组，这个房间里还能抽的 {bank.left} 组。
              </small>
              <SkipNumbers skip={s.skip ?? []} played={room.played.filter((x) => /^\d+-\d+$/.test(x))} editable={editable} onSave={(v) => set({ skip: v.split(/[,，、;；\s/]+/).filter(Boolean) })} />
            </>
          )}
        </Rule>

        <Rule label="裁判" info={RULE_INFO.judge}>
          <Choice
            label="裁判方式"
            value={s.judge}
            disabled={!editable}
            options={[
              ['llm', 'AI 裁判'],
              ['human', '主持人判定'],
            ]}
            onChange={(v) => set({ judge: v as RoomSettings['judge'] })}
          />
          <small class="b-lb-muted">
            {s.judge === 'human'
              ? '主持人在手机上手动判定提问和猜词。'
              : room.judge.ai
                ? `AI 裁判（${modelName(room.judge.model)}）回答是非问题、判定猜词。`
                : 'AI 裁判还没配置好：猜词只认完全一致的写法（含别名），提问一律答「无法判断」。'}
          </small>
        </Rule>
      </div>
    </section>
  );
}

/** 口令：一张钉在图上的小纸条（房主）。 */
function PasswordNote({ conn, has }: { conn: RoomConnection; has: boolean }) {
  const [pw, setPw] = useState('');
  return (
    <section class="b-lb-note" aria-label="房间口令">
      <i class="b-lb-pin" aria-hidden="true" />
      <p class="b-lb-note-h">
        <b>口令</b>
        <span>{has ? '已设置' : '没有设'}</span>
      </p>
      <form
        class="b-lb-note-form"
        onSubmit={(e) => {
          e.preventDefault();
          conn.send({ t: 'password', password: pw.trim() || null });
          setPw('');
        }}
      >
        <input value={pw} maxLength={32} placeholder={has ? '写一个新口令' : '设一个口令（可选）'} aria-label="房间口令" onInput={(e) => setPw(e.currentTarget.value)} />
        <button type="submit" class="b-lb-pill is-on" disabled={!pw.trim()}>
          设置
        </button>
        {has ? (
          <button type="button" class="b-lb-link" onClick={() => conn.send({ t: 'password', password: null })}>
            取消口令
          </button>
        ) : null}
      </form>
      <p class="b-lb-note-small">已经在房间里的人不受影响；断线重连也不需要口令。</p>
    </section>
  );
}

function NameAndLeave({ conn, name, showRename }: { conn: RoomConnection; name: string; showRename: boolean }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  return (
    <section class="b-lb-foot" aria-label="名字和离开">
      {showRename ? (
        editing ? (
          <form
            class="b-lb-foot-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (val.trim()) conn.send({ t: 'rename', name: val.trim() });
              setEditing(false);
            }}
          >
            <input value={val} maxLength={10} aria-label="新名字" autoFocus onInput={(e) => setVal(e.currentTarget.value)} />
            <button type="submit" class="b-lb-pill is-on">
              保存
            </button>
            <button type="button" class="b-lb-link" onClick={() => setEditing(false)}>
              取消
            </button>
          </form>
        ) : (
          <button
            type="button"
            class="b-lb-link"
            onClick={() => {
              setVal(name);
              setEditing(true);
            }}
          >
            改名字（现在是 {name}）
          </button>
        )
      ) : (
        <span />
      )}
      <button
        type="button"
        class="b-lb-link b-lb-leave"
        onClick={() => {
          if (confirm('离开这个房间？')) conn.send({ t: 'leave' });
        }}
      >
        离开房间
      </button>
    </section>
  );
}

/* ================================================================ 大厅 */

export function Lobby({ conn, snap, lastGame, onShowLast }: { conn: RoomConnection; snap: Snapshot; lastGame: boolean; onShowLast: () => void }) {
  const room = snap.room!;
  const me = room.members.find((m) => m.id === room.me);
  const isHost = room.hostId === room.me;
  const moderator = room.members.find((m) => m.id === room.moderatorId) ?? null;
  const isModerator = room.moderatorId === room.me;
  const players = room.members.filter((m) => m.id !== room.moderatorId);
  const n = players.length;
  const link = shareLink(room.code);

  const [pair, setPair] = useState<PairForm>(() => initialPair(room.customPair));
  const setField = (k: keyof PairForm, v: string) => setPair((prev) => ({ ...prev, [k]: v }));
  const [details, setDetails] = useState(false);
  const [tour, setTour] = useState(false);

  const [lowerRef, lowerH] = useHeight<HTMLDivElement>();
  const H = 844 + Math.max(lowerH, 200) + 46;

  const status = isModerator ? null : isHost ? '告诉朋友房间号，或者用下面的邀请' : room.inGame ? '这一局正在进行，下一局再一起玩' : '你已经在房间里了，等房主开始';
  const showStartTop = isHost && !isModerator;

  return (
    <>
    <Stage bg="day" mode="scroll" h={H} label={`房间 ${room.code} 的大厅`}>
      <Art svg={TOPO_ART} />
      <SeatMap room={room} players={players} moderator={moderator} />

      <div class="b-lb-head">
        <h1>大国小国</h1>
        <i />
        <p class="b-lb-code">
          <span>房间号</span>
          <b>{room.code}</b>
        </p>
        {isModerator ? <p class="b-lb-modline">你是这一局的主持人，不参与游戏</p> : <p class="b-lb-status">{status}</p>}
      </div>

      {isModerator ? (
        <PairCartouche
          room={room}
          f={pair}
          set={setField}
          conn={conn}
          detailsOpen={details}
          openDetails={() => {
            setDetails(true);
            setTimeout(() => scrollToId('b-lb-pair-more'), 60);
          }}
        />
      ) : (
        <>
          <SettingsLegend room={room} n={n} isHost={isHost} />
          <div class="b-lb-side">
            <HeadCount n={n} />
            {isHost ? <MiniInvite link={link} /> : <NameLine conn={conn} name={me?.name ?? ''} />}
          </div>
          {showStartTop ? (
            <StartBar room={room} n={n} conn={conn} top={752} />
          ) : (
            <WaitRibbon text={room.inGame ? '这一局正在进行' : '等房主开始游戏'} sub={room.inGame ? '下一局再加入' : '人齐就开'} />
          )}
        </>
      )}

      <div class="b-lb-foot-line" style={isModerator ? { top: '848px' } : undefined}>
        {isHost && room.startBlocker ? (
          <span class="is-warn">{room.startBlocker}</span>
        ) : (
          <button type="button" class="b-lb-link" onClick={() => setTour(true)}>
            怎么玩？看图解
          </button>
        )}
        <button type="button" class="b-lb-link" onClick={() => scrollToId('b-lb-lower')}>
          成员、规则在下面 ↓
        </button>
      </div>

      <div class="b-lb-lower" id="b-lb-lower" ref={lowerRef}>
        {isHost && isModerator ? (
          <div class="b-lb-start-block">
            <button type="button" class="b-btn b-lb-start b-lb-start--flow" disabled={!!room.startBlocker} onClick={() => conn.send({ t: 'start' })}>
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M5 3 L17 10 L5 17 Z" fill="currentColor" />
              </svg>
              <b>{room.gameNo ? '开始下一局' : '开始游戏'}</b>
              <small>{n} 人</small>
            </button>
            {room.startBlocker ? <p class="b-lb-bad">{room.startBlocker}</p> : null}
          </div>
        ) : null}

        {isModerator && details && room.settings.wordSource === 'custom' ? <PairDetails f={pair} set={setField} conn={conn} /> : null}

        <InviteTicket code={room.code} link={link} />

        <button type="button" class="b-btn b-btn--ghost b-lb-wide" onClick={() => setTour(true)}>
          <span>第一次玩？看一分钟规则图解</span>
        </button>

        {lastGame && room.gameNo > 0 ? (
          <button type="button" class="b-btn b-btn--ghost b-lb-wide" onClick={onShowLast}>
            <span>查看第 {room.gameNo} 局的结算和记录</span>
          </button>
        ) : null}

        <Members conn={conn} room={room} isHost={isHost} players={n} />

        <Rules conn={conn} room={room} n={n} editable={isHost} />

        {isHost ? <PasswordNote conn={conn} has={room.hasPassword} /> : null}

        <NameAndLeave conn={conn} name={me?.name ?? ''} showRename={isHost || isModerator} />
      </div>
    </Stage>
      {/* 放在画板外面：画板有缩放，fixed 在里面会跟着缩放 */}
      {tour ? <RulesTour onClose={() => setTour(false)} /> : null}
    </>
  );
}
