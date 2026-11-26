/**
 * 预览器的场景：用真的规则引擎走一局 7 人游戏，停在各个步骤，按指定玩家的视角取画面。
 * 只在 /dgxg/preview.html 里用，不连服务器。
 */

import {
  DEFAULT_RULES,
  act,
  advance,
  createGame,
  judge,
  judgeView,
  viewFor,
  type Action,
  type Faction,
  type GameState,
  type Rules,
  type WordPair,
} from '../engine/index.ts';
import type { CustomPair, MemberView, RoomSettings, RoomView } from '../shared/protocol.ts';
import type { RoomInfo, Snapshot } from './net.ts';

const PAIR: WordPair = {
  id: 'preview-squid-stock',
  wordA: '鱿鱼',
  wordB: '股票',
  senseA: '鱿鱼：海洋动物、食材',
  senseB: '股票：证券、金融产品',
  link: '都是可以「炒」的东西',
  hints: ['都和一个动词有关', '这个动词在厨房里也用得上'],
  difficulty: 1,
};

const NAMES: [string, string][] = [
  ['a', '阿乐'],
  ['b', '林夕'],
  ['c', '小满'],
  ['d', '周周'],
  ['e', '老陈'],
  ['f', '米粒'],
  ['g', '七七'],
];
const CLUES = ['海边', '下锅', '涨停', '红色', '翻身', '潮汐', '牛市'];
const CODE = '3572';



export class Sim {
  g: GameState;
  t = 1_000_000;
  constructor(rules: Partial<Rules> = {}, seed = 11, names: [string, string][] = NAMES) {
    this.g = createGame({ players: names.map(([id, name]) => ({ id, name })), pair: PAIR, rules, seed, now: this.t });
  }
  get step() {
    return this.g.step;
  }
  do(id: string, action: Action) {
    const r = act(this.g, id, action, this.t);
    if (r.error) throw new Error(`${id} ${JSON.stringify(action)}：${r.error}`);
    this.g = r.state;
  }
  wait(ms: number) {
    this.t += ms;
    this.g = advance(this.g, this.t);
  }
  verdict(v: Parameters<typeof judge>[2]) {
    const req = this.g.judge[0];
    if (!req) throw new Error('没有待判定的请求');
    const r = judge(this.g, req.id, v, this.t);
    if (r.error) throw new Error(r.error);
    this.g = r.state;
  }
  alive() {
    return this.g.players.filter((p) => p.alive);
  }
  of(f: Faction, aliveOnly = true) {
    return this.g.players.filter((p) => p.faction === f && (!aliveOnly || p.alive));
  }
  night(start?: string, dir: 'cw' | 'ccw' = 'cw') {
    if (this.step.k !== 'night') throw new Error(`现在是 ${this.step.k}，不是夜晚`);
    const s = start ?? this.alive()[0].id;
    for (const p of this.alive()) this.do(p.id, { a: 'night', player: s, dir });
  }
  clues(count = Infinity) {
    let i = 0;
    while (this.step.k === 'clue' && i < count) {
      const s = this.step;
      this.do(s.order[s.idx], { a: 'clue', text: CLUES[s.idx % CLUES.length] });
      i++;
    }
  }
  discuss() {
    for (const p of this.alive()) this.do(p.id, { a: 'ready' });
  }
  voteAll(target: string) {
    for (const p of this.alive()) this.do(p.id, { a: 'vote', target });
  }
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
}

/* ------------------------------------------------------------------ 房间 */

function settings(patch: Partial<RoomSettings> = {}): RoomSettings {
  return {
    composition: DEFAULT_RULES.composition,
    judge: DEFAULT_RULES.judge,
    wordSource: 'bank',
    banks: ['日常', '谐音'],
    recognition: DEFAULT_RULES.recognition,
    wipeoutThreshold: DEFAULT_RULES.wipeoutThreshold,
    wipeoutVsBlanks: false,
    phase2Questions: DEFAULT_RULES.phase2Questions,
    tableMode: DEFAULT_RULES.tableMode,
    clueMaxLength: DEFAULT_RULES.clueMaxLength,
    untimed: false,
    timers: { ...DEFAULT_RULES.timers },
    ...patch,
  };
}

function room(opts: {
  me: string;
  host?: string;
  members?: MemberView[];
  moderatorId?: string | null;
  hasPassword?: boolean;
  gameNo?: number;
  inGame?: boolean;
  startBlocker?: string | null;
  settings?: Partial<RoomSettings>;
  customPair?: CustomPair | null;
}): RoomView {
  const host = opts.host ?? 'a';
  const members =
    opts.members ??
    NAMES.map(([id, name], i) => ({ id, name, online: id !== 'f', host: id === host, score: [4, 3, 1, 0, 3, 1, 0][i] }));
  return {
    code: CODE,
    hasPassword: opts.hasPassword ?? true,
    me: opts.me,
    hostId: host,
    members,
    settings: settings(opts.settings),
    gameNo: opts.gameNo ?? 0,
    inGame: opts.inGame ?? false,
    startBlocker: opts.startBlocker ?? null,
    played: [],
    judge: { ai: true, model: 'anthropic/claude-opus-5.5' },
    moderatorId: opts.moderatorId ?? null,
    customPair: opts.customPair ?? null,
    customPairReady: !!opts.customPair,
    bank: {
      total: 96,
      left: 93,
      sample: false,
      banks: [
        { name: '日常', total: 60, left: 58 },
        { name: '谐音', total: 36, left: 35 },
        { name: '网络梗', total: 24, left: 24 },
      ],
    },
  };
}

function snapOf(r: RoomView, extra: Partial<Snapshot> = {}): Snapshot {
  return { status: 'open', joined: true, room: r, game: null, judge: null, offset: 0, error: null, bye: null, avatars: {}, ...extra };
}

/** 对局中的画面：某个玩家的视角。 */
export function gameSnap(s: Sim, me: string, opts: { gameNo?: number; host?: string; settings?: Partial<RoomSettings> } = {}): Snapshot {
  const v = viewFor(s.g, me, s.t);
  return snapOf(room({ me, inGame: v.phase !== 'over', gameNo: opts.gameNo ?? 1, host: opts.host, settings: opts.settings }), { game: v, offset: s.t - Date.now() });
}

const roleOf = (s: Sim, role: 'black' | 'white') => {
  const p = s.g.players.find((x) => x.faction === 'blank' && x.role === role);
  if (!p) throw new Error(`没有${role}`);
  return p.id;
};

export const idOf = (s: Sim, f: Faction, aliveOnly = true, n = 0) => {
  const p = s.of(f, aliveOnly)[n];
  if (!p) throw new Error(`找不到第 ${n + 1} 个${f}`);
  return p.id;
};

/* ------------------------------------------------------------------ 场景 */

export interface SceneFlags {
  hold?: boolean;
  dossier?: 'clues' | 'votes' | 'secret' | 'all';
  revealed?: boolean;
}
export type SceneData = { kind: 'home' } | ({ kind: 'room'; snap: Snapshot; info?: RoomInfo; token?: string | null } & SceneFlags);

export interface Scene {
  id: string;
  group: string;
  title: string;
  note: string;
  build: () => SceneData;
}

/** 走到第一天发言中途：起始玩家已定，前几个人说完了。 */
function cluesMidway(said: number) {
  const s = new Sim();
  s.night('c', 'cw');
  s.clues(said);
  return s;
}

/** 第一天全票投出一个白板，停在他的出局选择。 */
function blankOut(rules: Partial<Rules> = {}) {
  const s = new Sim(rules);
  s.night('c', 'cw');
  s.clues();
  s.discuss();
  const b = idOf(s, 'blank');
  s.voteAll(b);
  return { s, b };
}

/** 两个白板都投出去，进入第二阶段。 */
function phase2() {
  const s = new Sim();
  for (const b of s.of('blank')) s.dayVoting(b.id);
  if (s.step.k !== 'turn') throw new Error(`没有进入第二阶段：${s.step.k}`);
  return s;
}

export const SCENES: Scene[] = [
  { id: 'home', group: '首页', title: '首页', note: '转动的地球、行李牌写名字、两张票：建房间 / 加入', build: () => ({ kind: 'home' }) },
  {
    id: 'join',
    group: '首页',
    title: '扫码进房',
    note: '航路图 + 登岛牌，存根就是「进入房间」',
    build: () => ({
      kind: 'room',
      token: null,
      info: { exists: true, hasPassword: true, inGame: false, members: 6 },
      snap: { status: 'open', joined: false, room: null, game: null, judge: null, offset: 0, error: null, bye: null, avatars: {} },
    }),
  },
  {
    id: 'lobby-host',
    group: '大厅',
    title: '大厅 · 房主',
    note: '圆桌岛地形图上的座位 + 本局设置图例；往下滚是成员和规则',
    build: () => ({ kind: 'room', snap: snapOf(room({ me: 'a' })) }),
  },
  {
    id: 'lobby-guest',
    group: '大厅',
    title: '大厅 · 玩家',
    note: '等房主开始时，飘带写着等待',
    build: () => ({ kind: 'room', snap: snapOf(room({ me: 'c', hasPassword: false })) }),
  },
  {
    id: 'lobby-moderator',
    group: '大厅',
    title: '大厅 · 主持人',
    note: '主持人坐在罗盘上；出题 = 把两个词写进图例',
    build: () => {
      const members: MemberView[] = [
        ...NAMES.map(([id, name], i) => ({ id, name, online: true, host: id === 'a', score: [4, 3, 1, 0, 3, 1, 0][i] })),
        { id: 'm', name: '老周', online: true, host: false, score: 0 },
      ];
      return {
        kind: 'room',
        snap: snapOf(
          room({
            me: 'm',
            members,
            moderatorId: 'm',
            settings: { wordSource: 'custom', judge: 'human' },
            customPair: { wordA: '鱿鱼', wordB: '股票', link: '都是可以「炒」的东西', hints: ['都和一个动词有关'] },
          }),
        ),
      };
    },
  },
  {
    id: 'night-start',
    group: '第一阶段',
    title: '夜晚 · 起点白板',
    note: '起点白板在圆桌上选明天从谁开始',
    build: () => {
      const s = new Sim();
      return { kind: 'room', snap: gameSnap(s, roleOf(s, 'black')) };
    },
  },
  {
    id: 'night-dir',
    group: '第一阶段',
    title: '夜晚 · 方向白板',
    note: '方向白板只选顺时针或逆时针',
    build: () => {
      const s = new Sim();
      return { kind: 'room', snap: gameSnap(s, roleOf(s, 'white')) };
    },
  },
  {
    id: 'night-nation',
    group: '第一阶段',
    title: '夜晚 · 国家玩家',
    note: '国家玩家不用选，点确认就行',
    build: () => {
      const s = new Sim();
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'big')) };
    },
  },
  {
    id: 'night-blank',
    group: '第一阶段',
    title: '夜晚 · 白板（按住）',
    note: '按住看身份：竖着对折的身份图打开',
    build: () => {
      const s = new Sim();
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'blank')), hold: true };
    },
  },
  {
    id: 'untimed-host',
    group: '第一阶段',
    title: '不限时 · 房主',
    note: '没有倒计时；房主可以「跳过等待」',
    build: () => {
      const s = new Sim({ untimed: true });
      s.night('c', 'cw');
      s.clues(2);
      return { kind: 'room', snap: gameSnap(s, 'a', { host: 'a', settings: { untimed: true } }) };
    },
  },
  {
    id: 'clue-mine',
    group: '第一阶段',
    title: '发言 · 轮到我',
    note: '前四个人说完了，轮到我写线索',
    build: () => {
      const s = cluesMidway(4);
      const st = s.step;
      if (st.k !== 'clue') throw new Error('不在发言');
      return { kind: 'room', snap: gameSnap(s, st.order[st.idx]) };
    },
  },
  {
    id: 'clue-wait',
    group: '第一阶段',
    title: '发言 · 等别人',
    note: '别人在发言，我等着',
    build: () => {
      const s = cluesMidway(2);
      const st = s.step;
      if (st.k !== 'clue') throw new Error('不在发言');
      return { kind: 'room', snap: gameSnap(s, st.order[st.order.length - 1]) };
    },
  },
  {
    id: 'identity-nation',
    group: '第一阶段',
    title: '按住看身份 · 国家',
    note: '身份图：岛上写着你的词，①② 两条规则提示，本局人数',
    build: () => {
      const s = cluesMidway(3);
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'big')), hold: true };
    },
  },
  {
    id: 'discussion',
    group: '第一阶段',
    title: '讨论',
    note: '今天的线索 + 准备投票',
    build: () => {
      const s = new Sim();
      s.night('c', 'cw');
      s.clues();
      const alive = s.alive();
      s.do(alive[1].id, { a: 'ready' });
      s.do(alive[2].id, { a: 'ready' });
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'small')) };
    },
  },
  {
    id: 'vote',
    group: '第一阶段',
    title: '投票',
    note: '在桌上点一个人；已有 3 人投完',
    build: () => {
      const s = new Sim();
      s.night('c', 'cw');
      s.clues();
      s.discuss();
      const me = idOf(s, 'big');
      const others = s.alive().filter((p) => p.id !== me);
      for (const p of others.slice(0, 3)) s.do(p.id, { a: 'vote', target: others[4].id });
      return { kind: 'room', snap: gameSnap(s, me) };
    },
  },
  {
    id: 'exit-blank',
    group: '第一阶段',
    title: '出局 · 我是白板',
    note: '白板出局：什么都不做、猜大国词或问裁判',
    build: () => {
      const { s, b } = blankOut();
      return { kind: 'room', snap: gameSnap(s, b) };
    },
  },
  {
    id: 'exit-watch',
    group: '第一阶段',
    title: '出局 · 旁观',
    note: '别人在做出局选择',
    build: () => {
      const { s } = blankOut();
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'big')) };
    },
  },
  {
    id: 'identity-blank',
    group: '第一阶段',
    title: '按住看身份 · 白板',
    note: '白板的身份图：队友、今晚的任务、裁判私下的回答',
    build: () => {
      const { s, b } = blankOut();
      s.do(b, { a: 'ask', text: '大国的词是吃的东西吗' });
      s.verdict('yes');
      s.wait(s.g.rules.timers.exitMinShow);
      if (s.step.k !== 'night') throw new Error(`没到第二夜：${s.step.k}`);
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'blank')), hold: true };
    },
  },
  {
    id: 'turn-mine',
    group: '第二阶段',
    title: '回合 · 轮到我',
    note: '白板清空，轮流猜对方的词或提问',
    build: () => {
      const s = phase2();
      const st = s.step;
      if (st.k !== 'turn') throw new Error('不在回合');
      return { kind: 'room', snap: gameSnap(s, st.order[st.idx]) };
    },
  },
  {
    id: 'relief',
    group: '第二阶段',
    title: '白板救济',
    note: '第一轮无人猜中，白板问一题再猜一次',
    build: () => {
      const s = phase2();
      while (s.step.k === 'turn') s.wait(s.g.rules.timers.turn);
      if (s.step.k !== 'relief') throw new Error(`没到救济：${s.step.k}`);
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'blank', false)) };
    },
  },
  {
    id: 'race',
    group: '第二阶段',
    title: '抢答',
    note: '公布联系和提示，随时抢答',
    build: () => {
      const s = phase2();
      for (let i = 0; i < 40 && s.step.k !== 'race'; i++) {
        const k = s.step.k;
        s.wait(k === 'turn' ? s.g.rules.timers.turn : k === 'relief' ? s.g.rules.timers.reliefAsk : 1000);
      }
      if (s.step.k !== 'race') throw new Error(`没到抢答：${s.step.k}`);
      s.wait(s.g.rules.timers.hintInterval);
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'small')) };
    },
  },
  {
    id: 'big-chance',
    group: '第二阶段',
    title: '大国的一次机会',
    note: '白板猜中大国词后，大国猜一次小国词',
    build: () => {
      const { s, b } = blankOut();
      s.do(b, { a: 'guess', text: s.g.secret.big.word });
      s.wait(s.g.rules.timers.exitMinShow);
      if (s.step.k !== 'bigChance') throw new Error(`没到大国的机会：${s.step.k}`);
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'big')) };
    },
  },
  {
    id: 'over',
    group: '结算',
    title: '结算 · 揭晓前',
    note: '历史疆域图：国界上贴着胶带，按住撕开',
    build: () => {
      const { s, b } = blankOut();
      s.do(b, { a: 'guess', text: s.g.secret.big.word });
      s.wait(s.g.rules.timers.exitMinShow);
      s.do(idOf(s, 'big'), { a: 'guess', text: '牛市' });
      if (s.g.judge.length) s.verdict('wrong');
      if (s.step.k !== 'over') throw new Error(`没结束：${s.step.k}`);
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'small')) };
    },
  },
  {
    id: 'over-revealed',
    group: '结算',
    title: '结算 · 揭晓后',
    note: '联系写在两国共用的国界上；名次是一张剖面图',
    build: () => {
      const { s, b } = blankOut();
      s.do(b, { a: 'guess', text: s.g.secret.big.word });
      s.wait(s.g.rules.timers.exitMinShow);
      s.do(idOf(s, 'big'), { a: 'guess', text: '牛市' });
      if (s.g.judge.length) s.verdict('wrong');
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'small')), revealed: true };
    },
  },
  ...(['clues', 'votes', 'secret', 'all'] as const).map(
    (tab): Scene => ({
      id: `dossier-${tab}`,
      group: '档案',
      title: `档案 · ${{ clues: '线索', votes: '投票', secret: '秘密（白板）', all: '全部记录' }[tab]}`,
      note: { clues: '每人每天的身份提示排成一张表', votes: '选一天，看谁投了谁', secret: '只有白板阵营有：队友、裁判私下的回答', all: '按时间的完整记录' }[tab],
      build: () => {
        const s = new Sim();
        s.night('c', 'cw');
        s.clues();
        s.discuss();
        const b = idOf(s, 'blank', true, 0);
        const others = s.alive().filter((p) => p.id !== b);
        for (const p of s.alive()) s.do(p.id, { a: 'vote', target: p.id === b ? others[0].id : b });
        s.do(b, { a: 'ask', text: '大国的词是吃的东西吗' });
        s.verdict('yes');
        s.wait(s.g.rules.timers.exitMinShow);
        s.night(s.alive()[2].id, 'ccw');
        s.clues();
        const me = tab === 'secret' ? idOf(s, 'blank') : idOf(s, 'big');
        return { kind: 'room', snap: gameSnap(s, me), dossier: tab };
      },
    }),
  ),
  {
    id: 'moderator',
    group: '主持人',
    title: '主持人台',
    note: '总控图：所有人的身份都在图上，待判定是一张撕下来的单子',
    build: () => {
      const { s, b } = blankOut({ judge: 'human' });
      s.do(b, { a: 'ask', text: '大国的词是吃的东西吗' });
      const members: MemberView[] = [
        ...NAMES.map(([id, name]) => ({ id, name, online: true, host: id === 'a', score: 0 })),
        { id: 'm', name: '老周', online: true, host: false, score: 0 },
      ];
      const r = room({ me: 'm', members, moderatorId: 'm', inGame: true, gameNo: 1, settings: { judge: 'human' } });
      return { kind: 'room', snap: snapOf(r, { judge: judgeView(s.g, s.t), offset: s.t - Date.now() }) };
    },
  },
];
