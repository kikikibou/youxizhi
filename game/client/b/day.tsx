/**
 * 白天发言：每天是一条地铁线，每个座位一站，按今天说话的顺序排；你说的词就是你这一站的站名。
 * 两段直线中间一个 45° 弯；出局的人还在线上，是一个不停靠的站。底部：车厢里的线路屏（等别人说）、
 * 站名牌（轮到你）、发车牌（自由讨论：下一项投票，人齐就开始）。
 */

import { useState } from 'preact/hooks';
import type { LogEntry, StepView } from '../../engine/view.ts';
import { DIR } from '../text.ts';
import { Btn, Layer, Stage, Timer, okText } from './board.tsx';
import { Chips, type G } from './game.tsx';

type Clue = Extract<StepView, { k: 'clue' }>;
type Talk = Extract<StepView, { k: 'discussion' }>;

const PAPER = '#f4ecda';
const INK = '#1e1b17';
const MUTED = '#5d564c';
const WARM = '#f4ecda';
/** 每天一条线一种颜色（从不用强调色）。 */
const LINES = ['#7a4e8a', '#2e6f86', '#b88a2a', '#5f8a6f', '#8a5a3c', '#4f5f9a'];
const lineColor = (day: number) => LINES[(day - 1) % LINES.length];

const BG_LINES = `<g opacity="0.22" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M376 206 H296 L254 248 V468 L214 508 H14" stroke="#7a4e8a" stroke-width="6"/><path d="M214 14 V150 L326 262 V430 L376 480" stroke="#b88a2a" stroke-width="6"/><path d="M14 600 H92 L196 496 H300 L376 420" stroke="#5f8a6f" stroke-width="6"/><path d="M14 120 H28 L44 136 V160" stroke="#8a7d6b" stroke-width="6"/></g><g opacity="0.3">${[
  [296, 206],
  [254, 300],
  [254, 380],
  [254, 450],
  [150, 508],
  [80, 508],
  [214, 80],
  [270, 206],
  [326, 330],
  [326, 400],
  [60, 600],
  [150, 538],
  [250, 496],
  [338, 458],
]
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#ffffff" stroke="#6b6152" stroke-width="1.4"/>`)
  .join('')}<circle cx="226" cy="496" r="6.5" fill="#ffffff" stroke="#1e1b17" stroke-width="1.8"/></g>`;

/** 一条线的几何：两段直线、一个弯；站距随人数收紧，10 人以上字小一号。 */
class Line {
  pos = new Map<string, [number, number]>();
  path: [number, number][];
  compact: boolean;
  constructor(stations: string[], signTop: number) {
    const n = stations.length;
    const top = 142;
    let ext = 30;
    let dx = 56;
    const room = signTop - 22 - top;
    let s = Math.min(58, (room - 2 * ext - dx) / (n - 2 + 0.9));
    if (s < 38) {
      ext = 22;
      dx = 44;
      s = (room - 2 * ext - dx) / (n - 2 + 0.9);
    }
    this.compact = s < 40;
    const a = Math.floor(n / 2);
    const x1 = 66;
    const x2 = 66 + dx;
    const y1 = top + ext;
    for (let i = 0; i < a; i++) this.pos.set(stations[i], [x1, y1 + i * s]);
    const yb0 = y1 + (a - 1) * s + 0.45 * s;
    const yb1 = yb0 + dx;
    const y2 = yb1 + 0.45 * s;
    for (let j = 0; j < n - a; j++) this.pos.set(stations[a + j], [x2, y2 + j * s]);
    const end = y2 + (n - a - 1) * s + ext;
    this.path = [
      [x1, top],
      [x1, yb0],
      [x2, yb1],
      [x2, end],
    ];
  }
  /** 在 pt 处把线分成走过的和没走的两段。 */
  split(pt: [number, number]): [[number, number][], [number, number][]] {
    const P = this.path;
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, y0] = P[i];
      const [x1, y1] = P[i + 1];
      const [x, y] = pt;
      const cross = (x1 - x0) * (y - y0) - (y1 - y0) * (x - x0);
      const within = Math.min(x0, x1) - 0.5 <= x && x <= Math.max(x0, x1) + 0.5 && Math.min(y0, y1) - 0.5 <= y && y <= Math.max(y0, y1) + 0.5;
      if (Math.abs(cross) < 1 && within) return [[...P.slice(0, i + 1), pt], [pt, ...P.slice(i + 1)]];
    }
    return [P, [P[P.length - 1]]];
  }
}

const poly = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');

interface DayData {
  day: number;
  color: string;
  /** 整圈的座位（从起点开始、按方向），包括出局的人。 */
  stations: { id: string; name: string; out: boolean }[];
  /** 今天说话的顺序（只有活着的）。 */
  order: string[];
  said: Map<string, string | null>;
  dir: 'cw' | 'ccw';
}

function dayData(g: G, start: string, dir: 'cw' | 'ccw', order: string[]): DayData {
  const { v } = g;
  const all = [...v.players].sort((a, b) => a.seat - b.seat);
  const i0 = Math.max(0, all.findIndex((p) => p.id === start));
  const n = all.length;
  const stations = all.map((_, k) => all[(i0 + (dir === 'cw' ? k : n - k)) % n]).map((p) => ({ id: p.id, name: p.name, out: !order.includes(p.id) }));
  const said = new Map(v.log.filter((e): e is Extract<LogEntry, { t: 'clue' }> => e.t === 'clue' && e.day === v.day).map((c) => [c.player, c.text] as const));
  return { day: v.day, color: lineColor(v.day), stations, order, said, dir };
}

function LineMap({ d, cur, me, ready, signTop }: { d: DayData; cur: number; me: string; ready?: string[]; signTop: number }) {
  const L = new Line(
    d.stations.map((s) => s.id),
    signTop,
  );
  const n = d.order.length;
  const k = L.compact ? 0.84 : 1;
  const r = 8.5 * k;
  const fsName = 15 * k;
  const fsClue = 21 * k;
  const halo = `paint-order: stroke; stroke: ${PAPER}; stroke-linejoin: round`;
  const c = d.color;
  let lines;
  if (cur >= n) {
    lines = <path d={poly(L.path)} fill="none" stroke={c} stroke-width="9" stroke-linejoin="round" stroke-linecap="round" />;
  } else {
    const [done, ahead] = L.split(L.pos.get(d.order[cur])!);
    lines = (
      <>
        <path d={poly(ahead)} fill="none" stroke="#c9bfa8" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" />
        <path d={poly(ahead)} fill="none" stroke={PAPER} stroke-width="2.4" stroke-dasharray="5 5" stroke-linejoin="round" />
        <path d={poly(done)} fill="none" stroke={c} stroke-width="9" stroke-linejoin="round" stroke-linecap="round" />
      </>
    );
  }
  const [sx, sy] = L.path[0];
  const [ex, ey] = L.path[L.path.length - 1];
  const nameW = (s: string) => Array.from(s).length * fsName;
  return (
    <>
      {lines}
      <path d={`M${sx - 13} ${sy} H${sx + 13}`} stroke={INK} stroke-width="3" />
      <path d={`M${ex - 13} ${ey} H${ex + 13}`} stroke={INK} stroke-width="3" opacity={cur >= n ? 1 : 0.35} />
      {d.stations.map((st) => {
        const [x, y] = L.pos.get(st.id)!;
        if (st.out) {
          return (
            <g key={st.id}>
              <circle cx={x} cy={y} r={r} fill={PAPER} stroke="#8f8676" stroke-width="2.2" />
              <path d={`M${x - 6 * k} ${y + 6 * k} L${x + 6 * k} ${y - 6 * k}`} stroke="#8f8676" stroke-width="2.2" stroke-linecap="round" />
              <text x={x + 24} y={y + 5} style={`font-family: var(--serif); font-weight: 700; font-size: ${fsName}px; fill: #8f8676; ${halo}; stroke-width: 4px`}>
                {st.name}
              </text>
              <text x={x + 30 + nameW(st.name)} y={y + 4} style={`font-size: 11px; fill: #8f8676; ${halo}; stroke-width: 3px`}>
                已出局 · 不停靠
              </text>
            </g>
          );
        }
        const i = d.order.indexOf(st.id);
        const said = i < cur;
        const now = i === cur && cur < n;
        const isMe = st.id === me;
        const col = said || now ? INK : '#8f8676';
        let cx = x + 30 + nameW(st.name);
        const clue = d.said.get(st.id);
        return (
          <g key={st.id}>
            <text x={x - 22} y={y + 3.5} text-anchor="end" style={`font-family: var(--mono); font-size: 9px; fill: ${MUTED}; ${halo}; stroke-width: 3px`}>
              {d.day}-{String(i + 1).padStart(2, '0')}
            </text>
            {now ? (
              <>
                <circle cx={x} cy={y} r="16" fill="none" stroke="var(--acc)" stroke-width="1.6" class="b-pulse" />
                <circle cx={x} cy={y} r="10" fill="var(--acc)" stroke={INK} stroke-width="2" />
                <circle cx={x} cy={y} r="3.6" fill="#ffffff" />
              </>
            ) : said ? (
              <circle cx={x} cy={y} r={r} fill="#ffffff" stroke={INK} stroke-width="2.6" />
            ) : (
              <circle cx={x} cy={y} r={r} fill={PAPER} stroke="#a39a88" stroke-width="2.2" />
            )}
            {isMe ? <circle cx={x} cy={y} r={now ? 20 : 14 * k} fill="none" stroke={INK} stroke-width="1.2" stroke-dasharray={now ? '2 2' : undefined} /> : null}
            <text x={x + 24} y={y + 5} style={`font-family: var(--serif); font-weight: 700; font-size: ${fsName}px; fill: ${col}; ${halo}; stroke-width: 4px`}>
              {st.name}
            </text>
            {isMe
              ? (() => {
                  const tx = x + 26 + nameW(st.name);
                  cx += 20;
                  return (
                    <g>
                      <rect x={tx} y={y - 7.5} width="17" height="14" rx="2" fill={PAPER} stroke="var(--acc)" stroke-width="1" />
                      <text x={tx + 8.5} y={y + 3.5} text-anchor="middle" style="font-size: 10px; font-weight: 700; fill: var(--acc-text)">
                        你
                      </text>
                    </g>
                  );
                })()
              : null}
            {said ? (
              clue === null || clue === undefined ? (
                <text x={cx} y={y + 4} style={`font-size: 12px; fill: #8f8676; ${halo}; stroke-width: 3px`}>
                  没有给提示
                </text>
              ) : (
                <>
                  <text x={cx} y={y + 7 * k} style={`font-family: var(--serif); font-weight: 900; font-size: ${fsClue}px; fill: ${INK}; ${halo}; stroke-width: 5px`}>
                    「{clue}」
                  </text>
                  {ready?.includes(st.id) ? (
                    <g transform={`translate(${(cx + fsClue * (Array.from(clue).length + 1.4) + 8).toFixed(1)} ${y})`}>
                      <circle r={8 * k} fill={INK} stroke={PAPER} stroke-width="2" />
                      <path d="M-3.6 0.2 L-1 2.8 L3.8 -2.6" fill="none" stroke={PAPER} stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" transform={`scale(${k})`} />
                    </g>
                  ) : null}
                </>
              )
            ) : now ? (
              <text x={cx} y={y + 5} style={`font-size: 14px; font-weight: 700; fill: var(--acc-text); ${halo}; stroke-width: 4px`}>
                {isMe ? '轮到你' : '正在想……'}
              </text>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

function Roundel({ day, size = 22, ring = '#ffffff' }: { day: number; size?: number; ring?: string }) {
  return (
    <span class="b-d-roundel" style={{ width: `${size}px`, height: `${size}px`, background: lineColor(day), boxShadow: `0 0 0 1.5px ${ring}`, fontSize: `${Math.round(size * 0.62)}px` }}>
      {day}
    </span>
  );
}

function LoopIcon({ color, dir }: { color: string; dir: 'cw' | 'ccw' }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" style={dir === 'ccw' ? { transform: 'scaleX(-1)' } : undefined}>
      <rect x="4" y="4" width="22" height="22" rx="8" fill="none" stroke="#ffffff" stroke-width="2.6" />
      <path d="M22.5 9.5 L26 13 L29.4 9.5" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="26" cy="17" r="3" fill={color} stroke="#ffffff" stroke-width="1.6" />
    </svg>
  );
}

function Header({ g, title, d }: { g: G; title: string; d: DayData }) {
  const first = g.name(d.order[0]);
  const last = g.name(d.order[d.order.length - 1]);
  return (
    <>
      <h1 class="b-d-h1">{title}</h1>
      <Chips g={g} label="按住看词" noSkip style={{ top: '30px' }} />
      {g.skip ? (
        <button type="button" class="b-chip b-d-skip" onClick={g.skip}>
          跳过等待
        </button>
      ) : null}
      <div class="b-d-sign" style={{ boxShadow: `inset 0 -4px 0 ${d.color}` }}>
        <span class="b-d-num" style={{ background: d.color }}>
          {d.day}
        </span>
        <span class="b-d-route">
          <small>
            第 {d.day} 天的线路 · {d.order.length} 站
          </small>
          <b>
            {first} 开往 {last}
          </b>
        </span>
        <span class="b-d-dir">
          {DIR[d.dir]}
          <LoopIcon color={d.color} dir={d.dir} />
        </span>
      </div>
    </>
  );
}

/** 车厢里的线路屏：现在谁在说，下一站是谁。 */
function DoorDisplay({ g, d, cur, top }: { g: G; d: DayData; cur: number; top: number }) {
  const n = d.order.length;
  const me = g.v.me.id;
  const nxt = cur + 1 < n ? d.order[cur + 1] : null;
  const after = cur + 2 < n ? d.order[cur + 2] : null;
  const tail = nxt === me ? '，下一个就是你' : after === me ? '，再下一站就到你' : '';
  const width = 290;
  const gap = n > 1 ? (width - 24) / (n - 1) : 0;
  const s = g.v.step;
  return (
    <div class="b-d-door" style={{ top: `${top}px` }}>
      <div class="b-d-screen">
        <div class="b-d-row">
          <Roundel day={d.day} ring="#141312" />
          <span class="b-d-dim">第 {d.day} 天 · 身份提示</span>
          <span class="b-d-count">
            {Math.min(cur + 1, n)} / {n}
          </span>
        </div>
        <p class="b-d-now">
          <span class="b-d-dim">现在</span>
          <b>{g.name(d.order[cur])}</b>
          <span>正在想一个和自己的词有关的词</span>
        </p>
        <svg width={width} height={n > 9 ? 66 : 58} viewBox={`0 0 ${width} ${n > 9 ? 66 : 58}`} aria-hidden="true" style={{ display: 'block' }}>
          <path d={`M12 14 H${width - 12}`} stroke="#4a4640" stroke-width="5" stroke-linecap="round" />
          {cur > 0 ? <path d={`M12 14 H${(12 + gap * Math.min(cur, n - 1)).toFixed(1)}`} stroke={d.color} stroke-width="5" stroke-linecap="round" /> : null}
          {d.order.map((id, i) => {
            const x = 12 + gap * i;
            const col = i <= cur ? WARM : '#8f887c';
            const nm = Array.from(g.name(id)).slice(0, n > 9 ? 2 : 4).join('');
            const ly = n > 9 && i % 2 ? 51 : 40;
            return (
              <g key={id}>
                {i < cur ? (
                  <circle cx={x} cy="14" r="5" fill={WARM} stroke={d.color} stroke-width="2" />
                ) : i === cur ? (
                  <>
                    <circle cx={x} cy="14" r="10" fill="none" stroke="var(--acc)" stroke-width="1.4" class="b-pulse" />
                    <circle cx={x} cy="14" r="6.5" fill="var(--acc)" />
                  </>
                ) : (
                  <circle cx={x} cy="14" r="5" fill="#1a1917" stroke="#6b665d" stroke-width="1.6" />
                )}
                <text x={x} y={ly} text-anchor="middle" style={`font-size: ${n > 9 ? 9.5 : 10.5}px; font-weight: ${i === cur ? 700 : 500}; fill: ${col}`}>
                  {nm}
                </text>
                {id === me ? (
                  <text x={x} y={ly + 12} text-anchor="middle" style="font-size: 9px; font-weight: 700; fill: var(--acc)">
                    你
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        <p class="b-d-next">
          <span class="b-d-tag">下一站</span>
          <b>{nxt ? g.name(nxt) : '—'}</b>
          <span class="b-d-dim">{tail}</span>
          {s.k === 'clue' && s.deadline !== null ? (
            <span style={{ marginLeft: 'auto' }}>
              <Timer deadline={s.deadline} offset={g.offset} total={g.total} night />
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

/** 站名牌：你说的词就是这一站的站名。 */
function StationBoard({ g, d, top, text, setText, submit }: { g: G; d: DayData; top: number; text: string; setText: (t: string) => void; submit: () => void }) {
  const me = g.v.me.id;
  const i = d.order.indexOf(me);
  const prev = i > 0 ? d.order[i - 1] : null;
  const nxt = i + 1 < d.order.length ? d.order[i + 1] : null;
  const max = g.v.rules.clueMaxLength;
  const len = Array.from(text.trim()).length;
  const prevClue = prev ? d.said.get(prev) : undefined;
  const s = g.v.step;
  return (
    <>
      <i class="b-d-rod" style={{ left: '70px', top: `${top - 14}px` }} />
      <i class="b-d-rod" style={{ right: '70px', top: `${top - 14}px` }} />
      <div class="b-d-station" style={{ top: `${top}px` }}>
        <div class="b-d-stripe" style={{ background: d.color }}>
          <Roundel day={d.day} />
          <span class="b-serif">{d.day} 号线</span>
          <span style={{ marginLeft: 'auto' }}>开往 {g.name(d.order[d.order.length - 1])} →</span>
        </div>
        <div class="b-d-name">
          <p class="b-d-hint">
            轮到你了 · 你说的词就是这一站的站名
            {s.k === 'clue' && s.deadline !== null ? (
              <>
                {' '}
                <Timer deadline={s.deadline} offset={g.offset} total={g.total} />
              </>
            ) : null}
          </p>
          <label class="b-d-input">
            <input
              value={text}
              autoFocus
              placeholder="写一个和你的词有关的词"
              aria-label="你的身份提示"
              enterKeyHint="send"
              onInput={(e) => setText(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <em class={len > max ? 'is-over' : ''}>
              {len} / {max}
            </em>
          </label>
          <p class="b-d-code">
            {g.v.me.name} · {d.day}-{String(i + 1).padStart(2, '0')}
          </p>
        </div>
        <div class="b-d-foot">
          <span>{prev ? `← ${g.name(prev)}${prevClue ? `「${prevClue}」` : ''}` : '← 你是第一站'}</span>
          <span>{nxt ? `${g.name(nxt)} →` : '终点站'}</span>
        </div>
      </div>
    </>
  );
}

/** 发车牌：下一项投票，准备好的人亮灯；最下面是昨天的线。 */
function DepartureBoard({ g, s, top }: { g: G; s: Talk; top: number }) {
  const alive = g.v.players.filter((p) => p.alive);
  const total = alive.length;
  const readyN = s.ready.length;
  const prevNight = [...g.v.log].reverse().find((e): e is Extract<LogEntry, { t: 'night' }> => e.t === 'night' && e.day === g.v.day - 1);
  return (
    <div class="b-d-depart" style={{ top: `${top}px` }}>
      <div class="b-d-screen">
        <div class="b-d-grid">
          <span class="b-d-dim">下一项</span>
          <b class="b-d-big">投票</b>
          <span class="b-cond b-d-n">
            {readyN} / {total}
          </span>
          <span class="b-d-dim">准备好</span>
          <span class="b-d-lamps">
            {alive.map((p) => (
              <i key={p.id} class={s.ready.includes(p.id) ? 'is-on' : ''} title={p.name} />
            ))}
          </span>
          <span class="b-d-dim">人到齐就开始</span>
        </div>
        <p class="b-d-yest">
          {prevNight ? (
            <>
              <Roundel day={g.v.day - 1} size={18} ring="#141312" />
              <span>
                第 {g.v.day - 1} 天：从 {g.name(prevNight.start)} 开始{DIR[prevNight.dir]}
              </span>
              <button type="button" class="b-d-link" onClick={g.openFile}>
                看昨天的词 ›
              </button>
            </>
          ) : (
            <>
              <span>这是第一天</span>
              {s.deadline !== null ? (
                <span style={{ marginLeft: 'auto' }}>
                  <Timer deadline={s.deadline} offset={g.offset} total={g.total} label="讨论还有" night />
                </span>
              ) : null}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function DayScreen({ g, s }: { g: G; s: Clue | Talk }) {
  const { v, conn } = g;
  const [text, setText] = useState('');
  const clueStep = s.k === 'clue' ? s : null;
  const nightEntry = [...v.log].reverse().find((e): e is Extract<LogEntry, { t: 'night' }> => e.t === 'night' && e.day === v.day);
  const start = clueStep?.start ?? nightEntry?.start ?? v.players[0].id;
  const dir = clueStep?.dir ?? nightEntry?.dir ?? 'cw';
  const order = clueStep ? clueStep.order : v.log.filter((e): e is Extract<LogEntry, { t: 'clue' }> => e.t === 'clue' && e.day === v.day).map((c) => c.player);
  const d = dayData(g, start, dir, order.length ? order : v.players.filter((p) => p.alive).map((p) => p.id));
  const crowded = d.stations.length >= 10;
  const signTop = crowded ? 604 : 560;
  const cur = clueStep ? clueStep.idx : d.order.length;
  const mine = !!clueStep && clueStep.order[clueStep.idx] === v.me.id;
  const max = v.rules.clueMaxLength;
  const submit = () => {
    if (!okText(text, max)) return;
    conn.act({ a: 'clue', text: text.trim() });
    setText('');
  };
  const talk = s.k === 'discussion' ? s : null;
  const ready = talk ? talk.ready.includes(v.me.id) : false;
  return (
    <Stage bg="line" label={clueStep ? '身份提示' : '自由讨论'}>
      <svg width="390" height="844" viewBox="0 0 390 844" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0 }} dangerouslySetInnerHTML={{ __html: BG_LINES }} />
      <Layer label={`第 ${v.day} 天的线路：${d.order.map(g.name).join('、')}`}>
        <LineMap d={d} cur={cur} me={v.me.id} ready={talk?.ready} signTop={signTop} />
      </Layer>
      <Header g={g} title={clueStep ? '身份提示' : '自由讨论'} d={d} />
      {clueStep ? (
        mine ? (
          <>
            <StationBoard g={g} d={d} top={signTop + 14} text={text} setText={setText} submit={submit} />
            <div class="b-d-btn" style={{ top: `${signTop + 196}px` }}>
              <Btn onClick={submit} disabled={!okText(text, max)}>
                说出
              </Btn>
              <p class="b-d-after">说出去就不能改了，也可以先当面说，再打在这里。</p>
            </div>
          </>
        ) : (
          <DoorDisplay g={g} d={d} cur={cur} top={signTop + 12} />
        )
      ) : talk ? (
        <>
          <DepartureBoard g={g} s={talk} top={signTop + 12} />
          <div class="b-d-btn" style={{ top: `${crowded ? 772 : 760}px` }}>
            {v.me.alive ? (
              <Btn onClick={() => conn.act({ a: 'ready' })} disabled={ready}>
                {ready ? '已准备，等其他人' : '准备投票'}
              </Btn>
            ) : (
              <p class="b-wait">你已出局，可以参与讨论，但不能投票。</p>
            )}
          </div>
        </>
      ) : null}
    </Stage>
  );
}
