/**
 * 手机和房间服务器之间的消息格式（WebSocket，JSON）。网页和服务器都引用这一份。
 *
 * 流程：POST /rooms 建房拿到房间号 → 连 /rooms/<房间号>/ws → 第一条消息发 join。
 * 之后服务器每次有变化都推一份完整的 state（已按这个人过滤），客户端照着画。
 */

import type { Action, Composition, Recognition, Timers } from '../engine/index.ts';
import type { PlayerView } from '../engine/view.ts';

/** 房主可以改的规则（§10.2）。计时以毫秒存，界面上按秒显示。 */
export interface RoomSettings {
  composition: Composition | null;
  judge: 'llm' | 'human';
  difficulty: 1 | 2 | 3 | 'random';
  recognition: 'auto' | Recognition;
  wipeoutThreshold: 0 | 1;
  phase2Questions: boolean;
  revealOnExit: boolean;
  tableMode: boolean;
  clueMaxLength: number;
  timers: Timers;
}

export type ClientMsg =
  /** 第一条消息。带 token 是重连（不用再输密码）；不带是新加入。seen：这台手机玩过的词对，抽题时排除。 */
  | { t: 'join'; name: string; password?: string; token?: string; seen?: string[] }
  | { t: 'rename'; name: string }
  | { t: 'leave' }
  /** 以下是房主操作。 */
  | { t: 'settings'; settings: Partial<RoomSettings> }
  | { t: 'password'; password: string | null }
  | { t: 'kick'; id: string }
  | { t: 'transfer'; id: string }
  | { t: 'start' }
  /** 对局中的动作。 */
  | { t: 'act'; action: Action }
  | { t: 'ping' };

export interface MemberView {
  id: string;
  name: string;
  online: boolean;
  host: boolean;
  /** 本房间累计得分（§7.3）。 */
  score: number;
}

export interface RoomView {
  code: string;
  hasPassword: boolean;
  me: string;
  hostId: string | null;
  members: MemberView[];
  settings: RoomSettings;
  /** 第几局（0 表示还没开过）。 */
  gameNo: number;
  inGame: boolean;
  /** 房主现在能不能开局；不能时给原因。 */
  startBlocker: string | null;
  /** 本房间已经结束的对局用过的词对，客户端记下来，下次加入别的房间时带上。 */
  played: string[];
}

export type ServerMsg =
  | { t: 'welcome'; id: string; token: string }
  | { t: 'state'; room: RoomView; game: PlayerView | null }
  | { t: 'error'; message: string }
  /** 被踢出或房间关闭：客户端回到首页，并删掉本地 token。 */
  | { t: 'bye'; reason: string }
  | { t: 'pong' };

/** 房间号：4 位数字，手机上好输。 */
export const ROOM_CODE = /^\d{4}$/;
export const NAME_MAX = 10;
