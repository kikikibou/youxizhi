/** 界面文字：阶段名、阵营名、记录怎么写成一句话。 */

import type { BlankRole, Faction } from '../engine/rules.ts';
import type { LogEntry, PlayerView, StepView } from '../engine/view.ts';

export const FACTION: Record<Faction, string> = { big: '大国', small: '小国', blank: '白板' };
export const ROLE: Record<BlankRole, string> = { black: '黑板', white: '白板', both: '白板（独自一人）' };
export const ROLE_DUTY: Record<BlankRole, string> = {
  black: '每晚决定当天从谁开始发言',
  white: '每晚决定发言方向（顺时针或逆时针）',
  both: '每晚决定从谁开始发言，以及发言方向',
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
      return { cn: '发言', en: `DAY ${d} · CLUES` };
    case 'discussion':
      return { cn: '讨论', en: `DAY ${d} · TALK` };
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
      return { text: `天亮了：从 ${name(e.start)} 开始，${DIR[e.dir]}发言` };
    case 'clue':
      return { text: e.text === null ? `${name(e.player)} 没有发言` : `${name(e.player)}：「${e.text}」` };
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
      return { text: e.index === 0 ? `提示一（联系）：${e.text}` : `提示${'一二三四五六七八九十'[e.index] ?? e.index + 1}：${e.text}`, tone: 'big' };
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

/** 规则速览（首页「怎么玩」）。 */
export const HOW_TO = [
  ['三个阵营', '大国、小国各拿一个词，两个词之间有一个微妙的联系（例：股票 / 鱿鱼，都能「炒」）。白板没有词。你只知道自己的词，不知道自己是大国还是小国。'],
  ['第一阶段', '每天每人说一个词当线索，然后讨论、投票。目标是把白板全部投出去。说得太模糊会被当成白板，说得太准会在第二阶段被对方猜中。'],
  ['第二阶段', '白板清空后，存活的国家玩家轮流猜对方国家的词（也可以改为向裁判提问），先猜中的阵营第一。'],
  ['白板', '目标是猜中大国词。出局时可以猜一次或问裁判一个问题；也可以什么都不做，装成被误投的国家玩家。'],
] as const;
