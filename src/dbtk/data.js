/**
 * 大辩题库的行情数据，来自后端 dbtk-server（地址见 config.js）。
 *
 * 一只「股」（一条已上市的辩题）：
 *   code        DB0001 起的编号
 *   title       辩题正文（用户投稿，页面上用系统字体）
 *   who         题库人（投稿人，没写就是「匿名」）
 *   pro / con   正方、反方的立场（AI 提炼或站主填，可能是空的）
 *   votes       累计票数（看涨）；monthVotes 本月新增，月榜按它排
 *   today       今天的票数；yesterday 昨天的票数，用来算「今日涨幅」
 *   long/short  看正、看反的人数
 *   listedAt    上市时间（毫秒）
 *
 * 这台浏览器用一个随机设备号（localStorage 的 dbtk:device）识别：
 * 每台设备每月每只股能看涨一次，一次随机加 1~99 票（后端决定）；站正方 / 反方可以改。
 * 站队先在页面上改掉（乐观更新），后端拒绝了再改回来；看涨要等后端告诉加了几票。
 */
import { API } from './config.js';

const DEVICE_KEY = 'dbtk:device';
let memoryDevice = '';

function newDevice() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function device() {
  try {
    let d = localStorage.getItem(DEVICE_KEY);
    if (!d || !/^[A-Za-z0-9_-]{16,64}$/.test(d)) {
      d = newDevice();
      localStorage.setItem(DEVICE_KEY, d);
    }
    return d;
  } catch {
    // 无痕模式之类拿不到 localStorage：这一次打开页面期间用同一个
    return (memoryDevice ||= newDevice());
  }
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = 'GET', body, withDevice = true } = {}) {
  const headers = {};
  if (withDevice) headers['X-Device'] = device();
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('连不上行情系统，检查一下网络', 0, {});
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || '行情系统出了点问题，稍后再试', res.status, data);
  return data;
}

export function createStore() {
  let board = { now: Date.now(), day: '', month: '', monthLength: 30, topics: [] };
  let voted = new Set();
  let gains = {};
  let sides = {};
  let mine = [];
  let past = null;
  const kline = new Map(); // code → { days: [{ day, gain, pro, con }] }

  const find = (code) => board.topics.find((s) => s.code === code);

  return {
    async load() {
      const [b, m] = await Promise.all([
        request('/board', { withDevice: false }),
        request('/me').catch(() => null), // 自己的状态拿不到也不耽误看行情
      ]);
      board = b;
      if (m) {
        voted = new Set(m.voted);
        gains = m.gains || {};
        sides = m.sides || {};
        mine = m.mine || [];
      }
    },
    all: () => board.topics,
    voted: (code) => voted.has(code),
    /** 本月看涨这只时加了几票（没投过是 0）。 */
    gain: (code) => gains[code] || 0,
    side: (code) => sides[code] || null,
    mine: () => mine,

    /** 看涨：随机加 1~99 票。返回 { ok, gain, from }、{ already } 或 { error }。 */
    async vote(code) {
      const s = find(code);
      if (!s || voted.has(code)) return { already: true };
      try {
        const r = await request('/vote', { method: 'POST', body: { code } });
        const gain = Number(r.gain) || 1;
        const from = s.votes;
        s.votes += gain;
        s.monthVotes += gain;
        s.today += gain;
        voted.add(code);
        gains[code] = gain;
        const k = kline.get(code);
        if (k?.days.length) k.days.at(-1).gain += gain; // 今天那根 K 线跟着长
        return { ok: true, gain, from };
      } catch (e) {
        if (e.data?.voted) {
          voted.add(code); // 别的标签页已经投过了
          return { already: true };
        }
        return { error: e.message };
      }
    },

    /** 站队：pro = 看正，con = 看反。可以改主意。 */
    async pick(code, side) {
      const s = find(code);
      const was = sides[code];
      if (!s || was === side) return { ok: false };
      const apply = (from, to) => {
        if (from === 'pro') s.long -= 1;
        if (from === 'con') s.short -= 1;
        if (to === 'pro') s.long += 1;
        if (to === 'con') s.short += 1;
        if (to) sides[code] = to;
        else delete sides[code];
      };
      apply(was, side);
      try {
        await request('/side', { method: 'POST', body: { code, side } });
        kline.delete(code); // 当天的红绿柱变了，下次重新取
        return { ok: true };
      } catch (e) {
        apply(side, was);
        return { error: e.message };
      }
    },

    /** 申请上市。返回 { status: 'listed' | 'pending' | 'rejected', code?, reason? } 或 { error }。 */
    async submit(title, who, token) {
      try {
        const r = await request('/submit', { method: 'POST', body: { title, who, token } });
        await this.load().catch(() => {});
        return r;
      } catch (e) {
        return { error: e.message };
      }
    },

    /** K 线：近 14 天每天新增的票数和当天看正 / 看反的设备数。取过的留着。 */
    async history(code) {
      if (!kline.has(code)) kline.set(code, await request(`/history?code=${encodeURIComponent(code)}`, { withDevice: false }));
      return kline.get(code);
    },
    cachedHistory: (code) => kline.get(code) || null,

    /** 往月榜：[{ month: 'YYYY-MM', top: [{ rank, code, title, who, gain }] }]，取一次就留着。 */
    async months() {
      past ||= (await request('/months', { withDevice: false })).months;
      return past;
    },
  };
}

/** 今日涨幅（%）：今天的票数比昨天多多少。昨天没有票（新股）返回 null。 */
export function change(s) {
  if (!s.yesterday) return null;
  return ((s.today - s.yesterday) / s.yesterday) * 100;
}
