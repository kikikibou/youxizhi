/**
 * 大辩题库 (/dbtk/): 离谱辩题的交易所，画成 2000s 证券营业厅的 LED 行情大屏
 * （见 DESIGN.md）。
 *
 * 每条辩题是一只股：DB 编号、累计票数、今日涨幅，红涨绿跌，+10% 以上打「涨停」。
 * 点一行展开它的盘口：多空比例条，「买入」支持正方、「卖出」支持反方，
 * 「看涨」给辩题本身投一票（每台设备每月每只一票）。
 * 投稿叫「申请上市」，投稿人叫「题库人」，先过 AI 初筛，拿不准的等站主审核。
 * 月榜是「月度涨幅榜」，只算本月新增的票；每月 1 日收盘，存进往月榜。
 *
 * 页面骨架只画一次；行情表、月榜、快讯、我的申请这几块数据变了就重画。
 * 投稿表单（连同里面的 Turnstile 人机验证）不重画，免得打到一半的字被清掉。
 *
 * 辩题正文、题库人、立场和输入框都是用户写的字，用系统字体；
 * 固定文案用 DBTK Round（子集，见 fonts.json），数字用 Doto。
 */
import '@fontsource/doto/latin-700.css';
import '@fontsource/doto/latin-900.css';
import './style.css';
import { TURNSTILE_SITEKEY } from './config.js';
import { change, createStore } from './data.js';

const MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const LIMIT = 10; // 涨停线（%）
const NEW_FOR = 24 * 3600e3; // 上市 24 小时内算「新上市」
const BJ = 8 * 3600e3; // 日期和月份按北京时间，和后端一致
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const store = createStore();
const app = document.getElementById('app');
let phase = 'loading'; // loading / ready / error
let loadError = '';
let sort = 'hot'; // hot = 最热（累计票数），new = 最新（上市时间）
let order = []; // 当前排好的顺序；投票后不马上重排，免得行在手指下跳走
let open = null; // 展开的那一只
let pastOpen = false; // 往月榜展开了没有
let past = null; // 往月榜数据：null 还没取 / 'loading' / 'error' / 数组

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const icon = {
  shuffle:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M1 4h3.5c2 0 3 1 4 3l1 2c1 2 2 3 4 3H15M12.5 9.5 15 12l-2.5 2.5M1 12h3.5c1.2 0 2-.4 2.6-1.1M9.3 5.1C9.9 4.4 10.7 4 12 4h3M12.5 1.5 15 4l-2.5 2.5"/></svg>',
  share:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 2h5v5M14 2 7 9M12 10v4H2V4h4"/></svg>',
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

/* ---------- ordering ---------- */

function sorted() {
  const list = [...store.all()];
  if (sort === 'new') list.sort((a, b) => b.listedAt - a.listedAt);
  else list.sort((a, b) => b.votes - a.votes || b.listedAt - a.listedAt);
  return list.map((s) => s.code);
}

const byCode = (code) => store.all().find((s) => s.code === code);
const isNew = (s) => Date.now() - s.listedAt < NEW_FOR;
const pct = (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

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

function bar(s) {
  const total = s.long + s.short;
  if (!total) return '<div class="bar is-empty"><span>还没人站队，买入或卖出当第一个</span></div>';
  const l = Math.round((s.long / total) * 100);
  const r = 100 - l;
  const label = (side, n) => (n < 16 ? `<b>${n}%</b>` : side === 'long' ? `多方 <b>${n}%</b>` : `<b>${n}%</b> 空方`);
  return `<div class="bar" role="img" aria-label="多方 ${l}%，空方 ${r}%"><span class="long" style="width:${l}%">${label('long', l)}</span><span class="short" style="width:${r}%">${label('short', r)}</span></div>`;
}

function depth(s) {
  const side = store.side(s.code);
  const voted = store.voted(s.code);
  const pos = (t) => (t ? `<span class="pos">${esc(t)}</span>` : '');
  return `<div class="depth" id="d-${s.code}">
    ${bar(s)}
    <div class="trade">
      <button class="buy" data-act="pro" aria-pressed="${side === 'pro'}"><span class="act">${side === 'pro' ? '已买入' : '买入'}<small>支持正方</small></span>${pos(s.pro)}</button>
      <button class="sell" data-act="con" aria-pressed="${side === 'con'}"><span class="act">${side === 'con' ? '已卖出' : '卖出'}<small>支持反方</small></span>${pos(s.con)}</button>
    </div>
    <button class="rate" data-act="vote" aria-pressed="${voted}" ${voted ? 'aria-disabled="true"' : ''}>${voted ? '已看涨' : '看涨'}<small>${voted ? '这个月<br>投过了' : '给这题<br>投一票'}</small></button>
    <p class="depth-meta">本月 <b>+${s.monthVotes}</b> 票　累计 <b>${s.votes}</b> 票　每月可以再看涨一次</p>
  </div>`;
}

function row(s) {
  const c = change(s);
  const dir = c === null || c >= 0 ? 'up' : 'down';
  const isOpen = open === s.code;
  const chg =
    c === null
      ? '<span class="chg up">新股</span>'
      : `<span class="chg ${dir}">${pct(c)}${c >= LIMIT ? '<span class="limit">涨停</span>' : ''}</span>`;
  return `<article class="row${isOpen ? ' is-open' : ''}" data-code="${s.code}">
    <button class="row-head" aria-expanded="${isOpen}" aria-controls="d-${s.code}">
      <span class="code">${s.code}${isNew(s) ? '<i>新上市</i>' : ''}</span>
      <span class="t"><span class="name">${esc(s.title)}</span><span class="who">题库人 <b>${esc(s.who)}</b></span></span>
      <span class="num ${dir}" data-num>${s.votes}</span>
      ${chg}
    </button>
    ${isOpen ? depth(s) : ''}
  </article>`;
}

function table() {
  const cols = '<div class="cols" aria-hidden="true"><span>代码</span><span>辩题</span><span>票数</span><span>今日涨幅</span></div>';
  if (phase === 'loading') return cols + '<p class="empty">开盘中，正在拉行情……</p>';
  if (phase === 'error')
    return cols + `<div class="empty is-error"><p>${esc(loadError)}</p><button class="retry" data-retry>重新连接</button></div>`;
  const rows = order.map(byCode).filter(Boolean);
  return cols + (rows.length ? rows.map(row).join('') : '<p class="empty">还没有辩题上市。写一条，当第一只股。</p>');
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
    <nav class="tabs" aria-label="排序">
      <button data-sort="hot" aria-pressed="true">最热</button>
      <button data-sort="new" aria-pressed="false">最新</button>
      <button class="rand" data-rand disabled>${icon.shuffle}随机抽一只</button>
    </nav>
    <section class="table" aria-label="辩题行情" data-part="table"></section>
    <section class="month" aria-label="月度涨幅榜" data-part="month"></section>
    <form class="ipo" novalidate>
      <label class="ipo-title" for="ipo-t">申请上市<small>AI 初筛，通过就上市</small></label>
      <input id="ipo-t" name="topic" placeholder="写下你的离谱辩题" autocomplete="off" maxlength="80" enterkeyhint="next" />
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
      <button class="share" type="button" data-share>${icon.share}甩到群里</button>
    </footer>
    <p class="toast" role="status" aria-live="polite"></p>`;
}

const part = (name) => app.querySelector(`[data-part="${name}"]`);

/** 重画数据相关的几块。withTicker：快讯条也重画（会让它从头滚，只在拉完行情时做）。 */
function update({ withTicker = false } = {}) {
  const y = window.scrollY;
  if (withTicker) part('ticker').innerHTML = ticker();
  part('table').innerHTML = table();
  part('month').innerHTML = month();
  part('mine').innerHTML = mine();
  app.querySelectorAll('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === sort)));
  app.querySelector('[data-rand]').disabled = phase !== 'ready' || !order.length;
  window.scrollTo(0, y);
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

function flash(code, partName) {
  const el = app.querySelector(`.row[data-code="${code}"]`);
  if (!el || reduced.matches) return;
  el.classList.add('flash');
  if (partName === 'num') el.querySelector('[data-num]')?.classList.add('bump');
}

function toggle(code) {
  open = open === code ? null : code;
  update();
  refocus(`.row[data-code="${code}"] .row-head`);
}

function reveal(code) {
  open = code;
  if (!order.includes(code)) order = sorted();
  update();
  const el = app.querySelector(`.row[data-code="${code}"]`);
  el?.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
  el?.querySelector('.row-head')?.focus({ preventScroll: true });
  flash(code);
}

async function load() {
  phase = 'loading';
  update({ withTicker: true });
  try {
    await store.load();
    phase = 'ready';
    order = sorted();
    if (!open || !order.includes(open)) open = order[0] || null; // 第一只默认展开，一进来就看到怎么站队
  } catch (e) {
    phase = 'error';
    loadError = e.message;
  }
  update({ withTicker: true });
}

async function vote(code) {
  const pending = store.vote(code);
  update();
  refocus(`.row[data-code="${code}"] [data-act="vote"]`);
  flash(code, 'num');
  const r = await pending;
  if (r.error) {
    toast(r.error);
    update();
  }
}

async function pick(code, side) {
  const pending = store.pick(code, side);
  update();
  refocus(`.row[data-code="${code}"] [data-act="${side}"]`);
  flash(code);
  const r = await pending;
  if (r.error) {
    toast(r.error);
    update();
  }
}

async function togglePast() {
  pastOpen = !pastOpen;
  if (pastOpen && (past === null || past === 'error')) {
    past = 'loading';
    update();
    try {
      past = await store.months();
    } catch {
      past = 'error';
    }
  }
  update();
  refocus('[data-past]');
}

async function share() {
  const data = { title: '大辩题库', text: '离谱辩题交易所，进来站个队', url: location.href.split('#')[0] };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(data.url);
    toast('链接已复制，去群里粘贴吧');
  } catch (e) {
    if (e?.name !== 'AbortError') toast('没能复制，长按地址栏复制链接吧');
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
    note(`上市成功：${r.code}`);
    topic.value = '';
    sort = 'new';
    order = sorted();
    reveal(r.code);
    return;
  } else if (r.status === 'rejected') {
    note(`没能上市：${r.reason || '没通过初筛'}`, true);
  } else {
    note('已递交，等站主审核，结果会显示在下面');
    topic.value = '';
  }
  update();
}

/* ---------- wiring ---------- */

shell();
load();

app.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t || t.classList.contains('go')) return; // 递交按钮交给 submit 事件
  const code = t.closest('.row')?.dataset.code;

  if (t.classList.contains('row-head')) return toggle(code);
  if (t.dataset.act === 'vote') return t.getAttribute('aria-disabled') === 'true' ? toast('这个月已经看涨过这只了，下个月再来') : vote(code);
  if (t.dataset.act === 'pro' || t.dataset.act === 'con') return pick(code, t.dataset.act);
  if (t.dataset.sort) {
    sort = t.dataset.sort;
    order = sorted();
    update();
    return refocus(`[data-sort="${sort}"]`);
  }
  if ('rand' in t.dataset) {
    const pool = order.filter((c) => c !== open);
    if (pool.length) reveal(pool[Math.floor(Math.random() * pool.length)]);
    return;
  }
  if ('retry' in t.dataset) return load();
  if ('past' in t.dataset) return togglePast();
  if (t.dataset.jump) return reveal(t.dataset.jump);
  if ('share' in t.dataset) share();
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

// 时钟和倒计时每半分钟刷新
setInterval(() => {
  const c = app.querySelector('[data-clock]');
  if (c) c.textContent = clockText();
  const k = app.querySelector('[data-close]');
  if (k) k.innerHTML = closeText();
}, 30e3);
