/**
 * 《大国小国》的规则配置：人数、房间自选项、计时，以及规则文档里所有「默认」处理。
 *
 * 规则文档（《大国小国》线上版规则与开发说明）第 13 节列出的待确认事项，
 * 在这里都能找到一处对应的常量或开关，注释里写着「§13-编号」。确认后如有变化，
 * 改这里即可；引擎里不再散落别的魔法数字。
 */

export type Faction = 'big' | 'small' | 'blank';

/** 白板阵营的子身份。'both'：白板阵营只有 1 人时不分，他同时决定起始玩家和方向。 */
export type BlankRole = 'black' | 'white' | 'both';

/** 白板互认方式（§3.3）。'auto'：2 人用单向认人，3 人及以上用分组互认（§13-3）。 */
export type Recognition = 'group' | 'oneWay' | 'all';

export interface Composition {
  big: number;
  small: number;
  blank: number;
}

/** §3.2 人数预设。7 人已确定，其余是「默认」（§13-1）。 */
export const PRESETS: Readonly<Record<number, Composition>> = {
  6: { big: 3, small: 2, blank: 1 },
  7: { big: 3, small: 2, blank: 2 },
  8: { big: 4, small: 2, blank: 2 },
  9: { big: 4, small: 3, blank: 2 },
  10: { big: 4, small: 3, blank: 3 },
  11: { big: 5, small: 3, blank: 3 },
  12: { big: 5, small: 4, blank: 3 },
};

/** 房间人数范围（§10.1，§13-1）。人类裁判和出题人不计入。 */
export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 12;

/** 自定义人数的约束：大国 > 小国 ≥ 2，白板 ≥ 1。返回错误说明，合法时返回 null。 */
export function compositionError(c: Composition): string | null {
  const ints = [c.big, c.small, c.blank].every((n) => Number.isInteger(n) && n >= 0);
  if (!ints) return '人数必须是非负整数';
  if (c.small < 2) return '小国至少 2 人';
  if (c.big <= c.small) return '大国人数必须多于小国';
  if (c.blank < 1) return '白板至少 1 人';
  const total = c.big + c.small + c.blank;
  if (total < MIN_PLAYERS || total > MAX_PLAYERS) return `总人数需在 ${MIN_PLAYERS}–${MAX_PLAYERS} 人之间`;
  return null;
}

/** 白板阵营内部黑板 / 白板的人数（§3.3，§13-2）：1 人不分；2 人 1+1；3 人 2+1；4 人 2+2。 */
export function blankRoleSplit(blanks: number): { black: number; white: number } {
  if (blanks <= 1) return { black: 0, white: 0 }; // 唯一的白板是 'both'
  return { black: Math.ceil(blanks / 2), white: Math.floor(blanks / 2) };
}

/** 实际使用的互认方式（§13-3）。单向认人只适用于 2 个白板的局。 */
export function effectiveRecognition(setting: Rules['recognition'], blanks: number): Recognition {
  if (setting === 'auto') return blanks === 2 ? 'oneWay' : 'group';
  if (setting === 'oneWay' && blanks !== 2) return 'group';
  return setting;
}

/** 各环节时长，单位毫秒（§12，全部是「默认」，§13-18）。 */
export interface Timers {
  night: number;
  clue: number;
  discussion: number;
  vote: number;
  exitChoice: number;
  /** 出局选择的最短展示时长：国家玩家也要「选择中」这么久，防止瞬间出结果暴露身份（§11）。 */
  exitMinShow: number;
  turn: number;
  reliefAsk: number;
  reliefGuess: number;
  hintInterval: number;
  raceCooldown: number;
  bigChance: number;
  /** 等 LLM 裁判的最长时间，超过就按 §8.3 的兜底处理（问题答「无法判断」，猜词只认精确匹配）。 */
  llmJudge: number;
  /** 等人类裁判的最长时间。 */
  humanJudge: number;
}

export const DEFAULT_TIMERS: Readonly<Timers> = {
  night: 30_000,
  clue: 45_000,
  discussion: 180_000,
  vote: 30_000,
  exitChoice: 30_000,
  exitMinShow: 8_000,
  turn: 45_000,
  reliefAsk: 45_000,
  reliefGuess: 45_000,
  hintInterval: 60_000,
  raceCooldown: 10_000,
  bigChance: 60_000,
  llmJudge: 30_000,
  humanJudge: 180_000,
};

/** 房间自选规则（§10.2）。实验规则和白板夜间聊天本期不做，所以不在这里。 */
export interface Rules {
  /** null：按人数用预设（§3.2）。 */
  composition: Composition | null;
  judge: 'llm' | 'human';
  recognition: 'auto' | Recognition;
  /** 白板胜利条件 2 的阈值：某国存活人数降到它（含）以下，白板立刻获胜（§5.6）。 */
  wipeoutThreshold: 0 | 1;
  /** 第二阶段回合内能否改为提问（§6.2，默认开，§13-10）。 */
  phase2Questions: boolean;
  /** 出局时公布「是白板 / 不是白板」（§10.3，默认关，§13-10）。 */
  revealOnExit: boolean;
  /**
   * 同桌模式：玩家面对面各用各的手机。夜晚所有存活玩家都要在同样的面板上选一名玩家和一个方向，
   * 国家玩家的选择不生效——否则「谁在夜里低头操作」就暴露了白板。规则文档按纯线上写，
   * 这是为同桌玩加的处理。
   */
  tableMode: boolean;
  /** 线索长度上限，按字符计（§5.2，§13-18）。 */
  clueMaxLength: number;
  timers: Timers;
}

export const DEFAULT_RULES: Readonly<Rules> = {
  composition: null,
  judge: 'llm',
  recognition: 'auto',
  wipeoutThreshold: 0,
  phase2Questions: true,
  revealOnExit: false,
  tableMode: true,
  clueMaxLength: 12,
  timers: DEFAULT_TIMERS,
};

/** 计分（§7.3，§13-15）：计给该阵营的每位玩家。平局时谁都不得分。 */
export const SCORES = { first: 3, second: 1, third: 0 } as const;

/** 提问无效时允许重问的次数（§8.1，§13-18）。 */
export const REASKS_ALLOWED = 1;

/*
 * 其余「默认」处理写在引擎的对应位置，这里列出以便查找：
 *
 * §13-4  同一子身份多人时以最后一次提交为准；某子身份全部出局后由另一子身份代选
 *        → engine.ts nightDeciders()
 * §13-5  出局玩家两个阶段的公开讨论都能参与 → 公共聊天频道对所有人开放
 * §13-6  最后一个白板出局时提问，回答在第二阶段开始时私下送达 → engine.ts startPhase2()
 * §13-7  白板出局提问和救济提问不限对象 → 这两种提问没有 target。
 *        问题里没说明问的是哪个词时，裁判按「大国的词」理解（新增默认，白板的目标是大国词；见 server/src/judge.ts）
 * §13-8  救济回答公开；只在第一轮后有一次 → engine.ts 'relief' 步骤
 * §13-9  第二阶段不能主动跳过回合，只有超时会跳过
 * §13-11 提示用完后再过一个间隔无人猜中：公布答案，平局
 * §13-12 白板第一名后大国没猜中小国词：小国第二
 * §13-13 白板靠条件 2 获胜：人数未降到阈值的国家第二。两国同时降到阈值（新增默认）：两国并列第二
 * §13-14 抢答第二名时提示用完仍无人猜中：并列第二
 * §13-16 词对哪个给大国：每局随机 → setup.ts
 *
 * 出局选择：多人同时出局时按座位号从小到大依次处理（§5.5）。
 * 超时：夜晚未选的项随机；线索记为「未发言」；投票视为投自己；出局选择视为什么都不做；
 *       第二阶段回合跳过；救济提问超时直接进入猜词，救济猜词超时视为放弃（§12）。
 */
