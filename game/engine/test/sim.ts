/** 测试用的小工具：拿着一局状态和一个假时钟，按玩家下动作。 */

import {
  act,
  advance,
  createGame,
  judge,
  nextWake,
  viewFor,
  SAMPLE_PAIRS,
  type Action,
  type Faction,
  type GameState,
  type PlayerState,
  type Rules,
  type WordPair,
} from '../index.ts';

export class Sim {
  g: GameState;
  t = 1_000_000;

  constructor(opts: { n?: number; seed?: number; rules?: Partial<Rules>; pair?: WordPair } = {}) {
    const n = opts.n ?? 7;
    this.g = createGame({
      players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `玩家${i + 1}` })),
      pair: opts.pair ?? SAMPLE_PAIRS[0],
      rules: opts.rules,
      seed: opts.seed ?? 1,
      now: this.t,
    });
  }

  get step() {
    return this.g.step;
  }
  /** 动作必须成功，否则测试失败。 */
  do(id: string, action: Action) {
    const r = act(this.g, id, action, this.t);
    if (r.error) throw new Error(`${id} ${JSON.stringify(action)} 被拒绝：${r.error}`);
    this.g = r.state;
  }
  /** 动作应当被拒绝，返回拒绝理由。 */
  refused(id: string, action: Action): string {
    const r = act(this.g, id, action, this.t);
    if (!r.error) throw new Error(`${id} ${JSON.stringify(action)} 本应被拒绝`);
    return r.error;
  }
  wait(ms: number) {
    this.t += ms;
    this.g = advance(this.g, this.t);
  }
  /** 一直等到下一个计时点。 */
  waitNext() {
    const w = nextWake(this.g);
    if (w === null) throw new Error('没有计时在走');
    this.t = Math.max(this.t, w);
    this.g = advance(this.g, this.t);
  }
  verdict(v: Parameters<typeof judge>[2], which = 0) {
    const req = this.g.judge[which];
    if (!req) throw new Error('没有待判定的请求');
    const r = judge(this.g, req.id, v, this.t);
    if (r.error) throw new Error(r.error);
    this.g = r.state;
  }
  view(id: string) {
    return viewFor(this.g, id, this.t);
  }

  p(id: string): PlayerState {
    return this.g.players.find((p) => p.id === id)!;
  }
  of(f: Faction, aliveOnly = true): PlayerState[] {
    return this.g.players.filter((p) => p.faction === f && (!aliveOnly || p.alive));
  }
  alive(): PlayerState[] {
    return this.g.players.filter((p) => p.alive);
  }
  lastEvent<T extends GameState['events'][number]['t']>(t: T) {
    const evs = this.g.events.filter((e) => e.t === t);
    return evs[evs.length - 1] as Extract<GameState['events'][number], { t: T }> | undefined;
  }

  /* ----- 走流程的快捷方式 ----- */

  /** 所有存活玩家提交夜晚选择（同桌模式），让黑板选 start、白板选 dir。 */
  night(start?: string, dir: 'cw' | 'ccw' = 'cw') {
    if (this.step.k !== 'night') throw new Error(`现在是 ${this.step.k}，不是夜晚`);
    const s = start ?? this.alive()[0].id;
    for (const p of this.alive()) this.do(p.id, { a: 'night', player: s, dir });
  }
  clues(text = '线索') {
    while (this.step.k === 'clue') {
      const s = this.step;
      this.do(s.order[s.idx], { a: 'clue', text });
    }
  }
  /** 轮流发言：每个人依次说完。 */
  discuss() {
    while (this.step.k === 'discussion') {
      const s = this.step;
      this.do(s.order[s.idx], { a: 'ready' });
    }
  }
  /** 所有存活玩家投给 target（或按 ballots 指定）。 */
  voteAll(target: string, ballots: Record<string, string> = {}) {
    for (const p of this.alive()) this.do(p.id, { a: 'vote', target: ballots[p.id] ?? target });
  }
  /** 当前出局者「什么都不做」，并等到公布。 */
  passExit() {
    const s = this.step;
    if (s.k !== 'exit') throw new Error('不在出局选择');
    this.do(s.cur.player, { a: 'pass' });
    this.wait(this.g.rules.timers.exitMinShow);
  }
  /** 一整天：夜晚 → 线索 → 讨论 → 全票投 target → 出局者什么都不做。 */
  dayVoting(target: string) {
    this.night();
    this.clues();
    this.discuss();
    this.voteAll(target);
    while (this.step.k === 'exit') this.passExit();
  }
  /** 把白板一个个投出去，进入第二阶段。 */
  toPhase2() {
    for (const b of this.of('blank')) this.dayVoting(b.id);
    if (this.step.k !== 'turn') throw new Error(`没有进入第二阶段：${this.step.k}`);
  }
}
