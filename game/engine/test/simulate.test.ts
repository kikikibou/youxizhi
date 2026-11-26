/**
 * 随机机器人跑大量完整对局：每一局都要能结束、结果自洽；每一步都检查每个玩家拿到的视图有没有泄密（§11）。
 */

import { describe, expect, it } from 'vitest';
import {
  act,
  advance,
  createGame,
  judge,
  nextWake,
  viewFor,
  SAMPLE_PAIRS,
  type Action,
  type GameState,
  type PlayerView,
  type Rules,
  type WordSide,
} from '../index.ts';

/** 随机数（测试自己用，和引擎的分开）。 */
function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 机器人说的话不能碰巧包含任何测试词里的字，否则泄密检查会误报。
const SECRET_CHARS = new Set(SAMPLE_PAIRS.flatMap((p) => [...p.wordA, ...p.wordB]));
const JUNK = ['苹果', '火车', '月亮', '钢琴', '雨伞', '咖啡', '书包', '电视', '飞机', '红色', '很大', '会动'].filter(
  (w) => ![...w].some((c) => SECRET_CHARS.has(c)),
);

/** 机器人只看自己的视图做决定；「作弊」时才偷看答案，用来走到各种获胜路径。 */
function botAction(g: GameState, v: PlayerView, r: () => number): Action | null {
  const me = g.players.find((p) => p.id === v.me.id)!;
  const junk = () => JUNK[Math.floor(r() * JUNK.length)];
  const anyAlive = () => {
    const live = v.players.filter((p) => p.alive);
    return live[Math.floor(r() * live.length)].id;
  };
  const cheat = (side: WordSide, p: number) => (r() < p ? g.secret[side].word : junk());
  const st = v.step;
  if (r() < 0.02) return { a: 'chat', channel: 'public', text: junk() };
  switch (st.k) {
    case 'night':
      return st.canPick && !st.myPick ? { a: 'night', player: anyAlive(), dir: r() < 0.5 ? 'cw' : 'ccw' } : null;
    case 'clue':
      return st.order[st.idx] === v.me.id && r() < 0.8 ? { a: 'clue', text: junk() } : null;
    case 'discussion':
      return st.order[st.idx] === v.me.id && r() < 0.5 ? { a: 'ready' } : null;
    case 'vote': {
      if (!v.me.alive || st.myVote || r() < 0.2) return null;
      // 偏向投白板，让更多对局走到第二阶段
      const blanksAlive = g.players.filter((p) => p.alive && p.faction === 'blank');
      if (blanksAlive.length && r() < 0.6) return { a: 'vote', target: blanksAlive[Math.floor(r() * blanksAlive.length)].id };
      return { a: 'vote', target: anyAlive() };
    }
    case 'exit': {
      const m = st.mine;
      if (!m || (m.status !== 'choosing' && m.status !== 'reask')) return null;
      const opt = m.options[Math.floor(r() * m.options.length)];
      if (opt === 'none') return { a: 'pass' };
      if (opt === 'guess') return { a: 'guess', text: cheat('big', 0.15) };
      return { a: 'ask', text: `${junk()}吗` };
    }
    case 'turn':
      if (st.actor !== v.me.id || st.judging || r() < 0.2) return null;
      if (st.canAsk && r() < 0.4) return { a: 'ask', target: r() < 0.5 ? 'big' : 'small', text: `${junk()}吗` };
      return { a: 'guess', text: cheat(me.faction === 'big' ? 'small' : 'big', 0.1) };
    case 'relief':
      if (!st.canAct || st.judging || r() < 0.5) return null;
      if (st.stage === 'ask') return r() < 0.8 ? { a: 'ask', text: `${junk()}吗` } : { a: 'pass' };
      return r() < 0.9 ? { a: 'guess', text: cheat('big', 0.2) } : { a: 'pass' };
    case 'race': {
      if (!st.canGuess || st.myPending || st.cooldownUntil || r() < 0.7) return null;
      const s = g.step as Extract<GameState['step'], { k: 'race' }>;
      return { a: 'guess', text: cheat(s.targets[v.me.id], 0.05) };
    }
    case 'bigChance':
      return st.canGuess && r() < 0.3 ? { a: 'guess', text: cheat('small', 0.3) } : null;
    case 'over':
      return null;
  }
}

/** 检查一个玩家的视图没有超出他该知道的内容。 */
function checkView(g: GameState, v: PlayerView, where: string) {
  const json = JSON.stringify(v);
  const me = g.players.find((p) => p.id === v.me.id)!;
  const over = g.step.k === 'over';
  const fail = (msg: string) => {
    throw new Error(`${where} 玩家 ${me.id}（${me.faction}）：${msg}`);
  };
  // 内部字段永远不出现
  for (const key of ['"aud"', '"targets"', '"picks"', '"pending"', '"qa"', '"judge"', '"secret"', '"sense"', '"aliases"', '"pairId"', '"rng"']) {
    if (json.includes(key)) fail(`出现了内部字段 ${key}`);
  }
  if (!over) {
    // 结算前任何人都看不到阵营归属；国家玩家连子身份字段都没有
    if (json.includes('"faction"')) fail('出现了阵营字段');
    if (me.faction !== 'blank' && json.includes('"role"')) fail('国家玩家的视图里出现了子身份');
    if (v.reveal) fail('结算前出现了公布');
    // 词：只能看到自己的词和已公开的词（自己刚输入、还没公布的猜测不算）
    const own = JSON.parse(json) as PlayerView;
    if (own.step.k === 'exit' && own.step.mine) own.step.mine.guess = null;
    if (own.step.k === 'race') own.step.myPending = null;
    const ownJson = JSON.stringify(own);
    for (const side of ['big', 'small'] as const) {
      const w = g.secret[side].word;
      if (me.faction !== side && !g.revealed[side] && ownJson.includes(w)) fail(`看到了不该看到的词「${w}」`);
    }
    // 联系和提示：公布前看不到
    // 联系只在抢答把提示全部放完之后（最后一条）或结算时才出现
    if (g.step.k !== 'over' && g.hintsShown < g.secret.hints.length + 1 && json.includes(g.secret.link)) fail('联系提前出现');
    // 白板出局提问的回答只给白板阵营
    if (me.faction !== 'blank' && v.log.some((e) => e.t === 'answer')) fail('国家玩家看到了出局提问的回答');
    // 白板队友：只能按互认方式看到
    if (me.faction !== 'blank' && v.me.blank) fail('国家玩家拿到了白板信息');
    // 第二阶段的猜词记录不写猜的是哪国的词
    for (const e of v.log) if (e.t === 'turn' && e.action === 'guess' && 'target' in e) fail('回合猜词记录带了 target');
    // 投票公布前只看得到自己的票
    if (v.step.k === 'vote' && json.includes('"ballots"')) {
      const day = v.step.day;
      if (v.log.some((e) => e.t === 'votes' && e.day === day)) fail('本轮投票提前公布');
    }
  }
  // 大国、小国玩家的 me 结构完全相同
  if (me.faction !== 'blank') expect(Object.keys(v.me)).toEqual(['id', 'name', 'seat', 'alive', 'word', 'blank']);
}

function checkResult(g: GameState) {
  const r = g.result!;
  expect(r).toBeTruthy();
  const all = [r.first, ...r.second, ...r.third].filter((x) => x !== null);
  expect(new Set(all).size).toBe(all.length); // 不重复
  if (r.first === null) expect(r.how).toBe('draw');
  else expect(r.second.length).toBeGreaterThan(0);
  if (r.how === 'wipeout') expect(r.first).toBe('blank');
  expect(g.judge).toEqual([]);
  expect(g.revealed).toEqual({ big: true, small: true });
}

function playOne(seed: number, n: number, rules: Partial<Rules>, checkEvery: number) {
  const r = rng(seed * 7919 + n);
  const pair = SAMPLE_PAIRS[seed % SAMPLE_PAIRS.length];
  let t = 5_000_000;
  let g = createGame({
    players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `玩家${i + 1}` })),
    pair,
    rules,
    seed,
    now: t,
  });
  let steps = 0;
  while (g.step.k !== 'over') {
    if (++steps > 20_000) throw new Error(`第 ${seed} 局没有结束，停在 ${g.step.k}`);
    const roll = r();
    if (roll < 0.15 && g.judge.length && r() < 0.9) {
      // 裁判作答（偶尔不答，让超时兜底生效）
      const req = g.judge[Math.floor(r() * g.judge.length)];
      const v = req.kind === 'guess' ? (r() < 0.05 ? 'correct' : 'wrong') : (['yes', 'no', 'unknown', 'invalid'] as const)[Math.floor(r() * 4)];
      const res = judge(g, req.id, v, t);
      expect(res.error).toBeUndefined();
      g = res.state;
    } else if (roll < 0.8) {
      const p = g.players[Math.floor(r() * g.players.length)];
      const action = botAction(g, viewFor(g, p.id, t), r);
      if (action) {
        const res = act(g, p.id, action, t);
        // 机器人只按视图允许的操作做，不应该被拒绝（抢答结束的边界除外）
        if (res.error && !/抢答已经结束/.test(res.error)) throw new Error(`第 ${seed} 局 ${p.id} ${JSON.stringify(action)}：${res.error}`);
        g = res.state;
      }
    } else {
      // 时间流逝：小步走，或直接跳到下一个计时点
      const w = nextWake(g);
      t = r() < 0.5 && w !== null ? Math.max(t, w) : t + Math.floor(r() * 3000);
      g = advance(g, t);
    }
    if (steps % checkEvery === 0 || g.step.k === 'over') {
      for (const p of g.players) checkView(g, viewFor(g, p.id, t), `第 ${seed} 局第 ${steps} 步`);
    }
    // 状态必须能 JSON 往返（房间要存盘）
    if (steps % 50 === 0) expect(JSON.parse(JSON.stringify(g))).toEqual(g);
  }
  checkResult(g);
  return g.result!;
}

describe('随机对局', () => {
  it('各种人数和规则组合下都能打完，结果自洽，视图不泄密', () => {
    const tally: Record<string, number> = {};
    const variants: Partial<Rules>[] = [
      {},
      { tableMode: false },
      { wipeoutThreshold: 1 },
      { phase2Questions: false, revealOnExit: true },
      { recognition: 'all' },
      { recognition: 'group', judge: 'human' },
    ];
    let seed = 1;
    for (const n of [6, 7, 8, 9, 10, 11, 12]) {
      for (const rules of variants) {
        for (let k = 0; k < 6; k++) {
          const res = playOne(seed++, n, rules, 4);
          const key = `${res.how}:${res.first}>${res.second.join('+')}`;
          tally[key] = (tally[key] ?? 0) + 1;
        }
      }
    }
    // 各种结局都应该出现过
    const hows = new Set(Object.keys(tally).map((k) => k.split(':')[0]));
    for (const how of ['wipeout', 'exitGuess', 'turnGuess', 'reliefGuess', 'raceGuess', 'draw']) expect(hows).toContain(how);
    // 第二名的几种决出方式也都要走到：抢答胜出、并列、大国的一次机会成败
    const seconds = Object.keys(tally).map((k) => k.split('>')[1]);
    for (const s of ['small', 'big', 'blank', 'small+blank', 'big+blank']) expect(seconds).toContain(s);
  }, 180_000);
});
