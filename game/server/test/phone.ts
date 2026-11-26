/** 冒烟测试用的模拟手机和机器人（只看自己收到的视图）。 */

import type { PlayerView } from '../../engine/view.ts';
import type { ClientMsg, RoomView, ServerMsg } from '../../shared/protocol.ts';

export const BASE = (process.argv[2] ?? 'http://127.0.0.1:8788').replace(/\/$/, '');
export const WS_BASE = BASE.replace(/^http/, 'ws');

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const JUNK = ['火车', '月亮', '钢琴', '雨伞', '咖啡', '书包', '红色', '会动', '很大'];

export let failures = 0;
export function check(ok: unknown, msg: string) {
  if (ok) console.log(`  ✓ ${msg}`);
  else {
    failures += 1;
    console.log(`  ✗ ${msg}`);
  }
}

export class Phone {
  ws!: WebSocket;
  id = '';
  token = '';
  room: RoomView | null = null;
  game: PlayerView | null = null;
  errors: string[] = [];
  bye: string | null = null;
  bot = false;
  /** 测试用：先问这个，返回 undefined 时才用默认的机器人逻辑。 */
  decide?: (v: PlayerView) => import('../../engine/types.ts').Action | null | undefined;
  /** 测试用：每收到一次 state 调一次。 */
  onState?: (m: Extract<ServerMsg, { t: 'state' }>) => void;
  private acting = false;
  private waiters: ((m: ServerMsg) => boolean)[] = [];

  name: string;
  code: string;
  constructor(name: string, code: string) {
    this.name = name;
    this.code = code;
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_BASE}/rooms/${this.code}/ws`);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (ev) => this.onMessage(JSON.parse(String(ev.data)) as ServerMsg);
    });
  }
  send(m: ClientMsg) {
    this.ws.send(JSON.stringify(m));
  }
  /** 等到收到满足条件的消息。 */
  next(pred: (m: ServerMsg) => boolean, timeout = 15_000): Promise<ServerMsg> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.name} 等消息超时`)), timeout);
      this.waiters.push((m) => {
        if (!pred(m)) return false;
        clearTimeout(timer);
        resolve(m);
        return true;
      });
    });
  }
  async join(password?: string, token?: string) {
    await this.open();
    const reply = this.next((m) => m.t === 'welcome' || m.t === 'error');
    this.send({ t: 'join', name: this.name, password, token });
    const m = await reply;
    if (m.t === 'welcome') {
      this.id = m.id;
      this.token = m.token;
      await this.next((x) => x.t === 'state');
    }
    return m;
  }
  close() {
    this.ws.close();
  }

  private onMessage(m: ServerMsg) {
    if (m.t === 'state') {
      this.room = m.room;
      this.game = m.game;
    }
    if (m.t === 'error') this.errors.push(m.message);
    if (m.t === 'bye') this.bye = m.reason;
    this.waiters = this.waiters.filter((w) => !w(m));
    if (m.t === 'state') this.onState?.(m);
    if (m.t === 'state' && this.bot) void this.play();
  }

  /** 机器人：只看自己的视图。 */
  async play() {
    if (this.acting || !this.game) return;
    this.acting = true;
    await sleep(30 + Math.random() * 150);
    this.acting = false;
    const v = this.game;
    if (!v || this.ws.readyState !== WebSocket.OPEN) return;
    const custom = this.decide?.(v);
    const a = custom !== undefined ? custom : botAction(v);
    if (a) this.send({ t: 'act', action: a });
  }
}

export function botAction(v: PlayerView): import('../../engine/types.ts').Action | null {
  const st = v.step;
  const alive = v.players.filter((p) => p.alive);
  switch (st.k) {
    case 'night':
      return st.canPick && !st.myPick ? { a: 'night', player: pick(alive).id, dir: pick(['cw', 'ccw'] as const) } : null;
    case 'clue':
      return st.order[st.idx] === v.me.id ? { a: 'clue', text: pick(JUNK) } : null;
    case 'discussion':
      return st.order[st.idx] === v.me.id ? { a: 'ready' } : null;
    case 'vote': {
      if (!v.me.alive || st.myVote) return null;
      // 大家都投座位号最小的另一位存活玩家：每天只出局一人，更容易走到第二阶段
      const target = alive.filter((p) => p.id !== v.me.id).sort((a, b) => a.seat - b.seat)[0] ?? alive[0];
      return { a: 'vote', target: target.id };
    }
    case 'exit': {
      const m = st.mine;
      if (!m || (m.status !== 'choosing' && m.status !== 'reask')) return null;
      const o = pick(m.options);
      return o === 'none' ? { a: 'pass' } : o === 'guess' ? { a: 'guess', text: pick(JUNK) } : { a: 'ask', text: `${pick(JUNK)}吗` };
    }
    case 'turn':
      if (st.actor !== v.me.id || st.judging) return null;
      return st.canAsk && Math.random() < 0.4
        ? { a: 'ask', target: pick(['big', 'small'] as const), text: `${pick(JUNK)}吗` }
        : { a: 'guess', text: pick(JUNK) };
    case 'relief':
      if (!st.canAct || st.judging) return null;
      return st.stage === 'ask' ? { a: 'ask', text: `${pick(JUNK)}吗` } : { a: 'guess', text: pick(JUNK) };
    case 'race':
      return st.canGuess && !st.myPending && !st.cooldownUntil && Math.random() < 0.3 ? { a: 'guess', text: pick(JUNK) } : null;
    case 'bigChance':
      return st.canGuess ? { a: 'guess', text: pick(JUNK) } : null;
    default:
      return null;
  }
}

/** 测试用的短计时（毫秒）。 */
export const FAST = {
  night: 2500, clue: 2000, discussion: 2000, vote: 2000, exitChoice: 2000, exitMinShow: 1000,
  turn: 2000, reliefAsk: 2000, reliefGuess: 2000, hintInterval: 2000, raceCooldown: 1000, bigChance: 2000,
};

