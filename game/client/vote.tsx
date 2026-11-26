/**
 * 投票与出局：圆桌岛按座位切成几块（每人一块），像一张选区图。
 * 投票：点一块地或在选票上打勾，按钮上有个小票箱图标，上面一行记已投人数。
 * 出局：按票数给地图上色（票越多越深），出局的那块变成空白；钉在图上的出局通知；
 * 轮到自己时是三张卡：什么都不做 / 猜大国的词 / 问裁判（国家玩家后两张扣着）。
 */

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { LogEntry, StepView } from '../engine/view.ts';
import { VOTE } from './art.ts';
import { Btn, Layer, Stage, Timer, TitleBlock, okText } from './board.tsx';
import { Chips, type G } from './game.tsx';
import { along, coastPoint, wedge } from './seats.ts';

type Vote = Extract<StepView, { k: 'vote' }>;
type Exit = Extract<StepView, { k: 'exit' }>;

const PAPER = '#f4ecda';
const INK = '#1e1b17';
const MUTED = '#5d564c';
const SEA = '#d8e3df';
const WL = '#5f8f93';
const BASE = '#ebe0c5';
const SEQ = ['#efe6cf', '#c8dbd8', '#8db6bc', '#4c8a9d', '#2a6478', '#173f52'];
const GUILL = '#2e6f86';
const [HX, HY, HR] = VOTE.hub;
const TICK = 'M3 11 C5 12 7 15 8.5 18 C10.5 11 14.5 5.5 20 1.5';

function Sheet() {
  return (
    <g>
      <defs>
        <pattern id="v-blank" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#fbf8f0" />
          <path d="M0 0 V6" stroke="#b9b09d" stroke-width="1" />
        </pattern>
        <pattern id="v-pick" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <path d="M0 0 V5" stroke="var(--acc)" stroke-width="1.6" />
        </pattern>
        <clipPath id="v-isle">
          <path d={VOTE.coast} />
        </clipPath>
      </defs>
      <g fill="none" stroke={WL} stroke-width="0.75">
        {VOTE.waterlines.map((w) => (
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

interface District {
  id: string;
  name: string;
  a: number;
  d: string;
  label: { x: number; y: number };
}

function districts(g: G): District[] {
  const n = g.v.players.length;
  return [...g.v.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => {
      const a = -Math.PI / 2 + (2 * Math.PI * p.seat) / n;
      const h = Math.PI / n;
      return { id: p.id, name: p.name, a, d: wedge(HX, HY, a - h, a + h), label: along(VOTE.pts, HX, HY, a, n > 9 ? 0.66 : 0.62) };
    });
}

/** 选区图。mode：vote（点一块投票）、result（按票数上色）。 */
function DistrictMap({
  g,
  mode,
  pick,
  onPick,
  tally,
  out,
  current,
}: {
  g: G;
  mode: 'vote' | 'result';
  pick?: string | null;
  onPick?: (id: string) => void;
  tally?: Map<string, number>;
  out: Set<string>;
  current?: string | null;
}) {
  const ds = districts(g);
  const n = ds.length;
  const me = g.v.me.id;
  const fs = n > 9 ? 12.5 : 15;
  return (
    <>
      <Sheet />
      <g clip-path="url(#v-isle)">
        {ds.map((d) => {
          const t = tally?.get(d.id) ?? 0;
          const fill = out.has(d.id) && mode === 'vote' ? 'url(#v-blank)' : mode === 'result' ? SEQ[Math.min(t, 5)] : BASE;
          return <path key={d.id} d={d.d} fill={fill} stroke="#fbf6e8" stroke-width="2.6" stroke-linejoin="round" />;
        })}
        {mode === 'result' ? ds.filter((d) => out.has(d.id)).map((d) => <path key={`o${d.id}`} d={d.d} fill="url(#v-blank)" opacity="0.55" />) : null}
        {pick ? <path d={ds.find((d) => d.id === pick)?.d} fill="url(#v-pick)" stroke="var(--acc)" stroke-width="3" stroke-linejoin="round" /> : null}
        {current ? <path d={ds.find((d) => d.id === current)?.d} fill="none" stroke="var(--acc)" stroke-width="2.6" stroke-dasharray="6 4" stroke-linejoin="round" class="b-v-march" /> : null}
      </g>
      <g fill="none" stroke={INK} stroke-width="0.7" stroke-dasharray="4 2 1 2" opacity="0.5">
        {ds.map((d) => {
          const b = d.a - Math.PI / n;
          const c = coastPoint(VOTE.pts, HX, HY, b);
          return <path key={`b${d.id}`} d={`M${(HX + HR * Math.cos(b)).toFixed(1)} ${(HY + HR * Math.sin(b)).toFixed(1)} L${c.x.toFixed(1)} ${c.y.toFixed(1)}`} />;
        })}
      </g>
      <path d={VOTE.coastIn} fill="none" stroke={INK} stroke-width="0.5" opacity="0.3" />
      <path d={VOTE.coast} fill="none" stroke={INK} stroke-width="1.5" stroke-linejoin="round" />
      <circle cx={HX} cy={HY} r={HR} fill={PAPER} stroke={INK} stroke-width="1.2" />
      <circle cx={HX} cy={HY} r={HR - 4} fill="none" stroke={INK} stroke-width="0.5" stroke-dasharray="1.5 2" />
      <text x={HX} y={HY + 4} text-anchor="middle" style="font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: 1px; fill: #1e1b17">
        圆桌
      </text>
      {ds.map((d) => {
        const { x, y } = d.label;
        const t = tally?.get(d.id) ?? 0;
        const isOut = out.has(d.id);
        const dark = mode === 'result' && t >= 3 && !isOut;
        const col = dark ? '#ffffff' : isOut ? MUTED : INK;
        const halo = dark ? 'none' : '#f7f1e2';
        const nameW = Array.from(d.name).length * fs;
        return (
          <g key={`l${d.id}`}>
            <text x={x} y={y} text-anchor="middle" style={`font-family: var(--serif); font-weight: 700; font-size: ${fs}px; letter-spacing: 0.05em; fill: ${col}; paint-order: stroke; stroke: ${halo}; stroke-width: 3.5px; stroke-linejoin: round`}>
              {d.name}
            </text>
            {d.id === me ? (
              <g>
                <rect x={x + nameW / 2 + 3} y={y - 12} width="17" height="14" rx="2" fill={PAPER} stroke="var(--acc)" stroke-width="1" />
                <text x={x + nameW / 2 + 11.5} y={y - 1.5} text-anchor="middle" style="font-size: 10px; font-weight: 700; fill: var(--acc-text)">
                  你
                </text>
              </g>
            ) : null}
            {mode === 'result' ? (
              <text x={x} y={y + 22} text-anchor="middle" style={`font-family: var(--cond); font-weight: 500; font-size: ${t ? 20 : 14}px; fill: ${dark ? '#ffffff' : MUTED}`}>
                {t} 票
              </text>
            ) : null}
            {isOut ? (
              <text x={x} y={y + (mode === 'result' ? 38 : 16)} text-anchor="middle" style={`font-size: 10.5px; font-weight: 700; fill: ${d.id === current ? 'var(--acc-text)' : MUTED}; paint-order: stroke; stroke: #fbf8f0; stroke-width: 3px`}>
                {d.id === current ? '正在选' : '出局'}
              </text>
            ) : null}
            {mode === 'vote' && d.id === pick ? (
              <g transform={`translate(${x} ${y - 26})`}>
                <circle r="9" fill="var(--acc)" />
                <path d="M-4 0.4 L-1.2 3.2 L4.2 -2.8" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </g>
            ) : null}
          </g>
        );
      })}
      {onPick
        ? ds
            .filter((d) => !out.has(d.id))
            .map((d) => (
              <path
                key={`t${d.id}`}
                d={d.d}
                fill="transparent"
                clip-path="url(#v-isle)"
                role="radio"
                aria-checked={d.id === pick}
                aria-label={`投给 ${d.name}`}
                tabIndex={0}
                style={{ cursor: 'pointer', outline: 'none', pointerEvents: 'auto' }}
                onClick={() => onPick(d.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick(d.id)}
              />
            ))
        : null}
    </>
  );
}

function GuillocheDefs({ id }: { id: string }) {
  const wave = 'M0 3.5 Q2.5 0 5 3.5 T10 3.5';
  const wave2 = 'M0 3.5 Q2.5 7 5 3.5 T10 3.5';
  return (
    <>
      <pattern id={`${id}h`} width="10" height="7" patternUnits="userSpaceOnUse">
        <path d={wave} fill="none" stroke={GUILL} stroke-width="0.55" />
        <path d={wave2} fill="none" stroke={GUILL} stroke-width="0.55" />
      </pattern>
      <pattern id={`${id}v`} width="10" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(90)">
        <path d={wave} fill="none" stroke={GUILL} stroke-width="0.55" />
        <path d={wave2} fill="none" stroke={GUILL} stroke-width="0.55" />
      </pattern>
    </>
  );
}

/** 选票：防伪花边、存根、每个活着的人一个方格。 */
function Ballot({ g, s, pick, setPick }: { g: G; s: Vote; pick: string | null; setPick: (id: string) => void }) {
  const alive = [...g.v.players].filter((p) => p.alive).sort((a, b) => a.seat - b.seat);
  const cols = alive.length > 8 ? 3 : 2;
  const rows = Math.ceil(alive.length / cols);
  const rh = rows > 3 ? 26 : 30;
  const W = 312;
  const H = Math.max(196, 116 + rows * rh);
  const top = 696 - H - 10;
  return (
    <div class="b-v-ballot" style={{ top: `${top}px`, height: `${H}px` }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <GuillocheDefs id="bg" />
        </defs>
        <rect width={W} height={H} fill="#fffaf0" />
        <rect x="5" y="5" width={W - 10} height="7" fill="url(#bgh)" />
        <rect x="5" y={H - 12} width={W - 10} height="7" fill="url(#bgh)" />
        <rect x="5" y="12" width="7" height={H - 24} fill="url(#bgv)" />
        <rect x={W - 12} y="12" width="7" height={H - 24} fill="url(#bgv)" />
        <rect x="15" y="15" width={W - 30} height={H - 30} fill="none" stroke={GUILL} stroke-width="0.5" />
        <path d={`M58 3 V${H - 3}`} stroke="#9b917e" stroke-width="1" stroke-dasharray="2 3" />
        <circle cx="58" cy="0" r="4" fill={SEA} />
        <circle cx="58" cy={H} r="4" fill={SEA} />
        <g transform={`translate(37 ${H / 2}) rotate(-90)`} style={`font-family: var(--mono); font-size: 8.5px; fill: ${MUTED}`} text-anchor="middle">
          <text y="-4">存根 · 第 {g.v.day} 天</text>
          <text y="9" style="font-size: 10px; fill: #1e1b17">
            No. {String(g.v.day).padStart(2, '0')}·{String(g.v.me.seat + 1).padStart(2, '0')}
          </text>
        </g>
      </svg>
      <div class="b-v-ballot-in">
        <div class="b-v-ballot-h">
          <b>选票</b>
          <span>一人一票</span>
        </div>
        <p class="b-v-ballot-sub">在一个名字旁打勾，也可以直接点地图</p>
        <div role="radiogroup" aria-label="投给谁" class="b-v-cands" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {alive.map((p) => {
            const on = p.id === pick;
            return (
              <button type="button" role="radio" aria-checked={on} class={`b-v-cand ${on ? 'is-on' : ''}`} style={{ height: `${rh}px` }} onClick={() => setPick(p.id)} key={p.id}>
                <span class="b-v-box">
                  {on ? (
                    <svg width="26" height="24" viewBox="0 0 22 20" aria-hidden="true">
                      <path d={TICK} fill="none" stroke="var(--acc)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  ) : null}
                </span>
                <span class="b-v-cname" style={p.id === g.v.me.id && cols === 3 ? { color: 'var(--acc-text)' } : undefined}>
                  {p.name}
                </span>
                {p.id === g.v.me.id && cols < 3 ? <span class="b-v-you">你</span> : null}
              </button>
            );
          })}
        </div>
        <p class="b-v-ballot-foot">{g.v.rules.untimed ? '公布前可以改 · 可以投自己' : '公布前可以改 · 可以投自己 · 没投就算投自己'}</p>
      </div>
    </div>
  );
}

const BOX_ICON = (
  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none', overflow: 'visible' }}>
    <rect x="8.2" y="1.6" width="7.6" height="11" fill="#ffffff" />
    <path d="M9.9 7.4 L11.5 9 L14.2 5" fill="none" stroke="var(--acc)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M3.2 12.6 H20.8 V21.6 H3.2 Z" fill="var(--acc)" stroke="#ffffff" stroke-width="1.7" stroke-linejoin="round" />
    <path d="M1.6 12.6 H22.4" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" />
    <path d="M8.6 17.1 H15.4" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" />
  </svg>
);

function Counter({ voted, total }: { voted: number; total: number }) {
  const halo = `paint-order: stroke; stroke: ${SEA}; stroke-width: 4px; stroke-linejoin: round`;
  const tx = 26 + total * 13 + 6;
  return (
    <Layer style={{ pointerEvents: 'none' }}>
      {Array.from({ length: total }, (_, i) => (
        <rect x={26 + i * 13} y="707" width="9" height="9" fill={i < voted ? INK : PAPER} stroke={INK} stroke-width="1" />
      ))}
      <text x={tx} y="716" style={`font-family: var(--cond); font-weight: 500; font-size: 14px; fill: #1e1b17; ${halo}`}>
        {voted} / {total}
        <tspan dx="5" style="font-family: var(--sans); font-weight: 400; font-size: 11px">
          人已投
        </tspan>
      </text>
      <text x="364" y="716" text-anchor="end" style={`font-size: 11px; fill: ${MUTED}; ${halo}`}>
        大家都投完就公布
      </text>
    </Layer>
  );
}

export function VoteScreen({ g, s }: { g: G; s: Vote }) {
  const { v, conn, name } = g;
  const [pick, setPick] = useState<string | null>(s.myVote);
  const alive = v.players.filter((p) => p.alive);
  const out = new Set(v.players.filter((p) => !p.alive).map((p) => p.id));
  const label = s.myVote ? (pick === s.myVote ? `已投给 ${name(s.myVote)}` : `改投 ${name(pick!)}`) : pick ? '投进票箱' : '先选一个人';
  return (
    <Stage bg="atlas" label="投票">
      <Layer label={`投票：圆桌岛按座位分成 ${v.players.length} 块${pick ? `，你选了${name(pick)}` : ''}`}>
        <DistrictMap g={g} mode="vote" pick={v.me.alive ? pick : null} onPick={v.me.alive ? setPick : undefined} out={out} />
      </Layer>
      <TitleBlock kicker={`第 ${v.day} 天`} title="投票" sub={v.me.alive ? '点一块地，投给这个人' : '你已出局，不能投票'} />
      <Chips g={g} label="按住看词" />
      {v.me.alive ? (
        <>
          <Ballot g={g} s={s} pick={pick} setPick={setPick} />
          <Counter voted={s.votedCount} total={alive.length} />
          <div class="b-v-go">
            <Btn icon={BOX_ICON} disabled={!pick || pick === s.myVote} onClick={() => conn.act({ a: 'vote', target: pick! })}>
              {label}
            </Btn>
            {s.deadline !== null ? (
              <p class="b-v-time">
                <Timer deadline={s.deadline} offset={g.offset} total={g.total} />
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div class="b-v-sideline">
            <p class="b-v-sideline-h">大家在投票</p>
            <p class="b-note">你已出局，可以看大家投，但不能投票。</p>
          </div>
          <Counter voted={s.votedCount} total={alive.length} />
        </>
      )}
    </Stage>
  );
}

/* ------------------------------------------------------------------ 出局 */

function lastVotes(g: G) {
  return [...g.v.log].reverse().find((e): e is Extract<LogEntry, { t: 'votes' }> => e.t === 'votes') ?? null;
}

function Pin({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="2" cy="5" rx="5" ry="2.5" fill="rgba(0,0,0,0.25)" />
      <circle r="6.5" fill="#8a7d6b" />
      <circle r="6.5" fill="url(#pin-g)" />
      <circle cx="-2" cy="-2" r="1.8" fill="#ffffff" opacity="0.7" />
    </g>
  );
}

/** 钉在图上的出局通知：谁出局了、几票、谁在选、接下来是谁。 */
function Notice({ g, s, tally }: { g: G; s: Exit; tally: Map<string, number> }) {
  const me = g.v.me.id;
  const tie = s.queue.length > 1;
  const nextId = s.queue[s.idx + 1] ?? null;
  const W = 338;
  return (
    <div class="b-v-notice">
      <div class="b-v-notice-band">
        <b>出局</b>
        <span>
          第 {s.day} 天{tie ? ` · 平票，${s.queue.length} 人一起出局` : ''}
        </span>
      </div>
      <div class="b-v-outs">
        {s.queue.map((id) => (
          <span key={id} class={id === s.current ? 'is-now' : ''}>
            <svg width="22" height="22" aria-hidden="true">
              <rect width="22" height="22" fill="url(#v-blank)" stroke={INK} stroke-width="0.8" />
            </svg>
            <b>{g.name(id)}</b>
            {id === me ? <small>（你）</small> : null}
            <em class="b-cond">{tally.get(id) ?? 0} 票</em>
          </span>
        ))}
      </div>
      <div class="b-v-now">
        <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
          <circle cx="26" cy="26" r="22" fill="none" stroke="#e1d7bf" stroke-width="5" />
          <circle cx="26" cy="26" r="22" fill="none" stroke={INK} stroke-width="5" stroke-dasharray="138.2" stroke-dashoffset="55" transform="rotate(-90 26 26)" class="b-v-ring" />
        </svg>
        <div>
          <p class="b-v-now-h">
            <b>{g.name(s.current)}</b>
            <span>正在做出局选择</span>
          </p>
          <p class="b-v-now-s">不管选了什么，每个人都要等满几秒，所以看不出谁做了什么。</p>
        </div>
      </div>
      <p class="b-v-next">
        <span class="b-v-tag">接下来</span>
        <b>{nextId ? `${g.name(nextId)}${nextId === me ? '（你）' : ''}` : '投票结束后天黑'}</b>
        {nextId === me ? <small>轮到你时这里会换成你的选择</small> : null}
      </p>
      <svg width={W} height="300" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <defs>
          <radialGradient id="pin-g" cx="35%" cy="35%" r="70%">
            <stop offset="0" stop-color="#d9cdb4" />
            <stop offset="1" stop-color="#6f6252" />
          </radialGradient>
        </defs>
        <Pin x={22} y={8} />
        <Pin x={W - 22} y={8} />
      </svg>
    </div>
  );
}

function CardIcon({ kind, color }: { kind: 'none' | 'guess' | 'ask'; color: string }) {
  if (kind === 'none')
    return (
      <svg width="58" height="40" viewBox="0 0 58 40" aria-hidden="true">
        <path d="M4 8 C16 2 42 2 54 8 C55 22 46 34 29 34 C12 34 3 22 4 8 Z" fill="none" stroke={color} stroke-width="2" />
        <path d="M14 17 C17 14 22 14 24 17 C22 20 17 20 14 17 Z M34 17 C36 14 41 14 44 17 C41 20 36 20 34 17 Z" fill={color} />
        <path d="M22 27 C26 29 32 29 36 27" fill="none" stroke={color} stroke-width="1.6" stroke-linecap="round" />
      </svg>
    );
  if (kind === 'guess')
    return (
      <svg width="58" height="40" viewBox="0 0 58 40" aria-hidden="true">
        <rect x="12" y="3" width="34" height="34" fill="#efc965" stroke={INK} stroke-width="1.4" />
        <text x="29" y="29" text-anchor="middle" style="font-family: var(--serif); font-weight: 900; font-size: 24px; fill: #1e1b17">
          ?
        </text>
      </svg>
    );
  return (
    <svg width="58" height="40" viewBox="0 0 58 40" aria-hidden="true">
      <path d="M6 5 H52 V27 H24 L14 36 V27 H6 Z" fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" />
      <text x="29" y="21" text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: 12px; letter-spacing: 2px; fill: ${color}`}>
        是/否
      </text>
    </svg>
  );
}

const CARDS: { k: 'none' | 'guess' | 'ask'; num: string; title: string; desc: string }[] = [
  { k: 'none', num: '一', title: '什么都不做', desc: '装成被误投的国家玩家' },
  { k: 'guess', num: '二', title: '猜大国的词', desc: '只能猜一次，猜对白板直接赢' },
  { k: 'ask', num: '三', title: '问裁判', desc: '一个是非题，答案只给白板' },
];

function ExitMine({ g, s }: { g: G; s: Exit }) {
  const m = s.mine!;
  const reask = m.status === 'reask';
  const [sel, setSel] = useState<'none' | 'guess' | 'ask'>(reask ? 'ask' : m.options.includes('guess') ? 'guess' : 'none');
  const [text, setText] = useState('');
  const open = m.status === 'choosing' || reask;
  const blankPlayer = m.options.includes('guess') || reask;
  const max = sel === 'ask' ? 60 : 20;
  const act = () => {
    if (sel === 'none') return g.conn.act({ a: 'pass' });
    if (!okText(text, max)) return;
    g.conn.act(sel === 'guess' ? { a: 'guess', text: text.trim() } : { a: 'ask', text: text.trim() });
    setText('');
  };
  let foot: ComponentChildren;
  if (m.status === 'judging') foot = <p class="b-wait">裁判思考中…</p>;
  else if (m.status === 'done') foot = <p class="b-wait">已提交，稍后和大家一起公布</p>;
  else if (sel === 'none') {
    foot = (
      <>
        <p class="b-v-mine-note">{blankPlayer ? '什么都不做：大家看不出你是不是白板。' : '猜词和提问只有白板阵营能用。你可以继续听大家讨论，但不能再投票。'}</p>
        <div class="b-v-go">
          <Btn onClick={act}>{reask ? '放弃提问' : blankPlayer ? '就这样' : '好的'}</Btn>
        </div>
      </>
    );
  } else {
    foot = (
      <>
        <label class="b-v-guess">
          <input
            value={text}
            autoFocus
            placeholder={sel === 'guess' ? `大国的词是……${g.v.me.blank?.bigLen ? `（${g.v.me.blank.bigLen} 个字）` : ''}` : '一个是非题，例：大国的词是动物吗'}
            aria-label={sel === 'guess' ? '猜大国的词' : '问裁判'}
            onInput={(e) => setText(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                act();
              }
            }}
          />
          <span>{sel === 'guess' ? `只能猜一次${g.v.me.blank?.bigLen ? ` · 大国的词 ${g.v.me.blank.bigLen} 个字` : ''} · 大家都看得到` : '问题公开 · 回答下个夜晚只给白板'}</span>
        </label>
        {reask ? <p class="b-v-mine-note">裁判认为上一个问题不是有效的是非问题，可以重问一次，或者放弃。</p> : null}
        <div class="b-v-go">
          <Btn onClick={act} disabled={!okText(text, max)}>
            {sel === 'guess' ? '就猜这个' : '问裁判'}
          </Btn>
        </div>
      </>
    );
  }
  return (
    <>
      <div class="b-v-heading">
        <b>你出局了</b>
        <span>
          {open ? (blankPlayer ? '选一张卡' : '国家玩家只能选第一张') : '已经选好了'}
          {m.deadline !== null && open ? (
            <>
              {' · '}
              <Timer deadline={m.deadline} offset={g.offset} total={g.total} />
            </>
          ) : null}
        </span>
      </div>
      <div class="b-v-cards" role="radiogroup" aria-label="出局选择">
        {CARDS.map((c, i) => {
          const x = 24 + i * 119;
          const avail = m.options.includes(c.k) && open;
          const on = sel === c.k && open;
          const back = !blankPlayer && c.k !== 'none';
          const rot = on ? 'translateY(-12px) rotate(0deg)' : i === 0 ? 'rotate(-2.5deg)' : i === 2 ? 'rotate(2.5deg)' : 'rotate(0deg)';
          if (back) {
            return (
              <div key={c.k} class="b-v-card is-back" style={{ left: `${x}px`, transform: rot }} aria-hidden="true">
                <span>白板专用</span>
              </div>
            );
          }
          return (
            <button
              type="button"
              role="radio"
              aria-checked={on}
              key={c.k}
              disabled={!avail}
              class={`b-v-card ${on ? 'is-on' : ''}`}
              style={{ left: `${x}px`, transform: rot }}
              onClick={() => setSel(c.k)}
            >
              <span class="b-v-card-n">{c.num}</span>
              <span class="b-v-card-i">
                <CardIcon kind={c.k} color={on ? 'var(--acc)' : INK} />
              </span>
              <b>{c.k === 'ask' && reask ? '重新提问' : c.title}</b>
              <small>{c.desc}</small>
            </button>
          );
        })}
      </div>
      {foot}
    </>
  );
}

export function ExitScreen({ g, s }: { g: G; s: Exit }) {
  const votes = lastVotes(g);
  const tally = new Map<string, number>();
  if (votes) for (const t of Object.values(votes.ballots)) tally.set(t, (tally.get(t) ?? 0) + 1);
  const out = new Set([...g.v.players.filter((p) => !p.alive).map((p) => p.id), ...s.queue]);
  const mine = !!s.mine;
  return (
    <Stage bg="atlas" label="出局">
      <Layer label={`出局：${s.queue.map(g.name).join('、')}；票越多颜色越深`}>
        <DistrictMap g={g} mode={mine ? 'vote' : 'result'} tally={tally} out={out} current={s.current} />
      </Layer>
      <TitleBlock kicker={`第 ${s.day} 天`} title="出局" sub={mine ? '轮到你选了' : '出局的那块地变成空白'} />
      <Chips g={g} label="按住看词" />
      {mine ? <ExitMine g={g} s={s} /> : <Notice g={g} s={s} tally={tally} />}
    </Stage>
  );
}
