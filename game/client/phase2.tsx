/**
 * 第二阶段：圆桌岛分成大国、小国两块，国界未定，两国的名牌空着。公开的提问像纸条一样钉在被问的那块地上；
 * 抢答时提示像界碑一样沿国界一块块立起来，最后一块是联系。操作区是一面插在黑白测量杆上的旗
 * （白板阵营救济时是一面白旗）。
 */

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { LogEntry, StepView } from '../engine/view.ts';
import { ANSWER, FACTION } from './text.ts';
import { AtlasSheet, Border, Caption, Coast, Dot, MeRing, Plate, QPin, SeatLabel, PINS, Stone, Territories, markerAt, placeSeats } from './atlas.tsx';
import { BIG, Btn, INK, Layer, MUTED, SMALL, Stage, Timer, TitleBlock, okText } from './board.tsx';
import { Chips, type G } from './game.tsx';

type Turn = Extract<StepView, { k: 'turn' }>;
type Relief = Extract<StepView, { k: 'relief' }>;
type Race = Extract<StepView, { k: 'race' }>;
type Big = Extract<StepView, { k: 'bigChance' }>;
type P2Step = Turn | Relief | Race | Big;
type TurnLog = Extract<LogEntry, { t: 'turn' }>;

const FLAG_ICON = (
  <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true">
    <path d="M3 1 V19" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />
    <path d="M4 2 H15 L12.5 6 L15 10 H4 Z" fill="#ffffff" />
  </svg>
);

/** 第二阶段的地图。 */
function PhaseMap({ g, s, mark }: { g: G; s: P2Step; mark?: 'big' | 'small' | null }) {
  const { v } = g;
  const n = v.players.length;
  const log = v.log;
  const turns = log.filter((e): e is TurnLog => e.t === 'turn');
  const asks = turns.filter((t): t is Extract<TurnLog, { action: 'ask' }> => t.action === 'ask');
  const pins: ComponentChildren[] = [];
  for (const side of s.k === 'race' ? [] : (['big', 'small'] as const)) {
    asks
      .filter((a) => a.target === side)
      .slice(-2)
      .forEach((a, i) => {
        const [x, y, r] = PINS[side][i];
        pins.push(<QPin x={x} y={y} rot={r} who={g.name(a.player)} q={a.text} ans={ANSWER[a.verdict] ?? '?'} />);
      });
  }
  const hints = v.hints;
  const race = s.k === 'race';
  // 旧服务器没有 hintTotal 时按「还有一条」算
  const total = Math.max(v.hintTotal ?? hints.length + 1, hints.length);
  const order = s.k === 'turn' ? s.order : [];
  const actor = s.k === 'turn' ? s.actor : null;
  const lastAct = new Map<string, string>();
  for (const t of turns) {
    if (t.action === 'guess') lastAct.set(t.player, t.verdict === 'correct' ? '!猜中了' : '猜错了');
    else if (t.action === 'ask') lastAct.set(t.player, `问了${FACTION[t.target]}的词`);
    else lastAct.set(t.player, '超时');
  }
  for (const e of log) {
    if (e.t === 'raceGuess') lastAct.set(e.player, e.verdict === 'correct' ? '!猜中了' : '猜错了');
    if (e.t === 'exit' && e.choice === 'guess' && e.guess?.verdict === 'correct') lastAct.set(e.player, '!猜中了');
  }
  const bigWord = v.revealed.big ?? null;
  const smallWord = v.revealed.small ?? null;
  return (
    <>
      <AtlasSheet />
      <Territories />
      <Border />
      <Coast />
      <Plate x={race ? 128 : 158} y={race ? 296 : 260} cap="大国的词" word={bigWord} mark={mark === 'big'} />
      <Plate x={race ? 278 : 266} y={race ? 330 : 298} cap="小国的词" word={smallWord} mark={mark === 'small'} />
      {pins}
      {race || hints.length
        ? Array.from({ length: Math.max(hints.length, race ? total : 0) }, (_, k) => {
            const p = markerAt(k, total);
            const st = k < hints.length ? (k === hints.length - 1 && race ? 'new' : 'done') : 'todo';
            return <Stone x={p.x} y={p.y} n={k + 1} state={st} />;
          })
        : null}
      {race || hints.length >= total
        ? (() => {
            // 最后一块界碑是联系（提示放完才立）
            const p = markerAt(total - 1, total);
            return (
              <text x={p.x + 12} y={p.y + 4} style="font-size: 9.5px; letter-spacing: 0.15em; fill: #5d564c; paint-order: stroke; stroke: #fbf3dc; stroke-width: 4px; stroke-linejoin: round">
                联系
              </text>
            );
          })()
        : null}
      {(() => {
        const caps = v.players.map((p) => (p.id === actor ? (p.id === v.me.id ? '!轮到你' : '!正在想') : (lastAct.get(p.id) ?? (p.alive ? '' : '出局'))));
        const spots = placeSeats(
          v.players.map((p, k) => ({
            seat: p.seat,
            nameW: Array.from(p.name).length * 14 + (p.id === v.me.id ? 14 : 0) + (order.includes(p.id) ? 10 : 0),
            capW: Array.from(caps[k].replace(/^!/, '')).length * 10,
            cap: !!caps[k],
          })),
          n,
        );
        return v.players.map((p, k) => ({ p, pl: spots[k], cap: caps[k] }));
      })().map(({ p, pl, cap }) => {
        const me = p.id === v.me.id;
        const dead = !p.alive;
        const idx = order.indexOf(p.id);
        const hot = cap.startsWith('!');
        return (
          <g key={p.id}>
            <Dot x={pl.at.x} y={pl.at.y} out={dead} />
            {p.id === actor ? <circle cx={pl.at.x} cy={pl.at.y} r="9" fill="none" stroke="var(--acc)" stroke-width="1.8" class="b-pulse" /> : null}
            {me ? <MeRing x={pl.at.x} y={pl.at.y} /> : null}
            <SeatLabel x={pl.label.x} y={pl.label.y} anchor={pl.anchor} name={p.name} me={me} dim={dead} num={idx >= 0 && !dead ? idx + 1 : undefined} numHot={p.id === actor} />
            {cap ? (
              <Caption x={pl.label.x} y={pl.capY} anchor={pl.anchor} hot={hot}>
                {cap.replace(/^!/, '')}
              </Caption>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

/** 插在黑白测量杆上的旗；white：白板阵营的白旗。 */
function Flag({ top = 462, bottom = 710, white }: { top?: number; bottom?: number; white?: boolean }) {
  const L = 38;
  const R = 364;
  const cloth = `M${L} ${top} C${L + 100} ${top - 9} ${L + 210} ${top + 9} ${R} ${top - 3} C${R + 9} ${top + 60} ${R - 8} ${top + 130} ${R + 1} ${bottom + 2} C${L + 220} ${bottom + 12} ${L + 100} ${bottom - 8} ${L} ${bottom} Z`;
  const stripes: ComponentChildren[] = [];
  for (let i = 0, y = 452; y < 808; y += 18, i++) stripes.push(<rect x="30" y={y} width="8" height="18" fill={i % 2 === 0 ? INK : '#fbf6e8'} />);
  return (
    <Layer style={{ pointerEvents: 'none' }}>
      <path d={cloth} fill={INK} opacity="0.13" transform="translate(4 5)" />
      <path d={cloth} fill={white ? '#ffffff' : '#fffaf0'} stroke={INK} stroke-width="1.1" stroke-dasharray={white ? '6 4' : undefined} />
      <rect x={L} y={top} width="12" height={bottom - top} fill={white ? '#f1f1ee' : '#efe5cc'} />
      <path d={`M${L + 12} ${top + 3} V${bottom - 3}`} stroke={INK} stroke-width="0.6" stroke-dasharray="3 2.5" />
      {stripes}
      <rect x="30" y="452" width="8" height="356" fill="none" stroke={INK} stroke-width="1" />
      <circle cx="34" cy="447" r="5" fill={INK} />
      <path d="M30 808 L34 826 L38 808 Z" fill={INK} />
      <ellipse cx="38" cy={top + 16} rx="7" ry="3.2" fill="none" stroke={INK} stroke-width="1.2" />
      <ellipse cx="38" cy={bottom - 16} rx="7" ry="3.2" fill="none" stroke={INK} stroke-width="1.2" />
    </Layer>
  );
}

function Cloth({ top = 478, children }: { top?: number; children: ComponentChildren }) {
  return (
    <div class="b-p-cloth" style={{ top: `${top}px` }}>
      {children}
    </div>
  );
}

/** 旗面上的一行手写栏（大字 + 光标 + 字数）。 */
function FlagInput({ label, value, setValue, max, size = 26, placeholder, onEnter, disabled }: { label: string; value: string; setValue: (v: string) => void; max: number; size?: number; placeholder?: string; onEnter: () => void; disabled?: boolean }) {
  const len = Array.from(value.trim()).length;
  return (
    <label class="b-p-write">
      <small>{label}</small>
      <span>
        <input
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          style={{ fontSize: `${size}px` }}
          enterKeyHint="send"
          onInput={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.isComposing) {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        <em class={len > max ? 'is-over' : ''}>
          {len} / {max}
        </em>
      </span>
    </label>
  );
}

function Tabs({ on, set }: { on: 'guess' | 'ask'; set: (m: 'guess' | 'ask') => void }) {
  return (
    <div role="tablist" class="b-p-tabs">
      {(
        [
          ['guess', '猜对方的词'],
          ['ask', '改为提问'],
        ] as const
      ).map(([k, label]) => (
        <button type="button" role="tab" aria-selected={on === k} class={on === k ? 'is-on' : ''} onClick={() => set(k)} key={k}>
          {label}
        </button>
      ))}
    </div>
  );
}

function wrongGuesses(g: G): string[] {
  const out: string[] = [];
  for (const e of g.v.log) {
    if (e.t === 'turn' && e.action === 'guess' && e.verdict === 'wrong') out.push(e.text);
    if (e.t === 'raceGuess' && e.verdict === 'wrong') out.push(e.text);
  }
  return [...new Set(out)].slice(-4);
}

function TurnPanel({ g, s, onTarget }: { g: G; s: Turn; onTarget: (t: 'big' | 'small' | null) => void }) {
  const { v, conn } = g;
  const mine = s.actor === v.me.id;
  const [mode, setModeState] = useState<'guess' | 'ask'>('guess');
  const [target, setTargetState] = useState<'big' | 'small' | null>(null);
  const setMode = (m: 'guess' | 'ask') => {
    setModeState(m);
    onTarget(m === 'ask' ? target : null);
  };
  const setTarget = (t: 'big' | 'small') => {
    setTargetState(t);
    onTarget(t);
  };
  const [text, setText] = useState('');
  const wrong = wrongGuesses(g);
  const max = mode === 'guess' ? 20 : 60;
  const go = () => {
    if (!okText(text, max)) return;
    if (mode === 'guess') conn.act({ a: 'guess', text: text.trim() });
    else if (target) conn.act({ a: 'ask', target, text: text.trim() });
    setText('');
  };
  const timer = s.deadline !== null ? <Timer deadline={s.deadline} offset={g.offset} total={g.total} /> : null;
  if (!mine || s.judging) {
    const recent = v.log.filter((e): e is TurnLog => e.t === 'turn').slice(-3).reverse();
    return (
      <>
        <Flag />
        <Cloth>
          <p class="b-p-h">
            <b>{s.judging ? '裁判思考中…' : `轮到 ${g.name(s.actor)}`}</b>
            <span>{timer}</span>
          </p>
          <p class="b-note" style={{ marginTop: '6px' }}>
            {mine ? '你的问题 / 猜测已经交给裁判。' : `猜对方国家的词${s.canAsk ? '，或者改为向裁判问一个是非题' : ''}。先猜中的国家拿第一。`}
          </p>
          <ul class="b-p-recent">
            {recent.map((t, i) => (
              <li key={i}>
                <b>{g.name(t.player)}</b>
                {t.action === 'timeout' ? (
                  <span>超时，跳过</span>
                ) : t.action === 'guess' ? (
                  <span>
                    猜「{t.text}」<em>{t.verdict === 'correct' ? '对' : '错'}</em>
                  </span>
                ) : (
                  <span>
                    问{FACTION[t.target]}的词「{t.text}」<em>{ANSWER[t.verdict]}</em>
                  </span>
                )}
              </li>
            ))}
            {!recent.length ? <li class="is-empty">还没有人行动</li> : null}
          </ul>
        </Cloth>
      </>
    );
  }
  return (
    <>
      <Flag />
      <Cloth>
        {s.canAsk ? <Tabs on={mode} set={setMode} /> : null}
        {s.reasking ? <p class="b-p-warn">上一个问题无效。可以重问一次，或者改为猜词。</p> : null}
        {mode === 'guess' ? (
          <>
            <FlagInput label="对方国家的词是" value={text} setValue={setText} max={20} onEnter={go} placeholder="写一个词" />
            <div class="b-p-row">
              {wrong.length ? <span>猜错过的</span> : null}
              {wrong.map((w) => (
                <s class="b-p-wrong" key={w}>
                  {w}
                </s>
              ))}
              <span style={{ marginLeft: 'auto' }}>{timer}</span>
            </div>
            <p class="b-note" style={{ marginTop: '10px' }}>
              你不知道自己是哪一国，所以只写「对方的词」。
              <br />
              猜错了就轮到下一个人，先猜中的国家拿第一。
            </p>
          </>
        ) : (
          <>
            <p class="b-p-small">问哪个国家的词</p>
            <div role="radiogroup" class="b-p-targets">
              {(['big', 'small'] as const).map((t) => (
                <button type="button" role="radio" aria-checked={target === t} class={target === t ? 'is-on' : ''} onClick={() => setTarget(t)} key={t}>
                  <i style={{ background: t === 'big' ? BIG : SMALL }} />
                  {FACTION[t]}的词
                </button>
              ))}
            </div>
            <FlagInput label="问裁判一个是非题" value={text} setValue={setText} max={60} size={19} onEnter={go} placeholder="例：它有骨头吗？" />
            <p class="b-note" style={{ marginTop: '8px' }}>
              问题和答案大家都看得到。问错了对象，
              <br />
              等于帮对方问了一题。 {timer}
            </p>
          </>
        )}
      </Cloth>
      <div class="b-p-go">
        <Btn icon={mode === 'guess' ? FLAG_ICON : undefined} disabled={!okText(text, max) || (mode === 'ask' && !target)} onClick={go}>
          {mode === 'guess' ? '猜这个词' : '问裁判'}
        </Btn>
      </div>
    </>
  );
}

function ReliefPanel({ g, s }: { g: G; s: Relief }) {
  const { conn } = g;
  const [text, setText] = useState('');
  const ask = s.stage === 'ask';
  const max = ask ? 60 : 20;
  const go = () => {
    if (!okText(text, max)) return;
    conn.act(ask ? { a: 'ask', text: text.trim() } : { a: 'guess', text: text.trim() });
    setText('');
  };
  const timer = s.deadline !== null ? <Timer deadline={s.deadline} offset={g.offset} total={g.total} /> : null;
  const steps = (
    <div class="b-p-steps">
      <span class={ask ? 'is-on' : 'is-done'}>
        <b class="b-cond">1</b>问一个问题
      </span>
      <svg width="14" height="8" aria-hidden="true">
        <path d="M0 4 H13 M9 1 L13 4 L9 7" fill="none" stroke={INK} stroke-width="1" />
      </svg>
      <span class={ask ? '' : 'is-on'}>
        <b class="b-cond">2</b>猜大国的词
      </span>
      <span style={{ marginLeft: 'auto' }}>{timer}</span>
    </div>
  );
  if (!s.canAct || s.judging) {
    return (
      <>
        <Flag white={s.canAct} />
        <Cloth>
          {steps}
          <p class="b-p-h" style={{ marginTop: '14px' }}>
            <b>{s.judging ? '裁判思考中…' : ask ? '白板阵营正在问裁判' : '白板阵营正在猜大国的词'}</b>
          </p>
          <p class="b-note" style={{ marginTop: '6px' }}>
            第一轮没人猜中。白板阵营可以先问裁判一个问题，再猜一次大国的词。问题和回答大家都看得到。
          </p>
        </Cloth>
      </>
    );
  }
  return (
    <>
      <Flag bottom={676} white />
      <Cloth>
        {steps}
        <p class="b-note" style={{ marginTop: '12px', fontSize: '11.5px' }}>
          {ask ? '第一轮没人猜中。白板阵营可以先问裁判一个问题，再猜一次大国的词。你们共用这一面旗，谁先交都算。' : '现在猜一次大国的词。猜中了白板拿第一。'}
        </p>
        {s.reasking ? <p class="b-p-warn">上一个问题无效，可以重问一次。</p> : null}
        <FlagInput label={ask ? '问裁判一个是非题（大家都看得到）' : '大国的词是'} value={text} setValue={setText} max={max} size={ask ? 19 : 24} onEnter={go} />
      </Cloth>
      <div class="b-p-two">
        <Btn onClick={go} disabled={!okText(text, max)}>
          {ask ? '问裁判' : '猜大国的词'}
        </Btn>
        <Btn ghost onClick={() => conn.act({ a: 'pass' })}>
          {ask ? '不问了，直接猜' : '放弃'}
        </Btn>
      </div>
    </>
  );
}

function RacePanel({ g, s }: { g: G; s: Race }) {
  const { v, conn } = g;
  const [text, setText] = useState('');
  const cooling = s.cooldownUntil !== null;
  const go = () => {
    if (!okText(text, 20) || cooling || s.myPending) return;
    conn.act({ a: 'guess', text: text.trim() });
    setText('');
  };
  const hints = v.hints;
  const second = s.purpose === 'second' && v.result?.first;
  return (
    <>
      <Flag top={462} bottom={716} />
      <Cloth top={474}>
        <div class="b-p-board-h">
          <b>界碑上的提示</b>
          <span>{s.nextHintAt ? '一条条立起来' : '提示都立完了'}</span>
        </div>
        <ol class="b-p-hints">
          {hints.slice(-4).map((h, i0) => {
            const i = hints.length - Math.min(4, hints.length) + i0;
            const isNew = i === hints.length - 1;
            return (
              <li key={i}>
                <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">
                  <path d="M-7 7 V-4 Q-7 -9 0 -9 Q7 -9 7 -4 V7 Z" fill={INK} />
                  <text y="4" text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 10.5px; fill: #ffffff">
                    {i + 1}
                  </text>
                </svg>
                <span class={isNew ? 'is-new' : ''}>
                  {i === (v.hintTotal ?? 0) - 1 ? <small>联系</small> : null}
                  {h}
                </span>
                {isNew ? <em>刚公布</em> : null}
              </li>
            );
          })}
          {s.nextHintAt ? (
            <li class="is-todo">
              <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">
                <path d="M-7 7 V-4 Q-7 -9 0 -9 Q7 -9 7 -4 V7 Z" fill="#fbf6e8" stroke={INK} stroke-width="0.9" stroke-dasharray="2 1.6" />
                <text y="4" text-anchor="middle" style={`font-family: var(--cond); font-weight: 500; font-size: 10px; fill: ${MUTED}`}>
                  {hints.length + 1}
                </text>
              </svg>
              <Timer deadline={s.nextHintAt} offset={g.offset} total={g.total} label={hints.length === (v.hintTotal ?? 0) - 1 ? '下一条是联系' : '下一条'} />
            </li>
          ) : null}
          {!hints.length && !s.nextHintAt ? <li class="is-todo">第一条提示还没公布</li> : null}
        </ol>
        {s.canGuess ? (
          <>
            <FlagInput label={second ? '抢第二名 · 要猜的词是' : '抢答 · 对方国家的词是'} value={text} setValue={setText} max={20} size={22} onEnter={go} disabled={cooling || !!s.myPending} />
            <p class="b-p-small" style={{ marginTop: '6px' }}>
              {s.myPending ? `「${s.myPending}」裁判判定中…` : cooling ? (
                <>
                  猜错了，冷却中 <Timer deadline={s.cooldownUntil} offset={g.offset} label="还要等" />
                </>
              ) : (
                '随时可以抢 · 猜错了要等 10 秒才能再猜'
              )}
            </p>
          </>
        ) : (
          <p class="b-note" style={{ marginTop: '10px' }}>
            {s.purpose === 'second' && v.me.alive ? '你的国家已经拿到第一名，这一轮由另外两方抢第二名。' : '你已出局，没有猜词权，可以看着大家抢。'}
          </p>
        )}
      </Cloth>
      {s.canGuess ? (
        <div class="b-p-go" style={{ top: '736px' }}>
          <Btn icon={FLAG_ICON} onClick={go} disabled={!okText(text, 20) || cooling || !!s.myPending}>
            抢答
          </Btn>
        </div>
      ) : null}
    </>
  );
}

function BigPanel({ g, s }: { g: G; s: Big }) {
  const { conn } = g;
  const [text, setText] = useState('');
  const go = () => {
    if (!okText(text, 20)) return;
    conn.act({ a: 'guess', text: text.trim() });
    setText('');
  };
  const timer = s.deadline !== null ? <Timer deadline={s.deadline} offset={g.offset} total={g.total} /> : null;
  return (
    <>
      <Flag />
      <Cloth>
        <p class="b-p-h">
          <b>只有一次</b>
          <span>{timer}</span>
        </p>
        <p class="b-note" style={{ marginTop: '8px', fontSize: '11.5px', lineHeight: '1.65' }}>
          白板猜中了大国的词，白板拿第一。
          <br />
          大国一起猜一次小国的词：猜中，大国第二；
          <br />
          没猜中，小国第二。
        </p>
        {s.submitted ? (
          <p class="b-wait" style={{ marginTop: '14px' }}>
            {g.name(s.submitted.by)} 代表大国交了「{s.submitted.text}」{s.judging ? '，裁判思考中…' : ''}
          </p>
        ) : s.canGuess ? (
          <>
            <FlagInput label="小国的词是" value={text} setValue={setText} max={20} size={24} onEnter={go} />
            <p class="b-p-small" style={{ marginTop: '10px' }}>
              哪个大国玩家先交都算{g.chat ? '，可以先在大国频道商量' : ''}
            </p>
          </>
        ) : (
          <p class="b-wait" style={{ marginTop: '14px' }}>
            大国阵营正在商量…
          </p>
        )}
      </Cloth>
      {s.canGuess && !s.submitted ? (
        <div class="b-p-go">
          <Btn onClick={go} disabled={!okText(text, 20)}>
            交上去
          </Btn>
        </div>
      ) : null}
    </>
  );
}

export function PhaseTwo({ g, s }: { g: G; s: P2Step }) {
  const { v } = g;
  const [askTarget, setAskTarget] = useState<'big' | 'small' | null>(null);
  const kicker = '第二阶段';
  let title = '';
  let sub = '';
  let size = 28;
  if (s.k === 'turn') {
    title = `第 ${s.round} 轮`;
    sub = s.round === 1 ? '白板都出局了，轮流猜对方国家的词' : '第一轮没人猜中，再轮一圈';
  } else if (s.k === 'relief') {
    title = '白板救济';
    sub = '第一轮没人猜中，白板还有一次机会';
    size = 26;
  } else if (s.k === 'race') {
    title = s.purpose === 'first' ? '抢答' : '抢第二名';
    sub =
      s.purpose === 'second' && v.result?.first
        ? v.result.first === 'big'
          ? '大国拿到第一。小国和白板抢答大国的词'
          : '小国拿到第一。大国和白板抢答小国的词'
        : '提示一条条公布，谁先猜中谁赢';
  } else {
    title = '大国的一次机会';
    sub = '白板猜中了大国的词';
    size = 22;
  }
  return (
    <Stage bg="atlas" label={title}>
      <Layer label="第二阶段地图：圆桌岛分成大国和小国两块，国界未定">
        <PhaseMap g={g} s={s} mark={s.k === 'turn' && s.actor === v.me.id ? askTarget : null} />
      </Layer>
      <TitleBlock kicker={kicker} title={title} sub={sub} size={size} />
      <Chips g={g} />
      {s.k === 'turn' ? <TurnPanel g={g} s={s} onTarget={setAskTarget} /> : s.k === 'relief' ? <ReliefPanel g={g} s={s} /> : s.k === 'race' ? <RacePanel g={g} s={s} /> : <BigPanel g={g} s={s} />}
    </Stage>
  );
}
