/** 对局界面：顶部阶段标题、计时轨道和迷你座次图，每个步骤一块操作面板，加上按住查看身份和档案。 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { factionScore } from '../engine/engine.ts';
import type { Faction, Timers } from '../engine/rules.ts';
import type { LogEntry, PlayerView, StepView } from '../engine/view.ts';
import { Avatar } from './avatar.tsx';
import { Dossier, logGroups } from './dossier.tsx';
import type { RoomConnection, Snapshot } from './net.ts';
import { DIR, FACTION, ROLE, deadlineOf, phaseTitle, resultLine } from './text.ts';
import { Card, Chat, Countdown, HoldIdentity, MiniTable, PhaseCard, RoundTable, StepArt, TextAction, Ticks, Track, pad2, previewFlags, type ArtKind } from './ui.tsx';

type Step<K extends StepView['k']> = Extract<StepView, { k: K }>;
interface P<K extends StepView['k']> {
  v: PlayerView;
  s: Step<K>;
  conn: RoomConnection;
  name: (id: string) => string;
  offset: number;
}

/** 这一步的总时长（画计时轨道用）。 */
function totalOf(s: StepView, t: Timers | undefined): number | null {
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
      return t.exitChoice;
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

/** 需要等人操作、又没有截止时间的步骤（不限时）。 */
function waitsForever(s: StepView): boolean {
  if (s.k === 'race' || s.k === 'over') return false;
  if (s.k === 'exit') return !!s.mine && s.mine.deadline === null && (s.mine.status === 'choosing' || s.mine.status === 'reask');
  return deadlineOf(s) === null;
}

export function GameScreen({ conn, snap, onLeave }: { conn: RoomConnection; snap: Snapshot; onLeave: () => void }) {
  const v = snap.game!;
  const s = v.step;
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  const title = phaseTitle(v);
  const props = { v, conn, name, offset: snap.offset };
  const night = s.k === 'night';
  const [archive, setArchive] = useState(previewFlags.dossier !== null);
  const room = snap.room;
  const canSkip = !!room && room.hostId === room.me && v.rules.untimed;

  let active: string | null = null;
  if (s.k === 'clue') active = s.order[s.idx];
  if (s.k === 'turn') active = s.actor;
  if (s.k === 'exit') active = s.current;
  const stepKey = `${s.k}-${v.day}-${s.k === 'turn' ? s.round : ''}${s.k === 'race' ? s.purpose : ''}`;

  return (
    <div class={`game ${night ? 'is-night' : ''}`}>
      <PhaseCard key={stepKey} kicker={title.en} title={title.cn} art={s.k} />
      <header class="phase">
        <div>
          <p class="kicker">{title.en}</p>
          <h1 class="phase-cn reg">{title.cn}</h1>
        </div>
        <Countdown deadline={deadlineOf(s)} offset={snap.offset} label={s.k === 'race' ? (s.nextHintAt ? '下一条提示' : '结束') : undefined} />
      </header>
      <div class="toolbar">
        <button type="button" class="tool" onClick={() => setArchive(true)}>
          <StepArt k="archive" size={22} />
          档案
        </button>
        {deadlineOf(s) !== null ? (
          <Track deadline={deadlineOf(s)} offset={snap.offset} total={totalOf(s, room?.settings.timers)} />
        ) : v.rules.untimed && s.k !== 'over' ? (
          <span class="untimed">
            <b>∞</b>不限时
          </span>
        ) : (
          <span class="toolbar-fill" />
        )}
        {canSkip && waitsForever(s) ? (
          <button type="button" class="tool tool--skip" onClick={() => confirm('跳过等待？这一步按时间到处理（没给提示记为没给，没投票视为投自己）。') && conn.send({ t: 'skip' })}>
            跳过等待
          </button>
        ) : null}
      </div>

      {s.k !== 'over' ? <SeatPanel v={v} active={active} /> : null}

      <div class="step" key={stepKey}>
        {s.k === 'night' && <Night {...props} s={s} />}
        {s.k === 'clue' && <Clue {...props} s={s} />}
        {s.k === 'discussion' && <Discussion {...props} s={s} />}
        {s.k === 'vote' && <Vote {...props} s={s} />}
        {s.k === 'exit' && <Exit {...props} s={s} />}
        {s.k === 'turn' && <Turn {...props} s={s} />}
        {s.k === 'relief' && <Relief {...props} s={s} />}
        {s.k === 'race' && <Race {...props} s={s} />}
        {s.k === 'bigChance' && <BigChance {...props} s={s} />}
        {s.k === 'over' && <Over {...props} s={s} onLeave={onLeave} />}
      </div>

      {v.me.blank && v.phase !== 1 ? <Chat v={v} conn={conn} channel="blanks" title="白板阵营频道" /> : null}
      <ArchiveTeaser v={v} onOpen={() => setArchive(true)} />
      {s.k !== 'over' ? <HoldIdentity v={v} /> : null}
      {archive ? <Dossier v={v} onClose={() => setArchive(false)} /> : null}
    </div>
  );
}

/** 面板顶部：大标题 + 一句说明 + 插图。 */
function StepHead({ art, title, sub }: { art: ArtKind; title: ComponentChildren; sub?: ComponentChildren }) {
  return (
    <div class="stephead">
      <div>
        <p class="stephead-title">{title}</p>
        {sub ? <p class="stephead-sub">{sub}</p> : null}
      </div>
      <StepArt k={art} size={60} />
    </div>
  );
}

/** 顶部的座次面板：迷你圆桌 + 几行说明。 */
function SeatPanel({ v, active }: { v: PlayerView; active: string | null }) {
  const s = v.step;
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  const out = v.players.filter((p) => !p.alive).length;
  const rows: [string, ComponentChildren][] = [];
  if (s.k === 'clue') {
    rows.push(['START / 起点', name(s.start)]);
    rows.push(['DIR / 方向', <span class="hl-text">{DIR[s.dir]}</span>]);
  } else if (active) {
    rows.push(['NOW / 现在', name(active)]);
  } else if (s.k === 'night') {
    rows.push(['NIGHT / 夜', `第 ${s.day} 夜`]);
  }
  rows.push(['YOU / 你', `${pad2(v.me.seat + 1)} 号 · ${v.me.name}${v.me.alive ? '' : '（出局）'}`]);
  rows.push(['ALIVE / 在场', `${v.players.length - out} 人${out ? ` · 出局 ${out}` : ''}`]);
  const clueStep = s.k === 'clue' ? s : null;
  return (
    <Card class="seat-panel">
      <h3 class="section-title">
        <span>座次</span>
        <small>SEATS</small>
      </h3>
      <MiniTable v={v} active={active} start={clueStep?.start} dir={clueStep?.dir} />
      <dl class="seat-info">
        {rows.slice(0, 3).map(([k, val]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** 页面底部的档案入口：最近几条记录 + 打开按钮。 */
function ArchiveTeaser({ v, onOpen }: { v: PlayerView; onOpen: () => void }) {
  const groups = logGroups(v);
  const latest = groups[0];
  const clues = v.log.filter((e) => e.t === 'clue').length;
  const votes = v.log.filter((e) => e.t === 'votes').length;
  return (
    <section class="card teaser">
      <h3 class="section-title">
        <span>档案</span>
        <small>ARCHIVE</small>
      </h3>
      <button type="button" class="teaser-main" onClick={onOpen}>
        <span class="teaser-folder" aria-hidden="true">
          <StepArt k="archive" size={54} />
        </span>
        <span class="teaser-stats">
          <span>
            <b>{pad2(v.day)}</b>
            <small>天</small>
          </span>
          <span>
            <b>{pad2(clues)}</b>
            <small>条提示</small>
          </span>
          <span>
            <b>{pad2(votes)}</b>
            <small>次投票</small>
          </span>
        </span>
        <span class="teaser-open">打开 →</span>
      </button>
      {latest ? (
        <ol class="teaser-latest">
          {latest.items
            .slice(-3)
            .reverse()
            .map((it, i) => (
              <li key={i} class={it.tone ? `tone-${it.tone}` : ''}>
                {it.text}
              </li>
            ))}
        </ol>
      ) : null}
    </section>
  );
}

function todaysClues(v: PlayerView) {
  return v.log.filter((e): e is Extract<LogEntry, { t: 'clue' }> => e.t === 'clue' && e.day === v.day);
}

function Waiting({ children }: { children: ComponentChildren }) {
  return <p class="waiting">{children}</p>;
}

/** 一串依次行动的人：节点（座位号）竖着串起来，后面跟着他说的词。 */
function Timeline({ v, order, idx, said, nowText }: { v: PlayerView; order: string[]; idx: number; said?: Map<string, string | null>; nowText: string }) {
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  return (
    <ol class="timeline">
      {order.map((id, i) => {
        const me = id === v.me.id;
        const state = i === idx ? 'is-now' : i < idx ? 'is-done' : '';
        const clue = said?.get(id);
        return (
          <li class={`${state} ${me ? 'is-me' : ''}`} key={id}>
            <b class="tl-node" title="座位号">
              {(v.players.find((p) => p.id === id)?.seat ?? 0) + 1}
            </b>
            <Avatar id={id} size={22} class="tl-avatar" />
            <span class="tl-name">
              {name(id)}
              {me ? '·你' : ''}
            </span>
            {i < idx || clue !== undefined ? (
              clue === null ? (
                <span class="tl-none">没有给提示</span>
              ) : clue !== undefined ? (
                <span class={`tile ${i === idx - 1 ? 'is-new' : ''}`}>{clue}</span>
              ) : null
            ) : i === idx ? (
              <span class="tl-now">{nowText}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ 夜晚 */

function Moons({ day }: { day: number }) {
  const from = Math.max(1, day - 2);
  const nights = Array.from({ length: 5 }, (_, i) => from + i);
  return (
    <ol class="moons" aria-label={`今晚是第 ${day} 夜`}>
      {nights.map((d) => {
        const phase = ((d - 1) % 4) as 0 | 1 | 2 | 3;
        return (
          <li class={d === day ? 'is-now' : d < day ? 'is-past' : 'is-future'} key={d}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10.5" class="moon-rim" />
              {d <= day ? (
                phase === 0 ? (
                  <path d="M12 1.5 A10.5 10.5 0 0 1 12 22.5 A5 10.5 0 0 0 12 1.5 Z" class="moon-lit" />
                ) : phase === 1 ? (
                  <path d="M12 1.5 A10.5 10.5 0 0 1 12 22.5 Z" class="moon-lit" />
                ) : phase === 2 ? (
                  <path d="M12 1.5 A10.5 10.5 0 0 1 12 22.5 A5 10.5 0 0 1 12 1.5 Z" class="moon-lit" />
                ) : (
                  <circle cx="12" cy="12" r="10.5" class="moon-lit" />
                )
              ) : null}
            </svg>
            <small>{d === day ? '今夜' : `N${d}`}</small>
          </li>
        );
      })}
      <li class="moons-more" aria-hidden="true">
        · · ·
      </li>
    </ol>
  );
}

/**
 * 夜晚。同桌模式下所有存活玩家都要操作：起点白板选人，方向白板选方向（独行白板两样都选），
 * 国家玩家点「确认」就行（他们的选择不生效）。
 */
function Night({ v, s, conn }: P<'night'>) {
  const [pick, setPick] = useState<string | null>(s.myPick?.player ?? null);
  const [dir, setDir] = useState<'cw' | 'ccw' | null>(s.myPick?.dir ?? null);
  const wantStart = s.decides.includes('start');
  const wantDir = s.decides.includes('dir');
  if (!s.canPick) {
    return (
      <Card>
        <h3 class="section-title">
          <span>宵禁</span>
          <small>CURFEW</small>
        </h3>
        <Moons day={s.day} />
        <StepHead art="night" title="天黑请闭眼" sub={v.me.alive ? '白板阵营正在行动，请等待天亮。' : '你已出局。等待天亮。'} />
        <Waiting>等天亮</Waiting>
      </Card>
    );
  }
  const done = !!s.myPick;
  const ready = (!wantStart || !!pick) && (!wantDir || !!dir);
  const submit = () => conn.act(wantStart || wantDir ? { a: 'night', player: wantStart ? pick! : undefined, dir: wantDir ? dir! : undefined } : { a: 'night' });
  return (
    <Card>
      <h3 class="section-title">
        <span>宵禁</span>
        <small>CURFEW</small>
      </h3>
      <Moons day={s.day} />
      {wantStart || wantDir ? (
        <StepHead
          art="night"
          title={wantStart && wantDir ? '选一个人，再选一个方向' : wantStart ? '选明天从谁开始' : '选明天的方向'}
          sub="按住下面的按钮可以确认自己的身份和今晚的任务。"
        />
      ) : (
        <StepHead art="night" title="低头，点确认" sub="今晚你不用做选择。点「确认」，等天亮。" />
      )}
      {wantStart ? (
        <RoundTable
          label="选明天从谁开始"
          onPick={setPick}
          seats={v.players.map((p) => ({ id: p.id, name: p.name, num: p.seat + 1, me: p.id === v.me.id, out: !p.alive, disabled: !p.alive, on: p.id === pick }))}
        />
      ) : null}
      {wantDir ? (
        <div class="toggle" role="radiogroup" aria-label="方向">
          {(['cw', 'ccw'] as const).map((d) => (
            <button type="button" class={`pick pick--dir ${dir === d ? 'is-on' : ''}`} aria-checked={dir === d} role="radio" onClick={() => setDir(d)} key={d}>
              <svg aria-hidden="true" width="26" height="26" viewBox="0 0 34 34">
                {d === 'cw' ? <path d="M28 17a11 11 0 1 1-3.6-8.1M28 6v7h-7" /> : <path d="M6 17a11 11 0 1 0 3.6-8.1M6 6v7h7" />}
              </svg>
              <span>
                {DIR[d]}
                <small>{d === 'cw' ? 'CLOCKWISE' : 'COUNTER'}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <button type="button" class="btn btn--accent btn--wide" disabled={!ready || (done && !wantStart && !wantDir)} onClick={submit}>
        {done ? (wantStart || wantDir ? '修改选择' : '已确认') : '确认'}
      </button>
      <p class="note">{done ? '已提交。天亮前还可以改。' : '只有白板阵营的选择算数。'}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ 身份提示 */

function Clue({ v, s, conn, name }: P<'clue'>) {
  const mine = s.order[s.idx] === v.me.id;
  const said = new Map(todaysClues(v).map((c) => [c.player, c.text] as const));
  return (
    <Card>
      <h3 class="section-title">
        <span>身份提示</span>
        <small>
          CLUES · {pad2(Math.min(s.idx + 1, s.order.length))}/{pad2(s.order.length)}
        </small>
      </h3>
      <StepHead art="clue" title={mine ? '轮到你了' : `等 ${name(s.order[s.idx])} 说`} sub={`从 ${name(s.start)} 开始，${DIR[s.dir]}，每人说一个和自己的词有关的词。`} />
      <Timeline v={v} order={s.order} idx={s.idx} said={said} nowText={mine ? '轮到你' : '想词中…'} />
      {mine ? (
        <TextAction
          label="你的身份提示 / YOUR CLUE"
          placeholder="一个和你的词有关的词"
          max={v.rules.clueMaxLength}
          button="说出"
          autoFocus
          onSubmit={(text) => conn.act({ a: 'clue', text })}
        />
      ) : (
        <Waiting>等待 {name(s.order[s.idx])} 给提示</Waiting>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 自由讨论 */

function Discussion({ v, s, conn }: P<'discussion'>) {
  const alive = v.players.filter((p) => p.alive);
  const ready = s.ready.includes(v.me.id);
  const said = todaysClues(v);
  return (
    <Card>
      <h3 class="section-title">
        <span>自由讨论</span>
        <small>TALK</small>
      </h3>
      <StepHead art="discussion" title="当面聊：谁可疑？谁是队友？" sub="今天的身份提示都在下面。聊完了点「准备投票」，所有人都准备好就开始投票。" />
      <Timeline v={v} order={said.map((c) => c.player)} idx={said.length} said={new Map(said.map((c) => [c.player, c.text] as const))} nowText="" />
      <div class="ready-row">
        <Ticks n={alive.length} done={s.ready.length} label={`已准备 ${s.ready.length} / ${alive.length}`} />
        <span class="mono">
          READY {s.ready.length}/{alive.length}
        </span>
      </div>
      {v.me.alive ? (
        <button type="button" class="btn btn--accent btn--wide" disabled={ready} onClick={() => conn.act({ a: 'ready' })}>
          {ready ? '已准备，等其他人' : '准备投票'}
        </button>
      ) : (
        <Waiting>你已出局，可以参与讨论，但不能投票。</Waiting>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 投票 */

function Vote({ v, s, conn, name }: P<'vote'>) {
  const [pick, setPick] = useState<string | null>(s.myVote);
  const alive = v.players.filter((p) => p.alive);
  if (!v.me.alive) {
    return (
      <Card>
        <h3 class="section-title">
          <span>投票</span>
          <small>VOTE</small>
        </h3>
        <StepHead art="vote" title="大家在投票" sub="你已出局，不能投票。" />
        <div class="ready-row">
          <Ticks n={alive.length} done={s.votedCount} label={`已投 ${s.votedCount} / ${alive.length}`} />
          <span class="mono">
            VOTED {s.votedCount}/{alive.length}
          </span>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <h3 class="section-title">
        <span>投票</span>
        <small>VOTE</small>
      </h3>
      <StepHead art="vote" title="投出你认为是白板的人" sub="在桌上点一个人。可以投自己，不能弃票；全部投完后同时公布。" />
      <RoundTable
        label="投给谁"
        onPick={setPick}
        seats={v.players.map((p) => ({ id: p.id, name: p.name, num: p.seat + 1, me: p.id === v.me.id, out: !p.alive, disabled: !p.alive, on: p.id === pick }))}
      />
      <div class="ready-row">
        <Ticks n={alive.length} done={s.votedCount} label={`已投 ${s.votedCount} / ${alive.length}`} />
        <span class="mono">
          VOTED {s.votedCount}/{alive.length}
        </span>
      </div>
      <button type="button" class="btn btn--accent btn--wide" disabled={!pick || pick === s.myVote} onClick={() => conn.act({ a: 'vote', target: pick! })}>
        {s.myVote ? (pick === s.myVote ? `已投给 ${name(s.myVote)}` : `改投 ${name(pick!)}`) : pick ? `投给 ${name(pick)}` : '先在桌上点一个人'}
      </button>
      {v.rules.untimed ? null : <p class="note">超时未投视为投自己{s.myVote ? '；公布前还可以改' : ''}。</p>}
    </Card>
  );
}

/* ------------------------------------------------------------------ 出局选择 */

/** 刚公布的票数：一条条横条。 */
function VoteBars({ v }: { v: PlayerView }) {
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  const last = [...v.log].reverse().find((e): e is Extract<LogEntry, { t: 'votes' }> => e.t === 'votes');
  if (!last) return null;
  const tally = new Map<string, string[]>();
  for (const [voter, target] of Object.entries(last.ballots)) tally.set(target, [...(tally.get(target) ?? []), voter]);
  const ranked = [...tally.entries()].sort((a, b) => b[1].length - a[1].length);
  const max = ranked[0]?.[1].length ?? 1;
  return (
    <ol class="votebars" aria-label="这一轮的票数">
      {ranked.map(([t, vs]) => (
        <li key={t} class={last.out.includes(t) ? 'is-out' : ''}>
          <Avatar id={t} size={20} />
          <b>{name(t)}</b>
          <span class="vb-bar">
            <i style={{ width: `${(vs.length / max) * 100}%` }} />
          </span>
          <span class="vb-n">{vs.length}</span>
        </li>
      ))}
    </ol>
  );
}

function Exit({ v, s, conn, name }: P<'exit'>) {
  const [mode, setMode] = useState<'guess' | 'ask' | null>(null);
  const m = s.mine;
  if (!m) {
    return (
      <Card>
        <h3 class="section-title">
          <span>出局</span>
          <small>OUT</small>
        </h3>
        <StepHead art="exit" title={`${name(s.current)} 出局了`} sub={`${name(s.current)} 正在做出局选择…${s.queue.length > 1 ? `之后依次是：${s.queue.slice(s.idx + 1).map(name).join('、') || '无'}` : ''}`} />
        <VoteBars v={v} />
        <Waiting>等 {name(s.current)} 选择</Waiting>
      </Card>
    );
  }
  const can = (o: 'none' | 'guess' | 'ask') => m.options.includes(o) && (m.status === 'choosing' || m.status === 'reask');
  return (
    <Card tone="accent" class="exit-card">
      <h3 class="section-title">
        <span>你出局了</span>
        <small>YOU'RE OUT</small>
      </h3>
      <div class="exit-stamp" aria-hidden="true">
        <span>出局</span>
        <small>OUT · DAY {pad2(s.day)}</small>
      </div>
      <StepHead art="exit" title="你被投出局了" sub={m.options.length > 1 ? '白板出局可以猜一次大国词，或者问裁判一个问题；也可以什么都不做，装成被误投的国家玩家。' : '国家玩家出局后什么都不用做。'} />
      <VoteBars v={v} />
      {m.status === 'judging' ? <Waiting>裁判思考中…</Waiting> : null}
      {m.status === 'done' ? <Waiting>已提交，稍后和大家一起公布</Waiting> : null}
      {m.status === 'reask' ? <p class="note">裁判认为上一个问题不是有效的是非问题。可以重问一次，或者放弃。</p> : null}
      {m.status === 'choosing' || m.status === 'reask' ? (
        <>
          <div class="choices">
            <button type="button" class="btn" disabled={!can('none')} onClick={() => conn.act({ a: 'pass' })}>
              {m.status === 'reask' ? '放弃提问' : '什么都不做'}
            </button>
            <button type="button" class={`btn ${mode === 'guess' ? 'is-on' : ''}`} disabled={!can('guess')} onClick={() => setMode('guess')}>
              猜大国词
            </button>
            <button type="button" class={`btn ${mode === 'ask' || m.status === 'reask' ? 'is-on' : ''}`} disabled={!can('ask')} onClick={() => setMode('ask')}>
              {m.status === 'reask' ? '重新提问' : '向裁判提问（Yes / No）'}
            </button>
          </div>
          {mode === 'guess' && can('guess') ? <TextAction label="猜大国词 / GUESS" placeholder="大国的词是……" max={20} button="猜" autoFocus onSubmit={(text) => conn.act({ a: 'guess', text })} /> : null}
          {(mode === 'ask' || m.status === 'reask') && can('ask') ? (
            <>
              <TextAction label="问裁判 / ASK" placeholder="一个是非问题，例：大国的词是动物吗" max={60} button="问" autoFocus onSubmit={(text) => conn.act({ a: 'ask', text })} />
              <p class="note">问题公开；回答只在下一个夜晚私下告诉白板阵营。</p>
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ 第二阶段回合 */

function Turn({ v, s, conn, name }: P<'turn'>) {
  const [mode, setMode] = useState<'guess' | 'ask'>('guess');
  const [target, setTarget] = useState<'big' | 'small' | null>(null);
  const mine = s.actor === v.me.id;
  return (
    <Card tone={mine ? 'accent' : undefined}>
      <h3 class="section-title">
        <span>第 {s.round} 轮</span>
        <small>ROUND {pad2(s.round)}</small>
      </h3>
      <StepHead art="turn" title={mine ? '轮到你了' : `轮到 ${name(s.actor)}`} sub={`猜对方国家的词${s.canAsk ? '，或者改为向裁判问一个 Yes / No 问题' : ''}。先猜中的国家拿第一。`} />
      <Timeline v={v} order={s.order} idx={s.idx} nowText={s.judging ? '裁判思考中…' : mine ? '轮到你' : '行动中'} />
      {!mine ? (
        <Waiting>{s.judging ? '裁判思考中…' : `等 ${name(s.actor)} 行动`}</Waiting>
      ) : s.judging ? (
        <Waiting>裁判思考中…</Waiting>
      ) : (
        <>
          {s.reasking ? <p class="note">上一个问题无效。可以重问一次，或者改为猜词。</p> : null}
          {s.canAsk ? (
            <div class="toggle">
              <button type="button" class={`pick ${mode === 'guess' ? 'is-on' : ''}`} onClick={() => setMode('guess')}>
                猜词
              </button>
              <button type="button" class={`pick ${mode === 'ask' ? 'is-on' : ''}`} onClick={() => setMode('ask')}>
                改为提问
              </button>
            </div>
          ) : null}
          {mode === 'guess' ? (
            <TextAction label="猜对方的词 / GUESS" placeholder="对方国家的词是……" max={20} button="猜" autoFocus onSubmit={(text) => conn.act({ a: 'guess', text })} />
          ) : (
            <>
              <p class="note">公开提问，所有人都会看到问题和答案。先想好：你问的是大国的词还是小国的词？问错了对象，等于替对手问了一题。</p>
              <div class="toggle">
                {(['big', 'small'] as const).map((t) => (
                  <button type="button" class={`pick ${target === t ? 'is-on' : ''}`} onClick={() => setTarget(t)} key={t}>
                    <i class={`swatch swatch--${t}`} aria-hidden="true" />问{FACTION[t]}的词
                  </button>
                ))}
              </div>
              <TextAction label="问裁判（Yes / No）/ ASK" placeholder="一个是非问题" max={60} button="问" disabled={!target} onSubmit={(text) => conn.act({ a: 'ask', target: target!, text })} />
            </>
          )}
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 白板救济 */

function Relief({ s, conn }: P<'relief'>) {
  if (!s.canAct) {
    return (
      <Card>
        <h3 class="section-title">
          <span>白板救济</span>
          <small>RELIEF</small>
        </h3>
        <StepHead art="relief" title="第一轮无人猜中" sub="白板阵营可以问裁判一个问题，然后猜一次大国词。" />
        <Waiting>{s.judging ? '裁判思考中…' : s.stage === 'ask' ? '白板阵营正在向裁判提问…' : '白板阵营正在猜大国词…'}</Waiting>
      </Card>
    );
  }
  return (
    <Card tone="accent">
      <h3 class="section-title">
        <span>白板救济</span>
        <small>RELIEF · {s.stage === 'ask' ? 'ASK' : 'GUESS'}</small>
      </h3>
      <StepHead art="relief" title={s.stage === 'ask' ? '先问一个问题' : '再猜一次大国词'} sub="白板阵营共用这个面板，任何一人提交都算，先提交的为准。问题和回答都公开。" />
      {s.judging ? (
        <Waiting>裁判思考中…</Waiting>
      ) : s.stage === 'ask' ? (
        <>
          {s.reasking ? <p class="note">上一个问题无效，可以重问一次。</p> : null}
          <TextAction label="问裁判（Yes / No）/ ASK" placeholder="一个是非问题" max={60} button="问" onSubmit={(text) => conn.act({ a: 'ask', text })} />
          <button type="button" class="btn btn--ghost btn--wide" onClick={() => conn.act({ a: 'pass' })}>
            不问了，直接猜
          </button>
        </>
      ) : (
        <>
          <TextAction label="猜大国词 / GUESS" placeholder="大国的词是……" max={20} button="猜" onSubmit={(text) => conn.act({ a: 'guess', text })} />
          <button type="button" class="btn btn--ghost btn--wide" onClick={() => conn.act({ a: 'pass' })}>
            放弃
          </button>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 抢答 */

function Race({ v, s, conn, offset }: P<'race'>) {
  const cooling = s.cooldownUntil !== null;
  return (
    <Card tone="accent">
      <h3 class="section-title">
        <span>{s.purpose === 'first' ? '抢答' : '抢第二名'}</span>
        <small>RACE · HINTS {pad2(v.hints.length)}</small>
      </h3>
      <StepHead
        art="race"
        title={s.purpose === 'second' && v.result?.first ? `${FACTION[v.result.first]}拿到第一` : '看提示，随时抢答'}
        sub={s.purpose === 'second' && v.result?.first ? (v.result.first === 'big' ? '小国和白板抢答大国词，抢第二名。' : '大国和白板抢答小国词，抢第二名。') : '两轮无人猜中。提示一条条公布，谁先猜中谁赢。'}
      />
      <ol class="hints">
        {v.hints.map((h, i) => (
          <li key={i} class={i === v.hints.length - 1 ? 'is-new' : ''}>
            <small>{i === 0 ? '联系 LINK' : `提示 ${pad2(i + 1)}`}</small>
            <span>{h}</span>
          </li>
        ))}
        {!v.hints.length ? <li class="empty">第一条提示还没公布</li> : null}
      </ol>
      {s.canGuess ? (
        <>
          <TextAction
            label="抢答 / GUESS"
            placeholder={s.purpose === 'first' && !v.me.blank ? '对方国家的词是……' : '要猜的词是……'}
            max={20}
            button="抢答"
            disabled={cooling || !!s.myPending}
            onSubmit={(text) => conn.act({ a: 'guess', text })}
          />
          {s.myPending ? <p class="note">「{s.myPending}」裁判判定中…</p> : null}
          {cooling ? (
            <p class="note">
              猜错了，冷却中 <Countdown deadline={s.cooldownUntil} offset={offset} />
            </p>
          ) : null}
        </>
      ) : (
        <Waiting>{s.purpose === 'second' && v.me.alive ? '你的国家已经拿到第一名，这一轮由另外两方抢第二名。' : '你已出局，没有猜词权，可以看着大家抢。'}</Waiting>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 大国的一次机会 */

function BigChance({ v, s, conn, name }: P<'bigChance'>) {
  return (
    <>
      <Card tone="accent">
        <h3 class="section-title">
          <span>大国的一次机会</span>
          <small>LAST CHANCE</small>
        </h3>
        <StepHead art="bigChance" title="白板猜中了大国词" sub="大国阵营有一次机会猜小国词：猜中则大国第二，没猜中则小国第二。任何一个大国玩家提交都算。" />
        {s.submitted ? (
          <Waiting>
            {name(s.submitted.by)} 代表大国提交了「{s.submitted.text}」{s.judging ? '，裁判思考中…' : ''}
          </Waiting>
        ) : s.canGuess ? (
          <TextAction label="猜小国词 / GUESS" placeholder="小国的词是……" max={20} button="提交" onSubmit={(text) => conn.act({ a: 'guess', text })} />
        ) : (
          <Waiting>大国阵营正在商量…</Waiting>
        )}
      </Card>
      {s.canGuess || (v.me.word !== null && v.revealed.big === v.me.word && v.me.alive) ? <Chat v={v} conn={conn} channel="big" title="大国频道" /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ 结算 */

/** 长按按钮：按满 ms 毫秒才触发，中途松手就清零。 */
function LongPress({ label, sub, ms, onDone }: { label: string; sub: string; ms: number; onDone: () => void }) {
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
      class={`longpress ${holding ? 'is-holding' : ''}`}
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
      <i class="longpress-fill" aria-hidden="true" />
      <span class="longpress-label">
        <b>{holding ? '再按一会儿…' : label}</b>
        <small>{sub}</small>
      </span>
    </button>
  );
}

const PLACE = ['第一名', '第二名', '第三名'];

function wordSize(w: string, max: number, room: number) {
  return Math.min(max, Math.floor(room / Math.max(1, Array.from(w).length)));
}

function Over({ v, name, onLeave }: P<'over'> & { onLeave: () => void }) {
  const r = v.result!;
  const rv = v.reveal!;
  const [open, setOpen] = useState(previewFlags.revealed);
  const places: { place: number; factions: Faction[] }[] = [];
  if (r.first) places.push({ place: 0, factions: [r.first] });
  if (r.second.length) places.push({ place: 1, factions: r.second });
  if (r.third.length) places.push({ place: 2, factions: r.third });
  const podium = [places.find((p) => p.place === 1), places.find((p) => p.place === 0), places.find((p) => p.place === 2)];
  const factionLabel = (p: { faction: Faction; role: string | null }) =>
    p.faction === 'blank' ? `白板阵营${p.role && p.role !== 'both' ? `·${ROLE[p.role as 'black' | 'white']}` : ''}` : FACTION[p.faction];
  const bigFs = wordSize(rv.big, 46, 148);
  const smallFs = wordSize(rv.small, 30, 108);
  return (
    <>
      <Card tone="accent" class="reveal-card">
        <h3 class="section-title">
          <span>谜底</span>
          <small>REVEAL</small>
        </h3>
        <StepHead art="over" title={open ? resultLine(r) : '游戏结束'} sub={open ? '两国共用的那段国界，就是两个词之间的联系。' : '两个词都摆在这儿了，它们之间的联系还盖着。按住下面的按钮揭晓。'} />
        <div
          class={`rv-slab ${open ? 'is-open' : ''}`}
          role="img"
          aria-label={`大国词：${rv.big}；小国词：${rv.small}；联系：${open ? rv.link : '还没揭晓'}`}
        >
          {/* 和标志一样：大的一块在前、小的一块在后（顶边更低），中间一刀斜劈，上宽下窄的缝；缝的上方露出一段细线 */}
          <div class="rv-ground">
            <svg class="rv-land" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon class="rv-land-big" points="0,8 67.9,11 41.7,100 0,100" />
              <polygon class="rv-land-small" points="65.6,26 100,34 100,100 42.3,100" />
              <path class="rv-blade" d="M72.3 0.5 L70.6 6" vector-effect="non-scaling-stroke" />
            </svg>
            <p class="rv-w rv-w--big">
              <small>大国词 · BIG</small>
              <b style={{ fontSize: `${bigFs}px` }}>{rv.big}</b>
            </p>
            <p class="rv-w rv-w--small">
              <small>小国词 · SMALL</small>
              <b style={{ fontSize: `${smallFs}px` }}>{rv.small}</b>
            </p>
          </div>
          <p class="rv-seal">
            <small>联系 · LINK</small>
            <span>{open ? rv.link : '？？？'}</span>
          </p>
        </div>
        {open ? null : <LongPress label="按住揭晓联系" sub="HOLD TO REVEAL · 大家一起看" ms={1400} onDone={() => setOpen(true)} />}
      </Card>

      {open ? (
        <>
          <Card class="podium-card">
            <h3 class="section-title">
              <span>名次</span>
              <small>RESULT</small>
            </h3>
            <div class="podium">
              {podium.map((p, i) =>
                p ? (
                  <div class={`pd-col pd-${p.place}`} key={i}>
                    <span class="pd-who">
                      {p.factions.map((f) => (
                        <em key={f}>
                          <i class={`swatch swatch--${f}`} aria-hidden="true" />
                          {FACTION[f]}
                        </em>
                      ))}
                    </span>
                    <span class="pd-block">
                      <b>{pad2(p.place + 1)}</b>
                      <small>{PLACE[p.place]}</small>
                      <span class="pd-pts">+{factionScore(r, p.factions[0])}</span>
                    </span>
                  </div>
                ) : (
                  <div class="pd-col pd-empty" key={i} />
                ),
              )}
            </div>
            {!places.length ? <p class="lead">无人猜中，平局</p> : null}
          </Card>
          <Card>
            <h3 class="section-title">
              <span>每个人</span>
              <small>ROSTER</small>
            </h3>
            <table class="roster">
              <tbody>
                {rv.players.map((p) => {
                  const pts = factionScore(r, p.faction);
                  const pl = v.players.find((x) => x.id === p.id);
                  return (
                    <tr class={p.id === v.me.id ? 'is-me' : ''} key={p.id}>
                      <td class="seatno">{pl ? pad2(pl.seat + 1) : ''}</td>
                      <td class="roster-who">
                        <Avatar id={p.id} size={22} />
                        {name(p.id)}
                        {p.id === v.me.id ? ' · 你' : ''}
                      </td>
                      <td class={`f-${p.faction}`}>
                        <i class={`swatch swatch--${p.faction}`} aria-hidden="true" />
                        {factionLabel(p)}
                      </td>
                      <td class="pts">{pts ? `+${pts}` : '0'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <button type="button" class="btn btn--accent btn--wide btn--big" onClick={onLeave}>
            回到房间
          </button>
        </>
      ) : (
        <button type="button" class="btn btn--ghost btn--wide" onClick={onLeave}>
          先回房间（不看谜底）
        </button>
      )}
    </>
  );
}
