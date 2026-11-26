/**
 * 档案：一本上翻的测量手簿，摊在切割垫上。右边是索引页签（每轮 / 投票 / 秘密 / 全部），
 * 内容写在横线上：每轮是「人 × 天」的总表（每格是那天的提示和投给了谁），投票是手簿上画的岛和箭头，
 * 全部是倒着记的流水账。白天、夜晚都能打开，盖住整个屏幕；内容多了手簿就变长，往下滚。
 * 打开时手簿从下面推上来、封面沿顶上的线圈翻上去；合上时封面翻下来盖好，再退下去。
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { LogEntry, PlayerView } from '../engine/view.ts';
import { ANSWER, DIR, FACTION, ROLE, ROLE_DUTY, VERDICT, describe, resultLine } from './text.ts';
import { P2 } from './art.ts';
import { INK, Layer, MUTED, PAGE, Stage, WL, pad2, textWidth } from './board.tsx';
import { flags } from './flags.ts';
import { coastSeat, labelSpot } from './seats.ts';

type Tab = 'clues' | 'votes' | 'secret' | 'all';
type E<T extends LogEntry['t']> = Extract<LogEntry, { t: T }>;

const RULE = 28;
const TOP = 112;
const MIN_BOTTOM = 814;
/** 第 k 条横线上面那一格（k 从 1 起）。 */
const row = (k: number, span = 1) => ({ top: `${TOP + (k - 1) * RULE}px`, height: `${span * RULE}px` });

const nameOf = (v: PlayerView) => (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';

/** 一格横线上的一行字（贴着线写）。 */
function Line({ k, span = 1, left = 62, right = 46, children, class: cls }: { k: number; span?: number; left?: number; right?: number; children: ComponentChildren; class?: string }) {
  return (
    <div class={`b-fl-line ${cls ?? ''}`} style={{ ...row(k, span), left: `${left}px`, right: `${right}px` }}>
      {children}
    </div>
  );
}

function Heading({ k, children }: { k: number; children: ComponentChildren }) {
  return (
    <Line k={k} class="b-fl-heading">
      <b>{children}</b>
      <i aria-hidden="true" />
    </Line>
  );
}

function Verdict({ v }: { v: string | null }) {
  if (!v) return null;
  const good = v === '对' || v === '是';
  return <em class={`b-fl-v ${good ? 'is-good' : ''}`}>{v}</em>;
}

/* ================================================================ 手簿本身 */

function Book({ bottom, tabs, tab, me, day }: { bottom: number; tabs: [Tab, string][]; tab: Tab; me: string; day: number }) {
  const rules: string[] = [];
  for (let y = TOP + RULE; y < bottom - 4; y += RULE) rules.push(`M20 ${y} H344`);
  const coils = [];
  for (let x = 36; x < 336; x += 15) {
    coils.push(
      <g key={x}>
        <rect x={x - 2.5} y="36" width="5" height="26" rx="2.5" fill="none" stroke="#8b8273" stroke-width="2" />
        <ellipse cx={x} cy="68" rx="2.6" ry="2" fill="#2a2520" />
      </g>,
    );
  }
  return (
    <>
      <rect x="16" y="44" width="334" height={bottom - 38} fill={INK} opacity="0.35" transform="translate(4 7)" />
      <rect x="14" y="44" width="334" height={bottom - 38} fill="#a88b5f" stroke={INK} stroke-width="1.2" />
      {tabs.map(([k, label], i) => {
        const y = 128 + i * 70;
        const on = k === tab;
        return (
          <g key={k}>
            <path d={`M343 ${y} H366 Q372 ${y} 372 ${y + 6} V${y + 56} Q372 ${y + 62} 366 ${y + 62} H343`} fill={on ? PAGE : '#e4d3ad'} stroke={INK} stroke-width="1" />
            {Array.from(label).map((ch, j) => (
              <text key={j} x="357.5" y={y + 26 + j * 17} text-anchor="middle" style={`font-family: var(--serif); font-weight: ${on ? 900 : 700}; font-size: 13px; fill: ${on ? INK : MUTED}`}>
                {ch}
              </text>
            ))}
          </g>
        );
      })}
      <rect x="20" y="50" width="324" height={bottom - 50} fill={PAGE} stroke={INK} stroke-width="0.8" />
      {tabs.map(([k], i) => (k === tab ? <path key={k} d={`M343 ${128 + i * 70 + 0.6} V${128 + i * 70 + 61.4}`} stroke={PAGE} stroke-width="2.4" /> : null))}
      <path d={rules.join(' ')} fill="none" stroke={WL} stroke-width="0.6" opacity="0.4" />
      <path d={`M50 50 V${bottom} M53 50 V${bottom}`} stroke={WL} stroke-width="0.6" opacity="0.6" />
      <rect x="14" y="40" width="334" height="14" fill="#2a2520" />
      {coils}
      <text x="62" y="104" style={`font-family: var(--serif); font-weight: 900; font-size: 26px; letter-spacing: 0.3em; fill: ${INK}`}>
        档案
      </text>
      <text x="146" y="103" style={`font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.06em; fill: ${MUTED}`}>
        第 {day} 天 · {me}
      </text>
    </>
  );
}

/* ================================================================ 线索 */

interface P2Line {
  who: string;
  me: boolean;
  what: string;
  v: string | null;
}

function phase2Lines(v: PlayerView): P2Line[] {
  const name = nameOf(v);
  const out: P2Line[] = [];
  for (const e of v.log) {
    if (e.t === 'turn') {
      const me = e.player === v.me.id;
      if (e.action === 'timeout') out.push({ who: name(e.player), me, what: '超时，跳过', v: null });
      else if (e.action === 'guess') out.push({ who: name(e.player), me, what: `猜「${e.text}」`, v: VERDICT[e.verdict] });
      else out.push({ who: name(e.player), me, what: `问${FACTION[e.target]}的词「${e.text}」`, v: ANSWER[e.verdict] });
    } else if (e.t === 'relief') {
      if (e.action === 'ask') out.push({ who: '白板阵营', me: false, what: `问「${e.text}」`, v: ANSWER[e.verdict] });
      else if (e.action === 'guess') out.push({ who: '白板阵营', me: false, what: `猜大国的词「${e.text}」`, v: VERDICT[e.verdict] });
      else out.push({ who: '白板阵营', me: false, what: e.action === 'skipAsk' ? '没有提问' : '没有猜词', v: null });
    } else if (e.t === 'raceGuess') {
      out.push({ who: name(e.player), me: e.player === v.me.id, what: `抢答「${e.text}」`, v: VERDICT[e.verdict] });
    } else if (e.t === 'bigChance') {
      if ('action' in e) out.push({ who: '大国', me: false, what: e.action === 'nobody' ? '已经没人了，没有机会猜' : '没有在时限内提交', v: null });
      else out.push({ who: '大国', me: e.player === v.me.id, what: `猜小国的词「${e.text}」（${name(e.player)}交的）`, v: VERDICT[e.verdict] });
    }
  }
  return out;
}

function cluesModel(v: PlayerView) {
  const clues = v.log.filter((e): e is E<'clue'> => e.t === 'clue');
  const nights = new Map(v.log.filter((e): e is E<'night'> => e.t === 'night').map((e) => [e.day, e]));
  const votes = new Map(v.log.filter((e): e is E<'votes'> => e.t === 'votes').map((e) => [e.day, e]));
  const days = [...new Set([...nights.keys(), ...clues.map((c) => c.day), ...votes.keys()])].sort((a, b) => a - b);
  const said = new Map(clues.map((c) => [`${c.day}:${c.player}`, c.text]));
  const outDay = new Map<string, number>();
  for (const e of votes.values()) for (const id of e.out) outDay.set(id, e.day);
  const p2 = phase2Lines(v);
  const n = v.players.length;
  // 表头 2 格 + 每人 2 格（提示、投给谁）+ 出局 2 格 + 说明 2 格
  const rules = days.length ? 2 + 2 * n + 2 + 3 + (p2.length ? 1 + p2.length : 0) : 2;
  return { days, nights, votes, said, outDay, p2, rules };
}

/** 每轮：一张「人 × 天」的总表，每格上面一行是那天的身份提示，下面一行是那天投给了谁；最后一行是那天谁出局。 */
function Clues({ v }: { v: PlayerView }) {
  const name = nameOf(v);
  const { days, nights, votes, said, outDay, p2 } = cluesModel(v);
  if (!days.length) {
    return (
      <Line k={2} class="b-fl-empty">
        还没有人给过身份提示。
      </Line>
    );
  }
  const n = v.players.length;
  const wide = days.length > 3;
  const colW = wide ? 64 : Math.floor(194 / days.length);
  const players = [...v.players].sort((a, b) => a.seat - b.seat);
  const after = 2 + 2 * n + 2 + 1;
  return (
    <>
      <div class="b-fl-table" style={{ top: `${TOP}px`, height: `${(2 + 2 * n + 2) * RULE}px` }} role="table" aria-label="每人每天的身份提示和投票">
        <div class="b-fl-names" role="rowgroup">
          <div class="b-fl-th" role="columnheader">
            玩家
          </div>
          {players.map((p, r) => {
            const od = outDay.get(p.id);
            const me = p.id === v.me.id;
            return (
              <div class={`b-fl-name ${me ? 'is-me' : ''} ${od ? 'is-out' : ''}`} role="rowheader" key={p.id}>
                <div>
                  <small class="b-mono">{pad2(r + 1)}</small>
                  <b>{p.name}</b>
                  {me ? <em>你</em> : null}
                </div>
                <div>{od ? <span>D{od} 出局</span> : null}</div>
              </div>
            );
          })}
          <div class="b-fl-foot-h">出局</div>
        </div>
        <div class={`b-fl-days ${wide ? 'is-wide' : ''}`} role="rowgroup">
          {days.map((d) => {
            const night = nights.get(d);
            const vote = votes.get(d);
            const got = new Map<string, number>();
            if (vote) for (const t of Object.values(vote.ballots)) got.set(t, (got.get(t) ?? 0) + 1);
            return (
              <div class="b-fl-col" style={{ width: `${colW}px` }} key={d}>
                <div class="b-fl-th">
                  <b class="b-cond">D{pad2(d)}</b>
                  {night ? (
                    <small>
                      从 {name(night.start)} {night.dir === 'cw' ? '↻' : '↺'}
                    </small>
                  ) : null}
                </div>
                {players.map((p) => {
                  const key = `${d}:${p.id}`;
                  const od = outDay.get(p.id);
                  const t = said.get(key);
                  const len = t ? Array.from(t).length : 0;
                  const to = vote?.ballots[p.id];
                  const outHere = !!vote && vote.out.includes(p.id);
                  return (
                    <div class={`b-fl-cell ${outHere ? 'is-out' : ''}`} role="cell" key={p.id}>
                      <div class="b-fl-say">
                        {said.has(key) ? (
                          t === null ? (
                            <span class="b-fl-none">没给</span>
                          ) : (
                            <b style={{ fontSize: `${len > 6 ? 11.5 : len > 4 ? 13 : 15}px` }}>{t}</b>
                          )
                        ) : od && d > od ? (
                          <span class="b-fl-gone">／</span>
                        ) : (
                          <span class="b-fl-gone">·</span>
                        )}
                        {got.get(p.id) ? <small aria-label={`得 ${got.get(p.id)} 票`}>{got.get(p.id)}</small> : null}
                      </div>
                      <div class="b-fl-to">
                        {to ? (
                          <span>
                            <i aria-hidden="true">→</i>
                            {to === p.id ? '自己' : name(to)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                <div class="b-fl-foot">
                  {vote ? (
                    vote.out.length ? (
                      <>
                        <b>{vote.out.map(name).join('、')}</b>
                        <small>{vote.out.length > 1 ? '平票，一起出局' : `${got.get(vote.out[0]) ?? 0} 票出局`}</small>
                      </>
                    ) : (
                      <small>没人出局</small>
                    )
                  ) : (
                    <small>还没投票</small>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Line k={after} span={2} class="b-fl-hint">
        {wide ? '每格：上面是那天的提示，下面是投给了谁；右上角的数字是这人那天得了几票。表格可以左右滑' : '每格：上面是那天的提示，下面是投给了谁；右上角的数字是这人那天得了几票'}
      </Line>
      {p2.length ? (
        <>
          <Heading k={after + 2}>第二阶段</Heading>
          {p2.map((l, i) => (
            <Line k={after + 3 + i} key={i} class="b-fl-p2">
              <small class="b-cond">{i + 1}</small>
              <b class={l.me ? 'is-me' : ''}>{l.who}</b>
              <span>{l.what}</span>
              <Verdict v={l.v} />
            </Line>
          ))}
        </>
      ) : null}
    </>
  );
}

/* ================================================================ 投票 */

const S = 0.82;
const CX = 196;
const CY = 318;
const tr = (x: number, y: number) => ({ x: CX + (x - 195) * S, y: CY + (y - 300) * S });

function votesModel(v: PlayerView, sel: number) {
  const rounds = v.log.filter((e): e is E<'votes'> => e.t === 'votes');
  const r = rounds.length ? rounds[Math.min(sel, rounds.length - 1)] : null;
  const tally = new Map<string, string[]>();
  if (r) for (const [voter, target] of Object.entries(r.ballots)) tally.set(target, [...(tally.get(target) ?? []), voter]);
  const name = nameOf(v);
  const ranked = [...tally.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([t, vs]) => ({ t, vs, span: textWidth(`投的人：${vs.map(name).join('、')}`, 11) > 270 ? 3 : 2 }));
  const rules = r ? 17 + ranked.reduce((a, x) => a + x.span, 0) : 2;
  return { rounds, r, ranked, rules };
}

function Votes({ v, sel, setSel }: { v: PlayerView; sel: number; setSel: (n: number) => void }) {
  const name = nameOf(v);
  const { rounds, r, ranked } = votesModel(v, sel);
  if (!r) {
    return (
      <Line k={2} class="b-fl-empty">
        还没有投过票。
      </Line>
    );
  }
  const idx = Math.min(sel, rounds.length - 1);
  const n = v.players.length;
  const outBefore = new Set<string>();
  for (const e of rounds) if (e.day < r.day) for (const id of e.out) outBefore.add(id);
  const seats = new Map(
    v.players.map((p) => {
      const c = coastSeat(P2.pts as number[][], p.seat, n, 195, 300);
      return [p.id, { at: tr(c.at.x, c.at.y), a: c.a }] as const;
    }),
  );
  const pull = (x: number, y: number, k: number) => {
    const dx = CX - x;
    const dy = CY - y;
    const L = Math.hypot(dx, dy) || 1;
    return { x: x + (dx / L) * k, y: y + (dy / L) * k };
  };
  const arrows = Object.entries(r.ballots).map(([voter, target]) => {
    const a = seats.get(voter);
    const b = seats.get(target);
    if (!a || !b) return null;
    const mine = voter === v.me.id;
    const col = mine ? 'var(--acc)' : INK;
    const mk = mine ? 'url(#b-fl-am)' : 'url(#b-fl-a)';
    const sw = mine ? 1.8 : 1.2;
    if (voter === target) {
      const lx = a.at.x + 14 * Math.cos(a.a);
      const ly = a.at.y + 14 * Math.sin(a.a);
      return (
        <g key={voter}>
          <circle cx={lx} cy={ly} r="7" fill="none" stroke={col} stroke-width={sw} />
          <path d={`M${lx + 5} ${ly - 5} l2.5 4 l-4.5 0.5 Z`} fill={col} />
        </g>
      );
    }
    const s = pull(a.at.x, a.at.y, 11);
    const e = pull(b.at.x, b.at.y, 11);
    const mx = (s.x + e.x) / 2;
    const my = (s.y + e.y) / 2;
    const qx = mx + (CX - mx) * 0.45;
    const qy = my + (CY - my) * 0.45;
    return <path key={voter} d={`M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`} fill="none" stroke={col} stroke-width={sw} marker-end={mk} />;
  });
  const selfVoters = new Set(Object.entries(r.ballots).filter(([a, b]) => a === b).map(([a]) => a));
  let k = 15;
  return (
    <>
      <div class="b-fl-daypick" style={{ top: `${TOP + 8}px` }} role="tablist" aria-label="选择哪一天">
        {rounds.map((x, i) => (
          <button type="button" role="tab" aria-selected={i === idx} class={i === idx ? 'is-on' : ''} onClick={() => setSel(i)} key={i}>
            D{pad2(x.day)}
          </button>
        ))}
      </div>
      <p class="b-fl-votenote" style={{ top: `${TOP + 14}px` }}>
        箭头从投票的人指向被投的人
      </p>
      <Layer h={TOP + 14 * RULE} label={`第 ${r.day} 天的投票：箭头从投票的人指向被投的人`}>
        <defs>
          <marker id="b-fl-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill={INK} />
          </marker>
          <marker id="b-fl-am" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="var(--acc)" />
          </marker>
        </defs>
        <g transform={`translate(${(CX - 195 * S).toFixed(2)} ${(CY - 300 * S).toFixed(2)}) scale(${S})`}>
          <path d={P2.coast} fill={PAGE} stroke={INK} stroke-width={(1.5 / S).toFixed(2)} stroke-linejoin="round" />
          <path d={P2.coastIn} fill="none" stroke={INK} stroke-width={(0.5 / S).toFixed(2)} opacity="0.4" stroke-dasharray="3 3" />
        </g>
        <text x={CX} y={CY + 4} text-anchor="middle" style="font-family: var(--serif); font-weight: 700; font-size: 11px; letter-spacing: 0.4em; fill: #b3a994">
          圆桌
        </text>
        {arrows}
        {v.players.map((p) => {
          const s = seats.get(p.id)!;
          const { x, y } = s.at;
          const gone = outBefore.has(p.id);
          const out = r.out.includes(p.id);
          const me = p.id === v.me.id;
          const w = textWidth(p.name, 13) + (me ? 14 : 0);
          const l = labelSpot(s.at, s.a, selfVoters.has(p.id) ? 30 : 17, w, 26, 340);
          return (
            <g key={p.id}>
              {gone ? (
                <>
                  <circle cx={x} cy={y} r="5" fill={PAGE} stroke="#8b8273" stroke-width="1" />
                  <path d={`M${x - 3.5} ${y + 3.5} L${x + 3.5} ${y - 3.5}`} stroke="#8b8273" stroke-width="1" />
                </>
              ) : out ? (
                <rect x={x - 6.5} y={y - 6.5} width="13" height="13" fill={INK} />
              ) : (
                <circle cx={x} cy={y} r="5" fill={INK} />
              )}
              {me ? <circle cx={x} cy={y} r="9" fill="none" stroke="var(--acc)" stroke-width="1.6" /> : null}
              <text x={l.x} y={l.y} text-anchor={l.anchor} style={`font-family: var(--serif); font-weight: 700; font-size: 13px; fill: ${gone ? '#8b8273' : INK}; paint-order: stroke; stroke: ${PAGE}; stroke-width: 3px`}>
                {p.name}
                {me ? <tspan dx="2" style="font-family: var(--sans); font-size: 9.5px; fill: var(--acc-text)">你</tspan> : null}
              </text>
              {out ? (
                <text x={l.x} y={l.anchor === 'middle' && !l.below ? l.y - 13 : l.y + 12} text-anchor={l.anchor} style={`font-size: 9.5px; font-weight: 700; fill: ${INK}; paint-order: stroke; stroke: ${PAGE}; stroke-width: 3px`}>
                  出局
                </text>
              ) : null}
            </g>
          );
        })}
      </Layer>
      <Heading k={14}>D{pad2(r.day)} 计票</Heading>
      {ranked.map(({ t, vs, span }) => {
        const top = k;
        k += span;
        const out = r.out.includes(t);
        return (
          <div key={t}>
            <Line k={top + 1} class="b-fl-tally">
              <b>{name(t)}</b>
              <svg width={vs.length * 8 + 4} height="20" viewBox={`0 0 ${vs.length * 8 + 4} 20`} aria-hidden="true">
                {vs.map((_, i) => (
                  <path key={i} d={`M${4 + i * 8} 2 L${3 + i * 8} 19`} stroke={INK} stroke-width="1.8" stroke-linecap="round" />
                ))}
              </svg>
              <span class="b-cond">{vs.length} 票</span>
              {out ? <em>出局</em> : null}
            </Line>
            <Line k={top + 2} span={span - 1} class="b-fl-voters">
              投的人：
              {vs.map((id, i) => (
                <span key={id} class={id === v.me.id ? 'is-me' : ''}>
                  {i ? '、' : ''}
                  {name(id)}
                </span>
              ))}
            </Line>
          </div>
        );
      })}
      <Line k={k + 1} class="b-fl-hint">
        {r.out.length > 1 ? `平票，${r.out.length} 个人一起出局。` : r.out.length ? '票最多的人出局。' : ''}
        {v.rules.untimed ? '' : '没投的人算投自己。'}
      </Line>
    </>
  );
}

/* ================================================================ 秘密（只有白板阵营有） */

function secretModel(v: PlayerView) {
  const b = v.me.blank;
  if (!b) return { rules: 2 };
  const answers = v.log.filter((e): e is E<'answer'> => e.t === 'answer');
  return { rules: 1 + 1 + 2 + 1 + 1 + Math.max(1, b.teammates.length) + 1 + 1 + Math.max(2, answers.length) };
}

function Secret({ v }: { v: PlayerView }) {
  const name = nameOf(v);
  const b = v.me.blank;
  if (!b) return null;
  const answers = v.log.filter((e): e is E<'answer'> => e.t === 'answer');
  const k1 = 6;
  const k2 = k1 + 1 + Math.max(1, b.teammates.length) + 1;
  return (
    <>
      <Heading k={1}>你的身份</Heading>
      <Line k={2} class="b-fl-role">
        <b>{ROLE[b.role]}</b>
      </Line>
      <Line k={3} span={2} class="b-fl-text">
        {ROLE_DUTY[b.role]}。目标是猜中大国的词{b.bigLen ? `（${b.bigLen} 个字）` : ''}。
      </Line>
      <Heading k={k1}>队友</Heading>
      {b.teammates.length ? (
        b.teammates.map((t, i) => (
          <Line k={k1 + 1 + i} key={t.id} class="b-fl-mate">
            <b>{name(t.id)}</b>
            <span>{t.role ? ROLE[t.role] : '白板阵营'}</span>
          </Line>
        ))
      ) : (
        <Line k={k1 + 1} class="b-fl-empty">
          你看不到其他队友。
        </Line>
      )}
      <Heading k={k2}>裁判私下的回答</Heading>
      {answers.length ? (
        answers.map((a, i) => (
          <Line k={k2 + 1 + i} key={i} class="b-fl-p2">
            <span>「{a.question}」</span>
            <Verdict v={ANSWER[a.answer]} />
          </Line>
        ))
      ) : (
        <Line k={k2 + 1} span={2} class="b-fl-text b-fl-muted">
          还没有。白板出局时问裁判的问题，回答会在下一个夜晚出现在这里。
        </Line>
      )}
    </>
  );
}

/* ================================================================ 全部 */

interface Group {
  title: string;
  items: { text: string; tone?: string; span: number }[];
}

function groupsOf(v: PlayerView): Group[] {
  const name = nameOf(v);
  const groups: Group[] = [];
  let cur: Group = { title: '开局', items: [] };
  for (const e of v.log) {
    if (e.t === 'night') {
      if (cur.items.length) groups.push(cur);
      cur = { title: `第 ${e.day} 天 · 从 ${name(e.start)} 开始${DIR[e.dir]}`, items: [] };
      continue;
    } else if (e.t === 'phase2') {
      if (cur.items.length) groups.push(cur);
      cur = { title: '第二阶段', items: [] };
    }
    const d = describe(e, name);
    if (d) cur.items.push({ text: d.text, tone: d.tone, span: Math.min(3, Math.ceil(textWidth(d.text, 12) / 258)) });
  }
  if (cur.items.length) groups.push(cur);
  return groups.reverse().map((g) => ({ ...g, items: [...g.items].reverse() }));
}

function allModel(v: PlayerView) {
  const groups = groupsOf(v);
  const banner = v.phase === 'over' && v.result ? 1 : 0;
  const rules = banner + groups.reduce((a, g) => a + 2 + g.items.reduce((b, it) => b + it.span, 0), 0) + 1;
  return { groups, banner, rules };
}

function All({ v }: { v: PlayerView }) {
  const { groups, banner } = allModel(v);
  let k = banner;
  return (
    <>
      {banner ? (
        <Line k={1} class="b-fl-banner">
          游戏结束 · {resultLine(v.result!)}
        </Line>
      ) : null}
      {groups.map((g, gi) => {
        k += 2;
        const head = k;
        return (
          <div key={gi}>
            <Line k={head} class="b-fl-group">
              {g.title}
            </Line>
            {g.items.map((it, i) => {
              const top = k + 1;
              k += it.span;
              return (
                <Line k={top} span={it.span} key={i} class={`b-fl-item tone-${it.tone ?? 'none'}`}>
                  <i aria-hidden="true" />
                  <span>{it.text}</span>
                  {it.tone === 'secret' ? <em>私下</em> : null}
                </Line>
              );
            })}
          </div>
        );
      })}
      {!groups.length ? (
        <Line k={2} class="b-fl-empty">
          还没有记录。
        </Line>
      ) : null}
    </>
  );
}

/* ================================================================ 封面 */

/** 封面合上时上沿的位置（线圈下面）。 */
const COVER_TOP = 56;
const COVER_H = 790;

function Cover({ me, day }: { me: string; day: number }) {
  const holes = [];
  for (let x = 36; x < 336; x += 15) holes.push(<ellipse key={x} cx={x - 14} cy="12" rx="2.6" ry="2" fill="#2a2520" />);
  return (
    <svg width="334" height={COVER_H} viewBox={`0 0 334 ${COVER_H}`} aria-hidden="true">
      <rect x="0.6" y="0.6" width="332.8" height={COVER_H - 1.2} fill="#a88b5f" stroke={INK} stroke-width="1.2" />
      <rect x="9" y="22" width="316" height={COVER_H - 32} fill="none" stroke={INK} stroke-width="0.6" opacity="0.55" />
      {holes}
      <g transform="translate(167 150)">
        <rect x="-108" y="-62" width="216" height="132" fill={PAGE} stroke={INK} stroke-width="1.1" />
        <rect x="-103" y="-57" width="206" height="122" fill="none" stroke={INK} stroke-width="0.5" />
        <text x="7" y="-6" text-anchor="middle" style={`font-family: var(--serif); font-weight: 900; font-size: 36px; letter-spacing: 0.4em; fill: ${INK}`}>
          档案
        </text>
        <path d="M-80 10 H80" stroke={INK} stroke-width="0.8" />
        <text y="30" text-anchor="middle" style={`font-family: var(--serif); font-weight: 700; font-size: 11.5px; letter-spacing: 0.3em; fill: ${INK}`}>
          测量手簿
        </text>
        <text y="51" text-anchor="middle" style={`font-family: var(--mono); font-size: 9.5px; fill: ${MUTED}`}>
          第 {day} 天 · {me}
        </text>
      </g>
      <text x="167" y={COVER_H - 26} text-anchor="middle" style={`font-family: var(--serif); font-weight: 700; font-size: 10px; letter-spacing: 0.3em; fill: ${INK}; opacity: 0.7`}>
        大国小国 · 圆桌岛
      </text>
    </svg>
  );
}

/* ================================================================ 档案 */

const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** 合上要多久（封面翻下来 + 手簿退下去），和 file.css 里的过渡一致。 */
const CLOSE_MS = 560;

export function Dossier({ v, onClose }: { v: PlayerView; onClose: () => void }) {
  const blank = !!v.me.blank;
  const [tab, setTab] = useState<Tab>(flags.dossier && (flags.dossier !== 'secret' || blank) ? flags.dossier : 'clues');
  const rounds = v.log.filter((e) => e.t === 'votes').length;
  const [sel, setSel] = useState(Math.max(0, rounds - 1));
  // 预览里一开始就开着的（flags.dossier）直接是打开的样子
  const [open, setOpen] = useState(flags.dossier !== null);
  const [hinge, setHinge] = useState(COVER_TOP);
  const wrap = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  useLayoutEffect(() => {
    if (open) return;
    // 先让浏览器把「合着、在下面」的样子算出来，再换成打开，过渡才会从那里开始
    void wrap.current?.offsetWidth;
    setOpen(true);
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (reduced()) return onClose();
    // 往下翻过了，封面就从现在看到的这一页的上沿翻下来
    const el = wrap.current;
    const u = el ? Math.min(el.clientWidth, 440) / 390 : 1;
    const at = el ? el.scrollTop / u : 0;
    setHinge(Math.max(COVER_TOP, at + 8));
    setOpen(false);
    window.setTimeout(onClose, CLOSE_MS);
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const tabs: [Tab, string][] = [['clues', '每轮'], ['votes', '投票'], ...(blank ? ([['secret', '秘密']] as [Tab, string][]) : []), ['all', '全部']];
  const rules =
    tab === 'clues' ? cluesModel(v).rules : tab === 'votes' ? votesModel(v, sel).rules : tab === 'secret' ? secretModel(v).rules : allModel(v).rules;
  const bottom = Math.max(MIN_BOTTOM, TOP + (rules + 2) * RULE);
  const H = bottom + 30;

  return (
    <div class={`b-fl-wrap ${open ? 'is-open' : ''}`} role="dialog" aria-modal="true" aria-label="档案" ref={wrap}>
      <Stage bg="mat" mode="scroll" h={H} frame={false} label="档案">
        <div class="b-fl-lift" style={{ height: `${H}px` }}>
          <Layer h={H}>
            <Book bottom={bottom} tabs={tabs} tab={tab} me={v.me.name} day={v.day} />
          </Layer>
          <div role="tablist" aria-label="档案分页">
            {tabs.map(([k, label], i) => (
              <button type="button" role="tab" aria-selected={tab === k} aria-label={label} class="b-fl-tab" style={{ top: `${128 + i * 70}px` }} onClick={() => setTab(k)} key={k} />
            ))}
          </div>
          <button type="button" class="b-fl-x" aria-label="合上档案" onClick={close}>
            ×
          </button>
          <div class="b-fl-body" key={tab}>
            {tab === 'clues' ? <Clues v={v} /> : tab === 'votes' ? <Votes v={v} sel={sel} setSel={setSel} /> : tab === 'secret' ? <Secret v={v} /> : <All v={v} />}
          </div>
          <div class="b-fl-hinge" style={{ top: `${hinge}px` }} aria-hidden="true">
            <div class="b-fl-cover">
              <Cover me={v.me.name} day={v.day} />
            </div>
          </div>
        </div>
      </Stage>
    </div>
  );
}

/** game.tsx 用：开着就放一本手簿；合上的动画由手簿自己放完再通知。 */
export function DossierLayer({ on, v, onClose }: { on: boolean; v: PlayerView; onClose: () => void }) {
  return on ? <Dossier v={v} onClose={onClose} /> : null;
}
