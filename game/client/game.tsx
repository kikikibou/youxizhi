/** 对局界面：每个步骤一块操作面板，加上座位条、按住查看身份和整局记录。 */

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { factionScore } from '../engine/engine.ts';
import type { LogEntry, PlayerView, StepView } from '../engine/view.ts';
import type { RoomConnection, Snapshot } from './net.ts';
import { DIR, FACTION, ROLE, deadlineOf, describe, phaseTitle, resultLine } from './text.ts';
import { Card, Chat, Countdown, GameLog, HoldIdentity, PlayerPicker, SeatStrip, TextAction } from './ui.tsx';

type Step<K extends StepView['k']> = Extract<StepView, { k: K }>;
interface P<K extends StepView['k']> {
  v: PlayerView;
  s: Step<K>;
  conn: RoomConnection;
  name: (id: string) => string;
  offset: number;
}

export function GameScreen({ conn, snap, onLeave }: { conn: RoomConnection; snap: Snapshot; onLeave: () => void }) {
  const v = snap.game!;
  const s = v.step;
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  const title = phaseTitle(v);
  const props = { v, conn, name, offset: snap.offset };
  const night = s.k === 'night';

  let active: string | null = null;
  if (s.k === 'clue') active = s.order[s.idx];
  if (s.k === 'turn') active = s.actor;
  if (s.k === 'exit') active = s.current;

  return (
    <div class={`game ${night ? 'is-night' : ''}`}>
      <header class="phase">
        <div>
          <p class="phase-en">{title.en}</p>
          <h1 class="phase-cn">{title.cn}</h1>
        </div>
        <Countdown deadline={deadlineOf(s)} offset={snap.offset} label={s.k === 'race' ? (s.nextHintAt ? '下一条提示' : '结束') : undefined} />
      </header>

      <SeatStrip v={v} active={active} marks={seatMarks(v)} />

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

      {v.me.blank && v.phase !== 1 ? <Chat v={v} conn={conn} channel="blanks" title="白板阵营频道" /> : null}
      {s.k !== 'over' ? <HoldIdentity v={v} /> : null}
      <GameLog v={v} />
    </div>
  );
}

/** 座位条上的小标记：今天谁说了什么线索。 */
function seatMarks(v: PlayerView): Record<string, string> {
  const marks: Record<string, string> = {};
  if (v.phase !== 1) return marks;
  for (const e of v.log) if (e.t === 'clue' && e.day === v.day) marks[e.player] = e.text ?? '—';
  return marks;
}

function todaysClues(v: PlayerView) {
  return v.log.filter((e): e is Extract<LogEntry, { t: 'clue' }> => e.t === 'clue' && e.day === v.day);
}

function Waiting({ children }: { children: ComponentChildren }) {
  return <p class="waiting">{children}</p>;
}

/* ------------------------------------------------------------------ 夜晚 */

function Night({ v, s, conn }: P<'night'>) {
  const [pick, setPick] = useState<string | null>(s.myPick?.player ?? null);
  const [dir, setDir] = useState<'cw' | 'ccw' | null>(s.myPick?.dir ?? null);
  const alive = v.players.filter((p) => p.alive);
  if (!s.canPick) {
    return (
      <Card tone="night">
        <p class="lead">天黑了</p>
        <Waiting>{v.me.alive ? '白板阵营正在行动，请等待天亮。' : '你已出局。等待天亮。'}</Waiting>
      </Card>
    );
  }
  return (
    <Card tone="night">
      <p class="lead">所有人低头，选一名玩家和一个方向</p>
      <p class="note">只有白板阵营的选择会生效。其他人也照常选，免得被看出谁在操作。</p>
      <PlayerPicker players={alive} value={pick} onPick={setPick} />
      <div class="toggle" role="radiogroup">
        {(['cw', 'ccw'] as const).map((d) => (
          <button type="button" class={`pick ${dir === d ? 'is-on' : ''}`} aria-checked={dir === d} role="radio" onClick={() => setDir(d)} key={d}>
            {DIR[d]}
          </button>
        ))}
      </div>
      <button type="button" class="btn btn--accent btn--wide" disabled={!pick || !dir} onClick={() => conn.act({ a: 'night', player: pick!, dir: dir! })}>
        {s.myPick ? '修改选择' : '确定'}
      </button>
      {s.myPick ? <p class="note">已提交。天亮前还可以改。</p> : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ 发言 */

function Clue({ v, s, conn, name }: P<'clue'>) {
  const mine = s.order[s.idx] === v.me.id;
  const said = todaysClues(v);
  return (
    <Card>
      <p class="lead">
        从 {name(s.start)} 开始，{DIR[s.dir]}，每人说一个词
      </p>
      <ol class="order">
        {s.order.map((id, i) => {
          const c = said.find((e) => e.player === id);
          return (
            <li class={i === s.idx ? 'is-now' : i < s.idx ? 'is-done' : ''} key={id}>
              <span>{name(id)}</span>
              <b>{c ? (c.text ?? '（没有发言）') : i === s.idx ? '发言中…' : ''}</b>
            </li>
          );
        })}
      </ol>
      {mine ? (
        <TextAction placeholder={`一个和你的词有关的词（最多 ${v.rules.clueMaxLength} 字）`} max={v.rules.clueMaxLength} button="说出" autoFocus onSubmit={(text) => conn.act({ a: 'clue', text })} />
      ) : (
        <Waiting>等待 {name(s.order[s.idx])} 发言</Waiting>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 讨论 */

function Discussion({ v, s, conn, name }: P<'discussion'>) {
  const alive = v.players.filter((p) => p.alive);
  const ready = s.ready.includes(v.me.id);
  return (
    <Card>
      <p class="lead">当面讨论：谁可疑，谁是自己的队友</p>
      <ul class="clues">
        {todaysClues(v).map((c) => (
          <li key={c.player}>
            <span>{name(c.player)}</span>
            <b>{c.text ?? '（没有发言）'}</b>
          </li>
        ))}
      </ul>
      {v.me.alive ? (
        <button type="button" class="btn btn--accent btn--wide" disabled={ready} onClick={() => conn.act({ a: 'ready' })}>
          {ready ? '已准备，等其他人' : '准备投票'}（{s.ready.length}/{alive.length}）
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
        <Waiting>
          你已出局，不能投票。已投 {s.votedCount}/{alive.length}
        </Waiting>
      </Card>
    );
  }
  return (
    <Card>
      <p class="lead">投出你认为是白板的人</p>
      <p class="note">可以投自己，不能弃票。全部投完后同时公布；超时未投视为投自己。</p>
      <PlayerPicker players={alive} value={pick} onPick={setPick} />
      <button type="button" class="btn btn--accent btn--wide" disabled={!pick || pick === s.myVote} onClick={() => conn.act({ a: 'vote', target: pick! })}>
        {s.myVote ? (pick === s.myVote ? `已投给 ${name(s.myVote)}` : '改投') : '投票'}
      </button>
      <p class="note">
        已投 {s.votedCount}/{alive.length}
        {s.myVote ? '，公布前还可以改' : ''}
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ 出局选择 */

function Exit({ v, s, conn, name }: P<'exit'>) {
  const [mode, setMode] = useState<'guess' | 'ask' | null>(null);
  const lastVotes = [...v.log].reverse().find((e) => e.t === 'votes');
  const votesLine = lastVotes ? describe(lastVotes, name)?.text : null;
  const m = s.mine;
  if (!m) {
    return (
      <Card>
        {votesLine ? <p class="note">{votesLine}</p> : null}
        <p class="lead">{name(s.current)} 正在做出局选择…</p>
        {s.queue.length > 1 ? <p class="note">之后依次是：{s.queue.slice(s.idx + 1).map(name).join('、') || '无'}</p> : null}
      </Card>
    );
  }
  const can = (o: 'none' | 'guess' | 'ask') => m.options.includes(o) && (m.status === 'choosing' || m.status === 'reask');
  return (
    <Card tone="accent">
      {votesLine ? <p class="note">{votesLine}</p> : null}
      <p class="lead">你出局了</p>
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
              {m.status === 'reask' ? '重新提问' : '向裁判提问'}
            </button>
          </div>
          {mode === 'guess' && can('guess') ? <TextAction placeholder="大国的词是……" max={20} button="猜" autoFocus onSubmit={(text) => conn.act({ a: 'guess', text })} /> : null}
          {(mode === 'ask' || m.status === 'reask') && can('ask') ? (
            <>
              <TextAction placeholder="一个是非问题，例：大国的词是动物吗" max={60} button="问" autoFocus onSubmit={(text) => conn.act({ a: 'ask', text })} />
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
    <Card>
      <ol class="order">
        {s.order.map((id, i) => (
          <li class={i === s.idx ? 'is-now' : i < s.idx ? 'is-done' : ''} key={id}>
            <span>{name(id)}</span>
            <b>{i === s.idx ? (s.judging ? '裁判思考中…' : '行动中') : ''}</b>
          </li>
        ))}
      </ol>
      {!mine ? (
        <Waiting>{s.judging ? '裁判思考中…' : `轮到 ${name(s.actor)}：猜对方国家的词${s.canAsk ? '，或向裁判提问' : ''}`}</Waiting>
      ) : s.judging ? (
        <Waiting>裁判思考中…</Waiting>
      ) : (
        <>
          <p class="lead">轮到你了</p>
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
            <TextAction placeholder="对方国家的词是……" max={20} button="猜" autoFocus onSubmit={(text) => conn.act({ a: 'guess', text })} />
          ) : (
            <>
              <p class="note">问之前先想好：你问的是大国的词还是小国的词？问错了对象，等于替对手问了一题。</p>
              <div class="toggle">
                {(['big', 'small'] as const).map((t) => (
                  <button type="button" class={`pick ${target === t ? 'is-on' : ''}`} onClick={() => setTarget(t)} key={t}>
                    问{FACTION[t]}的词
                  </button>
                ))}
              </div>
              <TextAction placeholder="一个是非问题" max={60} button="问" disabled={!target} onSubmit={(text) => conn.act({ a: 'ask', target: target!, text })} />
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
        <p class="lead">第一轮无人猜中</p>
        <Waiting>{s.judging ? '裁判思考中…' : s.stage === 'ask' ? '白板阵营正在向裁判提问…' : '白板阵营正在猜大国词…'}</Waiting>
      </Card>
    );
  }
  return (
    <Card tone="accent">
      <p class="lead">白板救济：问一个问题，然后猜一次大国词</p>
      <p class="note">白板阵营共用这个面板，任何一人提交都算，先提交的为准。问题和回答都公开。</p>
      {s.judging ? (
        <Waiting>裁判思考中…</Waiting>
      ) : s.stage === 'ask' ? (
        <>
          {s.reasking ? <p class="note">上一个问题无效，可以重问一次。</p> : null}
          <TextAction placeholder="一个是非问题" max={60} button="问" onSubmit={(text) => conn.act({ a: 'ask', text })} />
          <button type="button" class="btn btn--ghost" onClick={() => conn.act({ a: 'pass' })}>
            不问了，直接猜
          </button>
        </>
      ) : (
        <>
          <TextAction placeholder="大国的词是……" max={20} button="猜" onSubmit={(text) => conn.act({ a: 'guess', text })} />
          <button type="button" class="btn btn--ghost" onClick={() => conn.act({ a: 'pass' })}>
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
      {s.purpose === 'second' && v.result?.first ? (
        <p class="lead">
          {FACTION[v.result.first]}获得第一名。现在抢第二名：{v.result.first === 'big' ? '小国和白板抢答大国词' : '大国和白板抢答小国词'}
        </p>
      ) : (
        <p class="lead">两轮无人猜中。看提示，随时抢答</p>
      )}
      <ol class="hints">
        {v.hints.map((h, i) => (
          <li key={i}>
            <small>{i === 0 ? '联系' : `提示 ${i + 1}`}</small>
            {h}
          </li>
        ))}
        {!v.hints.length ? <li class="empty">第一条提示还没公布</li> : null}
      </ol>
      {s.canGuess ? (
        <>
          <TextAction
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
        <Waiting>
          {s.purpose === 'second' && v.me.alive ? '你的国家已经拿到第一名，这一轮由另外两方抢第二名。' : '你已出局，没有猜词权，可以看着大家抢。'}
        </Waiting>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ 大国的一次机会 */

function BigChance({ v, s, conn, name }: P<'bigChance'>) {
  return (
    <>
      <Card tone="accent">
        <p class="lead">白板猜中了大国词</p>
        <p class="note">大国阵营有一次机会猜小国词：猜中则大国第二，没猜中则小国第二。大国玩家可以在下面的频道里商量，任何一人提交即为大国的猜测。</p>
        {s.submitted ? (
          <Waiting>
            {name(s.submitted.by)} 代表大国提交了「{s.submitted.text}」{s.judging ? '，裁判思考中…' : ''}
          </Waiting>
        ) : s.canGuess ? (
          <TextAction placeholder="小国的词是……" max={20} button="提交" onSubmit={(text) => conn.act({ a: 'guess', text })} />
        ) : (
          <Waiting>大国阵营正在商量…</Waiting>
        )}
      </Card>
      {s.canGuess || (v.me.word !== null && v.revealed.big === v.me.word && v.me.alive) ? <Chat v={v} conn={conn} channel="big" title="大国频道" /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ 结算 */

function Over({ v, name, onLeave }: P<'over'> & { onLeave: () => void }) {
  const r = v.result!;
  const rv = v.reveal!;
  return (
    <Card tone="accent">
      <p class="result">{resultLine(r)}</p>
      <dl class="reveal">
        <dt>大国词</dt>
        <dd>{rv.big}</dd>
        <dt>小国词</dt>
        <dd>{rv.small}</dd>
        <dt>联系</dt>
        <dd>{rv.link}</dd>
      </dl>
      <table class="roster">
        <tbody>
          {rv.players.map((p) => {
            const pts = factionScore(r, p.faction);
            return (
              <tr class={p.id === v.me.id ? 'is-me' : ''} key={p.id}>
                <td>{name(p.id)}</td>
                <td class={`f-${p.faction}`}>
                  {p.faction === 'blank' ? `白板阵营${p.role && p.role !== 'both' ? `·${ROLE[p.role]}` : ''}` : FACTION[p.faction]}
                </td>
                <td class="pts">{pts ? `+${pts}` : '0'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" class="btn btn--accent btn--wide" onClick={onLeave}>
        回到房间
      </button>
    </Card>
  );
}
