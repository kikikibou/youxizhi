/**
 * 按玩家过滤后的视图（§11）。服务器发给每台手机的只能是 viewFor() 的结果，
 * 断线重连时下发的快照也一样。这里逐项挑选字段，从不把内部状态整块展开，
 * 新加的内部字段默认不会漏出去。
 */

import { nightDeciders } from './engine.ts';
import type { BlankRole, Faction } from './rules.ts';
import type { Dir, EventBody, GameEvent, GameState, PlayerId, PlayerState, Result, WordSide } from './types.ts';

export interface PublicPlayer {
  id: PlayerId;
  name: string;
  seat: number;
  alive: boolean;
}

export interface MeView {
  id: PlayerId;
  name: string;
  seat: number;
  alive: boolean;
  /** 国家玩家看到自己的词；白板阵营为 null。大国、小国看到的结构完全一样（§3.1）。 */
  word: string | null;
  /** 只有白板阵营有。 */
  blank: { role: BlankRole; teammates: { id: PlayerId; role: BlankRole | null }[] } | null;
}

export type StepView =
  | {
      k: 'night';
      day: number;
      deadline: number;
      /** 我这一晚提交过的选择。 */
      myPick: { player: PlayerId | null; dir: Dir | null } | null;
      /** 我的选择决定哪一项。国家玩家为空（同桌模式下他们的选择不生效）。 */
      decides: ('start' | 'dir')[];
      canPick: boolean;
    }
  | { k: 'clue'; day: number; start: PlayerId; dir: Dir; order: PlayerId[]; idx: number; deadline: number }
  | { k: 'discussion'; day: number; deadline: number; ready: PlayerId[] }
  | { k: 'vote'; day: number; deadline: number; myVote: PlayerId | null; votedCount: number }
  | {
      k: 'exit';
      day: number;
      queue: PlayerId[];
      idx: number;
      /** 正在「选择中」的出局者。公开视图不带截止时间：重问会延长时间，显示出来就暴露了他在提问。 */
      current: PlayerId;
      /** 只有当前出局者本人有。 */
      mine: {
        deadline: number | null;
        options: ('none' | 'guess' | 'ask')[];
        status: 'choosing' | 'judging' | 'reask' | 'done';
        guess: { text: string; verdict: 'correct' | 'wrong' | null } | null;
        questions: { text: string; verdict: string | null }[];
      } | null;
    }
  | {
      k: 'turn';
      round: 1 | 2;
      order: PlayerId[];
      idx: number;
      actor: PlayerId;
      deadline: number | null;
      judging: boolean;
      canAsk: boolean;
      /** 上一个问题被判无效、正在重问。 */
      reasking: boolean;
    }
  | { k: 'relief'; stage: 'ask' | 'guess'; deadline: number | null; judging: boolean; reasking: boolean; canAct: boolean }
  | {
      k: 'race';
      purpose: 'first' | 'second';
      nextHintAt: number | null;
      endAt: number | null;
      canGuess: boolean;
      cooldownUntil: number | null;
      myPending: string | null;
    }
  | { k: 'bigChance'; deadline: number | null; judging: boolean; canGuess: boolean; submitted: { by: PlayerId; text: string } | null }
  | { k: 'over' };

export type LogEntry = EventBody & { at: number };

export interface PlayerView {
  now: number;
  me: MeView;
  players: PublicPlayer[];
  day: number;
  phase: 1 | 2 | 'over';
  step: StepView;
  log: LogEntry[];
  /** 已公布的提示（序号 0 是联系）。 */
  hints: string[];
  /** 已公开的词。 */
  revealed: Partial<Record<WordSide, string>>;
  difficulty: number | null;
  rules: { phase2Questions: boolean; revealOnExit: boolean; tableMode: boolean; wipeoutThreshold: number; clueMaxLength: number };
  /** 第一名已产生时才有；second / third 在结束前可能还是空的。 */
  result: Result | null;
  /** 结算时公布：两个词、联系、所有人的阵营和子身份（§7.3）。 */
  reveal: {
    big: string;
    small: string;
    link: string;
    hints: string[];
    players: { id: PlayerId; faction: Faction; role: BlankRole | null }[];
  } | null;
}

function canSee(ev: GameEvent, me: PlayerState, over: boolean): boolean {
  if (over) return true;
  switch (ev.aud.to) {
    case 'all':
      return true;
    case 'blanks':
      return me.faction === 'blank';
    case 'players':
      return ev.aud.ids.includes(me.id);
  }
}

function teammates(g: GameState, me: PlayerState): { id: PlayerId; role: BlankRole | null }[] {
  const others = g.players.filter((p) => p.faction === 'blank' && p.id !== me.id);
  switch (g.recognition) {
    case 'all':
      return others.map((p) => ({ id: p.id, role: p.role }));
    case 'group':
      // 同一子身份的人互相可见；黑板和白板之间互相不知道是谁（§3.3）。
      return others.filter((p) => p.role === me.role).map((p) => ({ id: p.id, role: p.role }));
    case 'oneWay':
      // 白板能看到黑板，黑板看不到白板。
      return me.role === 'white' ? others.filter((p) => p.role === 'black').map((p) => ({ id: p.id, role: p.role })) : [];
  }
}

function phaseOf(g: GameState): PlayerView['phase'] {
  switch (g.step.k) {
    case 'night':
    case 'clue':
    case 'discussion':
    case 'vote':
    case 'exit':
      return 1;
    case 'over':
      return 'over';
    default:
      return 2;
  }
}

function stepView(g: GameState, me: PlayerState, now: number): StepView {
  const s = g.step;
  switch (s.k) {
    case 'night': {
      const d = nightDeciders(g);
      const decides: ('start' | 'dir')[] = [];
      if (d.start.some((p) => p.id === me.id)) decides.push('start');
      if (d.dir.some((p) => p.id === me.id)) decides.push('dir');
      const pk = s.picks[me.id];
      return {
        k: 'night',
        day: s.day,
        deadline: s.deadline,
        myPick: pk ? { player: pk.player ?? null, dir: pk.dir ?? null } : null,
        decides,
        canPick: me.alive && (g.rules.tableMode || decides.length > 0),
      };
    }
    case 'clue':
      return { k: 'clue', day: s.day, start: s.start, dir: s.dir, order: [...s.order], idx: s.idx, deadline: s.deadline };
    case 'discussion':
      return { k: 'discussion', day: s.day, deadline: s.deadline, ready: [...s.ready] };
    case 'vote':
      return { k: 'vote', day: s.day, deadline: s.deadline, myVote: s.ballots[me.id] ?? null, votedCount: Object.keys(s.ballots).length };
    case 'exit': {
      const c = s.cur;
      let mine: Extract<StepView, { k: 'exit' }>['mine'] = null;
      if (c.player === me.id) {
        const reask = c.choice === 'ask' && !c.done && !c.pending;
        mine = {
          deadline: c.deadline,
          options: reask ? ['none', 'ask'] : me.faction === 'blank' ? ['none', 'guess', 'ask'] : ['none'],
          status: c.done ? 'done' : c.pending ? 'judging' : reask ? 'reask' : 'choosing',
          guess: c.guess ? { ...c.guess } : null,
          // 出局提问的回答不在这里给：下个夜晚和其他白板一起收到。
          questions: c.questions.map((q) => ({ text: q.text, verdict: q.verdict === 'invalid' ? 'invalid' : q.verdict ? 'answered' : null })),
        };
      }
      return { k: 'exit', day: s.day, queue: [...s.queue], idx: s.idx, current: c.player, mine };
    }
    case 'turn':
      return {
        k: 'turn',
        round: s.round,
        order: [...s.order],
        idx: s.idx,
        actor: s.order[s.idx],
        deadline: s.deadline,
        judging: !!s.pending,
        canAsk: g.rules.phase2Questions,
        reasking: s.reasks > 0,
      };
    case 'relief':
      return { k: 'relief', stage: s.stage, deadline: s.deadline, judging: !!s.pending, reasking: s.reasks > 0, canAct: me.faction === 'blank' };
    case 'race': {
      const mineQ = s.queue.find((q) => q.player === me.id);
      const cd = s.cooldown[me.id];
      return {
        k: 'race',
        purpose: s.purpose,
        nextHintAt: s.nextHintAt,
        endAt: s.endAt,
        canGuess: !!s.targets[me.id],
        cooldownUntil: cd && cd > now ? cd : null,
        myPending: mineQ ? mineQ.text : null,
      };
    }
    case 'bigChance':
      return {
        k: 'bigChance',
        deadline: s.deadline,
        judging: !!s.pending,
        canGuess: me.faction === 'big' && me.alive && !s.by,
        submitted: s.by && s.text ? { by: s.by, text: s.text } : null,
      };
    case 'over':
      return { k: 'over' };
  }
}

export function viewFor(g: GameState, playerId: PlayerId, now: number): PlayerView {
  const me = g.players.find((p) => p.id === playerId);
  if (!me) throw new Error('不是这一局的玩家');
  const over = g.step.k === 'over';

  const log: LogEntry[] = [];
  for (const ev of g.events) {
    if (!canSee(ev, me, over)) continue;
    const { aud: _aud, ...rest } = ev;
    log.push(rest as LogEntry);
  }

  const hints: string[] = [];
  for (let i = 0; i < g.hintsShown; i++) hints.push(i === 0 ? g.secret.link : g.secret.hints[i - 1]);

  const revealed: PlayerView['revealed'] = {};
  if (g.revealed.big) revealed.big = g.secret.big.word;
  if (g.revealed.small) revealed.small = g.secret.small.word;

  return {
    now,
    me: {
      id: me.id,
      name: me.name,
      seat: me.seat,
      alive: me.alive,
      word: me.faction === 'blank' ? null : g.secret[me.faction].word,
      blank: me.faction === 'blank' ? { role: me.role!, teammates: teammates(g, me) } : null,
    },
    players: g.players.map((p) => ({ id: p.id, name: p.name, seat: p.seat, alive: p.alive })),
    day: g.day,
    phase: phaseOf(g),
    step: stepView(g, me, now),
    log,
    hints,
    revealed,
    difficulty: g.secret.difficulty,
    rules: {
      phase2Questions: g.rules.phase2Questions,
      revealOnExit: g.rules.revealOnExit,
      tableMode: g.rules.tableMode,
      wipeoutThreshold: g.rules.wipeoutThreshold,
      clueMaxLength: g.rules.clueMaxLength,
    },
    result: g.result ? { ...g.result, second: [...g.result.second], third: [...g.result.third] } : null,
    reveal: over
      ? {
          big: g.secret.big.word,
          small: g.secret.small.word,
          link: g.secret.link,
          hints: [...g.secret.hints],
          players: g.players.map((p) => ({ id: p.id, faction: p.faction, role: p.role })),
        }
      : null,
  };
}
