/**
 * 夜晚：同一座圆桌岛，换成夜航海图。灯塔在圆桌中间；起点白板点座位，灯塔的光照过去；
 * 方向白板选顺 / 逆时针，海岸线上的箭头就朝那边跑；国家玩家点确认，灯塔的光慢慢转。
 * 下面的面板是一把放在海图上的航海尺（带罗盘），所有人的版面一样，旁人看不出谁是白板。
 */

import { useState } from 'preact/hooks';
import type { StepView } from '../engine/view.ts';
import { DIR } from './text.ts';
import { ISLAND_ICON, NIGHT_ART, TOPO_COAST, TOPO_COAST_LEN } from './art.ts';
import { Art, Layer, Stage, Timer } from './board.tsx';
import { Chips, type G } from './game.tsx';
import { holdHandlers } from './identity.tsx';
import { ringLabel, ringPoint } from './seats.ts';

type Night = Extract<StepView, { k: 'night' }>;

const INK = '#e8ecf3';
const LINE = '#7fa6c8';
const SEA = '#0e2a3c';
const MUTED = '#b3c1d3';
const NA = 'var(--night-acc)';
const LH = { x: 212, y: 300 };
const LBL = 'font-family: var(--serif); font-weight: 700; font-size: 13.5px; paint-order: stroke; stroke: #0e2a3c; stroke-width: 3.4px; stroke-linejoin: round';

function bearingOf(x: number, y: number) {
  return ((Math.atan2(x - LH.x, -(y - LH.y)) * 180) / Math.PI + 360) % 360;
}

function Beam({ x, y }: { x: number; y: number }) {
  const ang = Math.atan2(y - LH.y, x - LH.x);
  const r = Math.hypot(x - LH.x, y - LH.y) + 24;
  const h = (9 * Math.PI) / 180;
  const p0 = [LH.x + r * Math.cos(ang - h), LH.y + r * Math.sin(ang - h)];
  const p1 = [LH.x + r * Math.cos(ang + h), LH.y + r * Math.sin(ang + h)];
  const mid = [LH.x + (r - 54) * Math.cos(ang), LH.y + (r - 54) * Math.sin(ang)];
  const deg = (ang * 180) / Math.PI;
  return (
    <g>
      <defs>
        <radialGradient id="nb-beam" cx={LH.x} cy={LH.y} r={r} gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#ff6a3d" stop-opacity="0.7" />
          <stop offset="0.85" stop-color="#ff6a3d" stop-opacity="0.22" />
          <stop offset="1" stop-color="#ff6a3d" stop-opacity="0" />
        </radialGradient>
      </defs>
      <path d={`M${LH.x} ${LH.y} L${p0[0].toFixed(1)} ${p0[1].toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Z`} fill="url(#nb-beam)" />
      <path d={`M${LH.x} ${LH.y} L${x.toFixed(1)} ${y.toFixed(1)}`} stroke={NA} stroke-width="0.9" stroke-dasharray="4 3" opacity="0.9" />
      <text x={mid[0]} y={mid[1] - 5} text-anchor="middle" transform={`rotate(${deg.toFixed(1)} ${mid[0].toFixed(1)} ${mid[1].toFixed(1)})`} style="font-family: var(--mono); font-size: 7px; fill: var(--night-acc)">
        {String(Math.round(bearingOf(x, y))).padStart(3, '0')}°
      </text>
    </g>
  );
}

function CoastFlow({ dir }: { dir: 'cw' | 'ccw' }) {
  const cw = dir === 'cw';
  const lap = 14;
  const dash = 9.5;
  const speed = TOPO_COAST_LEN / lap;
  return (
    <g>
      <path d={TOPO_COAST} fill="none" stroke={NA} stroke-width="3.4" opacity="0.25" stroke-linejoin="round" />
      <path d={TOPO_COAST} fill="none" stroke={NA} stroke-width="2.2" stroke-linecap="round" stroke-dasharray={`0.1 ${dash - 0.1}`}>
        <animate attributeName="stroke-dashoffset" values={`0;${cw ? -dash : dash}`} dur={`${(dash / speed).toFixed(3)}s`} repeatCount="indefinite" />
      </path>
      {[0, 1, 2, 3, 4].map((k) => (
        <path key={`${dir}${k}`} d="M-5.5 -4.8 L4.8 0 L-5.5 4.8 Z" fill={NA} stroke={SEA} stroke-width="0.9" stroke-linejoin="round">
          <animateMotion
            dur={`${lap}s`}
            begin={`-${((lap * k) / 5).toFixed(2)}s`}
            repeatCount="indefinite"
            rotate={cw ? 'auto' : 'auto-reverse'}
            keyPoints={cw ? '0;1' : '1;0'}
            keyTimes="0;1"
            calcMode="linear"
            {...({ path: TOPO_COAST } as Record<string, string>)}
          />
        </path>
      ))}
    </g>
  );
}

function Sweep() {
  return (
    <g>
      <defs>
        <radialGradient id="nb-sweep" cx={LH.x} cy={LH.y} r="151" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#f3d98a" stop-opacity="0.38" />
          <stop offset="1" stop-color="#f3d98a" stop-opacity="0" />
        </radialGradient>
      </defs>
      <g class="b-n-sweep" style={{ transformOrigin: `${LH.x}px ${LH.y}px` }}>
        <path d={`M${LH.x} ${LH.y} L${LH.x + 150} ${LH.y - 18} A151 151 0 0 1 ${LH.x + 150} ${LH.y + 18} Z`} fill="url(#nb-sweep)" />
      </g>
    </g>
  );
}

/** 航海尺上的罗盘：指向灯塔照着的人，或者画出方向。 */
function Dial({ kind, pick }: { kind: 'bearing' | 'cw' | 'ccw' | 'both' | 'idle'; pick: { x: number; y: number } | null }) {
  const ticks: string[] = [];
  for (let k = 0; k < 36; k++) {
    const a = (k * 10 * Math.PI) / 180;
    const r1 = k % 3 === 0 ? 24 : 27;
    ticks.push(`M${(29.5 * Math.sin(a)).toFixed(2)} ${(-29.5 * Math.cos(a)).toFixed(2)} L${(r1 * Math.sin(a)).toFixed(2)} ${(-r1 * Math.cos(a)).toFixed(2)}`);
  }
  const b = pick ? bearingOf(pick.x, pick.y) : 0;
  const nx = 21 * Math.sin((b * Math.PI) / 180);
  const ny = -21 * Math.cos((b * Math.PI) / 180);
  const r = kind === 'both' ? 13 : 16;
  const flip = kind === 'ccw' ? 'scale(-1 1)' : undefined;
  return (
    <g>
      <circle r="33" fill="#13243a" stroke={INK} stroke-width="1.1" />
      <path d={ticks.join(' ')} stroke={INK} stroke-width="0.8" opacity="0.75" />
      <text y="-17" text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 8px; fill: #e8ecf3">
        N
      </text>
      {(kind === 'bearing' || kind === 'both') && pick ? (
        <g>
          <path d={`M${(-nx * 0.35).toFixed(1)} ${(-ny * 0.35).toFixed(1)} L${nx.toFixed(1)} ${ny.toFixed(1)}`} stroke={NA} stroke-width="2.4" stroke-linecap="round" />
          <circle r="2.6" fill={NA} />
          {kind === 'bearing' ? (
            <text y="17" text-anchor="middle" style="font-family: var(--mono); font-size: 7.5px; fill: var(--night-acc)">
              {String(Math.round(b)).padStart(3, '0')}°
            </text>
          ) : null}
        </g>
      ) : null}
      {kind === 'cw' || kind === 'ccw' || kind === 'both' ? (
        <g transform={flip}>
          <path d={`M0 ${-r} A${r} ${r} 0 1 1 ${(-r * 0.87).toFixed(1)} ${(-r * 0.5).toFixed(1)}`} fill="none" stroke={NA} stroke-width="2" stroke-linecap="round" />
          <path d={`M-4 ${-r - 4} L1.5 ${-r} L-4 ${-r + 4}`} fill="none" stroke={NA} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      ) : null}
      {kind === 'idle' ? (
        <g>
          <g class="b-n-drift">
            <path d="M0 -20 L3 0 L0 4 L-3 0 Z" fill={INK} />
            <path d="M0 20 L3 0 L-3 0 Z" fill="none" stroke={INK} stroke-width="0.9" />
          </g>
          <circle r="2" fill="#13243a" stroke={INK} stroke-width="0.8" />
        </g>
      ) : null}
    </g>
  );
}

/** 航海尺：半透明的有机玻璃，两边有刻度，上边嵌着一个罗盘。里面放这一夜要做的事。 */
function Plotter({ top, rot, dial, children }: { top: number; rot: number; dial: preact.ComponentChildren; children: preact.ComponentChildren }) {
  const W = 350;
  const H = 844 - 26 - top;
  const ticks: string[] = [];
  let i = 0;
  for (let y = 14; y < H - 58; y += 6, i++) {
    const L = i % 5 === 0 ? 9 : 5;
    ticks.push(`M0 ${y} H${L} M${W} ${y} H${W - L}`);
  }
  const nums: number[] = [];
  for (let y = 14; y < H - 58; y += 30) nums.push(y);
  return (
    <div class="b-plotter" style={{ top: `${top}px`, transform: `rotate(${rot}deg)` }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="10" fill="rgba(30, 50, 77, 0.94)" stroke={INK} stroke-width="1" />
        <rect x="5" y="5" width={W - 10} height={H - 10} rx="7" fill="none" stroke={INK} stroke-width="0.4" opacity="0.35" />
        <path d={ticks.join(' ')} stroke={INK} stroke-width="0.7" opacity="0.6" />
        {nums.map((y, k) => (
          <text x="11" y={y + 2.5} style="font-family: var(--mono); font-size: 6px; fill: #7fa6c8">
            {k}
          </text>
        ))}
        <text x={W - 14} y={H - 62} text-anchor="end" style="font-family: var(--mono); font-size: 6.5px; letter-spacing: 0.12em; fill: #7fa6c8">
          NO. 3572
        </text>
        <g transform={`translate(${W - 54} 4)`}>{dial}</g>
      </svg>
      <div class="b-plotter-in">{children}</div>
    </div>
  );
}

function DirTiles({ value, onPick, compact }: { value: 'cw' | 'ccw' | null; onPick: (d: 'cw' | 'ccw') => void; compact?: boolean }) {
  return (
    <div class="b-n-dirs" role="radiogroup" aria-label="方向">
      {(['cw', 'ccw'] as const).map((d) => (
        <button type="button" role="radio" aria-checked={value === d} class={`b-n-dir ${compact ? 'is-compact' : ''} ${value === d ? 'is-on' : ''}`} onClick={() => onPick(d)} key={d}>
          <svg width={compact ? 30 : 44} height={compact ? 29 : 42} viewBox="70 190 266 252" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ISLAND_ICON[d] }} />
          <span>{DIR[d]}</span>
        </button>
      ))}
    </div>
  );
}

export function NightScreen({ g, s }: { g: G; s: Night }) {
  const { v, conn, name } = g;
  const [pick, setPick] = useState<string | null>(s.myPick?.player ?? null);
  const [dir, setDir] = useState<'cw' | 'ccw' | null>(s.myPick?.dir ?? null);
  const wantStart = s.decides.includes('start');
  const wantDir = s.decides.includes('dir');
  const n = v.players.length;
  const done = !!s.myPick;
  const changed = done && ((wantStart && pick !== s.myPick?.player) || (wantDir && dir !== s.myPick?.dir));
  const ready = (!wantStart || !!pick) && (!wantDir || !!dir);
  const submit = () => conn.act(wantStart || wantDir ? { a: 'night', player: wantStart ? pick! : undefined, dir: wantDir ? dir! : undefined } : { a: 'night' });

  const seats = v.players.map((p) => {
    const at = ringPoint(p.seat, n);
    return { p, at, label: ringLabel(at, 17) };
  });
  const pickAt = pick ? seats.find((x) => x.p.id === pick)?.at ?? null : null;
  let order: string[] = [];
  if (wantStart && wantDir && pick && dir) {
    const alive = v.players.filter((p) => p.alive).sort((a, b) => a.seat - b.seat);
    const i0 = alive.findIndex((p) => p.id === pick);
    if (i0 >= 0) order = alive.map((_, k) => alive[(i0 + (dir === 'cw' ? k : alive.length - k)) % alive.length].id);
  }

  const kind: 'bearing' | 'cw' | 'ccw' | 'both' | 'idle' = wantStart && wantDir ? 'both' : wantStart ? (pick ? 'bearing' : 'idle') : wantDir ? (dir ?? 'idle') : 'idle';
  const blankish = wantStart || wantDir;
  let title: string;
  let sub: string;
  if (!s.canPick) {
    title = '天黑请闭眼';
    sub = v.me.alive ? '白板阵营正在行动，请等待天亮。' : '你已出局。等待天亮。';
  } else if (wantStart && wantDir) {
    title = '选一个人，再选一个方向';
    sub = '地图上的数字就是明天说话的顺序。';
  } else if (wantStart) {
    title = '选明天从谁开始';
    sub = '点地图上的人，明天从这个人开始给身份提示。';
  } else if (wantDir) {
    title = '选明天的方向';
    sub = '明天大家按这个方向轮流给身份提示。';
  } else if (done) {
    title = '已确认，等天亮';
    sub = '所有人都确认后天就亮了。';
  } else {
    title = '今晚你不用选';
    sub = '点「确认」，然后等天亮。白板阵营在选人，从动作上看不出谁是谁。';
  }
  const top = wantDir ? 520 : 556;

  return (
    <Stage bg="night" label={`第 ${s.day} 夜`}>
      <Art svg={NIGHT_ART} />
      <Layer label={`第 ${s.day} 夜的海图${pick ? `：灯塔的光照向${name(pick)}` : ''}`}>
        {wantDir && dir ? <CoastFlow dir={dir} /> : null}
        {wantStart && pickAt ? <Beam x={pickAt.x} y={pickAt.y} /> : null}
        {!blankish ? <Sweep /> : null}
        {seats.map(({ p, at, label }) => {
          const me = p.id === v.me.id;
          const on = p.id === pick && wantStart;
          const tappable = wantStart && p.alive;
          const ord = order.indexOf(p.id);
          return (
            <g key={p.id}>
              {!p.alive ? (
                <>
                  <path d={`M${at.x - 5} ${at.y - 5} L${at.x + 5} ${at.y + 5} M${at.x + 5} ${at.y - 5} L${at.x - 5} ${at.y + 5}`} stroke={LINE} stroke-width="1.6" stroke-linecap="round" />
                  <text x={label.x} y={label.y} text-anchor={label.anchor} style={`${LBL}; fill: ${LINE}; opacity: 0.8; font-weight: 600`}>
                    {p.name}
                  </text>
                  <text x={label.x} y={label.y + 12} text-anchor={label.anchor} style="font-size: 9.5px; fill: #7fa6c8; paint-order: stroke; stroke: #0e2a3c; stroke-width: 3px">
                    出局
                  </text>
                </>
              ) : on ? (
                <>
                  <circle cx={at.x} cy={at.y} r="14" fill="none" stroke={NA} stroke-width="1" opacity="0.55" />
                  <circle cx={at.x} cy={at.y} r="8" fill={NA} />
                  <circle cx={at.x} cy={at.y} r="2.6" fill="#132033" />
                  <text x={label.x} y={label.y} text-anchor={label.anchor} style={`${LBL}; fill: var(--night-acc)`}>
                    {p.name}
                  </text>
                </>
              ) : (
                <>
                  {tappable ? <circle cx={at.x} cy={at.y} r="11" fill="none" stroke={NA} stroke-width="1" stroke-dasharray="2.5 2.2" opacity="0.8" /> : null}
                  <circle cx={at.x} cy={at.y} r="6.5" fill={SEA} stroke={INK} stroke-width="1.4" />
                  <circle cx={at.x} cy={at.y} r="1.9" fill={INK} />
                  <text x={label.x} y={label.y} text-anchor={label.anchor} style={`${LBL}; fill: ${INK}`}>
                    {p.name}
                  </text>
                </>
              )}
              {me ? (
                <text x={label.x} y={label.y + (p.alive ? 12 : 24)} text-anchor={label.anchor} style="font-size: 9.5px; font-weight: 700; fill: var(--night-acc); paint-order: stroke; stroke: #0e2a3c; stroke-width: 3px">
                  你
                </text>
              ) : null}
              {ord >= 0 ? (
                (() => {
                  const dx = LH.x - at.x;
                  const dy = LH.y - at.y;
                  const dl = Math.hypot(dx, dy) || 1;
                  const ox = at.x + (dx / dl) * 19;
                  const oy = at.y + (dy / dl) * 19;
                  return (
                    <g>
                      <circle cx={ox} cy={oy} r="6.3" fill="#132033" stroke={INK} stroke-width="0.8" />
                      <text x={ox} y={oy + 3.4} text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 10px; fill: #e8ecf3">
                        {ord + 1}
                      </text>
                    </g>
                  );
                })()
              ) : null}
              {tappable ? (
                <circle
                  cx={at.x}
                  cy={at.y}
                  r="20"
                  fill="transparent"
                  role="radio"
                  aria-checked={on}
                  aria-label={`明天从 ${p.name} 开始`}
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setPick(p.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPick(p.id)}
                />
              ) : null}
            </g>
          );
        })}
      </Layer>

      <div class="b-n-head">
        <h1>第 {s.day} 夜</h1>
      </div>
      <p class="b-n-sub">把手机拿近一点，别让旁边的人看到</p>
      <Chips g={g} hold={false} />

      <Plotter top={top} rot={wantDir ? 0.5 : -0.6} dial={<Dial kind={kind} pick={pickAt} />}>
        <div class="b-n-title">
          <p>{title}</p>
          <p class="b-n-titlesub">
            {sub}
            {s.deadline !== null ? (
              <>
                {' '}
                <Timer deadline={s.deadline} offset={g.offset} total={g.total} night />
              </>
            ) : null}
          </p>
        </div>
        {wantStart ? (
          <p class="b-n-summary">
            <span>明天从</span>
            <b class={pick ? '' : 'is-empty'}>{pick ? name(pick) : '还没选'}</b>
            <span>开始</span>
            <small>点地图上的人</small>
          </p>
        ) : null}
        {wantDir ? <DirTiles value={dir} onPick={setDir} compact={wantStart} /> : null}
        {s.canPick ? (
          <button type="button" class="b-btn b-n-confirm" disabled={!ready || (done && !changed)} onClick={submit}>
            <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 10.5 L8.5 15 L16.5 5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{done ? (changed ? '改好了，确认' : '已确认') : '确认'}</span>
          </button>
        ) : (
          <p class="b-wait" style={{ color: MUTED }}>
            等天亮
          </p>
        )}
        {done && blankish ? <p class="b-n-note">已提交。天亮前还可以改。</p> : null}
        <button type="button" class="b-n-hold" {...holdHandlers(g.hold)}>
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="7.5" fill="none" stroke="#132033" stroke-width="1.6" />
            <circle cx="10" cy="10" r="2.5" fill="#132033" />
          </svg>
          <span>按住看身份和今晚的任务</span>
          <small>松手就盖上</small>
        </button>
      </Plotter>
    </Stage>
  );
}
