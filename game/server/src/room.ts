/**
 * 一个房间 = 一个 Durable Object。管成员、密码、房主、设置、累计得分，并跑规则引擎。
 *
 * - 状态存在 Durable Object 的存储里，每次变化先存盘再推送；休眠或重启后从存储恢复。
 * - 每台手机一条 WebSocket（休眠 API），附件里记着它是哪个成员。
 * - 所有计时只用一个 alarm：设在引擎的 nextWake() 和房间闲置清理时间里较早的那个。
 * - 推给每个人的对局内容只经过 viewFor() 过滤（§11）。
 */

import { DurableObject } from 'cloudflare:workers';
import {
  act,
  advance,
  createGame,
  factionScore,
  judge as applyJudge,
  nextWake,
  viewFor,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PRESETS,
  type GameState,
  type JudgeRequest,
} from '../../engine/index.ts';
import { NAME_MAX, type ClientMsg, type RoomSettings, type RoomView, type ServerMsg } from '../../shared/protocol.ts';
import { pickPair } from './bank.ts';
import { decide, fallbackVerdict, judgeConfigured } from './judge.ts';
import { DEFAULT_SETTINGS, mergeSettings, toRules } from './settings.ts';

interface Member {
  id: string;
  name: string;
  /** 重连凭证，只发给本人。 */
  token: string;
  joinedAt: number;
  /** 这台手机玩过的词对（加入时带来）。 */
  seen: string[];
}

interface RoomData {
  code: string;
  createdAt: number;
  passwordHash: string | null;
  salt: string;
  hostId: string | null;
  members: Member[];
  settings: RoomSettings;
  scores: Record<string, number>;
  /** 本房间已经结束的对局用过的词对。 */
  played: string[];
  gameNo: number;
  /** 已经计过分的那一局，防止重复计分。 */
  scoredGameNo: number;
  lastActive: number;
  hostOfflineSince: number | null;
  failedJoins: { count: number; since: number };
}

interface Attachment {
  memberId: string | null;
}

/** 房间闲置这么久（且没人连着）就清掉。 */
const IDLE_TTL = 24 * 60 * 60 * 1000;
/** 房主掉线超过这么久，房主自动交给最早加入的在线成员。 */
const HOST_GRACE = 60 * 1000;
const MAX_MEMBERS = MAX_PLAYERS;
const MAX_MESSAGE = 4096;
const MAX_SEEN = 500;
const PASSWORD_MAX = 32;
/** 密码连续输错这么多次，锁一分钟。 */
const MAX_FAILED_JOINS = 10;

function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(salt: string, password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const n = name.replace(/\s+/g, ' ').trim();
  const len = Array.from(n).length;
  return len >= 1 && len <= NAME_MAX ? n : null;
}
function cleanPassword(pw: unknown): string | null {
  if (typeof pw !== 'string') return null;
  const p = pw.trim();
  return p ? p.slice(0, PASSWORD_MAX) : null;
}
function cleanSeen(seen: unknown): string[] {
  if (!Array.isArray(seen)) return [];
  return seen.filter((s): s is string => typeof s === 'string' && s.length <= 64).slice(-MAX_SEEN);
}

export class Room extends DurableObject<Env> {
  private room: RoomData | null = null;
  private game: GameState | null = null;
  /** 正在判定中的裁判请求（只在内存里；重启后会重新发起）。 */
  private inflight = new Set<string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomData>('room')) ?? null;
      this.game = (await ctx.storage.get<GameState>('game')) ?? null;
      // 重启后，之前没判完的请求重新交给裁判。
      this.dispatchJudging();
    });
    // 心跳由运行时直接回复，不唤醒房间。
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  /* ============================================================ RPC：建房、查询 */

  /** 用这个房间号建房。房间号正被占用时返回 false，Worker 会换一个号重试。 */
  async create(code: string, password: string | null): Promise<boolean> {
    const now = Date.now();
    if (this.room) {
      const idle = now - this.room.lastActive >= IDLE_TTL && this.ctx.getWebSockets().length === 0;
      if (!idle) return false;
      await this.wipe();
    }
    const salt = randomHex(16);
    const pw = cleanPassword(password);
    this.room = {
      code,
      createdAt: now,
      passwordHash: pw ? await hashPassword(salt, pw) : null,
      salt,
      hostId: null,
      members: [],
      settings: structuredClone(DEFAULT_SETTINGS),
      scores: {},
      played: [],
      gameNo: 0,
      scoredGameNo: 0,
      lastActive: now,
      hostOfflineSince: null,
      failedJoins: { count: 0, since: now },
    };
    this.game = null;
    await this.commit();
    return true;
  }

  /** 加入页用：房间在不在、要不要密码、能不能进。 */
  async info(): Promise<{ exists: boolean; hasPassword: boolean; inGame: boolean; members: number }> {
    if (!this.room) return { exists: false, hasPassword: false, inGame: false, members: 0 };
    return {
      exists: true,
      hasPassword: !!this.room.passwordHash,
      inGame: this.inGame(),
      members: this.room.members.length,
    };
  }

  /* ============================================================ WebSocket */

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('需要 WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ memberId: null } satisfies Attachment);
    if (!this.room) {
      this.send(server, { t: 'bye', reason: '房间不存在或已经关闭' });
      server.close(4004, 'no room');
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return this.fail(ws, '消息格式不对');
    let m: ClientMsg;
    try {
      m = JSON.parse(message);
    } catch {
      return this.fail(ws, '消息格式不对');
    }
    if (!this.room) {
      this.send(ws, { t: 'bye', reason: '房间不存在或已经关闭' });
      return ws.close(4004, 'no room');
    }
    if (m.t === 'ping') return this.send(ws, { t: 'pong' });
    this.room.lastActive = Date.now();
    if (m.t === 'join') return this.onJoin(ws, m);

    const memberId = (ws.deserializeAttachment() as Attachment | null)?.memberId;
    const me = memberId ? this.member(memberId) : undefined;
    if (!memberId) return this.fail(ws, '请先加入房间');
    if (!me) {
      this.send(ws, { t: 'bye', reason: '你已经不在这个房间里了' });
      return ws.close(4003, 'gone');
    }
    try {
      this.checkHost(); // 房主掉线够久了的话先交接，再判断谁是房主
      await this.onMessage(ws, me, m);
    } catch (e) {
      console.error('处理消息出错', m.t, e);
      this.fail(ws, '服务器出错了，请重试');
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      /* 已经关了 */
    }
    await this.onDisconnect(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.onDisconnect(ws);
  }

  /* ============================================================ 计时 */

  async alarm() {
    if (!this.room) return;
    const now = Date.now();
    if (now - this.room.lastActive >= IDLE_TTL && this.onlineSockets().length === 0) {
      await this.wipe();
      return;
    }
    if (this.game) this.game = advance(this.game, now);
    await this.commit();
  }

  /* ============================================================ 消息处理 */

  private async onJoin(ws: WebSocket, m: Extract<ClientMsg, { t: 'join' }>) {
    const room = this.room!;
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.memberId) return this.fail(ws, '你已经在房间里了');
    const now = Date.now();

    // 重连：凭 token 回到原来的位置，不用再输密码。
    if (typeof m.token === 'string') {
      const mem = room.members.find((x) => x.token === m.token);
      if (mem) {
        ws.serializeAttachment({ memberId: mem.id } satisfies Attachment);
        mem.seen = [...new Set([...mem.seen, ...cleanSeen(m.seen)])].slice(-MAX_SEEN);
        this.send(ws, { t: 'welcome', id: mem.id, token: mem.token });
        await this.commit();
        return;
      }
    }

    if (this.inGame()) return this.fail(ws, '对局进行中，这一局结束后才能加入');
    if (room.members.length >= MAX_MEMBERS) return this.fail(ws, `房间已满（最多 ${MAX_MEMBERS} 人）`);
    if (room.passwordHash) {
      const f = room.failedJoins;
      if (now - f.since > 60_000) Object.assign(f, { count: 0, since: now });
      if (f.count >= MAX_FAILED_JOINS) return this.fail(ws, '密码错误次数太多，请一分钟后再试');
      const pw = cleanPassword(m.password);
      if (!pw || (await hashPassword(room.salt, pw)) !== room.passwordHash) {
        f.count += 1;
        await this.save();
        return this.fail(ws, pw ? '密码不对' : '这个房间需要密码');
      }
    }
    const name = cleanName(m.name);
    if (!name) return this.fail(ws, `名字需要 1–${NAME_MAX} 个字`);
    if (room.members.some((x) => x.name === name)) return this.fail(ws, '这个名字已经有人用了');

    const mem: Member = { id: randomHex(4), name, token: randomHex(24), joinedAt: now, seen: cleanSeen(m.seen) };
    room.members.push(mem);
    room.scores[mem.id] ??= 0;
    room.hostId ??= mem.id; // 第一个进来的（建房的人）当房主
    ws.serializeAttachment({ memberId: mem.id } satisfies Attachment);
    this.send(ws, { t: 'welcome', id: mem.id, token: mem.token });
    await this.commit();
  }

  private async onMessage(ws: WebSocket, me: Member, m: ClientMsg) {
    const room = this.room!;
    const isHost = room.hostId === me.id;
    const hostOnly = () => {
      if (!isHost) throw new UserError('只有房主可以这样做');
    };
    const lobbyOnly = (what: string) => {
      if (this.inGame()) throw new UserError(`对局进行中不能${what}`);
    };
    try {
      switch (m.t) {
        case 'rename': {
          lobbyOnly('改名');
          const name = cleanName(m.name);
          if (!name) throw new UserError(`名字需要 1–${NAME_MAX} 个字`);
          if (room.members.some((x) => x.name === name && x.id !== me.id)) throw new UserError('这个名字已经有人用了');
          me.name = name;
          break;
        }
        case 'leave':
          lobbyOnly('离开房间');
          this.removeMember(me.id, '你已离开房间');
          break;
        case 'settings':
          hostOnly();
          lobbyOnly('修改规则');
          room.settings = mergeSettings(room.settings, m.settings);
          break;
        case 'password': {
          hostOnly();
          const pw = cleanPassword(m.password);
          room.passwordHash = pw ? await hashPassword(room.salt, pw) : null;
          break;
        }
        case 'kick':
          hostOnly();
          lobbyOnly('请人离开');
          if (m.id === me.id) throw new UserError('不能请自己离开');
          if (!this.member(m.id)) throw new UserError('没有这个人');
          this.removeMember(m.id, '你被房主请出了房间');
          break;
        case 'transfer':
          hostOnly();
          if (!this.member(m.id)) throw new UserError('没有这个人');
          room.hostId = m.id;
          room.hostOfflineSince = null;
          break;
        case 'start':
          hostOnly();
          this.startGame();
          break;
        case 'act': {
          if (!this.game || !this.game.players.some((p) => p.id === me.id)) throw new UserError('你不在这一局里');
          const r = act(this.game, me.id, m.action, Date.now());
          if (r.error) throw new UserError(r.error);
          this.game = r.state;
          break;
        }
        default:
          throw new UserError('不认识的消息');
      }
    } catch (e) {
      if (e instanceof UserError) return this.fail(ws, e.message);
      throw e;
    }
    await this.commit();
  }

  private async onDisconnect(ws: WebSocket) {
    if (!this.room) return;
    await this.commit(ws); // 推送在线状态；房主掉线的话 checkHost() 开始计时
  }

  /* ============================================================ 对局 */

  private inGame(): boolean {
    return !!this.game && this.game.step.k !== 'over';
  }

  /** 开局的障碍；能开局时返回 null。 */
  private startBlocker(): string | null {
    const room = this.room!;
    const n = room.members.length;
    if (this.inGame()) return '对局进行中';
    if (n < MIN_PLAYERS) return `至少 ${MIN_PLAYERS} 人才能开局，还差 ${MIN_PLAYERS - n} 人`;
    if (n > MAX_PLAYERS) return `最多 ${MAX_PLAYERS} 人`;
    const comp = room.settings.composition ?? PRESETS[n];
    if (!comp || comp.big + comp.small + comp.blank !== n) return `自定义的阵营人数加起来要等于 ${n} 人`;
    if (!this.choosePair(() => 0)) return '题库里已经没有大家都没玩过的词对了';
    return null;
  }

  private choosePair(random: () => number) {
    const room = this.room!;
    const exclude = new Set([...room.played, ...room.members.flatMap((m) => m.seen)]);
    return pickPair(room.settings.difficulty, exclude, random);
  }

  private startGame() {
    const room = this.room!;
    const blocker = this.startBlocker();
    if (blocker) throw new UserError(blocker);
    const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const pair = this.choosePair(random)!;
    this.game = createGame({
      players: room.members.map((m) => ({ id: m.id, name: m.name })),
      pair,
      rules: toRules(room.settings),
      seed: crypto.getRandomValues(new Int32Array(1))[0],
      now: Date.now(),
    });
    room.gameNo += 1;
  }

  /** 一局结束时计分（§7.3），并记下用过的词对。 */
  private settleFinishedGame() {
    const room = this.room!;
    const g = this.game;
    if (!g || g.step.k !== 'over' || room.scoredGameNo >= room.gameNo) return;
    for (const p of g.players) room.scores[p.id] = (room.scores[p.id] ?? 0) + factionScore(g.result, p.faction);
    if (!room.played.includes(g.secret.pairId)) room.played.push(g.secret.pairId);
    room.scoredGameNo = room.gameNo;
  }

  /* ============================================================ 裁判 */

  private dispatchJudging() {
    const g = this.game;
    if (!g || g.rules.judge === 'human') return; // 人类裁判手动判定（M4）
    for (const req of g.judge) {
      if (this.inflight.has(req.id)) continue;
      this.inflight.add(req.id);
      this.ctx.waitUntil(this.runJudge(req));
    }
  }

  private async runJudge(req: JudgeRequest) {
    let verdict;
    try {
      verdict = await decide(this.env, req, this.game!);
    } catch (e) {
      console.error('裁判出错，用兜底判定', e);
      verdict = fallbackVerdict(req);
    } finally {
      this.inflight.delete(req.id);
    }
    if (!this.game) return;
    const r = applyJudge(this.game, req.id, verdict, Date.now());
    if (r.error) return; // 已经超时兜底过了
    this.game = r.state;
    await this.commit();
  }

  /* ============================================================ 存盘、推送、计时 */

  /** 存盘 → 设闹钟 → 推送 → 交给裁判。closing：正在关闭的连接，不再给它推送。 */
  private async commit(closing?: WebSocket) {
    const room = this.room;
    if (!room) return;
    // 先补上已经到点的计时（闹钟可能还没响，比如房间刚被唤醒），推出去的就不会是过时的步骤。
    if (this.game) this.game = advance(this.game, Date.now());
    this.settleFinishedGame();
    this.checkHost(closing);
    await this.save();
    await this.schedule();
    this.broadcast(closing);
    this.dispatchJudging();
  }

  private async save() {
    // 两次写入之间不 await，存储会把它们合并成一次原子写入。
    const a = this.ctx.storage.put('room', this.room);
    const b = this.game ? this.ctx.storage.put('game', this.game) : this.ctx.storage.delete('game');
    await Promise.all([a, b]);
  }

  private async schedule() {
    const room = this.room!;
    const times = [room.lastActive + IDLE_TTL];
    const w = this.game ? nextWake(this.game) : null;
    if (w !== null) times.push(w);
    if (room.hostOfflineSince !== null) times.push(room.hostOfflineSince + HOST_GRACE);
    await this.ctx.storage.setAlarm(Math.min(...times));
  }

  private async wipe() {
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, { t: 'bye', reason: '房间已经关闭' });
      try {
        ws.close(4000, 'closed');
      } catch {
        /* ignore */
      }
    }
    this.room = null;
    this.game = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  private broadcast(closing?: WebSocket) {
    for (const ws of this.onlineSockets(closing)) {
      const id = (ws.deserializeAttachment() as Attachment | null)?.memberId;
      if (!id || !this.member(id)) continue;
      this.send(ws, this.stateFor(id));
    }
  }

  private stateFor(id: string): ServerMsg {
    const room = this.room!;
    const now = Date.now();
    const view: RoomView = {
      code: room.code,
      hasPassword: !!room.passwordHash,
      me: id,
      hostId: room.hostId,
      members: room.members.map((m) => ({
        id: m.id,
        name: m.name,
        online: this.isOnline(m.id),
        host: m.id === room.hostId,
        score: room.scores[m.id] ?? 0,
      })),
      settings: room.settings,
      gameNo: room.gameNo,
      inGame: this.inGame(),
      startBlocker: this.startBlocker(),
      played: [...room.played],
      judge: { ai: judgeConfigured(this.env), model: judgeConfigured(this.env) ? (this.env.JUDGE_MODEL ?? null) : null },
    };
    const inThisGame = this.game?.players.some((p) => p.id === id);
    return { t: 'state', room: view, game: inThisGame ? viewFor(this.game!, id, now) : null };
  }

  /* ============================================================ 成员 */

  private member(id: string): Member | undefined {
    return this.room?.members.find((m) => m.id === id);
  }

  private onlineSockets(except?: WebSocket): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws !== except && ws.readyState === WebSocket.OPEN);
  }

  private isOnline(memberId: string, except?: WebSocket): boolean {
    return this.onlineSockets(except).some((ws) => (ws.deserializeAttachment() as Attachment | null)?.memberId === memberId);
  }

  private removeMember(id: string, reason: string) {
    const room = this.room!;
    room.members = room.members.filter((m) => m.id !== id);
    delete room.scores[id];
    if (room.hostId === id) {
      room.hostId = room.members[0]?.id ?? null;
      room.hostOfflineSince = null;
    }
    for (const ws of this.ctx.getWebSockets()) {
      if ((ws.deserializeAttachment() as Attachment | null)?.memberId !== id) continue;
      this.send(ws, { t: 'bye', reason });
      ws.serializeAttachment({ memberId: null } satisfies Attachment);
      try {
        ws.close(4001, 'removed');
      } catch {
        /* ignore */
      }
    }
  }

  /** 房主掉线超过一分钟，交给最早加入的在线成员。 */
  private checkHost(closing?: WebSocket) {
    const room = this.room!;
    if (!room.hostId) return;
    if (this.isOnline(room.hostId, closing)) {
      room.hostOfflineSince = null;
      return;
    }
    room.hostOfflineSince ??= Date.now();
    if (Date.now() - room.hostOfflineSince < HOST_GRACE) return;
    const next = room.members.find((m) => this.isOnline(m.id, closing));
    if (next) {
      room.hostId = next.id;
      room.hostOfflineSince = null;
    }
  }

  /* ============================================================ 发送 */

  private send(ws: WebSocket, msg: ServerMsg) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* 连接已断 */
    }
  }

  private fail(ws: WebSocket, message: string) {
    this.send(ws, { t: 'error', message });
  }
}

class UserError extends Error {}
