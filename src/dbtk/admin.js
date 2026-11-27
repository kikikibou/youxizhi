/**
 * 大辩题库的后台（/dbtk/admin.html）：站主审核投稿。
 *
 * - 待审：AI 拿不准的、AI 当天额度用完的、没配 AI 时的所有投稿。可以改正反方立场再上市，或者退回并写原因。
 * - 最近处理：AI 和站主判过的投稿。AI 退回的可以改判上市；已上市的可以下市（不再出现在行情里，编号不回收）。
 *
 * 口令就是后端的 ADMIN_TOKEN（npm run secret:admin 设置），只存在这台浏览器的 localStorage 里。
 */
import '@fontsource/doto/latin-700.css';
import '@fontsource/doto/latin-900.css';
import './style.css';
import './admin.css';
import { API } from './config.js';

const KEY = 'dbtk:admin';
const root = document.getElementById('admin');
let token = '';
let data = null;
let error = '';

try {
  token = localStorage.getItem(KEY) || '';
} catch {
  /* no storage: ask every time */
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const p2 = (n) => String(n).padStart(2, '0');
function when(ms) {
  const d = new Date(ms + 8 * 3600e3);
  return `${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

async function api(path, body) {
  const res = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  if (!res) throw new Error('连不上后端，检查一下网络');
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(out.error || '后端出了点问题');
    e.status = res.status;
    throw e;
  }
  return out;
}

const STATUS = { listed: '已上市', rejected: '退回', delisted: '已下市', pending: '待审' };
const BY = { ai: 'AI', admin: '站主' };

function pendingItem(t) {
  return `<li class="desk-item" data-id="${t.id}">
    <p class="desk-title">${esc(t.title)}</p>
    <p class="desk-meta">题库人 <b>${esc(t.who)}</b>　${when(t.created_at)}${t.reason ? `　<em>AI：${esc(t.reason)}</em>` : ''}</p>
    <div class="desk-stance">
      <label>正方<input name="pro" value="${esc(t.pro)}" maxlength="8" placeholder="立场" /></label>
      <label>反方<input name="con" value="${esc(t.con)}" maxlength="8" placeholder="立场" /></label>
    </div>
    <div class="desk-act">
      <button class="list" data-do="list">上市</button>
      <input name="reason" maxlength="40" placeholder="退回原因（投稿人能看到）" />
      <button class="reject" data-do="reject">退回</button>
    </div>
  </li>`;
}

function recentItem(t) {
  const label = STATUS[t.status] || t.status;
  const act =
    t.status === 'listed'
      ? '<button class="reject" data-do="delist">下市</button>'
      : '<button class="list" data-do="list">改判上市</button>';
  return `<li class="desk-item is-${esc(t.status)}" data-id="${t.id}">
    <p class="desk-status"><b>${label}</b>${t.code ? ` <span class="c">${esc(t.code)}</span>` : ''}<span>${BY[t.decided_by] || ''}</span></p>
    <p class="desk-title">${esc(t.title)}</p>
    <p class="desk-meta">题库人 <b>${esc(t.who)}</b>　${when(t.created_at)}${t.status === 'listed' ? `　${t.votes} 票` : ''}${t.reason && t.status !== 'listed' ? `　<em>${esc(t.reason)}</em>` : ''}</p>
    <div class="desk-act">${act}</div>
  </li>`;
}

function render() {
  if (!token) {
    root.innerHTML = `
      <header class="head"><h1 class="led">大辩题库</h1><p class="desk-sub">上市审核</p></header>
      <form class="ipo desk-login">
        <label class="ipo-title" for="tok">后台口令<small>就是后端的 ADMIN_TOKEN</small></label>
        <div class="r"><input id="tok" type="password" autocomplete="current-password" /><button class="go">进入</button></div>
        <p class="note">${esc(error)}</p>
      </form>`;
    root.querySelector('.desk-login').classList.toggle('has-error', !!error);
    return;
  }
  const pending = data?.pending ?? [];
  const recent = data?.recent ?? [];
  const ai = data?.ai;
  root.innerHTML = `
    <header class="head"><h1 class="led">大辩题库</h1><p class="desk-sub">上市审核<button class="desk-out" data-out>退出</button></p></header>
    <p class="note desk-note" role="status" aria-live="polite">${esc(error)}</p>
    ${ai ? `<p class="desk-ai">本月 AI 初筛 <b>${ai.calls}</b> 次，花费 <b>$${ai.cost.toFixed(4)}</b>　今天 ${ai.today} / ${ai.cap} 次<button class="desk-refresh" data-mail>发测试邮件</button></p>` : ''}
    <section class="desk">
      <h2>待审 <b>${pending.length}</b><button class="desk-refresh" data-refresh>刷新</button></h2>
      ${data ? (pending.length ? `<ul>${pending.map(pendingItem).join('')}</ul>` : '<p class="past-note">没有待审的投稿</p>') : '<p class="past-note">正在取……</p>'}
    </section>
    <section class="desk">
      <h2>最近处理</h2>
      ${recent.length ? `<ul>${recent.map(recentItem).join('')}</ul>` : '<p class="past-note">还没有</p>'}
    </section>`;
}

async function refresh() {
  error = '';
  try {
    data = await api('/admin/queue');
  } catch (e) {
    if (e.status === 401) {
      token = '';
      try {
        localStorage.removeItem(KEY);
      } catch {}
    }
    error = e.message;
  }
  render();
}

root.addEventListener('submit', (e) => {
  e.preventDefault();
  token = e.target.querySelector('#tok').value.trim();
  if (!token) return;
  try {
    localStorage.setItem(KEY, token);
  } catch {}
  data = null;
  render();
  refresh();
});

root.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if ('out' in b.dataset) {
    token = '';
    data = null;
    error = '';
    try {
      localStorage.removeItem(KEY);
    } catch {}
    return render();
  }
  if ('refresh' in b.dataset) return refresh();
  if ('mail' in b.dataset) {
    b.disabled = true;
    const note = root.querySelector('.desk-note');
    try {
      const r = await api('/admin/test-email', {});
      note.textContent = r.ok ? `测试邮件已发到 ${r.to}，去收件箱（也看看垃圾箱）找「【大辩题库】测试邮件」` : `没发出去：${r.error}`;
    } catch (err) {
      note.textContent = `没发出去：${err.message}`;
    }
    b.disabled = false;
    return;
  }
  const item = b.closest('.desk-item');
  if (!item || !b.dataset.do) return;
  const field = (n) => item.querySelector(`[name="${n}"]`)?.value;
  const body = { id: Number(item.dataset.id), action: b.dataset.do };
  if (b.dataset.do === 'list' && item.querySelector('[name="pro"]')) Object.assign(body, { pro: field('pro'), con: field('con') });
  if (b.dataset.do === 'reject') body.reason = field('reason') || '';
  b.disabled = true;
  try {
    const r = await api('/admin/decide', body);
    await refresh();
    const note = root.querySelector('.desk-note');
    if (note) note.textContent = b.dataset.do === 'list' ? `已上市：${r.code}` : b.dataset.do === 'reject' ? '已退回' : '已下市';
  } catch (err) {
    error = err.message;
    b.disabled = false;
    render();
  }
});

render();
if (token) refresh();
