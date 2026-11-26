/**
 * 主持人台：一张「总控图」。不参与游戏的出题人 / 人类裁判用，什么都标在同一张图上——
 * 两国写着各自的词，每个座位涂着阵营色、白板写着子身份；待判定的提问或猜词是一张从卷筒上撕下来的单子；
 * 答案是这张图的图例（界碑就是提示）；整局记录（含私下内容）是单子的存根。整页往下滚。
 */

import type { BlankRole, Faction, Timers } from '../engine/rules.ts';
import type { JudgeView } from '../engine/view.ts';
import type { RoomConnection, Snapshot } from './net.ts';
import { ANSWER, DIR, FACTION, ROLE, describe, phaseTitle, resultLine } from './text.ts';
import { P2 } from './art.ts';
import { BIG, Btn, INK, Layer, MUTED, SMALL, Stage, Timer, WL, pad2, textWidth, useTick } from './board.tsx';
import { coastSeat, labelSpot } from './seats.ts';
import { PINS, QPin } from './atlas.tsx';

type Pending = JudgeView['pending'][number];
type RawStep = JudgeView['step'];

const ORIGIN: Record<string, string> = { exit: '出局提问', turn: '第二阶段回合', relief: '白板救济', race: '抢答', bigChance: '大国的一次机会' };
const HALO = 'paint-order: stroke; stroke: #d8e3df; stroke-width: 4px; stroke-linejoin: round';
const FCOL: Record<Faction, string> = { big: BIG, small: SMALL, blank: '#ffffff' };

/** 白板的子身份去掉「白板」两个字：起点 / 方向 / 独行。 */
export const roleShort = (r: BlankRole | null) => (r ? ROLE[r].replace('白板', '') : '');

/** 一个人的阵营写成一行小字：大国 / 小国 / 白板 · 起点。 */
export const factionLine = (f: Faction, r: BlankRole | null) => (f === 'blank' ? `白板${r ? ` · ${roleShort(r)}` : ''}` : FACTION[f]);

/** 界碑（提示）：done = 已立，todo = 虚线。 */
export function stone(x: number, y: number, n: number, done: boolean) {
  const shape = 'M-7 7 V-4 Q-7 -9 0 -9 Q7 -9 7 -4 V7 Z';
  return done ? (
    <g transform={`translate(${x} ${y})`} key={`s${n}`}>
      <path d={shape} fill={INK} />
      <path d="M-7 7 H7" stroke={INK} stroke-width="2.4" />
      <text y="4" text-anchor="middle" style="font-family: var(--cond); font-weight: 600; font-size: 10px; fill: #ffffff">
        {n}
      </text>
    </g>
  ) : (
    <g transform={`translate(${x} ${y})`} key={`s${n}`}>
      <path d={shape} fill="#fbf6e8" stroke={INK} stroke-width="0.9" stroke-dasharray="2 1.6" />
      <text y="4" text-anchor="middle" style={`font-family: var(--cond); font-weight: 600; font-size: 9.5px; fill: ${MUTED}`}>
        {n}
      </text>
    </g>
  );
}


/** 原始步骤的截止时间（主持人看得到出局者的真实截止时间）。 */
function rawDeadline(s: RawStep): number | null {
  switch (s.k) {
    case 'night':
    case 'clue':
    case 'discussion':
    case 'vote':
    case 'turn':
    case 'relief':
    case 'bigChance':
      return s.deadline;
    case 'exit':
      return s.cur.deadline ?? (s.cur.done ? s.cur.showUntil : null);
    case 'race':
      return s.nextHintAt ?? s.endAt;
    default:
      return null;
  }
}

/** 这一步的总时长（画倒计时圆环用）。 */
function totalOf(s: RawStep, t: Timers | undefined): number | null {
  if (!t) return null;
  switch (s.k) {
    case 'night':
      return t.night;
    case 'clue':
      return t.clue;
    case 'discussion':
      return t.discussion;
    case 'vote':
      return t.vote;
    case 'exit':
      return s.cur.deadline ? t.exitChoice : t.exitMinShow;
    case 'turn':
      return t.turn;
    case 'relief':
      return s.stage === 'ask' ? t.reliefAsk : t.reliefGuess;
    case 'bigChance':
      return t.bigChance;
    case 'race':
      return t.hintInterval;
    default:
      return null;
  }
}

/** 当前步骤的一句话说明（主持人看得到的细节）。 */
function stepLine(s: RawStep, name: (id: string) => string): string {
  switch (s.k) {
    case 'night':
      return `已提交 ${Object.keys(s.picks).length} 人`;
    case 'clue':
      return `从 ${name(s.start)} 开始${DIR[s.dir]}，现在 ${name(s.order[s.idx])}`;
    case 'discussion':
      return `轮流发言，现在 ${name(s.order[s.idx])}（${s.idx + 1} / ${s.order.length}）`;
    case 'vote':
      return `已投 ${Object.keys(s.ballots).length} 人`;
    case 'exit':
      return `${name(s.cur.player)} 出局选择中`;
    case 'turn':
      return `第 ${s.round} 轮，轮到 ${name(s.order[s.idx])}`;
    case 'relief':
      return s.stage === 'ask' ? '白板救济：提问' : '白板救济：猜词';
    case 'race':
      return s.purpose === 'first' ? '抢第一名' : '抢第二名';
    case 'bigChance':
      return '大国阵营商量中';
    default:
      return '游戏结束';
  }
}

/** 现在正在行动的人（图上加脉冲圈）。 */
function actorOf(s: RawStep): string | null {
  if (s.k === 'clue' || s.k === 'discussion' || s.k === 'turn') return s.order[s.idx] ?? null;
  if (s.k === 'exit') return s.cur.player;
  if (s.k === 'bigChance') return s.by;
  return null;
}

function askerOf(r: Pending, j: JudgeView, name: (id: string) => string): string {
  const s = j.step;
  if (r.origin === 'exit' && s.k === 'exit') return name(s.cur.player);
  if (r.origin === 'turn' && s.k === 'turn') return name(s.order[s.idx]);
  if (r.origin === 'relief') return '白板阵营';
  if (r.origin === 'bigChance' && s.k === 'bigChance' && s.by) return `${name(s.by)}（代表大国）`;
  if (r.origin === 'race' && s.k === 'race' && r.kind === 'guess') {
    const q = s.queue.find((x) => x.id === r.ref);
    if (q) return name(q.player);
  }
  return '';
}

/* ================================================================ 总控图 */

function wordPlate(x: number, y: number, cap: string, word: string) {
  const size = Math.min(24, Math.floor(118 / Math.max(1, Array.from(word).length)));
  return (
    <g>
      <text x={x} y={y - 16} text-anchor="middle" style="font-family: var(--serif); font-weight: 700; font-size: 10.5px; letter-spacing: 0.3em; fill: #3b362f">
        {cap}
      </text>
      <text
        x={x + size * 0.08}
        y={y + 12}
        text-anchor="middle"
        style={`font-family: var(--serif); font-weight: 900; font-size: ${size}px; letter-spacing: 0.16em; fill: ${INK}; paint-order: stroke; stroke: #fbf3dc; stroke-width: 5px; stroke-linejoin: round`}
      >
        {word}
      </text>
    </g>
  );
}

function MasterMap({ j, dy, mark }: { j: JudgeView; dy: number; mark: 'big' | 'small' | null }) {
  const s = j.step;
  const n = j.players.length;
  const actor = actorOf(s);
  const order = s.k === 'turn' ? s.order : null;
  const [[bx0, by0], [bx1, by1]] = P2.border as number[][];
  const bigAt = { x: 150, y: 262 };
  const smallAt = { x: 272, y: 312 };
  const hintTotal = 1 + j.secret.hints.length;
  const shownMarkers = Math.min(P2.markers.length, hintTotal);
  return (
    <g transform={`translate(0 ${dy})`}>
      <defs>
        <pattern id="jd-hb" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 V7" stroke="#d9b54a" stroke-width="0.7" />
        </pattern>
        <pattern id="jd-hs" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <path d="M0 0 V7" stroke="#87b46c" stroke-width="0.7" />
        </pattern>
      </defs>
      <g fill="none" stroke={WL} stroke-width="0.7">
        {(P2.waterlines as { d: string; op: number }[]).map((w, i) => (
          <path d={w.d} opacity={w.op} key={i} />
        ))}
      </g>
      <path d={P2.big} fill={BIG} />
      <path d={P2.big} fill="url(#jd-hb)" opacity="0.55" />
      <path d={P2.small} fill={SMALL} />
      <path d={P2.small} fill="url(#jd-hs)" opacity="0.55" />
      <path d={P2.coastIn} fill="none" stroke={INK} stroke-width="0.5" opacity="0.3" />
      <path d={`M${bx0} ${by0} L${bx1} ${by1}`} stroke="#fbf6e8" stroke-width="7" stroke-linecap="round" />
      <path d={`M${bx0} ${by0} L${bx1} ${by1}`} stroke={INK} stroke-width="1.5" stroke-dasharray="9 3 1.6 3" />
      <path d={P2.coast} fill="none" stroke={INK} stroke-width="1.5" stroke-linejoin="round" />
      {wordPlate(bigAt.x, bigAt.y, '大国的词', j.secret.big)}
      {wordPlate(smallAt.x, smallAt.y, '小国的词', j.secret.small)}
      {mark ? (
        <rect
          x={(mark === 'big' ? bigAt.x : smallAt.x) - 50}
          y={(mark === 'big' ? bigAt.y : smallAt.y) - 32}
          width="100"
          height="54"
          fill="none"
          stroke="var(--acc)"
          stroke-width="1.6"
          stroke-dasharray="4 3"
        />
      ) : null}
      {s.k === 'race'
        ? null
        : (['big', 'small'] as const).flatMap((side) =>
            j.log
              .filter((e): e is Extract<JudgeView['log'][number], { t: 'turn' }> => e.t === 'turn' && e.action === 'ask' && e.target === side)
              .slice(-2)
              .map((e, i) => {
                const [x, y, r] = PINS[side][i];
                return e.action === 'ask' ? <QPin x={x} y={y} rot={r} who={j.players.find((p) => p.id === e.player)?.name ?? '?'} q={e.text} ans={ANSWER[e.verdict] ?? '?'} /> : null;
              }),
          )}
      {(P2.markers as number[][]).slice(0, shownMarkers).map(([mx, my], i) => stone(mx, my, i + 1, i < j.hintsShown))}
      {j.players.map((p) => {
        const seat = coastSeat(P2.pts as number[][], p.seat, n, 195, 300);
        const { x, y } = seat.at;
        const dash = p.faction === 'blank' ? '2.4 1.6' : undefined;
        const role = factionLine(p.faction, p.role);
        const now = p.id === actor;
        const cap = `${role}${p.alive ? '' : ' · 出局'}${now ? ' · 正在行动' : ''}`;
        const num = order && p.alive && order.includes(p.id) ? `${order.indexOf(p.id) + 1} ` : '';
        const w = Math.max(textWidth(num + p.name, 14), textWidth(cap, 10));
        const l = labelSpot(seat.at, seat.a, 20, w, 18, 372);
        const capY = l.anchor === 'middle' && !l.below ? l.y - 14 : l.y + 13;
        return (
          <g key={p.id}>
            <circle cx={x} cy={y} r="6" fill={FCOL[p.faction]} stroke={INK} stroke-width="1.3" stroke-dasharray={dash} />
            {p.alive ? null : <path d={`M${x - 4.5} ${y + 4.5} L${x + 4.5} ${y - 4.5}`} stroke={INK} stroke-width="1.1" />}
            {now ? (
              <>
                <circle cx={x} cy={y} r="10" fill="none" stroke="var(--acc)" stroke-width="1.8" class="b-pulse" />
                <circle cx={x} cy={y} r="11" fill="none" stroke="var(--acc)" stroke-width="1.8" />
              </>
            ) : null}
            <text x={l.x} y={l.y} text-anchor={l.anchor} style={`font-family: var(--serif); font-weight: 700; font-size: 14px; fill: ${p.alive ? INK : '#8b8273'}; ${HALO}`}>
              {num ? <tspan style={`font-family: var(--cond); font-weight: 600; font-size: 12px; fill: ${now ? 'var(--acc-text)' : MUTED}`}>{num}</tspan> : null}
              {p.name}
            </text>
            <text x={l.x} y={capY} text-anchor={l.anchor} style={`font-size: 10px; font-weight: ${now ? 700 : 400}; fill: ${now ? 'var(--acc-text)' : MUTED}; ${HALO}`}>
              {cap}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/* ================================================================ 撕下来的单子 */

function zigzag(w: number, h: number): string {
  let top = '';
  for (let x = 0; x < w - 7; x += 8) top += ` L${x + 4} 0 L${x + 8} 5`;
  let bot = '';
  for (let x = 0; x < w - 7; x += 8) bot += ` L${w - x - 4} ${h} L${w - x - 8} ${h - 5}`;
  return `M0 5${top} L${w} 5 L${w} ${h - 5}${bot} L0 ${h - 5} Z`;
}

function Roll({ w, h, rule }: { w: number; h: number; rule?: number }) {
  const shape = zigzag(w, h);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" class="b-jd-roll">
      <path d={shape} fill={INK} opacity="0.14" transform="translate(4 5)" />
      <path d={shape} fill="#fffdf6" stroke={INK} stroke-width="0.9" />
      {rule ? <path d={`M14 ${rule} H${w - 14}`} stroke={INK} stroke-width="0.6" stroke-dasharray="2 2.5" /> : null}
    </svg>
  );
}

const TICKET_W = 338;
const ticketH = (r: Pending, human: boolean) => (human ? (r.kind === 'guess' ? 178 : 192) : 136) + (Array.from(r.text).length > 12 ? 30 : 0);

function Ticket({ r, j, human, conn, offset, name, no, top }: { r: Pending; j: JudgeView; human: boolean; conn: RoomConnection; offset: number; name: (id: string) => string; no: number; top: number }) {
  const who = askerOf(r, j, name);
  const about =
    r.kind === 'guess'
      ? `猜${FACTION[r.target]}的词（${j.secret[r.target]}）`
      : r.target
        ? `问${FACTION[r.target]}的词（${j.secret[r.target]}）`
        : '没有指定对象（按大国的词理解）';
  const options = r.kind === 'guess' ? (['correct', 'wrong'] as const) : (['yes', 'no', 'unknown', 'invalid'] as const);
  const label = (o: string) => (o === 'correct' ? '对' : o === 'wrong' ? '错' : ANSWER[o]);
  const h = ticketH(r, human);
  return (
    <section class="b-jd-ticket" style={{ top: `${top}px`, height: `${h}px` }} aria-label={`待判定：${r.text}`}>
      <Roll w={TICKET_W} h={h} rule={40} />
      <div class="b-jd-tk-head">
        <b>{human ? '待你判定' : 'AI 判定中'}</b>
        <span class="b-mono">
          {ORIGIN[r.origin]} · No.{pad2(no)}
        </span>
        <span class="b-jd-tk-time">
          <Timer deadline={r.deadline} offset={offset} />
        </span>
      </div>
      <p class="b-jd-tk-who">
        {who ? <b>{who}</b> : null} {about}
      </p>
      <p class="b-jd-tk-q">「{r.text}」</p>
      {human ? (
        <>
          <div class="b-jd-keys" role="group" aria-label="判定">
            {options.map((o) => (
              <button type="button" class={`b-jd-key ${label(o).length > 1 ? 'is-long' : ''}`} onClick={() => conn.send({ t: 'verdict', id: r.id, verdict: o })} key={o}>
                {label(o)}
              </button>
            ))}
          </div>
          <p class="b-jd-tk-foot">超时没判就自动按兜底处理{r.kind === 'question' ? ' · 问题和答案所有人都看得到' : ''}</p>
        </>
      ) : (
        <p class="b-jd-tk-foot">这一局由 AI 裁判判定，你在这里旁观。</p>
      )}
    </section>
  );
}

/* ================================================================ 图例（答案） */

function legendRows(j: JudgeView) {
  const note = j.secret.judgeNote ? Math.ceil(textWidth(j.secret.judgeNote, 11.5) / 250) : 0;
  const hints = j.secret.hints.length + 1;
  return { note, hints, h: 52 + 3 * 32 + (note ? note * 18 + 14 : 0) + 16 + hints * 26 + 36 };
}

function Legend({ j, top }: { j: JudgeView; top: number }) {
  const { h } = legendRows(j);
  const aliases = (a: string[]) => (a.length ? `别名：${a.join('、')}` : '');
  return (
    <section class="b-jd-legend" style={{ top: `${top}px`, height: `${h}px` }} aria-label="答案">
      <p class="b-jd-lg-h">
        <b>图例 · 答案{j.pairNo ? ` · 第 ${j.pairNo} 题` : ''}</b>
        <span>只有你看得到</span>
      </p>
      <dl class="b-jd-lg-rows">
        <div>
          <dt>
            <i class="b-jd-sw" style={{ background: BIG }} />
            大国词
          </dt>
          <dd>
            <b>{j.secret.big}</b>
            <small>{aliases(j.secret.bigAliases)}</small>
          </dd>
        </div>
        <div>
          <dt>
            <i class="b-jd-sw" style={{ background: SMALL }} />
            小国词
          </dt>
          <dd>
            <b>{j.secret.small}</b>
            <small>{aliases(j.secret.smallAliases)}</small>
          </dd>
        </div>
        <div>
          <dt>
            <svg width="22" height="14" aria-hidden="true">
              <path d="M0 7 H22" stroke={INK} stroke-width="2" stroke-dasharray="7 2 1.5 2" />
            </svg>
            联系
          </dt>
          <dd>
            <b>{j.secret.link}</b>
            <small>{j.secret.linkType ? `类型：${j.secret.linkType}` : ''}</small>
          </dd>
        </div>
      </dl>
      {j.secret.judgeNote ? (
        <p class="b-jd-lg-note">
          <span>裁判须知</span>
          {j.secret.judgeNote}
        </p>
      ) : null}
      <ol class="b-jd-lg-hints">
        {[...j.secret.hints, j.secret.link].map((hint, i, all) => {
          const done = i < j.hintsShown;
          const link = i === all.length - 1;
          return (
            <li key={i} class={done ? 'is-done' : ''}>
              <svg width="18" height="20" viewBox="-9 -10 18 20" aria-hidden="true">
                {stone(0, 0, i + 1, done)}
              </svg>
              <span>
                {link ? '联系：' : ''}
                {hint}
              </span>
              <em>{done ? '已公布' : '未公布'}</em>
            </li>
          );
        })}
      </ol>
      <p class="b-jd-lg-foot">已公布 {j.hintsShown} 条。抢答时按间隔一条条公布，提示放完最后一块才是联系。</p>
    </section>
  );
}

/* ================================================================ 记录（单子的存根） */

interface LogLine {
  tag: string | null;
  text: string;
  tone?: string;
  lines: number;
}

function logLines(j: JudgeView, name: (id: string) => string): LogLine[] {
  const out: LogLine[] = [];
  for (const e of [...j.log].reverse()) {
    let tag: string | null = null;
    let text: string;
    let tone: string | undefined;
    if (e.t === 'chat') {
      tag = e.channel === 'blanks' ? '白板频道' : e.channel === 'big' ? '大国频道' : '公共';
      text = `${name(e.player)}：${e.text}`;
    } else {
      const d = describe(e, name);
      if (!d) continue;
      text = d.text;
      tone = d.tone;
      if (e.to === 'blanks') tag = '只给白板';
      else if (e.to === 'some') tag = '私下';
    }
    const w = textWidth(text, 11.5) + (tag ? tag.length * 10 + 18 : 0);
    out.push({ tag, text, tone, lines: Math.max(1, Math.ceil(w / 276)) });
  }
  return out;
}

const logH = (lines: LogLine[]) => 52 + lines.reduce((a, l) => a + 12 + l.lines * 17, 0) + 24;

function StubRoll({ lines, top }: { lines: LogLine[]; top: number }) {
  const h = logH(lines);
  return (
    <section class="b-jd-log" style={{ top: `${top}px`, height: `${h}px` }} aria-label="整局记录">
      <Roll w={TICKET_W} h={h} />
      <p class="b-jd-log-h">
        <b>整局记录</b>
        <span>含私下内容 · 最新在上</span>
      </p>
      <ol>
        {lines.map((l, i) => (
          <li key={i} class={l.tone ? `tone-${l.tone}` : ''}>
            <small class="b-mono">{pad2(lines.length - i)}</small>
            <span>
              {l.tag ? <em>{l.tag}</em> : null}
              {l.text}
            </span>
          </li>
        ))}
        {!lines.length ? <li class="is-empty">还没有记录</li> : null}
      </ol>
    </section>
  );
}

/* ================================================================ 页面 */

function HeadBand({ j, snap }: { j: JudgeView; snap: Snapshot }) {
  useTick(250);
  const s = j.step;
  const name = (id: string) => j.players.find((p) => p.id === id)?.name ?? '?';
  const title = phaseTitle(j);
  const deadline = rawDeadline(s);
  const total = totalOf(s, snap.room?.settings.timers);
  const left = deadline === null ? null : Math.max(0, deadline - (Date.now() + snap.offset));
  const frac = left !== null && total ? Math.min(1, left / total) : 1;
  const secs = left === null ? 0 : Math.ceil(left / 1000);
  const human = j.judgeMode === 'human';
  return (
    <header class="b-jd-band">
      <p class="b-jd-k">主持人 · 总控图</p>
      <h1 class="b-jd-t">{title.cn}</h1>
      <p class="b-jd-s">
        {human ? '人工裁判' : 'AI 裁判'} · {stepLine(s, name)} · 你看得到所有人的身份
      </p>
      {left !== null ? (
        <div class={`b-jd-clock ${secs <= 5 ? 'is-low' : ''}`} role="timer" aria-label={`剩余 ${secs} 秒`}>
          <svg width="34" height="34" viewBox="0 0 26 26" aria-hidden="true">
            <circle cx="13" cy="13" r="11" fill="none" stroke="rgba(251, 246, 234, 0.25)" stroke-width="2.4" />
            <circle cx="13" cy="13" r="11" fill="none" stroke="var(--acc)" stroke-width="2.4" stroke-dasharray="69.1" stroke-dashoffset={(69.1 * (1 - frac)).toFixed(1)} transform="rotate(-90 13 13)" />
          </svg>
          <span class="b-cond">
            {Math.floor(secs / 60)}:{pad2(secs % 60)}
          </span>
        </div>
      ) : null}
    </header>
  );
}

export function JudgeScreen({ conn, snap, onLeave }: { conn: RoomConnection; snap: Snapshot; onLeave: () => void }) {
  const j = snap.judge!;
  const s = j.step;
  const name = (id: string) => j.players.find((p) => p.id === id)?.name ?? '?';
  const human = j.judgeMode === 'human';
  const over = s.k === 'over' && !!j.result;
  const canHint = s.k === 'race' && s.nextHintAt !== null;
  const seq = [...j.secret.hints, j.secret.link];
  const nextHint = seq[j.hintsShown];
  const nextIsLink = j.hintsShown === seq.length - 1;
  const first = j.pending[0];
  const mark = first ? (first.kind === 'guess' ? first.target : (first.target ?? 'big')) : null;

  // 从上往下排：标题带 → （结算）→ 总控图 → 待判定 → （提前公布）→ 图例 → 记录
  let y = 112;
  const resultTop = y;
  if (over) y += 112;
  const mapTop = y;
  y += 340;
  const tickets = j.pending.map((r) => {
    const top = y;
    y += ticketH(r, human) + 16;
    return top;
  });
  const idleTop = y;
  if (!j.pending.length) y += 92;
  const hintTop = y;
  if (canHint && nextHint) y += 92;
  const legendTop = y;
  y += legendRows(j).h + 20;
  const lines = logLines(j, name);
  const logTop = y;
  y += logH(lines) + 40;
  const H = Math.max(844, y);

  return (
    <Stage bg="atlas" mode="scroll" h={H} label="主持人台">
      <Layer h={H} label="主持人的总控图：两国的词、每个人的身份都标在图上">
        <MasterMap j={j} dy={mapTop - 140} mark={mark} />
      </Layer>
      <HeadBand j={j} snap={snap} />
      {over ? (
        <section class="b-jd-result" style={{ top: `${resultTop}px` }}>
          <p class="b-jd-result-t">{resultLine(j.result!)}</p>
          <Btn onClick={onLeave}>回到房间</Btn>
        </section>
      ) : null}
      {j.pending.map((r, i) => (
        <Ticket key={r.id} r={r} j={j} human={human} conn={conn} offset={snap.offset} name={name} no={i + 1} top={tickets[i]} />
      ))}
      {!j.pending.length ? (
        <section class="b-jd-idle" style={{ top: `${idleTop}px` }}>
          <Roll w={TICKET_W} h={76} />
          <p>
            <b>{human ? '待你判定' : '裁判'}</b>
            <span>{human ? '现在没有需要判定的提问或猜词。' : '这一局由 AI 裁判判定，你在这里旁观。现在没有正在判定的内容。'}</span>
          </p>
        </section>
      ) : null}
      {canHint && nextHint ? (
        <button type="button" class="b-jd-hint" style={{ top: `${hintTop}px` }} onClick={() => conn.send({ t: 'hint' })}>
          <svg width="26" height="26" viewBox="-13 -13 26 26" aria-hidden="true">
            <path d="M-8 9 V-3 Q-8 -10 0 -10 Q8 -10 8 -3 V9 Z" fill="#ffffff" />
            <text y="5" text-anchor="middle" style="font-family: var(--cond); font-weight: 600; font-size: 12px; fill: var(--acc)">
              {j.hintsShown + 1}
            </text>
          </svg>
          <span>
            <b>现在立第 {j.hintsShown + 1} 块界碑</b>
            <small>
              提前公布{nextIsLink ? '联系' : `提示 ${j.hintsShown + 1}`}：{nextHint}
            </small>
          </span>
        </button>
      ) : null}
      <Legend j={j} top={legendTop} />
      <StubRoll lines={lines} top={logTop} />
    </Stage>
  );
}

