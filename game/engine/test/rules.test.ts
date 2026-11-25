/** 逐条核对规则文档里的规则。章节号指《大国小国》线上版规则与开发说明。 */

import { describe, expect, it } from 'vitest';
import { forceTimeout, judgeView, nightDeciders, releaseHint, viewFor, PRESETS, type GameState } from '../index.ts';
import { Sim } from './sim.ts';

const T = (s: Sim) => s.g.rules.timers;

/** 让 x、y 并列最高票：其他人平分给两人，x、y 互投；人数为奇数时多出的一人投给别人。 */
function tieBallots(s: Sim, x: string, y: string): Record<string, string> {
  const others = s.alive().filter((p) => p.id !== x && p.id !== y);
  const ballots: Record<string, string> = { [x]: y, [y]: x };
  const even = others.length - (others.length % 2);
  others.forEach((p, i) => (ballots[p.id] = i < even ? (i % 2 ? y : x) : others[0].id));
  return ballots;
}

describe('开局（§3）', () => {
  it('各人数按预设分配阵营，7 人局 3 大国 / 2 小国 / 2 白板', () => {
    for (const n of [6, 7, 8, 9, 10, 11, 12]) {
      const s = new Sim({ n, seed: n });
      expect(s.of('big').length).toBe(PRESETS[n].big);
      expect(s.of('small').length).toBe(PRESETS[n].small);
      expect(s.of('blank').length).toBe(PRESETS[n].blank);
      expect(s.g.players.map((p) => p.seat)).toEqual([...Array(n).keys()]);
    }
  });

  it('自定义人数要满足 大国 > 小国 ≥ 2、白板 ≥ 1', () => {
    expect(() => new Sim({ n: 7, rules: { composition: { big: 2, small: 2, blank: 3 } } })).toThrow();
    expect(() => new Sim({ n: 7, rules: { composition: { big: 4, small: 1, blank: 2 } } })).toThrow();
    expect(() => new Sim({ n: 7, rules: { composition: { big: 3, small: 3, blank: 1 } } })).toThrow();
    expect(new Sim({ n: 7, rules: { composition: { big: 4, small: 2, blank: 1 } } }).of('blank').length).toBe(1);
  });

  it('黑板 / 白板的分法：1 人不分，2 人 1+1，3 人 2+1', () => {
    const roles = (n: number) => new Sim({ n, seed: 5 }).of('blank').map((p) => p.role).sort();
    expect(roles(6)).toEqual(['both']);
    expect(roles(7)).toEqual(['black', 'white']);
    expect(roles(10)).toEqual(['black', 'black', 'white']);
  });

  it('2 个白板默认单向认人：白板看得到黑板，黑板看不到白板', () => {
    const s = new Sim({ n: 7, seed: 2 });
    expect(s.g.recognition).toBe('oneWay');
    const black = s.of('blank').find((p) => p.role === 'black')!;
    const white = s.of('blank').find((p) => p.role === 'white')!;
    expect(s.view(white.id).me.blank!.teammates).toEqual([{ id: black.id, role: 'black' }]);
    expect(s.view(black.id).me.blank!.teammates).toEqual([]);
  });

  it('3 个白板默认分组互认：只看得到同一子身份的人', () => {
    const s = new Sim({ n: 10, seed: 2 });
    expect(s.g.recognition).toBe('group');
    const [b1, b2] = s.of('blank').filter((p) => p.role === 'black');
    const white = s.of('blank').find((p) => p.role === 'white')!;
    expect(s.view(b1.id).me.blank!.teammates.map((t) => t.id)).toEqual([b2.id]);
    expect(s.view(white.id).me.blank!.teammates).toEqual([]);
  });

  it('大国和小国看到的身份信息结构完全一样，只有词不同', () => {
    const s = new Sim({ n: 7, seed: 4 });
    const big = s.view(s.of('big')[0].id);
    const small = s.view(s.of('small')[0].id);
    expect(big.me.word).toBe(s.g.secret.big.word);
    expect(small.me.word).toBe(s.g.secret.small.word);
    expect(Object.keys(big.me)).toEqual(Object.keys(small.me));
    expect(big.me.blank).toBeNull();
    expect(JSON.stringify(big)).not.toMatch(/faction|"role"/);
  });
});

describe('夜晚（§5.1）', () => {
  it('同桌模式：国家玩家也要选，但只有黑板定起始玩家、白板定方向', () => {
    const s = new Sim({ n: 7, seed: 8 });
    const black = s.of('blank').find((p) => p.role === 'black')!;
    const white = s.of('blank').find((p) => p.role === 'white')!;
    const nation = s.of('big')[0];
    const target = s.of('small')[0].id;
    // 国家玩家的选择不生效
    s.do(nation.id, { a: 'night', player: nation.id, dir: 'ccw' });
    s.do(black.id, { a: 'night', player: target, dir: 'ccw' });
    s.do(white.id, { a: 'night', player: nation.id, dir: 'cw' });
    expect(s.step.k).toBe('night'); // 还有人没选
    for (const p of s.alive()) if (![nation.id, black.id, white.id].includes(p.id)) s.do(p.id, { a: 'night', player: p.id, dir: 'ccw' });
    expect(s.lastEvent('night')).toMatchObject({ start: target, dir: 'cw' });
    expect(s.step.k).toBe('clue');
  });

  it('同一子身份多人时以最后一次提交为准', () => {
    const s = new Sim({ n: 10, seed: 3 });
    const [b1, b2] = s.of('blank').filter((p) => p.role === 'black');
    const targets = s.of('big');
    s.do(b2.id, { a: 'night', player: targets[0].id });
    s.wait(1000);
    s.do(b1.id, { a: 'night', player: targets[1].id });
    s.wait(T(s).night);
    expect(s.lastEvent('night')!.start).toBe(targets[1].id);
  });

  it('某个子身份全部出局后，由另一个子身份代为决定', () => {
    const s = new Sim({ n: 7, seed: 8 });
    const black = s.of('blank').find((p) => p.role === 'black')!;
    const white = s.of('blank').find((p) => p.role === 'white')!;
    const g: GameState = JSON.parse(JSON.stringify(s.g));
    g.players.find((p) => p.id === black.id)!.alive = false;
    const d = nightDeciders(g);
    expect(d.start.map((p) => p.id)).toEqual([white.id]);
    expect(d.dir.map((p) => p.id)).toEqual([white.id]);
  });

  it('超时未选的项随机决定；起始玩家和方向公开，但不显示是谁选的', () => {
    const s = new Sim({ n: 7, seed: 9 });
    s.wait(T(s).night);
    const ev = s.lastEvent('night')!;
    expect(s.alive().map((p) => p.id)).toContain(ev.start);
    expect(['cw', 'ccw']).toContain(ev.dir);
    expect(Object.keys(ev).sort()).toEqual(['at', 'aud', 'day', 'dir', 'start', 't']);
  });

  it('非同桌模式下国家玩家夜晚没有操作', () => {
    const s = new Sim({ n: 7, seed: 9, rules: { tableMode: false } });
    const nation = s.of('small')[0];
    expect(s.refused(nation.id, { a: 'night', player: nation.id })).toMatch(/没有你的操作/);
    expect(s.view(nation.id).step).toMatchObject({ k: 'night', canPick: false, decides: [] });
  });
});

describe('线索、讨论、投票（§5.2–5.4）', () => {
  it('按起始玩家和方向依次发言；超时记为未发言；长度上限 12 字', () => {
    const s = new Sim({ n: 7, seed: 10 });
    const start = s.g.players[2].id;
    s.night(start, 'ccw');
    const st = s.step as Extract<GameState['step'], { k: 'clue' }>;
    expect(st.order.map((id) => s.p(id).seat)).toEqual([2, 1, 0, 6, 5, 4, 3]);
    expect(s.refused(st.order[1], { a: 'clue', text: '抢话' })).toMatch(/还没轮到你/);
    expect(s.refused(st.order[0], { a: 'clue', text: '一二三四五六七八九十十一' + '二' })).toMatch(/最多 12/);
    s.wait(T(s).clue);
    expect(s.lastEvent('clue')).toMatchObject({ player: start, text: null });
    s.do(st.order[1], { a: 'clue', text: '  能 炒  ' });
    expect(s.lastEvent('clue')!.text).toBe('能 炒');
  });

  it('全体存活玩家准备好可以提前结束讨论', () => {
    const s = new Sim({ n: 7, seed: 10 });
    s.night();
    s.clues();
    expect(s.step.k).toBe('discussion');
    s.discuss();
    expect(s.step.k).toBe('vote');
  });

  it('平票时并列最高票的玩家一起出局；超时未投视为投自己', () => {
    const s = new Sim({ n: 7, seed: 11 });
    s.night();
    s.clues();
    s.discuss();
    const [a, b, c, d, e, f] = s.alive().map((p) => p.id);
    // a、b 各 2 票，其余各 1 票；最后一人不投（视为投自己）
    s.do(a, { a: 'vote', target: b });
    s.do(b, { a: 'vote', target: a });
    s.do(c, { a: 'vote', target: a });
    s.do(d, { a: 'vote', target: b });
    s.do(e, { a: 'vote', target: c });
    s.do(f, { a: 'vote', target: d });
    s.wait(T(s).vote);
    const votes = s.lastEvent('votes')!;
    expect(votes.out.sort()).toEqual([a, b].sort());
    const last = s.g.players.find((p) => ![a, b, c, d, e, f].includes(p.id))!.id;
    expect(votes.ballots[last]).toBe(last);
  });

  it('投票公布前看不到别人投了谁', () => {
    const s = new Sim({ n: 7, seed: 12 });
    s.night();
    s.clues();
    s.discuss();
    const [a, b] = s.alive().map((p) => p.id);
    s.do(a, { a: 'vote', target: b });
    const v = s.view(b);
    expect(v.step).toMatchObject({ k: 'vote', myVote: null, votedCount: 1 });
    expect(JSON.stringify(v)).not.toContain(`"${a}":"${b}"`);
  });
});

describe('出局选择（§5.5，§11）', () => {
  it('国家玩家只能选什么都不做；公布结果前至少展示 8 秒「选择中」', () => {
    const s = new Sim({ n: 7, seed: 13 });
    const nation = s.of('big')[0];
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(nation.id);
    expect(s.step.k).toBe('exit');
    expect(s.refused(nation.id, { a: 'guess', text: '鱿鱼' })).toMatch(/只能选择/);
    expect(s.refused(nation.id, { a: 'ask', text: '是动物吗' })).toMatch(/只能选择/);
    expect(s.view(nation.id).step).toMatchObject({ mine: { options: ['none'] } });
    s.do(nation.id, { a: 'pass' });
    s.wait(T(s).exitMinShow - 1);
    expect(s.step.k).toBe('exit'); // 还在「选择中」
    expect(s.lastEvent('exit')).toBeUndefined();
    s.wait(1);
    expect(s.lastEvent('exit')).toMatchObject({ player: nation.id, choice: 'none' });
    expect(s.lastEvent('exit')).not.toHaveProperty('isBlank');
    expect(s.step.k).toBe('night');
  });

  it('其他人看到的出局步骤没有截止时间，也看不出他选没选', () => {
    const s = new Sim({ n: 7, seed: 13 });
    const blank = s.of('blank')[0];
    const other = s.of('big')[0];
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(blank.id);
    const before = JSON.stringify(s.view(other.id).step);
    s.do(blank.id, { a: 'ask', text: '大国的词能吃吗' });
    s.verdict('invalid'); // 重问会延长时间
    expect(JSON.stringify(s.view(other.id).step)).toBe(before);
    expect(s.view(other.id).step).toMatchObject({ k: 'exit', current: blank.id, mine: null });
  });

  it('白板出局猜中大国词：白板第一，大国有一次机会猜小国词', () => {
    const s = new Sim({ n: 7, seed: 14 });
    const blank = s.of('blank')[0];
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(blank.id);
    s.do(blank.id, { a: 'guess', text: ` ${s.g.secret.big.word} ` });
    s.wait(T(s).exitMinShow);
    expect(s.lastEvent('exit')).toMatchObject({ choice: 'guess', guess: { verdict: 'correct' } });
    expect(s.step.k).toBe('bigChance');
    expect(s.view(s.of('big')[0].id).revealed.big).toBe(s.g.secret.big.word);
    // 大国私密频道：存活的大国玩家可以发言，别人看不到
    const [b1] = s.of('big');
    s.do(b1.id, { a: 'chat', channel: 'big', text: '是股票吧' });
    expect(s.view(s.of('small')[0].id).log.some((e) => e.t === 'chat')).toBe(false);
    s.refused(s.of('small')[0].id, { a: 'guess', text: '股票' });
    s.do(b1.id, { a: 'guess', text: s.g.secret.small.word });
    expect(s.g.result).toEqual({ first: 'blank', second: ['big'], third: ['small'], how: 'exitGuess' });
    expect(s.step.k).toBe('over');
  });

  it('大国的一次机会超时视为没猜中，小国第二', () => {
    const s = new Sim({ n: 7, seed: 14 });
    const blank = s.of('blank')[0];
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(blank.id);
    s.do(blank.id, { a: 'guess', text: s.g.secret.big.word });
    s.wait(T(s).exitMinShow);
    s.wait(T(s).bigChance);
    expect(s.g.result).toMatchObject({ first: 'blank', second: ['small'], third: ['big'] });
  });

  it('白板出局提问：问题公开，回答在下一个夜晚私下发给白板阵营（含已出局的）', () => {
    const s = new Sim({ n: 7, seed: 15 });
    const [asker, mate] = s.of('blank');
    const nation = s.of('small')[0];
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(asker.id);
    s.do(asker.id, { a: 'ask', text: '大国的词是动物吗？' });
    s.verdict('yes');
    // 出局者自己现在也拿不到回答
    expect(JSON.stringify(s.view(asker.id))).not.toContain('"yes"');
    s.wait(T(s).exitMinShow);
    expect(s.lastEvent('exit')).toMatchObject({ choice: 'ask', questions: [{ text: '大国的词是动物吗？', invalid: false }] });
    expect(s.step.k).toBe('night');
    for (const id of [asker.id, mate.id]) {
      expect(s.view(id).log.find((e) => e.t === 'answer')).toMatchObject({ question: '大国的词是动物吗？', answer: 'yes' });
    }
    expect(s.view(nation.id).log.some((e) => e.t === 'answer')).toBe(false);
  });

  it('无效问题允许重问一次，再次无效则作废', () => {
    const s = new Sim({ n: 7, seed: 15 });
    const asker = s.of('blank')[0];
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(asker.id);
    s.do(asker.id, { a: 'ask', text: '它是红的还是蓝的' });
    s.verdict('invalid');
    expect(s.view(asker.id).step).toMatchObject({ mine: { status: 'reask', options: ['none', 'ask'] } });
    s.refused(asker.id, { a: 'guess', text: '鱿鱼' });
    s.do(asker.id, { a: 'ask', text: '又红又蓝吗还有多大' });
    s.verdict('invalid');
    s.wait(T(s).exitMinShow);
    expect(s.lastEvent('exit')!.questions).toEqual([
      { text: '它是红的还是蓝的', invalid: true },
      { text: '又红又蓝吗还有多大', invalid: true },
    ]);
    expect(s.g.pendingAnswers).toEqual([]);
  });

  it('「出局公布身份」开启时公布是不是白板', () => {
    const s = new Sim({ n: 7, seed: 16, rules: { revealOnExit: true } });
    const nation = s.of('small')[0];
    s.dayVoting(nation.id);
    expect(s.lastEvent('exit')).toMatchObject({ player: nation.id, isBlank: false });
  });
});

describe('结算检查（§5.6）', () => {
  it('某国全部出局，白板立刻获胜；该国第三，另一国第二', () => {
    const s = new Sim({ n: 7, seed: 17 });
    const [s1, s2] = s.of('small');
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(s1.id, tieBallots(s, s1.id, s2.id));
    expect(s.lastEvent('votes')!.out.sort()).toEqual([s1.id, s2.id].sort());
    expect(s.g.result).toEqual({ first: 'blank', second: ['big'], third: ['small'], how: 'wipeout' });
    expect(s.step.k).toBe('over');
  });

  it('阈值设为 1 时，某国剩 1 人就触发；且优先于「白板清空」', () => {
    const s = new Sim({ n: 7, seed: 18, rules: { wipeoutThreshold: 1 } });
    const [b1, b2] = s.of('blank');
    const sm = s.of('small')[0];
    s.dayVoting(b1.id); // 第一天投出一个白板
    expect(s.step.k).toBe('night');
    s.night();
    s.clues();
    s.discuss();
    // 第二天最后一个白板和一个小国平票一起出局
    s.voteAll(b2.id, tieBallots(s, b2.id, sm.id));
    expect(s.lastEvent('votes')!.out.sort()).toEqual([b2.id, sm.id].sort());
    expect(s.g.result).toMatchObject({ first: 'blank', how: 'wipeout', second: ['big'], third: ['small'] });
  });

  it('白板全部出局后进入第二阶段', () => {
    const s = new Sim({ n: 7, seed: 19 });
    s.toPhase2();
    expect(s.g.events.some((e) => e.t === 'phase2')).toBe(true);
    const st = s.step as Extract<GameState['step'], { k: 'turn' }>;
    expect(st.round).toBe(1);
    expect(st.order.length).toBe(5);
    // 起始随机，之后顺时针（座位号递增，绕回 0）
    const seats = st.order.map((id) => s.p(id).seat);
    const sorted = [...seats].sort((a, b) => a - b);
    const k = sorted.indexOf(seats[0]);
    expect(seats).toEqual([...sorted.slice(k), ...sorted.slice(0, k)]);
  });

  it('最后一个白板出局时提问：回答在第二阶段开始时立即送达', () => {
    const s = new Sim({ n: 7, seed: 20 });
    const [b1, b2] = s.of('blank');
    s.dayVoting(b1.id);
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(b2.id);
    s.do(b2.id, { a: 'ask', text: '小国的词能吃吗' });
    s.verdict('no');
    s.wait(T(s).exitMinShow);
    expect(s.step.k).toBe('turn');
    expect(s.view(b1.id).log.find((e) => e.t === 'answer')).toMatchObject({ answer: 'no' });
  });
});

describe('第二阶段（§6）', () => {
  it('回合内猜中对方的词：该国第一，进入第二名抢答；记录里不写猜的是哪国的词', () => {
    const s = new Sim({ n: 7, seed: 21 });
    s.toPhase2();
    const st = s.step as Extract<GameState['step'], { k: 'turn' }>;
    const actor = s.p(st.order[0]);
    const opp = actor.faction === 'big' ? 'small' : 'big';
    expect(s.refused(st.order[1], { a: 'guess', text: '抢先' })).toMatch(/还没轮到你/);
    s.do(actor.id, { a: 'guess', text: '同一事物的别名' });
    expect(s.view(st.order[1]).step).toMatchObject({ k: 'turn', judging: true, deadline: null });
    s.verdict('correct'); // LLM 认定是同一事物的另一种叫法
    const ev = s.lastEvent('turn')!;
    expect(ev).toEqual(expect.objectContaining({ action: 'guess', verdict: 'correct' }));
    expect(ev).not.toHaveProperty('target');
    expect(s.g.revealed[opp]).toBe(true);
    expect(s.step).toMatchObject({ k: 'race', purpose: 'second', winner: actor.faction });
    // 第二名：另一国的存活玩家和白板阵营抢答第一名国家的词
    const race = s.step as Extract<GameState['step'], { k: 'race' }>;
    const loser = actor.faction === 'big' ? 'small' : 'big';
    expect(Object.keys(race.targets).sort()).toEqual([...s.of(loser), ...s.of('blank', false)].map((p) => p.id).sort());
    expect(new Set(Object.values(race.targets))).toEqual(new Set([actor.faction]));
  });

  it('提问必须指明大国还是小国的词，回答公开；关闭后不能提问', () => {
    const s = new Sim({ n: 7, seed: 22 });
    s.toPhase2();
    const st = s.step as Extract<GameState['step'], { k: 'turn' }>;
    const a = st.order[0];
    expect(s.refused(a, { a: 'ask', text: '是动物吗' })).toMatch(/指明/);
    s.do(a, { a: 'ask', target: 'small', text: '是动物吗' });
    s.verdict('yes');
    expect(s.lastEvent('turn')).toMatchObject({ action: 'ask', target: 'small', verdict: 'yes' });
    expect(s.view(st.order[3]).log.some((e) => e.t === 'turn' && e.action === 'ask' && e.verdict === 'yes')).toBe(true);
    expect((s.step as { idx: number }).idx).toBe(1);

    const off = new Sim({ n: 7, seed: 22, rules: { phase2Questions: false } });
    off.toPhase2();
    const o = (off.step as Extract<GameState['step'], { k: 'turn' }>).order[0];
    expect(off.refused(o, { a: 'ask', target: 'big', text: '是动物吗' })).toMatch(/不能提问/);
  });

  it('第二阶段回合内无效问题可以重问一次，再无效则本回合结束', () => {
    const s = new Sim({ n: 7, seed: 22 });
    s.toPhase2();
    const st = s.step as Extract<GameState['step'], { k: 'turn' }>;
    const a = st.order[0];
    s.do(a, { a: 'ask', target: 'big', text: '红的蓝的' });
    s.verdict('invalid');
    expect((s.step as { idx: number }).idx).toBe(0);
    s.do(a, { a: 'ask', target: 'big', text: '红的蓝的？？' });
    s.verdict('invalid');
    expect((s.step as { idx: number }).idx).toBe(1);
  });

  it('无人猜中：第一轮 → 白板救济 → 第二轮 → 公布联系后抢答 → 提示用完平局', () => {
    const s = new Sim({ n: 7, seed: 23 });
    s.toPhase2();
    // 第一轮全部超时
    for (let i = 0; i < 5; i++) s.wait(T(s).turn);
    expect(s.step).toMatchObject({ k: 'relief', stage: 'ask' });
    // 白板救济：问题和回答公开，然后猜一次大国词
    const blank = s.of('blank', false)[0];
    s.refused(s.of('big')[0].id, { a: 'ask', text: '是动物吗' });
    s.do(blank.id, { a: 'ask', text: '大国的词是动物吗' });
    s.verdict('no');
    expect(s.step).toMatchObject({ k: 'relief', stage: 'guess' });
    s.do(blank.id, { a: 'guess', text: '不对的词' });
    s.verdict('wrong');
    expect(s.step).toMatchObject({ k: 'turn', round: 2 });
    for (let i = 0; i < 5; i++) s.wait(T(s).turn);
    // 公布联系，进入抢答
    expect(s.step).toMatchObject({ k: 'race', purpose: 'first' });
    expect(s.lastEvent('hint')).toMatchObject({ index: 0, text: s.g.secret.link });
    const hints = s.g.secret.hints.length;
    for (let i = 0; i < hints; i++) s.wait(T(s).hintInterval);
    expect(s.g.hintsShown).toBe(1 + hints);
    expect(s.step.k).toBe('race');
    s.wait(T(s).hintInterval);
    expect(s.g.result).toEqual({ first: null, second: [], third: [], how: 'draw' });
    expect(s.g.revealed).toEqual({ big: true, small: true });
  });

  it('抢答以服务器收到的先后为准：先到的猜测还在判定时，后到的精确命中要等', () => {
    const s = new Sim({ n: 7, seed: 24 });
    s.toPhase2();
    for (let i = 0; i < 5; i++) s.wait(T(s).turn);
    s.wait(T(s).reliefAsk);
    s.wait(T(s).reliefGuess);
    for (let i = 0; i < 5; i++) s.wait(T(s).turn);
    expect(s.step.k).toBe('race');
    const big = s.of('big')[0];
    const small = s.of('small')[0];
    s.do(small.id, { a: 'guess', text: '别名' }); // 先到，交给裁判
    s.do(big.id, { a: 'guess', text: s.g.secret.small.word }); // 后到，精确命中
    expect(s.g.result).toBeNull();
    s.verdict('correct');
    expect(s.g.result!.first).toBe('small');
  });

  it('抢答猜错后有冷却；先到的判错后，后到的精确命中获胜', () => {
    const s = new Sim({ n: 7, seed: 24 });
    s.toPhase2();
    for (let i = 0; i < 5; i++) s.wait(T(s).turn);
    s.wait(T(s).reliefAsk);
    s.wait(T(s).reliefGuess);
    for (let i = 0; i < 5; i++) s.wait(T(s).turn);
    const big = s.of('big')[0];
    const small = s.of('small')[0];
    s.do(small.id, { a: 'guess', text: '别名' });
    expect(s.refused(small.id, { a: 'guess', text: '再猜' })).toMatch(/判定/);
    s.do(big.id, { a: 'guess', text: s.g.secret.small.word });
    s.verdict('wrong');
    expect(s.g.result!.first).toBe('big');
    // 第二名抢答：小国和白板猜大国词；小国刚猜错还在冷却中
    expect(s.step).toMatchObject({ k: 'race', purpose: 'second' });
  });

  it('第二名抢答提示用完仍无人猜中：两方并列第二', () => {
    const s = new Sim({ n: 7, seed: 25 });
    s.toPhase2();
    const a = (s.step as Extract<GameState['step'], { k: 'turn' }>).order[0];
    const f = s.p(a).faction;
    s.do(a, { a: 'guess', text: s.g.secret[f === 'big' ? 'small' : 'big'].word });
    expect(s.step).toMatchObject({ k: 'race', purpose: 'second', nextHintAt: s.t + T(s).hintInterval });
    for (let i = 0; i < 1 + s.g.secret.hints.length; i++) s.wait(T(s).hintInterval);
    s.wait(T(s).hintInterval);
    expect(s.g.result).toEqual({ first: f, second: [f === 'big' ? 'small' : 'big', 'blank'], third: [], how: 'turnGuess' });
  });

  it('救济猜中大国词：白板第一', () => {
    const s = new Sim({ n: 7, seed: 26 });
    s.toPhase2();
    for (let i = 0; i < 5; i++) s.wait(T(s).turn);
    const blank = s.of('blank', false)[1];
    s.do(blank.id, { a: 'pass' });
    s.do(blank.id, { a: 'guess', text: s.g.secret.big.word });
    expect(s.step.k).toBe('bigChance');
    expect(s.g.result).toMatchObject({ first: 'blank', how: 'reliefGuess' });
  });
});

describe('裁判（§8）', () => {
  it('裁判超时：提问答「无法判断」', () => {
    const s = new Sim({ n: 7, seed: 27 });
    s.toPhase2();
    const a = (s.step as Extract<GameState['step'], { k: 'turn' }>).order[0];
    s.do(a, { a: 'ask', target: 'big', text: '是动物吗' });
    s.wait(T(s).llmJudge);
    expect(s.lastEvent('turn')).toMatchObject({ action: 'ask', verdict: 'unknown' });
  });

  it('猜词先做精确匹配：别名表、全角、空格和标点都不影响', () => {
    const s = new Sim({
      n: 7,
      seed: 28,
      pair: { id: 't', wordA: '狗', wordB: '神', aliasesA: ['犬'], link: 'god / dog', hints: [] },
    });
    const blank = s.of('blank')[0];
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(blank.id);
    const bigWord = s.g.secret.big.word;
    s.do(blank.id, { a: 'guess', text: bigWord === '狗' ? '「犬」' : ' 神。' });
    expect(s.g.judge).toEqual([]);
    expect((s.step as Extract<GameState['step'], { k: 'exit' }>).cur.guess!.verdict).toBe('correct');
  });
});

describe('视图', () => {
  it('结束后公布所有人的阵营、两个词和联系', () => {
    const s = new Sim({ n: 7, seed: 29 });
    s.toPhase2();
    const a = (s.step as Extract<GameState['step'], { k: 'turn' }>).order[0];
    s.do(a, { a: 'guess', text: s.g.secret[s.p(a).faction === 'big' ? 'small' : 'big'].word });
    for (let i = 0; i < 6; i++) s.wait(T(s).hintInterval);
    const v = viewFor(s.g, 'p1', s.t);
    expect(v.phase).toBe('over');
    expect(v.reveal).toMatchObject({ big: s.g.secret.big.word, small: s.g.secret.small.word, link: s.g.secret.link });
    expect(v.reveal!.players.length).toBe(7);
  });
});

describe('主持人（§8.4）', () => {
  it('人类裁判可以在抢答时提前公布下一条提示；不在抢答或提示用完时不行', () => {
    const s = new Sim({ n: 7, seed: 24, rules: { judge: 'human' } });
    expect(releaseHint(s.g, s.t).error).toMatch(/只有抢答/);
    s.toPhase2();
    for (let i = 0; i < 5; i++) s.wait(T(s).turn);
    s.wait(T(s).reliefAsk);
    s.wait(T(s).reliefGuess);
    for (let i = 0; i < 5; i++) s.wait(T(s).turn);
    expect(s.step.k).toBe('race');
    expect(s.g.hintsShown).toBe(1);
    const total = 1 + s.g.secret.hints.length;
    for (let i = 1; i < total; i++) {
      const r = releaseHint(s.g, s.t);
      expect(r.error).toBeUndefined();
      s.g = r.state;
    }
    expect(s.g.hintsShown).toBe(total);
    expect(releaseHint(s.g, s.t).error).toMatch(/全部公布/);
    // 提示用完后照常再过一个间隔结束
    s.wait(T(s).hintInterval);
    expect(s.g.result?.how).toBe('draw');
  });

  it('主持人视图看得到两个词、所有人的身份、待判定的请求和只给白板的记录', () => {
    const s = new Sim({ n: 7, seed: 15, rules: { judge: 'human' } });
    const asker = s.of('blank')[0];
    s.night();
    s.clues();
    s.discuss();
    s.voteAll(asker.id);
    s.do(asker.id, { a: 'ask', text: '大国的词是动物吗' });
    const jv = judgeView(s.g, s.t);
    expect(jv.secret.big).toBe(s.g.secret.big.word);
    expect(jv.secret.small).toBe(s.g.secret.small.word);
    expect(jv.players.every((p) => p.faction)).toBe(true);
    expect(jv.judgeMode).toBe('human');
    expect(jv.pending).toEqual([expect.objectContaining({ kind: 'question', text: '大国的词是动物吗', deadline: s.t + T(s).humanJudge })]);
    s.verdict('yes');
    s.wait(T(s).exitMinShow);
    const after = judgeView(s.g, s.t);
    expect(after.log.find((e) => e.t === 'answer')).toMatchObject({ answer: 'yes', to: 'blanks' });
    expect(after.qa).toEqual([expect.objectContaining({ verdict: 'yes', context: 'exit' })]);
  });

  it('人类裁判超时没判，按兜底处理', () => {
    const s = new Sim({ n: 7, seed: 27, rules: { judge: 'human' } });
    s.toPhase2();
    const a = (s.step as Extract<GameState['step'], { k: 'turn' }>).order[0];
    s.do(a, { a: 'ask', target: 'big', text: '是动物吗' });
    s.wait(T(s).llmJudge);
    expect(s.g.judge.length).toBe(1); // 人类裁判等得更久
    s.wait(T(s).humanJudge - T(s).llmJudge);
    expect(s.lastEvent('turn')).toMatchObject({ action: 'ask', verdict: 'unknown' });
  });
});

describe('房间自选：不限时、跳过等待、提前获胜的另一个条件、夜晚只需确认', () => {
  it('不限时：需要玩家操作的环节没有截止时间，等多久都不会自动往下走', () => {
    const s = new Sim({ n: 7, seed: 31, rules: { untimed: true } });
    expect((s.step as Extract<GameState['step'], { k: 'night' }>).deadline).toBeNull();
    s.wait(3_600_000);
    expect(s.step.k).toBe('night');
    s.night();
    expect(s.step.k).toBe('clue');
    s.wait(3_600_000);
    expect(s.step).toMatchObject({ k: 'clue', idx: 0, deadline: null });
  });

  it('跳过等待：当前发言的人按超时处理，记为未发言', () => {
    const s = new Sim({ n: 7, seed: 32, rules: { untimed: true } });
    s.night();
    const st = s.step as Extract<GameState['step'], { k: 'clue' }>;
    const first = st.order[0];
    const r = forceTimeout(s.g, s.t);
    expect(r.error).toBeUndefined();
    s.g = r.state;
    expect(s.lastEvent('clue')).toMatchObject({ player: first, text: null });
    expect(s.step).toMatchObject({ k: 'clue', idx: 1 });
  });

  it('白板存活人数多于某国时，白板立刻获胜（开启时）', () => {
    const s = new Sim({ n: 7, seed: 33, rules: { wipeoutVsBlanks: true } });
    const sm = s.of('small')[0];
    // 小国 2 人、白板 2 人：投出一个小国后，小国 1 < 白板 2
    s.dayVoting(sm.id);
    expect(s.g.result).toMatchObject({ first: 'blank', how: 'wipeout', third: ['small'] });
  });

  it('阈值可以填任意数字：9 人局设为 2 时，小国（3 人）剩 2 人就触发', () => {
    const s = new Sim({ n: 9, seed: 34, rules: { wipeoutThreshold: 2 } });
    expect(s.of('small').length).toBe(3);
    const sm = s.of('small')[0];
    s.dayVoting(sm.id);
    expect(s.g.result).toMatchObject({ first: 'blank', how: 'wipeout', second: ['big'], third: ['small'] });
  });

  it('同桌模式下国家玩家夜晚只点确认（空着提交）；白板阵营必须选', () => {
    const s = new Sim({ n: 7, seed: 35 });
    const nation = s.of('big')[0];
    s.do(nation.id, { a: 'night' });
    const blank = s.of('blank')[0];
    expect(s.refused(blank.id, { a: 'night' })).toBe('请选择起始玩家或方向');
  });
});
