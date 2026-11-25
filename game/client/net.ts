/** 和房间服务器的连接：建房、查房、WebSocket（自动重连、心跳、时钟校准）。 */

import type { Action } from '../engine/types.ts';
import type { PlayerView } from '../engine/view.ts';
import type { ClientMsg, RoomSettings, RoomView, ServerMsg } from '../shared/protocol.ts';

const params = new URLSearchParams(location.search);

/** 服务器地址：?api= 可以指定；本机开发连 127.0.0.1:8788；线上连 api.yxzzxy.com。 */
export const API = (() => {
  const q = params.get('api');
  if (q) return q.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://127.0.0.1:8788';
  return 'https://api.yxzzxy.com';
})();

/** ?as=xxx：同一个浏览器里扮演不同的人（调试用），本地存储各自分开。 */
const NS = `dgxg${params.get('as') ? `@${params.get('as')}` : ''}`;
export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(`${NS}:${key}`);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(`${NS}:${key}`);
      else localStorage.setItem(`${NS}:${key}`, value);
    } catch {
      /* 存不了就算了 */
    }
  },
};

/** 这台手机玩过的词对（抽题时排除）。 */
export function seenPairs(): string[] {
  try {
    return JSON.parse(store.get('seen') ?? '[]');
  } catch {
    return [];
  }
}
function rememberPairs(ids: string[]) {
  const all = [...new Set([...seenPairs(), ...ids])].slice(-500);
  store.set('seen', JSON.stringify(all));
}

export async function createRoom(password: string | null): Promise<string> {
  const res = await fetch(`${API}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const body = (await res.json()) as { code?: string; error?: string };
  if (!body.code) throw new Error(body.error ?? '建房失败');
  return body.code;
}

export interface RoomInfo {
  exists: boolean;
  hasPassword: boolean;
  inGame: boolean;
  members: number;
}
export async function roomInfo(code: string): Promise<RoomInfo> {
  const res = await fetch(`${API}/rooms/${code}`);
  return (await res.json()) as RoomInfo;
}

export type Status = 'connecting' | 'open' | 'offline' | 'closed';

export interface Snapshot {
  status: Status;
  /** 已经加入（拿到了 welcome）。 */
  joined: boolean;
  room: RoomView | null;
  game: PlayerView | null;
  /** 服务器时间 - 本机时间，用来算倒计时。 */
  offset: number;
  /** 最近一条错误（加入失败、动作被拒绝……）。 */
  error: { message: string; at: number } | null;
  /** 被请出或房间关闭。 */
  bye: string | null;
}

export class RoomConnection {
  readonly code: string;
  snap: Snapshot = { status: 'connecting', joined: false, room: null, game: null, offset: 0, error: null, bye: null };
  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private retry = 0;
  private retryTimer: number | undefined;
  private pingTimer: number | undefined;
  private stopped = false;
  private pendingJoin: { name: string; password?: string } | null = null;
  /** 这次连接是凭 token 重连的。 */
  private usedToken = false;

  constructor(code: string) {
    this.code = code;
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onVisible);
  }

  get token(): string | null {
    return store.get(`token:${this.code}`);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private update(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** 连上服务器。有 token 会自动重连回原来的位置；没有的话等 join()。 */
  connect() {
    if (this.stopped) return;
    clearTimeout(this.retryTimer);
    this.ws?.close();
    this.update({ status: 'connecting' });
    const ws = new WebSocket(`${API.replace(/^http/, 'ws')}/rooms/${this.code}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.update({ status: 'open' });
      const token = this.token;
      this.usedToken = !!token;
      if (token) this.send({ t: 'join', name: '', token, seen: seenPairs() });
      else if (this.pendingJoin) this.send({ t: 'join', ...this.pendingJoin, seen: seenPairs() });
      clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (ev) => this.onMessage(JSON.parse(String(ev.data)) as ServerMsg);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      clearInterval(this.pingTimer);
      if (this.stopped || this.snap.bye) return this.update({ status: 'closed' });
      this.update({ status: 'offline' });
      // 断了就重连：1、2、4、8 秒……最多 10 秒一次
      const delay = Math.min(10_000, 1000 * 2 ** this.retry++);
      this.retryTimer = window.setTimeout(() => this.connect(), delay);
    };
  }

  /** 第一次加入（输名字、密码）。 */
  join(name: string, password?: string) {
    this.pendingJoin = { name, password };
    this.update({ error: null });
    if (this.ws?.readyState === WebSocket.OPEN) this.send({ t: 'join', name, password, seen: seenPairs() });
    else this.connect();
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
  act(action: Action) {
    this.send({ t: 'act', action });
  }
  settings(s: Partial<RoomSettings>) {
    this.send({ t: 'settings', settings: s });
  }

  /** 离开房间页面（不是退出房间）。 */
  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pingTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onVisible);
    this.ws?.close();
  }

  /** 切回前台或网络恢复时，断着的话马上重连。 */
  private onVisible = () => {
    if (document.visibilityState !== 'visible' || this.stopped || this.snap.bye) return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) this.connect();
  };

  private onMessage(m: ServerMsg) {
    switch (m.t) {
      case 'welcome':
        store.set(`token:${this.code}`, m.token);
        this.pendingJoin = null;
        this.update({ joined: true, error: null });
        break;
      case 'state':
        if (m.room.played.length) rememberPairs(m.room.played);
        this.update({
          joined: true,
          room: m.room,
          game: m.game,
          offset: m.game ? m.game.now - Date.now() : this.snap.offset,
        });
        break;
      case 'error':
        if (!this.snap.joined && this.usedToken) {
          // token 失效（比如房间里已经没有这个人了）：忘掉它，回到加入表单
          store.set(`token:${this.code}`, null);
          this.usedToken = false;
          this.update({ error: { message: `需要重新加入：${m.message}`, at: Date.now() } });
          break;
        }
        this.update({ error: { message: m.message, at: Date.now() } });
        break;
      case 'bye':
        store.set(`token:${this.code}`, null);
        this.update({ bye: m.reason, status: 'closed' });
        this.ws?.close();
        break;
    }
  }
}
