/**
 * 手机和房间服务器之间的消息格式（WebSocket，JSON）。网页和服务器都引用这一份。
 *
 * 流程：POST /rooms 建房拿到房间号 → 连 /rooms/<房间号>/ws → 第一条消息发 join。
 * 之后服务器每次有变化都推一份完整的 state（已按这个人过滤），客户端照着画。
 */

import type { Action, Composition, Recognition, Timers } from '../engine/index.ts';
import type { JudgeView, PlayerView } from '../engine/view.ts';

/** 房主可以改的规则（§10.2）。计时以毫秒存，界面上按秒显示。 */
export interface RoomSettings {
  composition: Composition | null;
  /** 'human'：主持人手动判定（§8.4）。 */
  judge: 'llm' | 'human';
  /** 'custom'：主持人开局前自己填词对（自带词，§8.4）。 */
  wordSource: 'bank' | 'custom';
  /** 用哪几个题库（名字）；null = 全部。 */
  banks: string[] | null;
  recognition: 'auto' | Recognition;
  /** 某国存活人数降到这个数（含）以下，白板提前获胜；0 = 某国全部出局。 */
  wipeoutThreshold: number;
  /** 另一个提前获胜条件：某国存活人数少于白板存活人数。 */
  wipeoutVsBlanks: boolean;
  phase2Questions: boolean;
  tableMode: boolean;
  clueMaxLength: number;
  /** 不限时：需要玩家操作的环节都不倒计时（房主可以跳过卡住的人）。 */
  untimed: boolean;
  timers: Timers;
}

/** 主持人填的词对（自带词）。哪个给大国仍然每局随机。 */
export interface CustomPair {
  wordA: string;
  wordB: string;
  senseA?: string;
  senseB?: string;
  aliasesA?: string[];
  aliasesB?: string[];
  link: string;
  hints?: string[];
  /** 给裁判的补充说明（玩家看不到）。 */
  judgeNote?: string;
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
  /** 自己的头像（大厅里改）：手绘或者默认图案，见 AVATAR_RE；null 恢复默认。 */
  | { t: 'avatar'; avatar: string | null }
  /** 房主「跳过等待」：把当前这一步当作时间到（不限时的房间里有人走开时用）。 */
  | { t: 'skip' }
  | { t: 'transfer'; id: string }
  | { t: 'start' }
  /** 房主指定（或取消）主持人：不参与游戏的出题人 / 裁判。 */
  | { t: 'moderator'; id: string | null }
  /** 以下是主持人操作：填自带词（null 清空）；人工判定；提前公布下一条提示。 */
  | { t: 'customPair'; pair: CustomPair | null }
  | { t: 'verdict'; id: string; verdict: string }
  | { t: 'hint' }
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
  /** AI 裁判是否可用（服务器配了 key），以及用的模型。不可用时用兜底判定。 */
  judge: { ai: boolean; model: string | null };
  /** 主持人（不参与游戏）。 */
  moderatorId: string | null;
  /** 主持人填的自带词：只发给主持人本人；其他人只知道填没填好。 */
  customPair: CustomPair | null;
  customPairReady: boolean;
  /**
   * 题库：每个题库几组、这个房间还没玩过几组；total / left 是勾选的题库加起来的。
   * sample 表示还没导入题库、用的是 5 组示例。
   */
  bank: { total: number; left: number; sample: boolean; banks: { name: string; total: number; left: number }[] };
}

export type ServerMsg =
  | { t: 'welcome'; id: string; token: string }
  /** game：玩家看到的对局；judge：主持人看到的对局（两者至多一个）。 */
  | { t: 'state'; room: RoomView; game: PlayerView | null; judge: JudgeView | null }
  | { t: 'error'; message: string }
  /** 所有成员的头像（加入时发一次，有人改头像时再发）。没有的人用默认图案。 */
  | { t: 'avatars'; avatars: Record<string, string> }
  /** 被踢出或房间关闭：客户端回到首页，并删掉本地 token。 */
  | { t: 'bye'; reason: string }
  | { t: 'pong' };

/** 房间号：4 位数字，手机上好输。 */
export const ROOM_CODE = /^\d{4}$/;
export const NAME_MAX = 10;

/**
 * 头像：'p:<编号>' 是默认图案（0–23）；'d:<笔画>' 是手绘，64×64 的格子，
 * 每一笔是一串点，每个点用两个字符（0-9A-Za-z-_ 表示 0–63）记 x、y，笔画之间用逗号隔开。
 */
export const AVATAR_RE = /^(p:(?:[0-9]|1[0-9]|2[0-3])|d:[0-9A-Za-z_-]+(?:,[0-9A-Za-z_-]+)*)$/;
export const AVATAR_MAX = 3000;
export const AVATAR_PRESETS = 24;
