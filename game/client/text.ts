/** 界面文字：阶段名、阵营名、记录怎么写成一句话。 */

import type { BlankRole, Faction } from '../engine/rules.ts';
import type { LogEntry, PlayerView, StepView } from '../engine/view.ts';

export const FACTION: Record<Faction, string> = { big: '大国', small: '小国', blank: '白板' };
/**
 * 白板阵营的两种子身份按职责起名（规则文档里叫「黑板」「白板」，容易和阵营名混）：
 * 起点白板定谁先说，方向白板定顺 / 逆时针；只有一个白板时他两样都定。
 */
export const ROLE: Record<BlankRole, string> = { black: '起点白板', white: '方向白板', both: '独行白板' };
export const ROLE_DUTY: Record<BlankRole, string> = {
  black: '每晚决定当天从谁开始给身份提示',
  white: '每晚决定给提示的方向（顺时针或逆时针）',
  both: '每晚决定从谁开始、按什么方向给身份提示',
};
export const DIR: Record<'cw' | 'ccw', string> = { cw: '顺时针', ccw: '逆时针' };
export const ANSWER: Record<string, string> = { yes: '是', no: '否', unknown: '无法判断', invalid: '无效问题' };
export const VERDICT: Record<string, string> = { correct: '对', wrong: '错' };

/** 阶段的大标题和英文小字。玩家视图和主持人视图都能用（只看 k、round、purpose）。 */
export function phaseTitle(v: { day: number; step: { k: StepView['k'] } }): { cn: string; en: string } {
  const s = v.step as { k: StepView['k']; round?: number; purpose?: string };
  const d = String(v.day).padStart(2, '0');
  switch (s.k) {
    case 'night':
      return { cn: `第 ${v.day} 夜`, en: `NIGHT ${d}` };
    case 'clue':
      return { cn: '身份提示', en: `DAY ${d} · CLUES` };
    case 'discussion':
      return { cn: '自由讨论', en: `DAY ${d} · TALK` };
    case 'vote':
      return { cn: '投票', en: `DAY ${d} · VOTE` };
    case 'exit':
      return { cn: '出局选择', en: `DAY ${d} · OUT` };
    case 'turn':
      return { cn: `第二阶段 · 第 ${s.round} 轮`, en: `PHASE II · ROUND ${s.round}` };
    case 'relief':
      return { cn: '白板救济', en: 'PHASE II · RELIEF' };
    case 'race':
      return s.purpose === 'first' ? { cn: '抢答', en: 'PHASE II · RACE' } : { cn: '抢第二名', en: 'RACE FOR SECOND' };
    case 'bigChance':
      return { cn: '大国的一次机会', en: 'LAST CHANCE' };
    case 'over':
      return { cn: '结算', en: 'RESULT' };
  }
}

/** 截止时间（服务器时间）；没有时返回 null。 */
export function deadlineOf(s: StepView): number | null {
  switch (s.k) {
    case 'night':
    case 'clue':
    case 'discussion':
    case 'vote':
      return s.deadline;
    case 'exit':
      return s.mine?.deadline ?? null;
    case 'turn':
    case 'relief':
    case 'bigChance':
      return s.deadline;
    case 'race':
      return s.nextHintAt ?? s.endAt;
    default:
      return null;
  }
}

/** 一条记录写成一句话。name：玩家 id → 名字。返回 null 表示不在记录里显示。 */
export function describe(e: LogEntry, name: (id: string) => string): { text: string; tone?: 'good' | 'bad' | 'secret' | 'big' } | null {
  switch (e.t) {
    case 'start':
      return { text: '游戏开始' };
    case 'night':
      return { text: `天亮了：从 ${name(e.start)} 开始，${DIR[e.dir]}给身份提示` };
    case 'clue':
      return { text: e.text === null ? `${name(e.player)} 没有给提示` : `${name(e.player)}：「${e.text}」` };
    case 'votes': {
      const byTarget = new Map<string, string[]>();
      for (const [voter, target] of Object.entries(e.ballots)) byTarget.set(target, [...(byTarget.get(target) ?? []), voter]);
      const parts = [...byTarget.entries()].sort((a, b) => b[1].length - a[1].length).map(([t, vs]) => `${name(t)} ${vs.length} 票（${vs.map(name).join('、')}）`);
      return { text: `投票结果：${parts.join('；')}。出局：${e.out.map(name).join('、')}`, tone: 'big' };
    }
    case 'exit': {
      const who = name(e.player);
      const tag = e.isBlank === undefined ? '' : e.isBlank ? '（是白板）' : '（不是白板）';
      if (e.choice === 'none') return { text: `${who} 出局，什么都没做${tag}` };
      if (e.choice === 'guess' && e.guess) {
        return { text: `${who} 出局，猜大国词「${e.guess.text}」——${VERDICT[e.guess.verdict]}${tag}`, tone: e.guess.verdict === 'correct' ? 'good' : 'bad' };
      }
      const qs = (e.questions ?? []).map((q) => `「${q.text}」${q.invalid ? '（无效问题）' : ''}`).join('，重问 ');
      return { text: `${who} 出局，向裁判提问 ${qs}。回答只告诉白板阵营${tag}` };
    }
    case 'answer':
      return { text: `裁判私下回答「${e.question}」：${ANSWER[e.answer]}`, tone: 'secret' };
    case 'phase2':
      return { text: '白板已全部出局，游戏进入第二阶段', tone: 'big' };
    case 'turn':
      if (e.action === 'timeout') return { text: `${name(e.player)} 超时，跳过` };
      if (e.action === 'guess') return { text: `${name(e.player)} 猜「${e.text}」——${VERDICT[e.verdict]}`, tone: e.verdict === 'correct' ? 'good' : 'bad' };
      return { text: `${name(e.player)} 问${FACTION[e.target]}的词：「${e.text}」——${ANSWER[e.verdict]}` };
    case 'relief':
      if (e.action === 'ask') return { text: `白板阵营提问：「${e.text}」——${ANSWER[e.verdict]}` };
      if (e.action === 'guess') return { text: `白板阵营猜大国词「${e.text}」——${VERDICT[e.verdict]}`, tone: e.verdict === 'correct' ? 'good' : 'bad' };
      return { text: e.action === 'skipAsk' ? '白板阵营没有提问' : '白板阵营没有猜词' };
    case 'hint':
      return { text: e.link ? `最后一条，公布联系：${e.text}` : `提示${'一二三四五六七八九十'[e.index] ?? e.index + 1}：${e.text}`, tone: 'big' };
    case 'raceGuess':
      return { text: `${name(e.player)} 抢答「${e.text}」——${VERDICT[e.verdict]}`, tone: e.verdict === 'correct' ? 'good' : 'bad' };
    case 'bigChance':
      if ('action' in e) return { text: e.action === 'nobody' ? '大国已无人存活，没有机会猜小国词' : '大国阵营没有在时限内提交' };
      return { text: `大国阵营（${name(e.player)}）猜小国词「${e.text}」——${VERDICT[e.verdict]}`, tone: e.verdict === 'correct' ? 'good' : 'bad' };
    case 'word':
      return { text: `${FACTION[e.side]}词公开：${e.word}`, tone: 'big' };
    case 'result':
      return { text: resultLine(e.result), tone: 'big' };
    case 'chat':
      return null;
  }
}

export function resultLine(r: { first: Faction | null; second: Faction[]; third: Faction[] }): string {
  if (r.first === null) return '无人猜中，平局';
  const parts = [`第一名 ${FACTION[r.first]}`];
  if (r.second.length) parts.push(`第二名 ${r.second.map((f) => FACTION[f]).join('、')}${r.second.length > 1 ? '（并列）' : ''}`);
  if (r.third.length) parts.push(`第三名 ${r.third.map((f) => FACTION[f]).join('、')}`);
  return parts.join(' · ');
}

/** 规则设置旁边 ⓘ 里的说明（每条一行）。 */
export const RULE_INFO = {
  composition: ['大国人数要多于小国，小国至少 2 人，白板至少 1 人。', '不自定义时按人数用预设。'],
  recognition: [
    '白板阵营有两种子身份：起点白板每晚定谁先给身份提示，方向白板每晚定顺时针还是逆时针。只有 1 个白板时他两样都定（独行白板）。',
    '分组互认：同一种子身份的人互相认识。',
    '单向认人：方向白板认得起点白板，反过来不认得。',
    '全员互认：所有白板互相认识。',
    '自动：2 个白板时单向认人，3 个及以上分组互认。',
  ],
  wipeout: [
    '每次投票有人出局后检查：某国存活人数降到 N 人（含）以下，白板立刻获胜，这个国家排第三、另一国第二。',
    'N = 0 就是某国全部出局。',
    '打开「少于白板」后，某国存活人数比白板存活人数少时也算。',
    '两国同时达到条件时并列第二。',
  ],
  phase2Questions: [
    '白板全部出局后进入第二阶段，存活的国家玩家轮流猜对方国家的词。',
    '打开后，轮到你时可以不猜，改为向裁判问一个 Yes / No 问题。',
    '公开提问：所有人都会看到问题和答案。',
    '提问前要选问的是大国的词还是小国的词——问错对象等于帮了对手。',
    '裁判认为不是有效的是非问题时，可以重问一次。',
  ],
  tableMode: [
    '大家面对面、各用各的手机时打开。',
    '夜晚所有存活玩家都低头看手机：白板阵营做选择，国家玩家点「确认」，从动作上看不出谁是白板。',
    '关掉后夜晚只有白板阵营操作，适合不在一起、各自连线玩。',
  ],
  pace: [
    '不限时：每一步都等当事人操作完再往下走；有人走开了，房主或主持人可以点「跳过等待」，这一步按时间到处理。',
    '紧凑 / 标准 / 宽松：按倒计时自动推进。时间到了没操作：没给提示记为「没有给提示」，没投票视为投自己。',
    '抢答阶段的提示间隔一直按时计。',
  ],
  wordSource: [
    '题库：从勾选的题库里，随机抽一组这个房间里还没人玩过的词对。',
    '自带词：主持人开局前自己出题（两个词 + 联系），用过一次就作废。',
  ],
  judge: [
    'AI 裁判：回答是非问题、判定猜词；写法完全一致的猜词直接判对。',
    '主持人判定：主持人在手机上手动判；超过 3 分钟没判按兜底处理（问题答「无法判断」，猜词判错）。',
  ],
} as const;
