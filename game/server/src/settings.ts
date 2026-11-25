/** 房间设置的默认值和校验。房主发来的设置一律经过这里，非法的项保留原值。 */

import { DEFAULT_RULES, compositionError, normalizeWord, type Rules, type Timers } from '../../engine/index.ts';
import type { CustomPair, RoomSettings } from '../../shared/protocol.ts';

export const DEFAULT_SETTINGS: RoomSettings = {
  composition: DEFAULT_RULES.composition,
  judge: DEFAULT_RULES.judge,
  wordSource: 'bank',
  difficulty: 'random',
  recognition: DEFAULT_RULES.recognition,
  wipeoutThreshold: DEFAULT_RULES.wipeoutThreshold,
  phase2Questions: DEFAULT_RULES.phase2Questions,
  revealOnExit: DEFAULT_RULES.revealOnExit,
  tableMode: DEFAULT_RULES.tableMode,
  clueMaxLength: DEFAULT_RULES.clueMaxLength,
  timers: { ...DEFAULT_RULES.timers },
};

/** 每个计时允许的范围（毫秒）。下限给测试留了余地，界面上可以只给常用档位。 */
const TIMER_RANGE: Record<keyof Timers, [number, number]> = {
  night: [1_000, 300_000],
  clue: [1_000, 300_000],
  discussion: [1_000, 1_800_000],
  vote: [1_000, 300_000],
  exitChoice: [1_000, 300_000],
  exitMinShow: [0, 60_000],
  turn: [1_000, 300_000],
  reliefAsk: [1_000, 300_000],
  reliefGuess: [1_000, 300_000],
  hintInterval: [1_000, 600_000],
  raceCooldown: [0, 120_000],
  bigChance: [1_000, 600_000],
  llmJudge: [5_000, 120_000],
  humanJudge: [10_000, 900_000],
};

const oneOf = <T>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

export function mergeSettings(cur: RoomSettings, input: unknown): RoomSettings {
  if (!input || typeof input !== 'object') return cur;
  const p = input as Partial<Record<keyof RoomSettings, unknown>>;
  const next: RoomSettings = { ...cur, timers: { ...cur.timers } };

  if ('composition' in p) {
    const c = p.composition as RoomSettings['composition'];
    if (c === null) next.composition = null;
    else if (c && typeof c === 'object' && !compositionError(c)) next.composition = { big: c.big, small: c.small, blank: c.blank };
  }
  next.judge = oneOf(p.judge, ['llm', 'human'] as const, cur.judge);
  next.wordSource = oneOf(p.wordSource, ['bank', 'custom'] as const, cur.wordSource);
  next.difficulty = oneOf(p.difficulty, [1, 2, 3, 'random'] as const, cur.difficulty);
  next.recognition = oneOf(p.recognition, ['auto', 'group', 'oneWay', 'all'] as const, cur.recognition);
  next.wipeoutThreshold = oneOf(p.wipeoutThreshold, [0, 1] as const, cur.wipeoutThreshold);
  next.phase2Questions = bool(p.phase2Questions, cur.phase2Questions);
  next.revealOnExit = bool(p.revealOnExit, cur.revealOnExit);
  next.tableMode = bool(p.tableMode, cur.tableMode);
  if (Number.isInteger(p.clueMaxLength) && (p.clueMaxLength as number) >= 2 && (p.clueMaxLength as number) <= 30) {
    next.clueMaxLength = p.clueMaxLength as number;
  }
  if (p.timers && typeof p.timers === 'object') {
    for (const [k, v] of Object.entries(p.timers as Record<string, unknown>)) {
      const range = TIMER_RANGE[k as keyof Timers];
      if (range && typeof v === 'number' && Number.isFinite(v) && v >= range[0] && v <= range[1]) {
        next.timers[k as keyof Timers] = Math.round(v);
      }
    }
    if (next.timers.exitMinShow > next.timers.exitChoice) next.timers.exitMinShow = next.timers.exitChoice;
  }
  return next;
}

/** 房间设置 → 引擎规则。 */
export function toRules(s: RoomSettings): Rules {
  return {
    composition: s.composition,
    judge: s.judge,
    recognition: s.recognition,
    wipeoutThreshold: s.wipeoutThreshold,
    phase2Questions: s.phase2Questions,
    revealOnExit: s.revealOnExit,
    tableMode: s.tableMode,
    clueMaxLength: s.clueMaxLength,
    timers: { ...s.timers },
  };
}

/** 主持人填的自带词：整理、校验。不合格时返回错误说明。 */
export function cleanCustomPair(input: unknown): CustomPair | string {
  if (!input || typeof input !== 'object') return '词对格式不对';
  const p = input as Record<string, unknown>;
  const text = (v: unknown, max: number): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.replace(/\s+/g, ' ').trim();
    return t && Array.from(t).length <= max ? t : null;
  };
  const list = (v: unknown, maxItems: number, maxLen: number): string[] => {
    const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,，、\n]/) : [];
    return raw.map((x) => text(x, maxLen)).filter((x): x is string => !!x).slice(0, maxItems);
  };
  const wordA = text(p.wordA, 20);
  const wordB = text(p.wordB, 20);
  const link = text(p.link, 80);
  if (!wordA || !wordB) return '两个词都要填（每个最多 20 字）';
  if (normalizeWord(wordA) === normalizeWord(wordB)) return '两个词不能一样';
  if (!link) return '要写两个词之间的联系（最多 80 字）';
  const pair: CustomPair = { wordA, wordB, link };
  const senseA = text(p.senseA, 40);
  const senseB = text(p.senseB, 40);
  if (senseA) pair.senseA = senseA;
  if (senseB) pair.senseB = senseB;
  const aliasesA = list(p.aliasesA, 6, 20);
  const aliasesB = list(p.aliasesB, 6, 20);
  if (aliasesA.length) pair.aliasesA = aliasesA;
  if (aliasesB.length) pair.aliasesB = aliasesB;
  const hints = list(p.hints, 6, 80);
  if (hints.length) pair.hints = hints;
  const judgeNote = text(p.judgeNote, 200);
  if (judgeNote) pair.judgeNote = judgeNote;
  return pair;
}
