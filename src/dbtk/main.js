/**
 * 大辩题库 (/dbtk/): 离谱辩题的交易所，画成 2000s 证券营业厅的 LED 行情大屏
 * （见 DESIGN.md）。
 *
 * 每条辩题是一只股：DB 编号、票数、今日涨幅，红涨绿跌，+10% 以上打「涨停」。
 * 点一行展开它的盘口：多空比例条，「买入」支持正方、「卖出」支持反方，
 * 「看涨」给辩题本身投一票。投稿叫「申请上市」，投稿人叫「题库人」。
 * 月榜是「月度涨幅榜」，月底「收盘」。
 *
 * 辩题正文、题库人、立场和输入框都是用户写的字，用系统字体；
 * 固定文案用 DBTK Round（子集，见 fonts.json），数字用 Doto。
 *
 * 数据在 data.js：现在是示例行情加上这台浏览器自己的操作，后端以后再接。
 */
import '@fontsource/doto/latin-700.css';
import '@fontsource/doto/latin-900.css';
import './style.css';
import { createStore, change } from './data.js';

const MONTHS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const LIMIT = 10; // 涨停线（%）
const NEW_FOR = 24 * 3600e3; // 上市 24 小时内算「新上市」
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const store = createStore();
const app = document.getElementById('app');
let sort = 'hot'; // hot = 最热（票数），new = 最新（上市时间）
let order = []; // 当前排好的顺序；投票后不马上重排，免得行在手指下跳走
let open = null; // 展开的那一只
let notice = '';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const icon = {
  shuffle:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M1 4h3.5c2 0 3 1 4 3l1 2c1 2 2 3 4 3H15M12.5 9.5 15 12l-2.5 2.5M1 12h3.5c1.2 0 2-.4 2.6-1.1M9.3 5.1C9.9 4.4 10.7 4 12 4h3M12.5 1.5 15 4l-2.5 2.5"/></svg>',
  share:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 2h5v5M14 2 7 9M12 10v4H2V4h4"/></svg>',
};

/* ---------- time ---------- */

function monthInfo(d = new Date()) {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { name: MONTHS[d.getMonth()] + '月', last, left: last - d.getDate() };
}

function clockText(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function closeText() {
  const m = monthInfo();
  return m.left === 0 ? `${m.name}榜 今天收盘` : `${m.name}榜 <em>${m.left}</em> 天后收盘`;
}

/* ---------- ordering ---------- */

function sorted() {
  const list = [...store.all()];
  if (sort === 'new') list.sort((a, b) => b.listed - a.listed);
  else list.sort((a, b) => b.votes - a.votes || b.listed - a.listed);
  return list.map((s) => s.code);
}

const byCode = (code) => store.all().find((s) => s.code === code);
const isNew = (s) => Date.now() - s.listed < NEW_FOR;

/* ---------- pieces ---------- */

function pct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}

function tickerItems() {
  const list = store.all();
  const m = monthInfo();
  const items = [];
  list
    .filter((s) => (change(s) ?? 0) >= LIMIT)
    .sort((a, b) => change(b) - change(a))
    .slice(0, 3)
    .forEach((s) => items.push(`${s.code} ${esc(s.title)}　今日涨停`));
  const fresh = list.filter(isNew).sort((a, b) => b.listed - a.listed)[0];
  if (fresh) items.push(`新上市 ${fresh.code} ${esc(fresh.title)}，题库人「${esc(fresh.who)}」`);
  const lead = [...list].sort((a, b) => b.votes - a.votes)[0];
  if (lead) items.push(`${m.name}领涨 ${lead.code}，累计 ${lead.votes} 票`);
  items.push(m.left === 0 ? `${m.name}榜今天收盘` : `${m.name}榜 ${m.left} 天后收盘`);
  return items;
}

function ticker() {
  const line = '<b>快讯</b>' + tickerItems().join('　　') + '　　　';
  const secs = Math.max(14, Math.round(line.replace(/<[^>]+>/g, '').length * 0.32));
  return `<div class="ticker" role="marquee" aria-label="快讯"><p class="run" style="--secs:${secs}s">${line}<span aria-hidden="true">${line}</span></p></div>`;
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
    <button class="rate" data-act="vote" aria-pressed="${voted}">${voted ? '已看涨' : '看涨'}<small>${voted ? '这题<br>+1 票' : '给这题<br>投一票'}</small></button>
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

function month() {
  const m = monthInfo();
  const top = [...store.all()].sort((a, b) => b.votes - a.votes).slice(0, 3);
  if (!top.length) return '';
  return `<section class="month" aria-label="${m.name}月度涨幅榜">
    <h2>${m.name} 月度涨幅榜<small>按本月票数，${m.last} 日收盘</small></h2>
    <ol>${top.map((s, i) => `<li><button data-jump="${s.code}" aria-label="第 ${i + 1} 名 ${s.code}，${s.votes} 票"><b>${i + 1}</b><span class="c">${s.code}</span><span class="p">+${s.votes}</span></button></li>`).join('')}</ol>
  </section>`;
}

function render() {
  const rows = order.map(byCode).filter(Boolean);
  app.innerHTML = `
    ${ticker()}
    <header class="head">
      <h1 class="led">大辩题库</h1>
      <div class="clock"><b data-clock>${clockText()}</b><span data-close>${closeText()}</span></div>
    </header>
    <nav class="tabs" aria-label="排序">
      <button data-sort="hot" aria-pressed="${sort === 'hot'}">最热</button>
      <button data-sort="new" aria-pressed="${sort === 'new'}">最新</button>
      <button class="rand" data-rand ${rows.length ? '' : 'disabled'}>${icon.shuffle}随机抽一只</button>
    </nav>
    <section class="table" aria-label="辩题行情">
      <div class="cols" aria-hidden="true"><span>代码</span><span>辩题</span><span>票数</span><span>今日涨幅</span></div>
      ${rows.length ? rows.map(row).join('') : '<p class="empty">还没有辩题上市。写一条，当第一只股。</p>'}
    </section>
    ${month()}
    <form class="ipo" novalidate>
      <label class="ipo-title" for="ipo-t">申请上市<small>通过后编号 ${store.nextCode()}</small></label>
      <input id="ipo-t" name="topic" placeholder="写下你的离谱辩题" autocomplete="off" maxlength="80" enterkeyhint="next" />
      <div class="r">
        <label class="pre" for="ipo-w">题库人</label>
        <input id="ipo-w" name="who" placeholder="署个名，不写就是匿名" autocomplete="nickname" maxlength="20" enterkeyhint="send" />
        <button class="go" type="submit">递交</button>
      </div>
      <p class="note" role="status" aria-live="polite">${esc(notice)}</p>
    </form>
    <footer class="foot">
      <small>行情仅供娱乐，不构成辩论建议</small>
      <button class="share" data-share>${icon.share}甩到群里</button>
    </footer>`;
}

/* ---------- actions ---------- */

function flash(code, part) {
  const el = app.querySelector(`.row[data-code="${code}"]`);
  if (!el || reduced.matches) return;
  el.classList.add('flash');
  if (part === 'num') el.querySelector('[data-num]')?.classList.add('bump');
}

function rerender(focusSel) {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
  if (focusSel) app.querySelector(focusSel)?.focus({ preventScroll: true });
}

function toggle(code) {
  open = open === code ? null : code;
  rerender(`.row[data-code="${code}"] .row-head`);
}

function reveal(code) {
  open = code;
  if (!order.includes(code)) order = sorted();
  rerender();
  const el = app.querySelector(`.row[data-code="${code}"]`);
  el?.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
  el?.querySelector('.row-head')?.focus({ preventScroll: true });
  flash(code);
}

async function share() {
  const data = { title: '大辩题库', text: '离谱辩题交易所，进来站个队', url: location.href };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(data.url);
    notice = '链接已复制，去群里粘贴吧';
  } catch (e) {
    if (e?.name === 'AbortError') return;
    notice = '没能复制，长按地址栏复制链接吧';
  }
  rerender();
}

app.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const rowEl = t.closest('.row');
  const code = rowEl?.dataset.code;

  if (t.classList.contains('row-head')) return toggle(code);
  if (t.dataset.act === 'vote') {
    if (store.vote(code)) {
      rerender(`.row[data-code="${code}"] [data-act="vote"]`);
      flash(code, 'num');
    }
    return;
  }
  if (t.dataset.act === 'pro' || t.dataset.act === 'con') {
    if (store.pick(code, t.dataset.act)) {
      rerender(`.row[data-code="${code}"] [data-act="${t.dataset.act}"]`);
      flash(code);
    }
    return;
  }
  if (t.dataset.sort) {
    sort = t.dataset.sort;
    order = sorted();
    return rerender(`[data-sort="${sort}"]`);
  }
  if ('rand' in t.dataset) {
    const pool = order.filter((c) => c !== open);
    if (pool.length) reveal(pool[Math.floor(Math.random() * pool.length)]);
    return;
  }
  if (t.dataset.jump) return reveal(t.dataset.jump);
  if ('share' in t.dataset) share();
});

app.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const { topic, who } = f.elements;
  const res = store.submit(topic.value, who.value);
  if (res.error) {
    notice = res.error;
    const keep = { topic: topic.value, who: who.value };
    rerender('#ipo-t');
    app.querySelector('#ipo-t').value = keep.topic;
    app.querySelector('#ipo-w').value = keep.who;
    app.querySelector('.ipo').classList.add('has-error');
    return;
  }
  notice = `递交成功：${res.code} 已上市`;
  sort = 'new';
  order = sorted();
  reveal(res.code);
});

app.addEventListener('animationend', (e) => {
  e.target.classList.remove('flash', 'bump');
});

// the clock and the countdown tick over on the minute
setInterval(() => {
  const c = app.querySelector('[data-clock]');
  if (c) c.textContent = clockText();
  const k = app.querySelector('[data-close]');
  if (k) k.innerHTML = closeText();
}, 30e3);

order = sorted();
open = order[0] || null; // 第一只默认展开，让人一进来就看到怎么站队
render();
