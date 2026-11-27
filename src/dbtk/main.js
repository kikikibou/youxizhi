/**
 * 大辩题库 (/dbtk/): 离谱辩题的交易所，画成 2000s 证券营业厅的 LED 行情大屏
 * （见 DESIGN.md）。
 *
 * 页面中间是「主窗口」：一块深蓝的液晶分屏，一次只放大展示一只辩题：大字辩题、近 14 天的 K 线、
 * 票数，可以在这里站队（看正 / 看反）、看涨（推荐它，一次随机加 1~99 票，点了才知道加了几票）、
 * 随机抽一只、搬给群友（生成分享图）。
 * 颜色：黄色只表示票数的增长；红色只表示看正，绿色只表示看反。
 * - 带 #DB 编号打开（分享出去的链接）：主窗口放那一只；
 * - 第一次来：放票数最多的；
 * - 以后每次来：随机换一只和上次不一样的。
 * 下面是行情表（点一行就放进主窗口；「月榜」标签换成上一张收盘的月榜，按当月新增票数排名）、
 * 月度涨幅榜（只算本月新增的票）和申请上市。
 *
 * 页面骨架只画一次；主窗口、行情表、月榜、快讯、我的申请这几块数据变了就重画。
 * 投稿表单（连同里面的 Turnstile 人机验证）不重画，免得打到一半的字被清掉。
 *
 * 辩题正文、题库人、立场和输入框都是用户写的字，用系统字体；
 * 固定文案用 DBTK Round（子集，见 fonts.json），数字用 Doto。
 */
import '@fontsource/doto/latin-700.css';
import '@fontsource/doto/latin-900.css';
import './style.css';
import { TURNSTILE_SITEKEY } from './config.js';
import { arrive } from './arrive.js';
import { change, createStore } from './data.js';
import { klineSvg } from './kline.js';

const MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const LIMIT = 10; // 涨停线（%）
const NEW_FOR = 24 * 3600e3; // 上市 24 小时内算「新上市」
const BJ = 8 * 3600e3; // 日期和月份按北京时间，和后端一致
const LAST_KEY = 'dbtk:last'; // 上次主窗口放的是哪一只
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const store = createStore();
const app = document.getElementById('app');
let phase = 'loading'; // loading / ready / error
let loadError = '';
let sort = 'hot'; // hot = 最热（累计票数），new = 最新（上市时间），month = 月榜（上一张收盘的月榜）
let order = []; // 当前排好的顺序；投票后不马上重排，免得行在手指下跳走
let featured = null; // 主窗口里的那一只
let pastOpen = false; // 往月榜展开了没有
let past = null; // 往月榜数据（月榜标签也用它）：null 还没取 / 'loading' / 'error' / 数组，最近的月份在前

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const icon = {
  shuffle:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M1 4h3.5c2 0 3 1 4 3l1 2c1 2 2 3 4 3H15M12.5 9.5 15 12l-2.5 2.5M1 12h3.5c1.2 0 2-.4 2.6-1.1M9.3 5.1C9.9 4.4 10.7 4 12 4h3M12.5 1.5 15 4l-2.5 2.5"/></svg>',
  share:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 2h5v5M14 2 7 9M12 10v4H2V4h4"/></svg>',
  // 上市敲的那口钟（申请上市 / 推荐辩题）
  bell:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5v1.2M4.2 11.5V7.4a3.8 3.8 0 0 1 7.6 0v4.1l1.4 1.6H2.8z"/><path d="M6.5 13.6a1.6 1.6 0 0 0 3 0" stroke-linecap="round"/><path d="M13.4 3.2l1.2-.9M2.6 3.2l-1.2-.9" stroke-linecap="round"/></svg>',
};

/* ---------- time (Beijing) ---------- */

const bj = (ms = Date.now()) => new Date(ms + BJ); // read with getUTC*
const p2 = (n) => String(n).padStart(2, '0');

function monthInfo(d = bj()) {
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return { name: MONTHS[d.getUTCMonth()] + '月', last, left: last - d.getUTCDate() };
}

const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1] + '月';
const clockText = (d = bj()) => `${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;

function closeText() {
  const m = monthInfo();
  return m.left === 0 ? `${m.name}榜 今天收盘` : `${m.name}榜 <em>${m.left}</em> 天后收盘`;
}

/* ---------- ordering & the main window's pick ---------- */

function sorted() {
  const list = [...store.all()];
  if (sort === 'new') list.sort((a, b) => b.listedAt - a.listedAt);
  else list.sort((a, b) => b.votes - a.votes || a.code.localeCompare(b.code));
  return list.map((s) => s.code);
}

const byCode = (code) => store.all().find((s) => s.code === code);
const isNew = (s) => Date.now() - s.listedAt < NEW_FOR;
// 涨幅：百分之百以上不带小数（「+250%」「-100%」），好放进行情表那一列
const pct = (n) => (n >= 0 ? '+' : '') + (Math.abs(n) >= 100 ? Math.round(n) : n.toFixed(1)) + '%';
// 数字太长时字号小一号（is-long），不让它撑出那一列
const long = (text, max) => (String(text).length > max ? ' is-long' : '');

function remember(code) {
  try {
    localStorage.setItem(LAST_KEY, code);
  } catch {
    /* no storage: every visit counts as the first */
  }
}

/** 进页面时主窗口放哪一只：链接指定的 > 第一次来放票数最多的 > 随机换一只和上次不一样的。 */
function firstPick() {
  const codes = store.all().map((s) => s.code);
  if (!codes.length) return null;
  const asked = decodeURIComponent(location.hash.slice(1)).toUpperCase();
  if (codes.includes(asked)) return asked;
  let last = null;
  try {
    last = localStorage.getItem(LAST_KEY);
  } catch {}
  if (last === null) {
    return [...store.all()].sort((a, b) => b.votes - a.votes || a.code.localeCompare(b.code))[0].code;
  }
  const pool = codes.filter((c) => c !== last);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : codes[0];
}

/* ---------- pieces ---------- */

function tickerItems() {
  const list = store.all();
  const m = monthInfo();
  const items = [];
  list
    .filter((s) => (change(s) ?? 0) >= LIMIT)
    .sort((a, b) => change(b) - change(a))
    .slice(0, 3)
    .forEach((s) => items.push(`${s.code} ${esc(s.title)}　今日涨停`));
  const fresh = list.filter(isNew).sort((a, b) => b.listedAt - a.listedAt)[0];
  if (fresh) items.push(`新上市 ${fresh.code} ${esc(fresh.title)}，题库人「${esc(fresh.who)}」`);
  const lead = [...list].filter((s) => s.monthVotes > 0).sort((a, b) => b.monthVotes - a.monthVotes)[0];
  if (lead) items.push(`${m.name}领涨 ${lead.code}，本月 +${lead.monthVotes} 票`);
  items.push(m.left === 0 ? `${m.name}榜今天收盘` : `${m.name}榜 ${m.left} 天后收盘`);
  return items;
}

function ticker() {
  if (phase !== 'ready') return `<p class="run is-still"><b>快讯</b>${phase === 'error' ? '暂时休市' : '开盘中'}</p>`;
  const line = '<b>快讯</b>' + tickerItems().join('　　') + '　　　';
  const secs = Math.max(14, Math.round(line.replace(/<[^>]+>/g, '').length * 0.32));
  return `<p class="run" style="--secs:${secs}s">${line}<span aria-hidden="true">${line}</span></p>`;
}

function chgHtml(s) {
  const c = change(s);
  if (c === null) return '<span class="chg up">新股</span>';
  return `<span class="chg ${c >= 0 ? 'up' : 'down'}${long(pct(c), 6)}">${pct(c)}${c >= LIMIT ? '<span class="limit">涨停</span>' : ''}</span>`;
}

function sidesOf(s) {
  const total = s.long + s.short;
  if (!total) return { total, pro: null, con: null };
  const pro = Math.round((s.long / total) * 100);
  return { total, pro, con: 100 - pro };
}

/** 一边超过九成（至少 10 个人站队）：照「涨停」的说法打「正停」「反停」。 */
function stopTag(s) {
  const { total, pro, con } = sidesOf(s);
  if (total < 10) return '';
  if (pro >= 90) return '<span class="stop is-pro">正停</span>';
  if (con >= 90) return '<span class="stop is-con">反停</span>';
  return '';
}

function spot() {
  if (phase === 'loading') return '<p class="spot-empty">开盘中，正在拉行情……</p>';
  if (phase === 'error')
    return `<div class="spot-empty is-error"><p>${esc(loadError)}</p><button class="retry" data-retry>重新连接</button></div>`;
  const s = byCode(featured);
  if (!s) return '<p class="spot-empty">还没有辩题上市。写一条，当第一只股。</p>';
  const side = store.side(s.code);
  const voted = store.voted(s.code);
  const gain = store.gain(s.code);
  const { pro, con } = sidesOf(s);
  const pct = (n) => (n === null ? '' : ` <b>${n}%</b>`);
  const line = (stance, fallback) => esc(stance ? `${stance} 一方有利` : fallback);
  const mineTag = (on) => (on ? '<i class="mine-tag">你选的</i>' : '');
  return `
    <div class="spot-head"><span class="code">${s.code}</span><span class="spot-who">题库人 <b>${esc(s.who)}</b></span>${isNew(s) ? '<span class="spot-tag">新上市</span>' : ''}${stopTag(s)}${chgHtml(s)}</div>
    <h2 class="spot-title">${esc(s.title)}</h2>
    <div class="kline" data-kline role="img" aria-label="近 14 天每天新增的票数，和当天看正、看反的人数">${klineSvg(store.cachedHistory(s.code), s.votes)}</div>
    <p class="kline-legend"><span>近 14 天</span><span><i class="y">黄 新增票数</i><i class="r">红 看正</i><i class="g">绿 看反</i></span></p>
    <div class="spot-quote"><b class="spot-votes" data-spot-num>${s.votes}</b><span class="spot-unit">票</span><span class="spot-month">本月 <b>+${s.monthVotes}</b></span></div>
    <div class="trade">
      <button class="buy" data-act="pro" aria-pressed="${side === 'pro'}"><span class="act">看正${pct(pro)}</span><small>${line(s.pro, '正方有利')}</small>${mineTag(side === 'pro')}</button>
      <button class="sell" data-act="con" aria-pressed="${side === 'con'}"><span class="act">看反${pct(con)}</span><small>${line(s.con, '反方有利')}</small>${mineTag(side === 'con')}</button>
    </div>
    <button class="rate" data-act="vote" aria-pressed="${voted}" ${voted ? 'aria-disabled="true"' : ''}>${
      voted ? `已看涨<small>这个月给它加了 ${gain} 票</small>` : '看涨<small>推荐这个辩题，为它投票</small>'
    }</button>
    <div class="spot-foot">
      <button class="spot-btn" data-rand ${order.length > 1 ? '' : 'disabled'}>${icon.shuffle}随机抽一只</button>
      <button class="spot-btn" data-share>${icon.share}搬给群友</button>
    </div>`;
}

function row(s) {
  const c = change(s);
  const dir = c === null || c >= 0 ? 'up' : 'down';
  const on = featured === s.code;
  return `<article class="row${on ? ' is-current' : ''}" data-code="${s.code}">
    <button class="row-head" aria-current="${on}" aria-label="放进主窗口：${esc(s.title)}">
      <span class="code">${s.code}${isNew(s) ? '<i>新上市</i>' : ''}</span>
      <span class="t"><span class="name">${esc(s.title)}</span><span class="who">题库人 <b>${esc(s.who)}</b></span></span>
      <span class="num ${dir}${long(s.votes, 4)}" data-num>${s.votes}</span>
      ${chgHtml(s)}
    </button>
  </article>`;
}

function table() {
  if (sort === 'month') return boardTable();
  const cols = '<div class="cols" aria-hidden="true"><span>代码</span><span>辩题</span><span>票数</span><span>今日涨幅</span></div>';
  if (phase !== 'ready') return cols;
  const rows = order.map(byCode).filter(Boolean);
  return cols + (rows.length ? rows.map(row).join('') : '');
}

/** 月榜里的一行：名次和代码、辩题、当月新增票数、现在的累计票数。已经下市的不能点。 */
function boardRow(r) {
  const s = byCode(r.code);
  const on = featured === r.code;
  const inner = `<span class="code"><b class="rank">${r.rank}</b>${r.code}</span>
      <span class="t"><span class="name">${esc(r.title)}</span><span class="who">题库人 <b>${esc(r.who)}</b></span></span>
      <span class="num up${long(r.gain, 4)}">+${r.gain}</span>
      ${s ? `<span class="tot">${s.votes}</span>` : '<span class="tot is-off">已下市</span>'}`;
  return `<article class="row${on ? ' is-current' : ''}" data-code="${r.code}">${
    s
      ? `<button class="row-head" aria-current="${on}" aria-label="放进主窗口：第 ${r.rank} 名 ${esc(r.title)}">${inner}</button>`
      : `<div class="row-head">${inner}</div>`
  }</article>`;
}

/** 「月榜」标签：上一张收盘的月榜（每月 1 日收盘存前十名）。 */
function boardTable() {
  const cols = '<div class="cols" aria-hidden="true"><span>名次</span><span>辩题</span><span>当月票</span><span>累计票</span></div>';
  if (phase !== 'ready' || past === null || past === 'loading') return cols + '<p class="empty">正在翻往月的行情……</p>';
  if (past === 'error') return cols + '<p class="empty">月榜没取到，再点一下「月榜」试试</p>';
  const m = past[0];
  if (!m) {
    const now = monthInfo();
    return `${cols}<p class="empty">还没有收盘过的月榜：${now.name}榜 ${now.last} 日收盘，下个月 1 日挂在这里。这个月的排名在下面的月度涨幅榜。</p>`;
  }
  return `<p class="board-cap"><b>${m.month.slice(0, 4)} 年 ${monthName(m.month)}榜</b><span>已收盘 · 按当月新增票数</span></p>${cols}${m.top.map(boardRow).join('')}`;
}

function pastList() {
  if (past === 'loading') return '<p class="past-note">正在翻往月的行情……</p>';
  if (past === 'error') return '<p class="past-note">往月榜没取到，稍后再试</p>';
  if (!past?.length) return '<p class="past-note">还没有收盘过的月份</p>';
  return past
    .map(
      (m) => `<section class="past-month"><h3>${m.month.slice(0, 4)} 年 ${monthName(m.month)}榜</h3><ol>${m.top
        .slice(0, 3)
        .map((r) => `<li><b>${r.rank}</b><span class="c">${r.code}</span><span class="pt">${esc(r.title)}</span><span class="p">+${r.gain}</span></li>`)
        .join('')}</ol></section>`,
    )
    .join('');
}

function month() {
  if (phase !== 'ready') return '';
  const m = monthInfo();
  const top = [...store.all()].filter((s) => s.monthVotes > 0).sort((a, b) => b.monthVotes - a.monthVotes).slice(0, 3);
  const list = top.length
    ? `<ol>${top.map((s, i) => `<li><button data-jump="${s.code}" aria-label="第 ${i + 1} 名 ${s.code}，本月 ${s.monthVotes} 票"><b>${i + 1}</b><span class="c">${s.code}</span><span class="p">+${s.monthVotes}</span></button></li>`).join('')}</ol>`
    : '<p class="past-note">这个月还没开张，看涨一只就上榜</p>';
  return `<h2>${m.name} 月度涨幅榜<small>按本月新增票数，${m.last} 日收盘</small></h2>
    ${list}
    <button class="past-toggle" data-past aria-expanded="${pastOpen}">${pastOpen ? '收起往月榜' : '看往月榜'}</button>
    ${pastOpen ? `<div class="past">${pastList()}</div>` : ''}`;
}

function mine() {
  const items = store.mine().slice(0, 3);
  if (!items.length) return '';
  const label = { pending: '审核中', rejected: '退回', listed: '已上市', delisted: '已下市' };
  return items
    .map(
      (it) => `<li class="is-${esc(it.status)}"><b>${label[it.status] || it.status}</b><span>${esc(it.title)}${
        it.status === 'listed' && it.code ? `　${it.code}` : ''
      }${it.status === 'rejected' && it.reason ? `　${esc(it.reason)}` : ''}</span></li>`,
    )
    .join('');
}

/* ---------- render ---------- */

function shell() {
  app.innerHTML = `
    <div class="ticker" role="marquee" aria-label="快讯" data-part="ticker"></div>
    <header class="head">
      <h1 class="led">大辩题库</h1>
      <div class="clock"><b data-clock>${clockText()}</b><span data-close>${closeText()}</span></div>
    </header>
    <p class="lede">在这里，你可以自由分享交流你喜欢的大辩题。我们授权所有人使用它们，只是请千万不要忘记题库。</p>
    <section class="spot" aria-label="主窗口" aria-live="polite" data-part="spot"></section>
    <nav class="tabs" aria-label="行情表">
      <button data-sort="hot" aria-pressed="true">最热</button>
      <button data-sort="new" aria-pressed="false">最新</button>
      <button data-sort="month" aria-pressed="false">月榜</button>
      <button class="tabs-rec" type="button" data-rec>${icon.bell}推荐辩题</button>
    </nav>
    <section class="table" aria-label="辩题行情" data-part="table"></section>
    <section class="month" aria-label="月度涨幅榜" data-part="month"></section>
    <form class="ipo" novalidate>
      <label class="ipo-title" for="ipo-t"><span class="ipo-name">${icon.bell}申请上市</span><small>AI 初筛，通过就上市</small></label>
      <input id="ipo-t" name="topic" placeholder="写下你推荐的大辩题" autocomplete="off" maxlength="80" enterkeyhint="next" />
      <div class="r">
        <label class="pre" for="ipo-w">题库人</label>
        <input id="ipo-w" name="who" placeholder="署个名，不写就是匿名" autocomplete="nickname" maxlength="20" enterkeyhint="send" />
        <button class="go" type="submit">递交</button>
      </div>
      <div class="ts-box"></div>
      <p class="note" role="status" aria-live="polite"></p>
      <ul class="mine" aria-label="我的申请" data-part="mine"></ul>
    </form>
    <footer class="foot">
      <small>行情仅供娱乐，不构成辩论建议</small>
      <button class="share" type="button" data-share>${icon.share}搬给群友</button>
    </footer>
    <p class="toast" role="status" aria-live="polite"></p>
    <div class="sheet" data-part="sheet" hidden></div>`;
}

const part = (name) => app.querySelector(`[data-part="${name}"]`);

/** 重画数据相关的几块。withTicker：快讯条也重画（会让它从头滚，只在拉完行情时做）。 */
function update({ withTicker = false } = {}) {
  const y = window.scrollY;
  if (withTicker) part('ticker').innerHTML = ticker();
  part('spot').innerHTML = spot();
  part('table').innerHTML = table();
  part('month').innerHTML = month();
  part('mine').innerHTML = mine();
  app.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === sort)));
  window.scrollTo(0, y);
  loadKline();
}

/** 主窗口里那只的 K 线：没取过就去取，取到了只重画 K 线那一块。 */
async function loadKline() {
  const code = featured;
  if (phase !== 'ready' || !code || store.cachedHistory(code)) return;
  try {
    await store.history(code);
  } catch {
    return; // 取不到就只留网格
  }
  const s = byCode(code);
  const box = part('spot').querySelector('[data-kline]');
  if (code === featured && s && box) box.innerHTML = klineSvg(store.cachedHistory(code), s.votes);
}

function refocus(sel) {
  app.querySelector(sel)?.focus({ preventScroll: true });
}

let toastTimer = 0;
function toast(text) {
  const el = app.querySelector('.toast');
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
}

function note(text, isError = false) {
  const form = app.querySelector('.ipo');
  form.querySelector('.note').textContent = text;
  form.classList.toggle('has-error', isError);
}

/* ---------- actions ---------- */

function flash(el) {
  if (!el || reduced.matches) return;
  el.classList.remove('flash');
  void el.offsetWidth; // restart the animation
  el.classList.add('flash');
}

/** 把一只放进主窗口。scroll：从下面的表或月榜点过来时，把主窗口滚进视野。 */
function feature(code, { scroll = false } = {}) {
  if (!byCode(code)) return;
  featured = code;
  remember(code);
  update();
  const el = part('spot');
  if (scroll) el.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' });
  flash(el);
}

async function load() {
  phase = 'loading';
  update({ withTicker: true });
  try {
    await store.load();
    phase = 'ready';
    order = sorted();
    if (!featured || !byCode(featured)) {
      featured = firstPick();
      if (featured) remember(featured);
    }
  } catch (e) {
    phase = 'error';
    loadError = e.message;
  }
  update({ withTicker: true });
}

/** 看涨加了几票的一句话。 */
function gainWord(g) {
  if (g === 1) return '就一票';
  if (g === 99) return '顶格';
  if (g >= 90) return '暴涨';
  if (g >= 50) return '大涨';
  if (g >= 10) return '上涨';
  return '小涨';
}

/** 看涨之后：按钮上方跳出「+N」，大数字从旧票数滚到新票数。 */
function celebrate(from, gain) {
  const el = part('spot');
  const num = el.querySelector('[data-spot-num]');
  const rate = el.querySelector('[data-act="vote"]');
  const pop = document.createElement('span');
  pop.className = 'gain-pop';
  pop.setAttribute('aria-hidden', 'true');
  pop.innerHTML = `+${gain}<small>${gainWord(gain)}</small>`;
  pop.style.top = `${rate.offsetTop - 8}px`;
  el.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
  flash(el);
  if (reduced.matches || !num) return;
  const to = from + gain;
  const t0 = performance.now();
  num.classList.add('is-rolling');
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / 900);
    const eased = 1 - Math.pow(1 - p, 3);
    num.textContent = String(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(tick);
    else num.classList.remove('is-rolling');
  };
  num.textContent = String(from);
  requestAnimationFrame(tick);
}

async function vote(code) {
  const rate = part('spot').querySelector('[data-act="vote"]');
  if (rate) {
    rate.disabled = true;
    rate.setAttribute('aria-busy', 'true');
    rate.innerHTML = '看涨中<small>正在摇号……</small>';
  }
  const r = await store.vote(code);
  update();
  if (r.ok) {
    celebrate(r.from, r.gain);
    refocus('[data-act="vote"]');
  } else if (r.already) toast('这个月已经看涨过这只了，下个月再来');
  else toast(r.error);
}

async function pick(code, side) {
  const pending = store.pick(code, side);
  update();
  refocus(`[data-act="${side}"]`);
  const r = await pending;
  if (r.error) {
    toast(r.error);
    update();
  }
}

/** 「推荐辩题」：滚到申请上市，光标放进辩题输入框，框闪一下。 */
function goSubmit() {
  const form = app.querySelector('.ipo');
  form.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
  setTimeout(() => form.querySelector('#ipo-t').focus({ preventScroll: true }), reduced.matches ? 0 : 450);
  flash(form);
}

function randomPick() {
  const pool = store.all().map((s) => s.code).filter((c) => c !== featured);
  if (pool.length) feature(pool[Math.floor(Math.random() * pool.length)]);
}

/** 往月榜：没取过（或上次没取到）就去取。 */
async function loadPast() {
  if (past !== null && past !== 'error') return;
  past = 'loading';
  update();
  try {
    past = await store.months();
  } catch {
    past = 'error';
  }
  update();
}

async function togglePast() {
  pastOpen = !pastOpen;
  update();
  if (pastOpen) await loadPast();
  refocus('[data-past]');
}

/* ---------- 搬给群友：分享图 ---------- */

let sheetUrl = '';
let sheetReturn = null;

function closeSheet() {
  const sheet = part('sheet');
  sheet.hidden = true;
  sheet.innerHTML = '';
  if (sheetUrl) URL.revokeObjectURL(sheetUrl);
  sheetUrl = '';
  document.body.classList.remove('has-sheet');
  sheetReturn?.focus({ preventScroll: true });
}

async function share(trigger) {
  const s = byCode(featured);
  if (!s) return toast('还没有辩题可以搬');
  const link = `${location.origin}${location.pathname}#${s.code}`;
  const sheet = part('sheet');
  sheetReturn = trigger;
  sheet.hidden = false;
  document.body.classList.add('has-sheet');
  sheet.innerHTML = `<div class="sheet-box" role="dialog" aria-modal="true" aria-label="搬给群友"><p class="sheet-wait">正在画分享图……</p></div>`;
  try {
    const { drawCard } = await import('./share.js');
    const blob = await drawCard(s, link);
    if (sheet.hidden) return; // closed while drawing
    sheetUrl = URL.createObjectURL(blob);
    const file = new File([blob], `大辩题库-${s.code}.png`, { type: 'image/png' });
    const canFiles = !!navigator.canShare?.({ files: [file] });
    sheet.innerHTML = `<div class="sheet-box" role="dialog" aria-modal="true" aria-labelledby="sheet-h">
      <h2 id="sheet-h">搬给群友</h2>
      <img src="${sheetUrl}" alt="分享图：${esc(s.code)} ${esc(s.title)}" />
      <p class="sheet-tip">长按图片保存或转发；扫图上的码直接打开这一只</p>
      <div class="sheet-act">
        ${canFiles ? '<button class="sheet-main" data-sys>发给群友</button>' : ''}
        <a class="sheet-btn${canFiles ? '' : ' sheet-main'}" href="${sheetUrl}" download="大辩题库-${esc(s.code)}.png">保存图片</a>
        <button class="sheet-btn" data-copy>复制链接</button>
        <button class="sheet-btn" data-close>关闭</button>
      </div>
    </div>`;
    sheet.querySelector('[data-close]').focus();
    sheet.onclick = async (e) => {
      if (e.target === sheet || e.target.closest('[data-close]')) return closeSheet();
      if (e.target.closest('[data-copy]')) {
        try {
          await navigator.clipboard.writeText(link);
          toast('链接已复制，去群里粘贴吧');
        } catch {
          toast('没能复制，长按地址栏复制链接吧');
        }
      }
      if (e.target.closest('[data-sys]')) {
        try {
          await navigator.share({ files: [file], title: '大辩题库', text: `${s.title}（扫码来站队）` });
        } catch {
          /* cancelled */
        }
      }
    };
  } catch {
    sheet.innerHTML = `<div class="sheet-box" role="dialog" aria-modal="true" aria-label="搬给群友"><p class="sheet-wait">分享图没画出来，先复制链接吧</p><div class="sheet-act"><button class="sheet-btn sheet-main" data-copy>复制链接</button><button class="sheet-btn" data-close>关闭</button></div></div>`;
    sheet.onclick = async (e) => {
      if (e.target === sheet || e.target.closest('[data-close]')) return closeSheet();
      if (e.target.closest('[data-copy]')) navigator.clipboard?.writeText(link).then(() => toast('链接已复制，去群里粘贴吧'), () => {});
    };
  }
}

/* ---------- Turnstile（人机验证，只在要投稿时才加载） ---------- */

const ts = { ready: null, widget: null, token: '' };

function loadTurnstile() {
  if (!TURNSTILE_SITEKEY) return Promise.resolve(null);
  ts.ready ||= new Promise((resolve, reject) => {
    window.dbtkTurnstileLoaded = () => resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=dbtkTurnstileLoaded&render=explicit';
    s.async = true;
    s.onerror = () => {
      ts.ready = null;
      reject(new Error('人机验证没加载出来，检查一下网络'));
    };
    document.head.appendChild(s);
  });
  return ts.ready;
}

async function mountTurnstile() {
  const t = await loadTurnstile().catch((e) => {
    note(e.message, true);
    return null;
  });
  if (!t || ts.widget !== null) return;
  ts.widget = t.render(app.querySelector('.ts-box'), {
    sitekey: TURNSTILE_SITEKEY,
    theme: 'dark',
    appearance: 'interaction-only',
    size: 'flexible',
    language: 'zh-cn',
    callback: (token) => (ts.token = token),
    'expired-callback': () => (ts.token = ''),
    'error-callback': () => (ts.token = ''),
  });
}

function resetTurnstile() {
  ts.token = '';
  if (ts.widget !== null) window.turnstile?.reset(ts.widget);
}

async function submit(form) {
  const { topic, who } = form.elements;
  const go = form.querySelector('.go');
  const title = topic.value.trim();
  if ([...title].length < 4) {
    note('辩题至少写 4 个字', true);
    topic.focus();
    return;
  }
  if (TURNSTILE_SITEKEY && !ts.token) {
    mountTurnstile();
    note('人机验证还没好，稍等一下再递交', true);
    return;
  }
  go.disabled = true;
  go.textContent = '递交中';
  note('递交中，AI 正在初筛……');
  const r = await store.submit(title, who.value, ts.token);
  go.disabled = false;
  go.textContent = '递交';
  resetTurnstile();

  if (r.error) {
    note(r.error, true);
  } else if (r.status === 'listed') {
    note(`上市成功：${r.code}，已经放进主窗口，可以搬给群友了`);
    topic.value = '';
    sort = 'new';
    order = sorted();
    feature(r.code, { scroll: true });
    return;
  } else if (r.status === 'rejected') {
    note(`没能上市：${r.reason || '没通过初筛'}`, true);
  } else {
    note(r.full ? '今天的上市名额满了，已进审核队列，等站主审核' : '已递交，等站主审核，结果会显示在下面');
    topic.value = '';
  }
  update();
}

/* ---------- wiring ---------- */

// 开发时 ?arrive=秒：假装从小镇的转场进来，停在那一刻看（?arrive=play 照常播一遍）
const hold = import.meta.env.DEV ? new URLSearchParams(location.search).get('arrive') : null;
if (hold !== null) sessionStorage.setItem('youxizhi-arrive', JSON.stringify({ kind: 'led', at: Date.now() }));
const arrival = arrive(); // 从小镇的转场进来：先画好转场最后那块屏（arrive.js）
shell();
load();
if (hold !== null && hold !== 'play') arrival?.seek(Number(hold), app.querySelector('.head h1'));
else arrival?.play(app.querySelector('.head h1'));

app.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t || t.classList.contains('go') || t.closest('.sheet')) return; // 递交交给 submit 事件；分享层自己处理

  if (t.classList.contains('row-head')) return feature(t.closest('.row').dataset.code, { scroll: true });
  if (t.dataset.act === 'vote') return t.getAttribute('aria-disabled') === 'true' ? toast('这个月已经看涨过这只了，下个月再来') : vote(featured);
  if (t.dataset.act === 'pro' || t.dataset.act === 'con') return pick(featured, t.dataset.act);
  if (t.dataset.sort) {
    sort = t.dataset.sort;
    order = sorted();
    update();
    if (sort === 'month') loadPast();
    return refocus(`[data-sort="${sort}"]`);
  }
  if ('rand' in t.dataset) return randomPick();
  if ('rec' in t.dataset) return goSubmit();
  if ('retry' in t.dataset) return load();
  if ('past' in t.dataset) return togglePast();
  if (t.dataset.jump) return feature(t.dataset.jump, { scroll: true });
  if ('share' in t.dataset) share(t);
});

app.addEventListener('submit', (e) => {
  e.preventDefault();
  submit(e.target);
});

// 要投稿了才加载人机验证，不让每个只来看看的人都多下一个脚本
app.addEventListener('focusin', (e) => {
  if (e.target.closest?.('.ipo')) mountTurnstile();
});

app.addEventListener('animationend', (e) => {
  e.target.classList.remove('flash', 'bump');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !part('sheet').hidden) closeSheet();
});

// 地址栏换了 #DB 编号（比如点了群里的另一个链接）：放进主窗口
window.addEventListener('hashchange', () => {
  const code = decodeURIComponent(location.hash.slice(1)).toUpperCase();
  if (phase === 'ready' && byCode(code)) feature(code, { scroll: true });
});

// 时钟和倒计时每半分钟刷新
setInterval(() => {
  const c = app.querySelector('[data-clock]');
  if (c) c.textContent = clockText();
  const k = app.querySelector('[data-close]');
  if (k) k.innerHTML = closeText();
}, 30e3);
