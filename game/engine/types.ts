/** 引擎的状态、动作和记录类型。整局状态可以直接 JSON 序列化（房间要把它存盘）。 */

import type { BlankRole, Faction, Recognition, Rules } from './rules.ts';
import type { WordEntry } from './words.ts';

export type PlayerId = string;
/** 'cw' 顺时针 = 座位号递增；'ccw' 逆时针 = 座位号递减。 */
export type Dir = 'cw' | 'ccw';
/** 指「大国的词」还是「小国的词」。 */
export type WordSide = 'big' | 'small';
export type Answer = 'yes' | 'no' | 'unknown';
export type QuestionVerdict = Answer | 'invalid';
export type GuessVerdict = 'correct' | 'wrong';

export interface PlayerState {
  id: PlayerId;
  name: string;
  seat: number;
  faction: Faction;
  role: BlankRole | null;
  alive: boolean;
}

export interface Secret {
  pairId: string;
  big: WordEntry;
  small: WordEntry;
  /** 两个词之间的联系：指向性很强，抢答时放在所有提示之后才公布，否则要到结算才揭晓。 */
  link: string;
  /** 抢答时按顺序公布的提示（不含联系）。公布顺序：这里的第 0、1… 条，最后才是联系本身。 */
  hints: string[];
  difficulty: number | null;
  /** 内部：联系类型、给裁判的说明。只给裁判和主持人，不进玩家视图。 */
  linkType: string;
  judgeNote: string;
}

/** 一条记录谁能看到。 */
export type Audience = { to: 'all' } | { to: 'blanks' } | { to: 'players'; ids: PlayerId[] };

export type Channel = 'public' | 'blanks' | 'big';

/** 等待裁判判定的请求。exactMatch 没命中的猜词和所有提问才会走到这里。 */
export type Origin = 'exit' | 'turn' | 'relief' | 'race' | 'bigChance';
export type JudgeRequest =
  | { id: string; kind: 'guess'; target: WordSide; text: string; at: number; origin: Origin; ref?: string }
  | { id: string; kind: 'question'; target: WordSide | null; text: string; at: number; origin: Origin };

/** 裁判回答过的问题，供后续判定保持一致（§8.1）。 */
export interface QARecord {
  id: string;
  context: 'exit' | 'turn' | 'relief';
  target: WordSide | null;
  text: string;
  verdict: QuestionVerdict;
}

export interface Result {
  /** null：平局（§6.4，提示用完仍无人猜中）。 */
  first: Faction | null;
  second: Faction[];
  third: Faction[];
  how: 'exitGuess' | 'wipeout' | 'turnGuess' | 'reliefGuess' | 'raceGuess' | 'draw';
}

/* ------------------------------------------------------------------ 记录 */

export type EventBody =
  | { t: 'start' }
  | { t: 'night'; day: number; start: PlayerId; dir: Dir }
  | { t: 'clue'; day: number; player: PlayerId; text: string | null }
  | { t: 'votes'; day: number; ballots: Record<PlayerId, PlayerId>; out: PlayerId[] }
  | {
      t: 'exit';
      day: number;
      player: PlayerId;
      choice: 'none' | 'guess' | 'ask';
      guess?: { text: string; verdict: GuessVerdict };
      /** 出局提问：问题公开，回答不公开（下个夜晚私下发给白板阵营）。invalid 表示被判为无效问题。 */
      questions?: { text: string; invalid: boolean }[];
      /** 「出局公布身份」开启时才有。 */
      isBlank?: boolean;
    }
  | { t: 'answer'; question: string; answer: Answer }
  | { t: 'phase2' }
  | { t: 'turn'; round: 1 | 2; player: PlayerId; action: 'guess'; text: string; verdict: GuessVerdict }
  | { t: 'turn'; round: 1 | 2; player: PlayerId; action: 'ask'; target: WordSide; text: string; verdict: QuestionVerdict }
  | { t: 'turn'; round: 1 | 2; player: PlayerId; action: 'timeout' }
  | { t: 'relief'; action: 'ask'; text: string; verdict: QuestionVerdict }
  | { t: 'relief'; action: 'guess'; text: string; verdict: GuessVerdict }
  | { t: 'relief'; action: 'skipAsk' | 'giveUp' }
  | { t: 'hint'; index: number; text: string; /** 这一条就是联系（最后一条） */ link?: boolean }
  | { t: 'raceGuess'; player: PlayerId; text: string; verdict: GuessVerdict }
  | { t: 'bigChance'; player: PlayerId; text: string; verdict: GuessVerdict }
  | { t: 'bigChance'; action: 'timeout' | 'nobody' }
  | { t: 'word'; side: WordSide; word: string }
  | { t: 'result'; result: Result }
  | { t: 'chat'; channel: Channel; player: PlayerId; text: string };

export type GameEvent = EventBody & { at: number; aud: Audience };

/* ------------------------------------------------------------------ 步骤 */

export interface NightPick {
  player?: PlayerId;
  playerAt?: number;
  dir?: Dir;
  dirAt?: number;
}

export interface ExitCur {
  player: PlayerId;
  startedAt: number;
  /** 最短展示时间：在这之前，不管选完没有，大家看到的都是「选择中」。 */
  showUntil: number;
  /** 等裁判或已经选完时为 null。 */
  deadline: number | null;
  choice: 'none' | 'guess' | 'ask' | null;
  guess: { text: string; verdict: GuessVerdict | null } | null;
  questions: { text: string; verdict: QuestionVerdict | null }[];
  pending: string | null;
  done: boolean;
}

export interface RaceGuess {
  id: string;
  player: PlayerId;
  text: string;
  at: number;
  verdict: GuessVerdict | null;
}

export type Step =
  | { k: 'night'; day: number; deadline: number | null; picks: Record<PlayerId, NightPick> }
  | { k: 'clue'; day: number; start: PlayerId; dir: Dir; order: PlayerId[]; idx: number; deadline: number | null }
  /** 轮流发言：按身份提示的顺序每人说一段，当前发言的人点「说完了」（或时间到）轮到下一个。 */
  | { k: 'discussion'; day: number; order: PlayerId[]; idx: number; deadline: number | null }
  | { k: 'vote'; day: number; deadline: number | null; ballots: Record<PlayerId, PlayerId> }
  | { k: 'exit'; day: number; queue: PlayerId[]; idx: number; cur: ExitCur }
  | { k: 'turn'; round: 1 | 2; order: PlayerId[]; idx: number; deadline: number | null; pending: string | null; reasks: number }
  | { k: 'relief'; stage: 'ask' | 'guess'; deadline: number | null; pending: string | null; reasks: number }
  | {
      k: 'race';
      /** 'first'：两轮后抢第一名；'second'：一国已获第一，另一国和白板抢第二名。 */
      purpose: 'first' | 'second';
      /** purpose 为 'second' 时，已获第一名的国家。 */
      winner: Faction | null;
      /** 谁能抢答，以及各自要猜哪个词。 */
      targets: Record<PlayerId, WordSide>;
      queue: RaceGuess[];
      cooldown: Record<PlayerId, number>;
      nextHintAt: number | null;
      endAt: number | null;
    }
  | { k: 'bigChance'; deadline: number | null; pending: string | null; by: PlayerId | null; text: string | null }
  | { k: 'over' };

export type StepKind = Step['k'];

export interface GameState {
  v: 1;
  rules: Rules;
  /** 按座位号排序。 */
  players: PlayerState[];
  secret: Secret;
  recognition: Recognition;
  rng: number;
  seq: number;
  day: number;
  step: Step;
  /** 第二阶段的行动顺序（存活的国家玩家，起始随机，之后顺时针）。 */
  turnOrder: PlayerId[];
  /** 已公布的提示条数（含联系）。 */
  hintsShown: number;
  revealed: Record<WordSide, boolean>;
  /** 出局提问的回答，等下一个夜晚（或第二阶段开始时）私下送达白板阵营。 */
  pendingAnswers: { question: string; answer: Answer }[];
  qa: QARecord[];
  judge: JudgeRequest[];
  events: GameEvent[];
  result: Result | null;
  startedAt: number;
}

/* ------------------------------------------------------------------ 动作 */

export type Action =
  | { a: 'night'; player?: PlayerId; dir?: Dir }
  | { a: 'clue'; text: string }
  | { a: 'ready' }
  | { a: 'vote'; target: PlayerId }
  /** 出局时「什么都不做」；救济时放弃提问 / 放弃猜词。 */
  | { a: 'pass' }
  /** 按当前步骤决定猜的是哪个词：出局、救济猜大国词；回合和抢答猜对方的词；大国的一次机会猜小国词。 */
  | { a: 'guess'; text: string }
  /** 第二阶段回合内必须给 target；出局和救济的提问不限对象，不给 target。 */
  | { a: 'ask'; text: string; target?: WordSide }
  | { a: 'chat'; channel: Channel; text: string };

export interface ActResult {
  state: GameState;
  /** 有值时动作被拒绝，state 原样返回。 */
  error?: string;
}
