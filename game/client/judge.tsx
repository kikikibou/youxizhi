/**
 * 主持人台（§8.4）：不参与游戏的出题人 / 人类裁判用。看得到两个词、联系、提示、所有人的身份和整局记录；
 * 人工裁判模式下在这里判定提问和猜词，抢答时可以提前公布下一条提示。
 */

import { Fragment } from 'preact';
import type { JudgeView } from '../engine/view.ts';
import type { RoomConnection, Snapshot } from './net.ts';
import { ANSWER, DIR, FACTION, ROLE, describe, phaseTitle, resultLine } from './text.ts';
import { Card, Countdown } from './ui.tsx';

type Pending = JudgeView['pending'][number];
type RawStep = JudgeView['step'];

const ORIGIN: Record<string, string> = { exit: '出局提问', turn: '第二阶段回合', relief: '白板救济', race: '抢答', bigChance: '大国的一次机会' };

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

export function JudgeScreen({ conn, snap, onLeave }: { conn: RoomConnection; snap: Snapshot; onLeave: () => void }) {
  const j = snap.judge!;
  const s = j.step;
  const name = (id: string) => j.players.find((p) => p.id === id)?.name ?? '?';
  const title = phaseTitle(j);
  const human = j.judgeMode === 'human';
  const canHint = s.k === 'race' && s.nextHintAt !== null;

  return (
    <div class={`game judge ${s.k === 'night' ? 'is-night' : ''}`}>
      <header class="phase">
        <div>
          <p class="kicker">MODERATOR · {title.en}</p>
          <h1 class="phase-cn reg">{title.cn}</h1>
        </div>
        <Countdown deadline={rawDeadline(s)} offset={snap.offset} />
      </header>

      {s.k === 'over' && j.result ? (
        <Card tone="accent">
          <p class="result">{resultLine(j.result)}</p>
          <button type="button" class="btn btn--accent btn--wide" onClick={onLeave}>
            回到房间
          </button>
        </Card>
      ) : null}

      <Card tone="accent">
        <h3 class="section-title">
          <span>{human ? '待你判定' : '裁判'}</span>
          <small>{human ? `${j.pending.length} 条` : 'AI 判定中'}</small>
        </h3>
        {!human ? <p class="note">这一局由 AI 裁判判定，你在这里旁观。</p> : null}
        {j.pending.length === 0 ? <p class="note">{human ? '现在没有需要判定的提问或猜词。' : '现在没有正在判定的内容。'}</p> : null}
        {j.pending.map((r) => (
          <PendingItem key={r.id} r={r} j={j} human={human} conn={conn} offset={snap.offset} name={name} />
        ))}
        {canHint ? (
          <button type="button" class="btn btn--wide" onClick={() => conn.send({ t: 'hint' })}>
            现在公布下一条提示
          </button>
        ) : null}
      </Card>

      <Card>
        <h3 class="section-title">
          <span>答案</span>
          <small>只有你看得到</small>
        </h3>
        <dl class="reveal">
          <dt>大国词</dt>
          <dd>
            {j.secret.big}
            {j.secret.bigAliases.length ? <small>（别名：{j.secret.bigAliases.join('、')}）</small> : null}
          </dd>
          <dt>小国词</dt>
          <dd>
            {j.secret.small}
            {j.secret.smallAliases.length ? <small>（别名：{j.secret.smallAliases.join('、')}）</small> : null}
          </dd>
          <dt>联系</dt>
          <dd>
            {j.secret.link}
            {j.secret.linkType ? <small>（{j.secret.linkType}）</small> : null}
          </dd>
          {j.secret.judgeNote ? (
            <>
              <dt>裁判须知</dt>
              <dd>{j.secret.judgeNote}</dd>
            </>
          ) : null}
          {j.secret.hints.map((h, i) => (
            <Fragment key={i}>
              <dt>提示 {i + 2}</dt>
              <dd class={i + 1 < j.hintsShown ? '' : 'is-pending'}>
                {h}
                {i + 1 < j.hintsShown ? '' : '（未公布）'}
              </dd>
            </Fragment>
          ))}
        </dl>
        <p class="note">已公布 {j.hintsShown} 条提示（联系算第一条）。</p>
      </Card>

      <Card>
        <h3 class="section-title">
          <span>当前</span>
          <small>{stepLine(s, name)}</small>
        </h3>
        <table class="roster">
          <tbody>
            {j.players.map((p) => (
              <tr class={p.alive ? '' : 'is-out'} key={p.id}>
                <td>
                  {p.seat + 1} {p.name}
                </td>
                <td class={`f-${p.faction}`}>
                  {p.faction === 'blank' ? `白板阵营${p.role && p.role !== 'both' ? `·${ROLE[p.role]}` : ''}` : FACTION[p.faction]}
                </td>
                <td class="pts">{p.alive ? '' : '出局'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <section class="card log">
        <h3 class="section-title">
          <span>整局记录</span>
          <small>含私下内容</small>
        </h3>
        <ol class="log-all">
          {[...j.log].reverse().map((e, i) => {
            if (e.t === 'chat') {
              return (
                <li key={i} class="tone-secret">
                  ［{e.channel === 'blanks' ? '白板频道' : e.channel === 'big' ? '大国频道' : '公共'}］{name(e.player)}：{e.text}
                </li>
              );
            }
            const d = describe(e, name);
            if (!d) return null;
            return (
              <li key={i} class={d.tone ? `tone-${d.tone}` : ''}>
                {e.to === 'blanks' ? '［只给白板］' : ''}
                {d.text}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function PendingItem({ r, j, human, conn, offset, name }: { r: Pending; j: JudgeView; human: boolean; conn: RoomConnection; offset: number; name: (id: string) => string }) {
  const who = askerOf(r, j, name);
  const about = r.kind === 'guess' ? `猜${FACTION[r.target]}词（${j.secret[r.target]}）` : r.target ? `问${FACTION[r.target]}的词（${j.secret[r.target]}）` : '没有指定对象（按大国的词理解）';
  const options = r.kind === 'guess' ? (['correct', 'wrong'] as const) : (['yes', 'no', 'unknown', 'invalid'] as const);
  const label = (o: string) => (o === 'correct' ? '对' : o === 'wrong' ? '错' : ANSWER[o]);
  return (
    <div class="pending">
      <p class="note">
        {ORIGIN[r.origin]} · {who} · {about}
      </p>
      <p class="pending-text">「{r.text}」</p>
      {human ? (
        <>
          <div class="choice">
            {options.map((o) => (
              <button type="button" class="pick pick--sm" onClick={() => conn.send({ t: 'verdict', id: r.id, verdict: o })} key={o}>
                {label(o)}
              </button>
            ))}
          </div>
          <p class="note">
            <Countdown deadline={r.deadline} offset={offset} label="超时自动按兜底" />
          </p>
        </>
      ) : (
        <p class="note">AI 裁判判定中…</p>
      )}
    </div>
  );
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

/** 当前步骤的一句话说明（主持人看得到的细节）。 */
function stepLine(s: RawStep, name: (id: string) => string): string {
  switch (s.k) {
    case 'night':
      return `已提交 ${Object.keys(s.picks).length} 人`;
    case 'clue':
      return `从 ${name(s.start)} 开始${DIR[s.dir]}，现在 ${name(s.order[s.idx])}`;
    case 'discussion':
      return `准备投票 ${s.ready.length} 人`;
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
      return '';
  }
}
