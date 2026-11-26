/**
 * 《大国小国》规则引擎：纯函数状态机，不碰网络和真实时钟。
 *
 *   createGame(...)            开局
 *   act(state, player, action, now)   玩家动作
 *   judge(state, requestId, verdict, now)   裁判（LLM 或人类）给出判定
 *   advance(state, now)        时间到了（房间在 nextWake(state) 时调用）
 *
 * 每个函数都返回新状态，不修改传入的状态。时间一律是服务器的毫秒时间戳。
 * 给玩家看的内容只能经过 view.ts 的 viewFor() 过滤，不能直接发 GameState。
 */

import {
  DEFAULT_RULES,
  PRESETS,
  REASKS_ALLOWED,
  SCORES,
  blankRoleSplit,
  compositionError,
  effectiveRecognition,
  type Faction,
  type Rules,
} from './rules.ts';
import { exactMatch, type WordEntry, type WordPair } from './words.ts';
import type {
  ActResult,
  Action,
  Answer,
  Audience,
  Channel,
  Dir,
  EventBody,
  ExitCur,
  GameState,
  GuessVerdict,
  JudgeRequest,
  Origin,
  PlayerId,
  PlayerState,
  QuestionVerdict,
  Result,
  Step,
  WordSide,
} from './types.ts';

const ALL: Audience = { to: 'all' };
const BLANKS: Audience = { to: 'blanks' };

/** 问题和猜词的长度上限（防刷屏；规则没有规定）。 */
const MAX_QUESTION = 60;
const MAX_GUESS = 20;
const MAX_CHAT = 200;

/* ================================================================ 工具 */

class Reject extends Error {}
function reject(msg: string): never {
  throw new Reject(msg);
}

/** 截止时间：不限时的房间里，需要玩家操作的环节不设截止时间（null）。 */
function until(g: GameState, now: number, ms: number): number | null {
  return g.rules.untimed ? null : now + ms;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** mulberry32：可复现的随机数，状态存在 g.rng 里。 */
function rand(g: GameState): number {
  g.rng = (g.rng + 0x6d2b79f5) | 0;
  let t = g.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(g: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(g) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function pickOne<T>(g: GameState, arr: T[]): T {
  return arr[Math.floor(rand(g) * arr.length)];
}

function nextId(g: GameState, prefix: string): string {
  g.seq += 1;
  return `${prefix}${g.seq}`;
}

function emit(g: GameState, body: EventBody, now: number, aud: Audience = ALL) {
  g.events.push({ ...body, at: now, aud } as GameState['events'][number]);
}

const player = (g: GameState, id: PlayerId): PlayerState | undefined => g.players.find((p) => p.id === id);
const alivePlayers = (g: GameState) => g.players.filter((p) => p.alive);
const blanks = (g: GameState) => g.players.filter((p) => p.faction === 'blank');
const aliveOf = (g: GameState, f: Faction) => g.players.filter((p) => p.alive && p.faction === f);
const opponentSide = (f: Faction): WordSide => (f === 'big' ? 'small' : 'big');
const entry = (g: GameState, side: WordSide): WordEntry => g.secret[side];

/** 从 start 开始按方向绕一圈，只保留 ids 里的人。 */
function seatOrder(g: GameState, start: PlayerId, dir: Dir, ids: PlayerId[]): PlayerId[] {
  const n = g.players.length;
  const startSeat = player(g, start)!.seat;
  const keep = new Set(ids);
  const out: PlayerId[] = [];
  for (let k = 0; k < n; k++) {
    const seat = (((dir === 'cw' ? startSeat + k : startSeat - k) % n) + n) % n;
    const p = g.players[seat];
    if (keep.has(p.id)) out.push(p.id);
  }
  return out;
}

function cleanText(s: unknown, max: number, what: string): string {
  if (typeof s !== 'string') reject(`${what}不能为空`);
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) reject(`${what}不能为空`);
  if (Array.from(t).length > max) reject(`${what}最多 ${max} 个字`);
  return t;
}

function judgeTimeout(g: GameState): number {
  return g.rules.judge === 'human' ? g.rules.timers.humanJudge : g.rules.timers.llmJudge;
}

function requestGuess(g: GameState, target: WordSide, text: string, origin: Origin, now: number, ref?: string): string {
  const id = nextId(g, 'j');
  const req: JudgeRequest = { id, kind: 'guess', target, text, at: now, origin };
  if (ref) req.ref = ref;
  g.judge.push(req);
  return id;
}
function requestQuestion(g: GameState, target: WordSide | null, text: string, origin: Origin, now: number): string {
  const id = nextId(g, 'j');
  g.judge.push({ id, kind: 'question', target, text, at: now, origin });
  return id;
}

/* ================================================================ 开局 */

export interface NewGame {
  players: { id: PlayerId; name: string }[];
  pair: WordPair;
  rules?: Partial<Rules>;
  seed: number;
  now: number;
}

export function createGame(input: NewGame): GameState {
  const rules: Rules = { ...DEFAULT_RULES, ...input.rules, timers: { ...DEFAULT_RULES.timers, ...input.rules?.timers } };
  const n = input.players.length;
  const comp = rules.composition ?? PRESETS[n];
  if (!comp) throw new Error(`没有 ${n} 人的预设配置`);
  const err = compositionError(comp);
  if (err) throw new Error(err);
  if (comp.big + comp.small + comp.blank !== n) throw new Error('阵营人数之和与玩家人数不符');
  if (new Set(input.players.map((p) => p.id)).size !== n) throw new Error('玩家 id 重复');

  const g: GameState = {
    v: 1,
    rules,
    players: [],
    secret: null as unknown as GameState['secret'],
    recognition: effectiveRecognition(rules.recognition, comp.blank),
    rng: input.seed | 0,
    seq: 0,
    day: 0,
    step: { k: 'over' },
    turnOrder: [],
    hintsShown: 0,
    revealed: { big: false, small: false },
    pendingAnswers: [],
    qa: [],
    judge: [],
    events: [],
    result: null,
    startedAt: input.now,
  };

  // 座位随机，整局固定（§3.2）；阵营随机。
  const seats = shuffle(g, input.players.map((p) => ({ ...p })));
  const factions: Faction[] = shuffle(g, [
    ...Array<Faction>(comp.big).fill('big'),
    ...Array<Faction>(comp.small).fill('small'),
    ...Array<Faction>(comp.blank).fill('blank'),
  ]);
  g.players = seats.map((p, seat) => ({ id: p.id, name: p.name, seat, faction: factions[seat], role: null, alive: true }));

  // 黑板 / 白板（§3.3）。
  const bl = shuffle(g, blanks(g));
  if (bl.length === 1) bl[0].role = 'both';
  else {
    const split = blankRoleSplit(bl.length);
    bl.forEach((p, i) => (p.role = i < split.black ? 'black' : 'white'));
  }

  // 哪个词给大国每局随机（§13-16）。
  const p = input.pair;
  const A: WordEntry = { word: p.wordA, sense: p.senseA ?? '', aliases: p.aliasesA ?? [] };
  const B: WordEntry = { word: p.wordB, sense: p.senseB ?? '', aliases: p.aliasesB ?? [] };
  const aIsBig = rand(g) < 0.5;
  g.secret = {
    pairId: p.id,
    big: aIsBig ? A : B,
    small: aIsBig ? B : A,
    link: p.link,
    hints: p.hints ?? [],
    difficulty: p.difficulty ?? null,
    linkType: p.linkType ?? '',
    judgeNote: p.judgeNote ?? '',
  };

  emit(g, { t: 'start' }, input.now);
  startNight(g, input.now);
  return g;
}

/* ================================================================ 对外接口 */

export function act(state: GameState, playerId: PlayerId, action: Action, now: number): ActResult {
  const g = clone(state);
  try {
    settle(g, now);
    const me = player(g, playerId);
    if (!me) reject('你不在这一局里');
    handle(g, me, action, now);
    settle(g, now);
    return { state: g };
  } catch (e) {
    if (e instanceof Reject) return { state, error: e.message };
    throw e;
  }
}

/** 裁判对某个请求给出判定。猜词：'correct' | 'wrong'；提问：'yes' | 'no' | 'unknown' | 'invalid'。 */
export function judge(state: GameState, requestId: string, verdict: GuessVerdict | QuestionVerdict, now: number): ActResult {
  const g = clone(state);
  try {
    settle(g, now);
    applyVerdict(g, requestId, verdict, now);
    settle(g, now);
    return { state: g };
  } catch (e) {
    if (e instanceof Reject) return { state, error: e.message };
    throw e;
  }
}

/** 推进时间：处理所有到点的计时。 */
export function advance(state: GameState, now: number): GameState {
  const g = clone(state);
  settle(g, now);
  return g;
}

/** 下一次需要调用 advance() 的时间；没有计时在走时返回 null。 */
export function nextWake(g: GameState): number | null {
  const times: (number | null | undefined)[] = [];
  const s = g.step;
  switch (s.k) {
    case 'night':
    case 'clue':
    case 'discussion':
    case 'vote':
      times.push(s.deadline);
      break;
    case 'exit':
      times.push(s.cur.deadline, s.cur.done ? s.cur.showUntil : null);
      break;
    case 'turn':
    case 'relief':
    case 'bigChance':
      times.push(s.deadline);
      break;
    case 'race':
      times.push(s.nextHintAt, s.endAt);
      break;
  }
  const limit = judgeTimeout(g);
  for (const r of g.judge) times.push(r.at + limit);
  const valid = times.filter((t): t is number => typeof t === 'number');
  return valid.length ? Math.min(...valid) : null;
}

/**
 * 「跳过等待」：把当前这一步当作时间已到，按超时的规矩处理（没发言记为未发言、没投票视为投自己……）。
 * 给不限时的房间用：有人走开或掉线时，房主可以让游戏继续。裁判判定中、出局结果展示中不能跳。
 */
export function forceTimeout(state: GameState, now: number): ActResult {
  const g = clone(state);
  try {
    settle(g, now);
    const s = g.step;
    switch (s.k) {
      case 'night':
      case 'clue':
      case 'discussion':
      case 'vote':
        s.deadline = now;
        break;
      case 'turn':
      case 'relief':
      case 'bigChance':
        if (s.pending) reject('裁判正在判定，稍等一下');
        s.deadline = now;
        break;
      case 'exit':
        if (s.cur.pending) reject('裁判正在判定，稍等一下');
        if (s.cur.done) reject('出局结果马上公布');
        s.cur.deadline = now;
        break;
      default:
        reject('现在没有需要跳过的等待');
    }
    settle(g, now);
    return { state: g };
  } catch (e) {
    if (e instanceof Reject) return { state, error: e.message };
    throw e;
  }
}

/** 人类裁判手动提前公布下一条提示（§8.4）；只在抢答中、还有提示没公布时可以。 */
export function releaseHint(state: GameState, now: number): ActResult {
  const g = clone(state);
  try {
    settle(g, now);
    if (g.step.k !== 'race') reject('只有抢答时才能公布提示');
    if (g.step.nextHintAt === null) reject('提示已经全部公布了');
    revealHint(g, now);
    settle(g, now);
    return { state: g };
  } catch (e) {
    if (e instanceof Reject) return { state, error: e.message };
    throw e;
  }
}

/** 正在等裁判判定的请求（房间把它们交给 LLM 或人类裁判）。 */
export function pendingJudgements(g: GameState): readonly JudgeRequest[] {
  return g.judge;
}

/* ================================================================ 动作分发 */

function handle(g: GameState, me: PlayerState, action: Action, now: number) {
  if (action.a === 'chat') return chat(g, me, action.channel, action.text, now);
  const s = g.step;
  switch (s.k) {
    case 'night':
      if (action.a === 'night') return nightPick(g, me, action.player, action.dir, now);
      break;
    case 'clue':
      if (action.a === 'clue') return clue(g, me, action.text, now);
      break;
    case 'discussion':
      if (action.a === 'ready') return ready(g, me);
      break;
    case 'vote':
      if (action.a === 'vote') return vote(g, me, action.target);
      break;
    case 'exit':
      if (action.a === 'pass' || action.a === 'guess' || action.a === 'ask') return exitAction(g, me, action, now);
      break;
    case 'turn':
      if (action.a === 'guess' || action.a === 'ask') return turnAction(g, me, action, now);
      break;
    case 'relief':
      if (action.a === 'pass' || action.a === 'guess' || action.a === 'ask') return reliefAction(g, me, action, now);
      break;
    case 'race':
      if (action.a === 'guess') return raceGuess(g, me, action.text, now);
      break;
    case 'bigChance':
      if (action.a === 'guess') return bigChanceGuess(g, me, action.text, now);
      break;
  }
  reject('现在不能这样操作');
}

function applyVerdict(g: GameState, id: string, verdict: GuessVerdict | QuestionVerdict, now: number) {
  const i = g.judge.findIndex((r) => r.id === id);
  if (i < 0) reject('这个判定请求已经处理过了');
  const req = g.judge[i];
  if (req.kind === 'guess' && verdict !== 'correct' && verdict !== 'wrong') reject('猜词只能判「对」或「错」');
  if (req.kind === 'question' && !['yes', 'no', 'unknown', 'invalid'].includes(verdict)) reject('提问只能答是 / 否 / 无法判断 / 无效问题');
  g.judge.splice(i, 1);
  switch (req.origin) {
    case 'exit':
      return exitVerdict(g, req, verdict, now);
    case 'turn':
      return turnVerdict(g, req, verdict, now);
    case 'relief':
      return reliefVerdict(g, req, verdict, now);
    case 'race':
      return raceVerdict(g, req, verdict as GuessVerdict, now);
    case 'bigChance':
      return bigChanceVerdict(g, verdict as GuessVerdict, now);
  }
}

/** 处理所有到点的计时和可以自动推进的状态，直到稳定。 */
function settle(g: GameState, now: number) {
  for (let guard = 0; guard < 1000; guard++) {
    if (!settleOnce(g, now)) return;
  }
  throw new Error('settle 没有收敛');
}

function settleOnce(g: GameState, now: number): boolean {
  // 裁判超时的兜底（§8.3）：猜词只认精确匹配（已经没匹配上），所以判错；提问答「无法判断」。
  const limit = judgeTimeout(g);
  const late = g.judge.find((r) => r.at + limit <= now);
  if (late) {
    applyVerdict(g, late.id, late.kind === 'guess' ? 'wrong' : 'unknown', now);
    return true;
  }

  const s = g.step;
  const due = (t: number | null) => t !== null && t <= now;
  switch (s.k) {
    case 'night': {
      const everyone = g.rules.tableMode ? alivePlayers(g) : nightDecidersAll(g);
      if (due(s.deadline) || everyone.every((p) => s.picks[p.id])) {
        resolveNight(g, now);
        return true;
      }
      return false;
    }
    case 'clue':
      if (due(s.deadline)) {
        emit(g, { t: 'clue', day: s.day, player: s.order[s.idx], text: null }, now); // 记为「未发言」
        nextClue(g, now);
        return true;
      }
      return false;
    case 'discussion':
      if (due(s.deadline) || alivePlayers(g).every((p) => s.ready.includes(p.id))) {
        g.step = { k: 'vote', day: s.day, deadline: until(g, now, g.rules.timers.vote), ballots: {} };
        return true;
      }
      return false;
    case 'vote':
      if (due(s.deadline) || alivePlayers(g).every((p) => s.ballots[p.id])) {
        resolveVote(g, now);
        return true;
      }
      return false;
    case 'exit':
      return settleExit(g, now);
    case 'turn':
      if (due(s.deadline)) {
        emit(g, { t: 'turn', round: s.round, player: s.order[s.idx], action: 'timeout' }, now);
        nextTurn(g, now);
        return true;
      }
      return false;
    case 'relief':
      if (due(s.deadline)) {
        if (s.stage === 'ask') {
          emit(g, { t: 'relief', action: 'skipAsk' }, now);
          toReliefGuess(g, now);
        } else {
          emit(g, { t: 'relief', action: 'giveUp' }, now);
          startTurns(g, 2, now);
        }
        return true;
      }
      return false;
    case 'race':
      return settleRace(g, now);
    case 'bigChance':
      if (due(s.deadline)) {
        emit(g, { t: 'bigChance', action: 'timeout' }, now); // 超时视为没猜中
        finish(g, { first: 'blank', second: ['small'], third: ['big'], how: g.result!.how }, now);
        return true;
      }
      return false;
    case 'over':
      return false;
  }
}

/* ================================================================ 聊天 */

function chat(g: GameState, me: PlayerState, channel: Channel, text: unknown, now: number) {
  const t = cleanText(text, MAX_CHAT, '消息');
  const s = g.step;
  const phase2 = s.k === 'turn' || s.k === 'relief' || s.k === 'race' || s.k === 'bigChance' || s.k === 'over';
  let aud: Audience;
  if (channel === 'public') aud = ALL;
  else if (channel === 'blanks') {
    // 白板阵营的私密频道从第二阶段开始（§6.3）。夜间聊天是自选规则，本期不做。
    if (me.faction !== 'blank' || !phase2) reject('你不能在这个频道发言');
    aud = BLANKS;
  } else if (channel === 'big') {
    // 大国的一次机会：存活的大国玩家限时私聊（§7.2）。
    if (s.k !== 'bigChance' || me.faction !== 'big' || !me.alive) reject('你不能在这个频道发言');
    aud = { to: 'players', ids: g.players.filter((p) => p.faction === 'big').map((p) => p.id) };
  } else reject('没有这个频道');
  emit(g, { t: 'chat', channel, player: me.id, text: t }, now, aud);
}

/* ================================================================ 第一阶段：夜晚 */

function startNight(g: GameState, now: number) {
  g.day += 1;
  deliverAnswers(g, now);
  g.step = { k: 'night', day: g.day, deadline: until(g, now, g.rules.timers.night), picks: {} };
}

/** 出局提问的回答，私下发给白板阵营的所有玩家，包括已出局的（§5.1）。 */
function deliverAnswers(g: GameState, now: number) {
  for (const a of g.pendingAnswers) emit(g, { t: 'answer', question: a.question, answer: a.answer }, now, BLANKS);
  g.pendingAnswers = [];
}

/**
 * 谁决定起始玩家、谁决定方向（§5.1，§13-4）：
 * 黑板决定起始玩家，白板决定方向；只有 1 个白板阵营玩家时他两项都定；
 * 某个子身份已无人存活时，由另一个子身份的存活玩家代为决定。
 */
export function nightDeciders(g: GameState): { start: PlayerState[]; dir: PlayerState[] } {
  const live = blanks(g).filter((p) => p.alive);
  const black = live.filter((p) => p.role === 'black' || p.role === 'both');
  const white = live.filter((p) => p.role === 'white' || p.role === 'both');
  return { start: black.length ? black : white, dir: white.length ? white : black };
}
function nightDecidersAll(g: GameState): PlayerState[] {
  const d = nightDeciders(g);
  return [...new Set([...d.start, ...d.dir])];
}

function nightPick(g: GameState, me: PlayerState, target: PlayerId | undefined, dir: Dir | undefined, now: number) {
  if (!me.alive) reject('出局玩家夜晚没有操作');
  const decider = nightDecidersAll(g).some((p) => p.id === me.id);
  if (!g.rules.tableMode && !decider) reject('夜晚没有你的操作');
  // 同桌模式下国家玩家只需要点「确认」（选择不生效，空着提交也行）；白板阵营至少要选一项。
  if (decider && target === undefined && dir === undefined) reject('请选择起始玩家或方向');
  if (target !== undefined && !player(g, target)?.alive) reject('只能选择存活的玩家');
  if (dir !== undefined && dir !== 'cw' && dir !== 'ccw') reject('方向只能是顺时针或逆时针');
  const s = g.step as Extract<Step, { k: 'night' }>;
  const pick = { ...s.picks[me.id] };
  if (target !== undefined) Object.assign(pick, { player: target, playerAt: now });
  if (dir !== undefined) Object.assign(pick, { dir, dirAt: now });
  s.picks[me.id] = pick;
}

function resolveNight(g: GameState, now: number) {
  const s = g.step as Extract<Step, { k: 'night' }>;
  const d = nightDeciders(g);
  // 同一子身份多人时，以最后一次提交为准；超时未选的项随机决定。
  let start: PlayerId | undefined;
  let startAt = -Infinity;
  for (const p of d.start) {
    const pk = s.picks[p.id];
    if (pk?.player && pk.playerAt! > startAt && player(g, pk.player)?.alive) {
      start = pk.player;
      startAt = pk.playerAt!;
    }
  }
  let dir: Dir | undefined;
  let dirAt = -Infinity;
  for (const p of d.dir) {
    const pk = s.picks[p.id];
    if (pk?.dir && pk.dirAt! > dirAt) {
      dir = pk.dir;
      dirAt = pk.dirAt!;
    }
  }
  start ??= pickOne(g, alivePlayers(g)).id;
  dir ??= rand(g) < 0.5 ? 'cw' : 'ccw';
  // 起始玩家和方向对所有人公开，但不显示是谁选的。
  emit(g, { t: 'night', day: s.day, start, dir }, now);
  const order = seatOrder(g, start, dir, alivePlayers(g).map((p) => p.id));
  g.step = { k: 'clue', day: s.day, start, dir, order, idx: 0, deadline: until(g, now, g.rules.timers.clue) };
}

/* ================================================================ 线索、讨论、投票 */

function clue(g: GameState, me: PlayerState, text: unknown, now: number) {
  const s = g.step as Extract<Step, { k: 'clue' }>;
  if (s.order[s.idx] !== me.id) reject('还没轮到你');
  // 线索内容不做任何校验（§5.2），只限长度。
  const t = cleanText(text, g.rules.clueMaxLength, '线索');
  emit(g, { t: 'clue', day: s.day, player: me.id, text: t }, now);
  nextClue(g, now);
}

function nextClue(g: GameState, now: number) {
  const s = g.step as Extract<Step, { k: 'clue' }>;
  s.idx += 1;
  if (s.idx < s.order.length) s.deadline = until(g, now, g.rules.timers.clue);
  else g.step = { k: 'discussion', day: s.day, deadline: until(g, now, g.rules.timers.discussion), ready: [] };
}

function ready(g: GameState, me: PlayerState) {
  if (!me.alive) reject('出局玩家不参与投票');
  const s = g.step as Extract<Step, { k: 'discussion' }>;
  if (!s.ready.includes(me.id)) s.ready.push(me.id);
}

function vote(g: GameState, me: PlayerState, target: PlayerId) {
  if (!me.alive) reject('出局玩家不能投票');
  if (!player(g, target)?.alive) reject('只能投给存活的玩家');
  const s = g.step as Extract<Step, { k: 'vote' }>;
  s.ballots[me.id] = target; // 可以投自己；公布前可以改票
}

function resolveVote(g: GameState, now: number) {
  const s = g.step as Extract<Step, { k: 'vote' }>;
  const live = alivePlayers(g);
  const ballots: Record<PlayerId, PlayerId> = {};
  const tally = new Map<PlayerId, number>();
  for (const p of live) {
    const t = s.ballots[p.id] ?? p.id; // 超时未投视为投自己
    ballots[p.id] = t;
    tally.set(t, (tally.get(t) ?? 0) + 1);
  }
  const max = Math.max(...tally.values());
  // 平票时，所有并列最高票的玩家一起出局。
  const out = live.filter((p) => tally.get(p.id) === max).map((p) => p.id);
  emit(g, { t: 'votes', day: s.day, ballots, out }, now);
  for (const id of out) player(g, id)!.alive = false;

  // 结算检查第 1 条（§5.6）：某国存活人数降到阈值，白板立刻获胜；优先于「白板清空」。
  // 房间自选的另一个条件：某国存活人数少于白板存活人数。
  const th = g.rules.wipeoutThreshold;
  const blanksAlive = aliveOf(g, 'blank').length;
  const down = (f: 'big' | 'small') => {
    const n = aliveOf(g, f).length;
    return n <= th || (g.rules.wipeoutVsBlanks && n < blanksAlive);
  };
  const bigDown = down('big');
  const smallDown = down('small');
  if (bigDown || smallDown) {
    const standing: Faction[] = [];
    const fallen: Faction[] = [];
    (bigDown ? fallen : standing).push('big');
    (smallDown ? fallen : standing).push('small');
    // 两国同时降到阈值时并列第二（新增的默认处理，见 rules.ts）。
    const second = standing.length ? standing : fallen;
    const third = standing.length ? fallen : [];
    finish(g, { first: 'blank', second, third, how: 'wipeout' }, now);
    return;
  }
  g.step = { k: 'exit', day: s.day, queue: out, idx: 0, cur: newExitCur(g, out[0], now) };
}

/* ================================================================ 出局选择 */

function newExitCur(g: GameState, id: PlayerId, now: number): ExitCur {
  return {
    player: id,
    startedAt: now,
    showUntil: now + g.rules.timers.exitMinShow,
    deadline: until(g, now, g.rules.timers.exitChoice),
    choice: null,
    guess: null,
    questions: [],
    pending: null,
    done: false,
  };
}

function exitAction(g: GameState, me: PlayerState, action: Action, now: number) {
  const s = g.step as Extract<Step, { k: 'exit' }>;
  const c = s.cur;
  if (c.player !== me.id) reject('现在不是你的出局选择');
  if (c.done || c.pending) reject('你已经选过了');
  const reasking = c.choice === 'ask'; // 上一个问题被判无效，等重问
  if (action.a === 'pass') {
    if (!reasking) c.choice = 'none';
    c.done = true;
    c.deadline = null;
    return;
  }
  // 只有白板阵营的玩家可以猜词或提问（§5.5）。
  if (me.faction !== 'blank') reject('你只能选择「什么都不做」');
  if (action.a === 'guess') {
    if (reasking) reject('请重新提问，或选择放弃');
    const text = cleanText(action.text, MAX_GUESS, '猜测');
    c.choice = 'guess';
    c.deadline = null;
    if (exactMatch(text, entry(g, 'big'))) {
      c.guess = { text, verdict: 'correct' };
      c.done = true;
    } else {
      c.guess = { text, verdict: null };
      c.pending = requestGuess(g, 'big', text, 'exit', now);
    }
    return;
  }
  if (action.a === 'ask') {
    const text = cleanText(action.text, MAX_QUESTION, '问题');
    c.choice = 'ask';
    c.deadline = null;
    c.questions.push({ text, verdict: null });
    c.pending = requestQuestion(g, null, text, 'exit', now); // 不限对象（§13-7）
  }
}

function exitVerdict(g: GameState, req: JudgeRequest, verdict: GuessVerdict | QuestionVerdict, now: number) {
  const s = g.step;
  if (s.k !== 'exit' || s.cur.pending !== req.id) return;
  const c = s.cur;
  c.pending = null;
  if (req.kind === 'guess') {
    c.guess!.verdict = verdict as GuessVerdict;
    c.done = true;
    return;
  }
  const q = c.questions[c.questions.length - 1];
  q.verdict = verdict as QuestionVerdict;
  g.qa.push({ id: req.id, context: 'exit', target: null, text: q.text, verdict: q.verdict });
  if (verdict === 'invalid') {
    if (c.questions.length <= REASKS_ALLOWED) c.deadline = until(g, now, g.rules.timers.exitChoice); // 允许重问一次
    else c.done = true; // 再次无效，本次提问作废
    return;
  }
  // 回答不公开，下一个夜晚私下送达。
  g.pendingAnswers.push({ question: q.text, answer: verdict as Answer });
  c.done = true;
}

function settleExit(g: GameState, now: number): boolean {
  const s = g.step as Extract<Step, { k: 'exit' }>;
  const c = s.cur;
  if (!c.done && !c.pending && c.deadline !== null && c.deadline <= now) {
    if (c.choice === null) c.choice = 'none'; // 超时视为什么都不做
    c.done = true; // 重问超时：提问作废
    c.deadline = null;
    return true;
  }
  if (!c.done || now < c.showUntil) return false;

  // 公布这个出局者做了什么。
  const p = player(g, c.player)!;
  const body: Extract<EventBody, { t: 'exit' }> = { t: 'exit', day: s.day, player: c.player, choice: c.choice ?? 'none' };
  if (c.choice === 'guess' && c.guess) body.guess = { text: c.guess.text, verdict: c.guess.verdict! };
  if (c.choice === 'ask') body.questions = c.questions.map((q) => ({ text: q.text, invalid: q.verdict === 'invalid' }));
  if (g.rules.revealOnExit) body.isBlank = p.faction === 'blank';
  emit(g, body, now);

  if (c.guess?.verdict === 'correct') {
    revealWord(g, 'big', now);
    blankWins(g, 'exitGuess', now);
    return true;
  }
  s.idx += 1;
  if (s.idx < s.queue.length) {
    s.cur = newExitCur(g, s.queue[s.idx], now);
    return true;
  }
  // 结算检查第 3、4 条：白板全部出局进入第二阶段，否则进入下一个夜晚。
  if (blanks(g).every((b) => !b.alive)) startPhase2(g, now);
  else startNight(g, now);
  return true;
}

/* ================================================================ 第二阶段：回合 */

function startPhase2(g: GameState, now: number) {
  emit(g, { t: 'phase2' }, now); // 裁判宣布「游戏进入第二阶段」
  deliverAnswers(g, now); // 最后一个白板出局时的提问，此时立即送达（§13-6）
  const nations = g.players.filter((p) => p.alive && p.faction !== 'blank').map((p) => p.id);
  const start = pickOne(g, nations);
  g.turnOrder = seatOrder(g, start, 'cw', nations); // 起始随机，之后顺时针（§6.1）
  startTurns(g, 1, now);
}

function startTurns(g: GameState, round: 1 | 2, now: number) {
  // 第二轮「接着轮转」：一轮是每人一次，所以顺序和第一轮相同。
  const order = [...g.turnOrder];
  g.step = { k: 'turn', round, order, idx: 0, deadline: until(g, now, g.rules.timers.turn), pending: null, reasks: 0 };
}

function turnAction(g: GameState, me: PlayerState, action: Action, now: number) {
  const s = g.step as Extract<Step, { k: 'turn' }>;
  if (s.order[s.idx] !== me.id) reject('还没轮到你');
  if (s.pending) reject('裁判正在判定');
  if (action.a === 'guess') {
    const text = cleanText(action.text, MAX_GUESS, '猜测');
    const target = opponentSide(me.faction);
    s.deadline = null;
    if (exactMatch(text, entry(g, target))) return turnGuessResult(g, me.id, text, 'correct', now);
    s.pending = requestGuess(g, target, text, 'turn', now);
    return;
  }
  if (action.a === 'ask') {
    if (!g.rules.phase2Questions) reject('本房间第二阶段不能提问');
    // 必须指明问的是「大国的词」还是「小国的词」（§6.2）。
    if (action.target !== 'big' && action.target !== 'small') reject('请指明问的是大国的词还是小国的词');
    const text = cleanText(action.text, MAX_QUESTION, '问题');
    s.deadline = null;
    s.pending = requestQuestion(g, action.target, text, 'turn', now);
  }
}

function turnVerdict(g: GameState, req: JudgeRequest, verdict: GuessVerdict | QuestionVerdict, now: number) {
  const s = g.step;
  if (s.k !== 'turn' || s.pending !== req.id) return;
  s.pending = null;
  const who = s.order[s.idx];
  if (req.kind === 'guess') return turnGuessResult(g, who, req.text, verdict as GuessVerdict, now);
  const v = verdict as QuestionVerdict;
  g.qa.push({ id: req.id, context: 'turn', target: req.target, text: req.text, verdict: v });
  emit(g, { t: 'turn', round: s.round, player: who, action: 'ask', target: req.target!, text: req.text, verdict: v }, now);
  if (v === 'invalid' && s.reasks < REASKS_ALLOWED) {
    s.reasks += 1;
    s.deadline = until(g, now, g.rules.timers.turn); // 允许重问一次（也可以改为猜词）
    return;
  }
  nextTurn(g, now);
}

function turnGuessResult(g: GameState, who: PlayerId, text: string, verdict: GuessVerdict, now: number) {
  const s = g.step as Extract<Step, { k: 'turn' }>;
  // 记录里不写猜的是哪个词：「请猜对方国家的词」，写出来就暴露了归属（§11）。
  emit(g, { t: 'turn', round: s.round, player: who, action: 'guess', text, verdict }, now);
  if (verdict === 'correct') {
    const f = player(g, who)!.faction;
    revealWord(g, opponentSide(f), now);
    nationWins(g, f, 'turnGuess', now);
    return;
  }
  nextTurn(g, now);
}

function nextTurn(g: GameState, now: number) {
  const s = g.step as Extract<Step, { k: 'turn' }>;
  s.idx += 1;
  s.reasks = 0;
  s.pending = null;
  if (s.idx < s.order.length) {
    s.deadline = until(g, now, g.rules.timers.turn);
    return;
  }
  if (s.round === 1) startRelief(g, now);
  else startRace(g, 'first', null, now);
}

/* ================================================================ 白板救济 */

function startRelief(g: GameState, now: number) {
  g.step = { k: 'relief', stage: 'ask', deadline: until(g, now, g.rules.timers.reliefAsk), pending: null, reasks: 0 };
}

function toReliefGuess(g: GameState, now: number) {
  g.step = { k: 'relief', stage: 'guess', deadline: until(g, now, g.rules.timers.reliefGuess), pending: null, reasks: 0 };
}

function reliefAction(g: GameState, me: PlayerState, action: Action, now: number) {
  // 白板阵营全体共用一个行动面板，任何一人都可以提交，先提交的为准（§6.3）。
  if (me.faction !== 'blank') reject('只有白板阵营可以操作');
  const s = g.step as Extract<Step, { k: 'relief' }>;
  if (s.pending) reject('裁判正在判定');
  if (action.a === 'pass') {
    if (s.stage === 'ask') {
      emit(g, { t: 'relief', action: 'skipAsk' }, now);
      toReliefGuess(g, now);
    } else {
      emit(g, { t: 'relief', action: 'giveUp' }, now);
      startTurns(g, 2, now);
    }
    return;
  }
  if (action.a === 'ask') {
    if (s.stage !== 'ask') reject('现在是猜词环节');
    const text = cleanText(action.text, MAX_QUESTION, '问题');
    s.deadline = null;
    s.pending = requestQuestion(g, null, text, 'relief', now);
    return;
  }
  if (action.a === 'guess') {
    if (s.stage !== 'guess') reject('请先提问（或放弃提问）');
    const text = cleanText(action.text, MAX_GUESS, '猜测');
    s.deadline = null;
    if (exactMatch(text, entry(g, 'big'))) return reliefGuessResult(g, text, 'correct', now);
    s.pending = requestGuess(g, 'big', text, 'relief', now);
  }
}

function reliefVerdict(g: GameState, req: JudgeRequest, verdict: GuessVerdict | QuestionVerdict, now: number) {
  const s = g.step;
  if (s.k !== 'relief' || s.pending !== req.id) return;
  s.pending = null;
  if (req.kind === 'guess') return reliefGuessResult(g, req.text, verdict as GuessVerdict, now);
  const v = verdict as QuestionVerdict;
  g.qa.push({ id: req.id, context: 'relief', target: null, text: req.text, verdict: v });
  // 救济的问题和回答都公开（§13-8）。
  emit(g, { t: 'relief', action: 'ask', text: req.text, verdict: v }, now);
  if (v === 'invalid' && s.reasks < REASKS_ALLOWED) {
    s.reasks += 1;
    s.deadline = until(g, now, g.rules.timers.reliefAsk);
    return;
  }
  toReliefGuess(g, now);
}

function reliefGuessResult(g: GameState, text: string, verdict: GuessVerdict, now: number) {
  emit(g, { t: 'relief', action: 'guess', text, verdict }, now);
  if (verdict === 'correct') {
    revealWord(g, 'big', now);
    blankWins(g, 'reliefGuess', now);
    return;
  }
  startTurns(g, 2, now);
}

/* ================================================================ 抢答 */

/** 抢答时公布的顺序：先是一条条提示，最后才是联系本身（联系指向性太强，放在最后）。 */
export function hintSequence(g: Pick<GameState, 'secret'>): string[] {
  return [...g.secret.hints, g.secret.link];
}
const hintCount = (g: GameState) => hintSequence(g).length;

function startRace(g: GameState, purpose: 'first' | 'second', winner: Faction | null, now: number) {
  const targets: Record<PlayerId, WordSide> = {};
  if (purpose === 'first') {
    // 存活的国家玩家猜对方国家的词；白板阵营全体猜大国词（§6.4）。
    for (const p of g.players) {
      if (p.faction === 'blank') targets[p.id] = 'big';
      else if (p.alive) targets[p.id] = opponentSide(p.faction);
    }
  } else {
    // 第一名国家之外的那一国（只有存活玩家）和白板阵营（全体），一起抢答第一名猜中的那一国的词（§7.2）。
    const side: WordSide = winner === 'big' ? 'big' : 'small';
    const other: Faction = winner === 'big' ? 'small' : 'big';
    for (const p of g.players) {
      if (p.faction === 'blank' || (p.faction === other && p.alive)) targets[p.id] = side;
    }
  }
  g.step = { k: 'race', purpose, winner, targets, queue: [], cooldown: {}, nextHintAt: null, endAt: null };
  // 两轮无人猜中，进入抢答时先公布第一条提示（不是联系）；这组词没有提示时，联系也要等一个间隔再公布
  if (purpose === 'first' && g.secret.hints.length) revealHint(g, now);
  else scheduleHint(g, now); // 第二名：从尚未公布的下一条继续按间隔放出
}

function scheduleHint(g: GameState, now: number) {
  const s = g.step as Extract<Step, { k: 'race' }>;
  const interval = g.rules.timers.hintInterval;
  if (g.hintsShown < hintCount(g)) {
    s.nextHintAt = now + interval;
    s.endAt = null;
  } else {
    // 提示全部用完后，再过一个间隔仍无人猜中就结束（§6.4，§7.2）。
    s.nextHintAt = null;
    s.endAt = now + interval;
  }
}

function revealHint(g: GameState, now: number) {
  const seq = hintSequence(g);
  const i = g.hintsShown;
  emit(g, i === seq.length - 1 ? { t: 'hint', index: i, text: seq[i], link: true } : { t: 'hint', index: i, text: seq[i] }, now);
  g.hintsShown += 1;
  scheduleHint(g, now);
}

function raceGuess(g: GameState, me: PlayerState, text: unknown, now: number) {
  const s = g.step as Extract<Step, { k: 'race' }>;
  const target = s.targets[me.id];
  if (!target) reject('你没有猜词权');
  if (s.endAt !== null && s.endAt <= now) reject('抢答已经结束');
  if (s.queue.some((q) => q.player === me.id)) reject('裁判正在判定你上一个猜测');
  if ((s.cooldown[me.id] ?? 0) > now) reject('猜错后的冷却还没结束');
  const t = cleanText(text, MAX_GUESS, '猜测');
  const id = nextId(g, 'r');
  const hit = exactMatch(t, entry(g, target));
  s.queue.push({ id, player: me.id, text: t, at: now, verdict: hit ? 'correct' : null });
  if (!hit) requestGuess(g, target, t, 'race', now, id);
  processRace(g, now);
}

function raceVerdict(g: GameState, req: JudgeRequest, verdict: GuessVerdict, now: number) {
  const s = g.step;
  if (s.k !== 'race' || req.kind !== 'guess') return;
  const q = s.queue.find((x) => x.id === req.ref);
  if (!q) return;
  q.verdict = verdict;
  processRace(g, now);
}

/**
 * 最先猜中的阵营获胜，先后以服务器收到的时间为准（§6.4）。
 * 猜错的立刻公布并开始冷却；猜中的要等排在它前面、还在判定中的猜测都判完。
 */
function processRace(g: GameState, now: number) {
  const s = g.step as Extract<Step, { k: 'race' }>;
  for (const q of s.queue.filter((x) => x.verdict === 'wrong')) {
    emit(g, { t: 'raceGuess', player: q.player, text: q.text, verdict: 'wrong' }, now);
    s.cooldown[q.player] = now + g.rules.timers.raceCooldown;
  }
  s.queue = s.queue.filter((x) => x.verdict !== 'wrong');
  const head = s.queue[0];
  if (!head || head.verdict !== 'correct') return;
  emit(g, { t: 'raceGuess', player: head.player, text: head.text, verdict: 'correct' }, now);
  // 剩下还在判定的猜测作废。
  const stale = new Set(s.queue.map((x) => x.id));
  g.judge = g.judge.filter((r) => !(r.kind === 'guess' && r.origin === 'race' && r.ref && stale.has(r.ref)));
  s.queue = [];
  const f = player(g, head.player)!.faction;
  const side = s.targets[head.player];
  revealWord(g, side, now);
  if (s.purpose === 'first') {
    if (f === 'blank') blankWins(g, 'raceGuess', now);
    else nationWins(g, f, 'raceGuess', now);
  } else {
    const contestants: Faction[] = [s.winner === 'big' ? 'small' : 'big', 'blank'];
    const how = g.result!.how;
    finish(g, { first: s.winner, second: [f], third: contestants.filter((c) => c !== f), how }, now);
  }
}

function settleRace(g: GameState, now: number): boolean {
  const s = g.step as Extract<Step, { k: 'race' }>;
  if (s.nextHintAt !== null && s.nextHintAt <= now) {
    revealHint(g, now);
    return true;
  }
  if (s.endAt !== null && s.endAt <= now && s.queue.length === 0) {
    if (s.purpose === 'first') {
      // 提示用完仍无人猜中：公布答案，平局（§13-11）。
      revealWord(g, 'big', now);
      revealWord(g, 'small', now);
      finish(g, { first: null, second: [], third: [], how: 'draw' }, now);
    } else {
      // 第二名无人猜中：两方并列第二（§13-14）。
      const how = g.result!.how;
      finish(g, { first: s.winner, second: [s.winner === 'big' ? 'small' : 'big', 'blank'], third: [], how }, now);
    }
    return true;
  }
  return false;
}

/* ================================================================ 第一名产生之后 */

function revealWord(g: GameState, side: WordSide, now: number) {
  if (g.revealed[side]) return;
  g.revealed[side] = true;
  emit(g, { t: 'word', side, word: g.secret[side].word }, now);
}

/** 某国第一：另一国（存活玩家）和白板抢答第一名国家的词，决出第二名。 */
function nationWins(g: GameState, f: Faction, how: Result['how'], now: number) {
  g.result = { first: f, second: [], third: [], how }; // 临时记下，第二名定了再补全
  startRace(g, 'second', f, now);
}

/** 白板第一：大国阵营有一次机会猜小国词（§7.2）。 */
function blankWins(g: GameState, how: Result['how'], now: number) {
  g.result = { first: 'blank', second: [], third: [], how };
  if (aliveOf(g, 'big').length === 0) {
    emit(g, { t: 'bigChance', action: 'nobody' }, now);
    finish(g, { first: 'blank', second: ['small'], third: ['big'], how }, now);
    return;
  }
  g.step = { k: 'bigChance', deadline: until(g, now, g.rules.timers.bigChance), pending: null, by: null, text: null };
}

function bigChanceGuess(g: GameState, me: PlayerState, text: unknown, now: number) {
  const s = g.step as Extract<Step, { k: 'bigChance' }>;
  if (me.faction !== 'big' || !me.alive) reject('只有存活的大国玩家可以提交');
  if (s.pending || s.by) reject('大国阵营已经提交过了');
  const t = cleanText(text, MAX_GUESS, '猜测');
  s.by = me.id;
  s.text = t;
  s.deadline = null;
  if (exactMatch(t, entry(g, 'small'))) return bigChanceVerdict(g, 'correct', now);
  s.pending = requestGuess(g, 'small', t, 'bigChance', now);
}

function bigChanceVerdict(g: GameState, verdict: GuessVerdict, now: number) {
  const s = g.step;
  if (s.k !== 'bigChance' || !s.by || !s.text) return;
  s.pending = null;
  emit(g, { t: 'bigChance', player: s.by, text: s.text, verdict }, now);
  const how = g.result!.how;
  if (verdict === 'correct') {
    revealWord(g, 'small', now);
    finish(g, { first: 'blank', second: ['big'], third: ['small'], how }, now);
  } else finish(g, { first: 'blank', second: ['small'], third: ['big'], how }, now); // §13-12
}

function finish(g: GameState, result: Result, now: number) {
  g.result = result;
  g.judge = [];
  g.step = { k: 'over' };
  revealWord(g, 'big', now);
  revealWord(g, 'small', now);
  emit(g, { t: 'result', result }, now);
}

/** 某阵营在本局的得分（§7.3）。平局谁都不得分。 */
export function factionScore(result: Result | null, f: Faction): number {
  if (!result || result.first === null) return 0;
  if (result.first === f) return SCORES.first;
  if (result.second.includes(f)) return SCORES.second;
  return SCORES.third;
}
