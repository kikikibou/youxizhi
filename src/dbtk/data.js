/**
 * 大辩题库的行情数据。
 *
 * 后端还没定。现在这里是一份示例行情，加上这台浏览器自己做过的事（看涨、
 * 买入 / 卖出、申请上市），存在 localStorage 里，刷新后还在，但别人看不到。
 * 接上后端时只换这个文件：load() 改成从服务器拿行情，vote / pick / submit
 * 改成发给服务器，main.js 不用动。
 *
 * 一只「股」（一条辩题）：
 *   code       DB0001 起的编号
 *   title      辩题正文（用户投稿，页面上用系统字体）
 *   who        题库人（投稿人，没写就是「匿名」）
 *   pro / con  正方、反方的立场，没有就留空
 *   votes      本月票数（看涨）
 *   today      今天的票数；yesterday 昨天的票数，用来算「今日涨幅」
 *   long/short 买入（支持正方）、卖出（支持反方）的人数
 *   listed     上市时间（毫秒）
 */

const HOUR = 3600e3;

// 示例行情（站主确认过的五条）
function sample(now) {
  return [
    { code: 'DB0001', title: '手机掉进马桶，应该先捞手机还是先提裤子', who: '匿名二辩', pro: '先捞手机', con: '先提裤子', votes: 1284, today: 143, yesterday: 127, long: 412, short: 298, listed: now - 24 * 24 * HOUR },
    { code: 'DB0002', title: '周一应当被开除出一周', who: '不想上班的一辩', pro: '该开除', con: '不该开除', votes: 963, today: 88, yesterday: 80, long: 355, short: 145, listed: now - 20 * 24 * HOUR },
    { code: 'DB0003', title: '孙悟空打妖怪的开销，能不能找唐僧报销', who: '西天财务部', pro: '能报销', con: '不能报销', votes: 731, today: 25, yesterday: 24, long: 224, short: 126, listed: now - 15 * 24 * HOUR },
    { code: 'DB0004', title: '外星人降落地球，应该先见联合国秘书长还是先见小区保安', who: '小区保安老李', pro: '先见秘书长', con: '先见保安', votes: 402, today: 54, yesterday: 55, long: 46, short: 154, listed: now - 9 * 24 * HOUR },
    { code: 'DB0005', title: '半夜想到绝妙论点，该不该打电话叫醒队友', who: '凌晨三点的四辩', pro: '该叫醒', con: '不该叫醒', votes: 188, today: 94, yesterday: 50, long: 49, short: 51, listed: now - 2 * HOUR },
  ];
}

const KEY = 'dbtk:v1';

function readMine() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { voted: raw.voted || {}, side: raw.side || {}, listed: Array.isArray(raw.listed) ? raw.listed : [] };
  } catch {
    return { voted: {}, side: {}, listed: [] };
  }
}

function saveMine(mine) {
  try {
    localStorage.setItem(KEY, JSON.stringify(mine));
  } catch {
    /* private mode or storage full: the action still shows, it just won't survive a reload */
  }
}

export function createStore(now = Date.now()) {
  const mine = readMine();
  const stocks = [...sample(now), ...mine.listed];
  // this browser's own votes and picks, applied on top of the sample
  for (const s of stocks) {
    if (mine.voted[s.code] && !s.mine) {
      s.votes += 1;
      s.today += 1;
    }
    if (mine.side[s.code] === 'pro' && !s.mine) s.long += 1;
    if (mine.side[s.code] === 'con' && !s.mine) s.short += 1;
  }

  return {
    all: () => stocks,
    voted: (code) => Boolean(mine.voted[code]),
    side: (code) => mine.side[code] || null,
    nextCode() {
      const n = stocks.reduce((m, s) => Math.max(m, Number(s.code.slice(2)) || 0), 0) + 1;
      return 'DB' + String(n).padStart(4, '0');
    },
    /** 看涨：给辩题投一票。每只股每台设备一票。 */
    vote(code) {
      const s = stocks.find((x) => x.code === code);
      if (!s || mine.voted[code]) return false;
      s.votes += 1;
      s.today += 1;
      mine.voted[code] = true;
      if (s.mine) persistListed();
      saveMine(mine);
      return true;
    },
    /** 买入（pro）= 支持正方，卖出（con）= 支持反方。可以改主意，同一边再点一次不变。 */
    pick(code, side) {
      const s = stocks.find((x) => x.code === code);
      const was = mine.side[code];
      if (!s || was === side) return false;
      if (was === 'pro') s.long -= 1;
      if (was === 'con') s.short -= 1;
      if (side === 'pro') s.long += 1;
      else s.short += 1;
      mine.side[code] = side;
      if (s.mine) persistListed();
      saveMine(mine);
      return true;
    },
    /** 申请上市：投稿。返回新股，或者 { error }。 */
    submit(title, who) {
      const t = clean(title);
      const w = clean(who);
      const len = [...t].length;
      if (len < 4) return { error: '辩题至少写 4 个字' };
      if (len > 60) return { error: '辩题最多 60 个字，现在是 ' + len + ' 个' };
      if ([...w].length > 12) return { error: '题库人最多 12 个字' };
      const s = { code: this.nextCode(), title: t, who: w || '匿名', pro: '', con: '', votes: 0, today: 0, yesterday: 0, long: 0, short: 0, listed: Date.now(), mine: true };
      stocks.push(s);
      persistListed();
      saveMine(mine);
      return s;
    },
  };

  function persistListed() {
    mine.listed = stocks.filter((s) => s.mine);
  }
}

function clean(s) {
  return String(s || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 今日涨幅（%）：今天的票数比昨天多多少。昨天还没上市的返回 null。 */
export function change(s) {
  if (!s.yesterday) return null;
  return ((s.today - s.yesterday) / s.yesterday) * 100;
}
