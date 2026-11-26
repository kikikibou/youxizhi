/**
 * 解码与三国知识问答 (/sgjm/): a decoder's worksheet.
 *
 * Every 密语 word in a question is a button. Clicking one highlights it
 * wherever it occurs (both parts) and opens a small editor: the player writes
 * their reading of the word, or cuts it between letters and writes a reading
 * for each piece. Readings are kept by spelling, so a piece "crr" read once
 * shows wherever the player has cut "crr" out. Highlights only ever match
 * whole words or pieces the player cut themselves: the page never splits a
 * word for them (finding Crr in Crrupel is part of the puzzle).
 *
 * Answers are checked against hashes (seal.js); a right answer unlocks that
 * slot's note, and all of them together the dictionary. Progress, readings
 * and cuts stay in this browser (localStorage).
 */
import '@fontsource-variable/noto-serif-sc';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './style.css';
import { INTRO, ROUNDS, SLOT_IDS } from './questions.js';
import { SLOTS, DICTIONARY } from './answers.generated.js';
import { normalizeAnswer, checkOf, wrapKeyOf, open, openText, toB64, fromB64, dictionaryKeyOf } from './seal.js';

const STORE = 'sgjm:v1';
const TOTAL = SLOT_IDS.length;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const state = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE)) ?? {};
    return { solved: s.solved ?? {}, notes: s.notes ?? {}, splits: s.splits ?? {} };
  } catch {
    return { solved: {}, notes: {}, splits: {} };
  }
}
const save = () => localStorage.setItem(STORE, JSON.stringify(state));

/** A word cut at the given letter positions: [{ text, key }]. */
function segments(t, cuts) {
  const out = [];
  let from = 0;
  for (const at of [...cuts, t.length]) {
    out.push({ text: t.slice(from, at), key: t.slice(from, at).toLowerCase() });
    from = at;
  }
  return out;
}

/** Text with every run of Latin letters set as a 密语 word (a button in questions, plain type elsewhere). */
function wordsHtml(text, live) {
  return text
    .split(/([A-Za-z]+)/)
    .map((part, i) => {
      if (i % 2 === 0) return esc(part);
      return live
        ? `<span class="w" role="button" tabindex="0" data-k="${part.toLowerCase()}" data-t="${part}"></span>`
        : `<span class="w-static">${esc(part)}</span>`;
    })
    .join('');
}

// ---------------------------------------------------------------- the page

const labelOf = (s) => (s.label ? `${s.label}：` : '答：');

document.getElementById('app').innerHTML = `
  <div class="layout">
    <main class="file">
      <a class="back" href="../#/puzzle">← 问答 · 游戏之致西柚</a>
      <header class="sheet cover">
        <div class="cover-meta"><span>FILE No. SGJM-01</span><span>${esc(INTRO.en.toUpperCase())}</span></div>
        <h1>${esc(INTRO.title)}</h1>
        <p class="lead">${esc(INTRO.lead)}</p>
        <ul class="rules">${INTRO.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        <div class="cover-foot">
          <span class="progress">已破译 <b id="count">0</b> / ${TOTAL}</span>
          <span class="cover-stamp" id="coverStamp">待破译</span>
        </div>
      </header>
      ${ROUNDS.map(
        (r) => `
        <section class="sheet round" id="round-${r.id}">
          <div class="round-tab"><span>${esc(r.en.toUpperCase())}</span>${esc(r.name)}</div>
          ${r.questions
            .map(
              (q) => `
            <article class="q" id="q-${q.slots[0].id}">
              <div class="q-no">${esc(q.no)}</div>
              <div class="q-body">
                <p class="q-text">${wordsHtml(q.text, true)}</p>
                <div class="q-slots">${q.slots.map((s) => `<div class="slot" id="slot-${s.id}" data-label="${esc(labelOf(s))}"></div>`).join('')}</div>
                <div class="q-notes">${q.slots.map((s) => `<div class="note" id="note-${s.id}" data-label="${esc(s.label ?? '')}" hidden></div>`).join('')}</div>
              </div>
            </article>`,
            )
            .join('')}
        </section>`,
      ).join('')}
      <section class="sheet dict" id="dict"></section>
      <p class="reset-row"><button type="button" class="reset" id="reset">清空进度和笔记</button></p>
    </main>
    <aside class="nb" id="nb" aria-label="笔记本"></aside>
  </div>
  <button type="button" class="nb-toggle" id="nbToggle">笔记本</button>
  <div class="ed" id="ed" hidden></div>`;

const $ = (id) => document.getElementById(id);
const ed = $('ed');
const nb = $('nb');

// ---------------------------------------------------------------- words, readings, highlights

let hit = null; // the spelling highlighted everywhere
let editing = null; // { w, t, k }: the word whose editor is open

const occurrences = (key) => document.querySelectorAll(`.q-text .w[data-k="${key}"], .q-text .seg[data-s="${key}"]`);

function renderWord(w) {
  const { t, k } = w.dataset;
  const cuts = state.splits[k];
  const segs = cuts ? segments(t, cuts) : null;
  const segRead = segs?.some((s) => state.notes[s.key]);
  const ruby = (text, gloss) => (gloss ? `<ruby>${esc(text)}<rt>${esc(gloss)}</rt></ruby>` : esc(text));
  const inner = segs
    ? segs.map((s) => `<span class="seg" data-s="${s.key}" data-txt="${esc(s.text)}">${segRead ? ruby(s.text, state.notes[s.key]) : esc(s.text)}</span>`).join('')
    : esc(t);
  const whole = state.notes[k];
  w.innerHTML = !segRead && whole ? `<ruby>${inner}<rt>${esc(whole)}</rt></ruby>` : inner;
  w.classList.toggle('has-note', Boolean(whole || segRead));
}

function renderWords() {
  for (const w of document.querySelectorAll('.q-text .w')) renderWord(w);
  highlight(hit);
}

function highlight(key) {
  hit = key;
  for (const el of document.querySelectorAll('.is-hit')) el.classList.remove('is-hit');
  if (key) for (const el of occurrences(key)) el.classList.add('is-hit');
  for (const el of nb.querySelectorAll('.nb-item')) el.classList.toggle('is-sel', el.dataset.key === key);
}

/** How a spelling is shown in the notebook: as it is written in the questions. */
function displayOf(key) {
  const w = document.querySelector(`.q-text .w[data-k="${key}"]`);
  if (w) return w.dataset.t;
  return document.querySelector(`.q-text .seg[data-s="${key}"]`)?.dataset.txt ?? key;
}

// ---------------------------------------------------------------- the editor

const fine = matchMedia('(pointer: fine)');

function openEditor(w) {
  closeEditor();
  editing = { w, t: w.dataset.t, k: w.dataset.k };
  w.classList.add('is-cur');
  renderEditor();
  ed.hidden = false;
  placeEditor();
  highlight(editing.k);
  if (fine.matches) ed.querySelector('input')?.focus({ preventScroll: true });
}

function renderEditor() {
  const { t, k } = editing;
  const cuts = state.splits[k] ?? [];
  const letters = [...t]
    .map(
      (c, i) =>
        (i ? `<button type="button" class="ed-cut${cuts.includes(i) ? ' on' : ''}" data-i="${i}" title="在这里拆开" aria-label="在 ${esc(t.slice(0, i))} 后面拆开"></button>` : '') +
        `<span class="ed-l">${esc(c)}</span>`,
    )
    .join('');
  const rows = [{ text: '整词', key: k, whole: true }, ...(cuts.length ? segments(t, cuts) : [])];
  ed.innerHTML = `
    <button type="button" class="ed-x" aria-label="关闭">×</button>
    <div class="ed-word">${letters}</div>
    <div class="ed-rows">
      ${rows
        .map(
          (r) => `<label class="ed-row${r.whole ? ' is-whole' : ''}">
            <span class="ed-key">${esc(r.text)}</span>
            <input data-key="${r.key}" value="${esc(state.notes[r.key] ?? '')}" placeholder="${r.whole ? '你对这个词的解读' : '这一段的意思'}" autocomplete="off" />
          </label>`,
        )
        .join('')}
    </div>
    <p class="ed-meta">在题目里出现 ${occurrences(k).length} 次 · 点字母之间的缝隙，可以把词拆开</p>`;
}

function placeEditor() {
  const sheet = innerWidth < 700;
  ed.classList.toggle('is-sheet', sheet);
  const r = editing.w.getBoundingClientRect();
  if (sheet) {
    ed.style.left = ed.style.top = '';
    // keep the word above the sheet
    const room = innerHeight - ed.offsetHeight - 16;
    if (r.bottom > room) scrollBy({ top: r.bottom - room, behavior: 'smooth' });
    return;
  }
  ed.style.left = `${Math.max(scrollX + 12, Math.min(r.left + scrollX - 12, scrollX + innerWidth - ed.offsetWidth - 12))}px`;
  ed.style.top = `${r.bottom + scrollY + 10}px`;
}

function closeEditor() {
  if (!editing) return;
  editing.w.classList.remove('is-cur');
  editing = null;
  ed.hidden = true;
  highlight(null);
}

ed.addEventListener('click', (e) => {
  if (e.target.closest('.ed-x')) return closeEditor();
  const cut = e.target.closest('.ed-cut');
  if (!cut) return;
  const { k } = editing;
  const cuts = new Set(state.splits[k] ?? []);
  const i = Number(cut.dataset.i);
  if (cuts.has(i)) cuts.delete(i);
  else cuts.add(i);
  if (cuts.size) state.splits[k] = [...cuts].sort((a, b) => a - b);
  else delete state.splits[k];
  save();
  renderWords();
  renderEditor();
  renderNotebook();
  placeEditor();
});

ed.addEventListener('input', (e) => {
  const key = e.target.dataset.key;
  if (!key) return;
  const v = e.target.value.trim();
  if (v) state.notes[key] = v;
  else delete state.notes[key];
  save();
  renderWords();
  renderNotebook();
});

ed.addEventListener('focusin', (e) => {
  if (e.target.dataset.key) highlight(e.target.dataset.key);
});

// ---------------------------------------------------------------- the notebook

function renderNotebook() {
  const keys = Object.keys(state.notes).sort();
  $('nbToggle').textContent = keys.length ? `笔记本 · ${keys.length}` : '笔记本';
  nb.innerHTML = `
    <div class="nb-head"><h2>笔记本</h2><button type="button" class="nb-close" aria-label="收起">×</button></div>
    ${
      keys.length
        ? `<ul class="nb-list">${keys
            .map(
              (k) => `<li><button type="button" class="nb-item${k === hit ? ' is-sel' : ''}" data-key="${k}">
                <b>${esc(displayOf(k))}</b><span>${esc(state.notes[k])}</span><small>×${occurrences(k).length}</small>
              </button></li>`,
            )
            .join('')}</ul>`
        : `<p class="nb-empty">点题目里任意一个密语词，就能在它上面写下你的猜测。</p><p class="nb-empty">点字母之间的缝隙，可以把一个词拆成几段，分别注上意思。</p>`
    }`;
}

// ---------------------------------------------------------------- answers

function renderSlot(id, fresh = false) {
  const el = $(`slot-${id}`);
  const label = el.dataset.label;
  const solved = state.solved[id];
  el.classList.toggle('is-solved', Boolean(solved));
  el.innerHTML = solved
    ? `<span class="slot-label">${esc(label)}</span><span class="slot-answer">${esc(solved.typed)}</span><span class="stamp${fresh ? ' is-new' : ''}">已破译</span>`
    : `<form class="slot-form" data-slot="${id}">
        <label class="slot-label" for="in-${id}">${esc(label)}</label>
        <input id="in-${id}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" />
        <button type="submit">核对</button>
        <span class="slot-msg" aria-live="polite"></span>
      </form>`;
}

async function showNote(id, key) {
  const text = await openText(key, SLOTS[id].note);
  const el = $(`note-${id}`);
  const label = el.dataset.label;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  el.innerHTML =
    `<div class="note-head">出题人注${label ? ` · ${esc(label)}` : ''}</div>` +
    lines
      .map((l) =>
        /^词[：:]/.test(l)
          ? `<p class="note-words"><span class="note-tag">词</span>${wordsHtml(l.slice(2), false)}</p>`
          : `<p>${wordsHtml(l, false)}</p>`,
      )
      .join('');
  el.hidden = false;
}

async function updateProgress() {
  const n = SLOT_IDS.filter((id) => state.solved[id]).length;
  $('count').textContent = n;
  const done = n === TOTAL;
  const stamp = $('coverStamp');
  stamp.textContent = done ? '全部破译' : '待破译';
  stamp.classList.toggle('is-done', done);
  if (done) {
    try {
      const key = await dictionaryKeyOf(SLOT_IDS.map((id) => fromB64(state.solved[id].k)));
      return showDictionary(await openText(key, DICTIONARY));
    } catch {
      /* stale progress: fall through to the locked sheet */
    }
  }
  $('dict').innerHTML = `
    <div class="round-tab"><span>APPENDIX</span>附录</div>
    <div class="dict-lock">
      <p class="dict-lock-title">密语词典</p>
      <p>${TOTAL} 格全部破译之后，这里会出现完整的密语词典。</p>
      <p class="dict-lock-count">${n} / ${TOTAL}</p>
    </div>`;
}

function showDictionary(text) {
  let html = `<div class="round-tab"><span>APPENDIX</span>附录</div><h2 class="dict-title">密语词典</h2>`;
  let rows = [];
  const flush = () => {
    if (rows.length) html += `<dl class="dict-rows">${rows.join('')}</dl>`;
    rows = [];
  };
  for (const l of text.split('\n').map((s) => s.trim()).filter(Boolean)) {
    if (l.startsWith('## ')) {
      flush();
      html += `<h3>${esc(l.slice(3))}</h3>`;
    } else if (l.includes(' = ')) {
      const [a, ...b] = l.split(' = ');
      const value = b.join(' = ');
      // (long readings, like the affixes with their examples, take the whole width)
      rows.push(`<div${value.length > 16 ? ' class="is-long"' : ''}><dt>${wordsHtml(a, false)}</dt><dd>${wordsHtml(value, false)}</dd></div>`);
    } else {
      flush();
      html += `<p>${wordsHtml(l, false)}</p>`;
    }
  }
  flush();
  $('dict').innerHTML = html;
}

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('.slot-form');
  if (!form) return;
  e.preventDefault();
  const id = form.dataset.slot;
  const input = form.querySelector('input');
  const raw = input.value.trim();
  const norm = normalizeAnswer(raw);
  if (!norm) return input.focus();
  const wrapped = SLOTS[id]?.checks[await checkOf(id, norm)];
  if (!wrapped) {
    form.classList.remove('is-wrong');
    void form.offsetWidth; // restart the shake
    form.classList.add('is-wrong');
    form.querySelector('.slot-msg').textContent = '不对';
    return;
  }
  const key = await open(await wrapKeyOf(id, norm), wrapped);
  state.solved[id] = { k: toB64(key), typed: raw };
  save();
  renderSlot(id, true);
  await showNote(id, key);
  updateProgress();
});

document.addEventListener('input', (e) => {
  const form = e.target.closest?.('.slot-form');
  if (form) {
    form.classList.remove('is-wrong');
    form.querySelector('.slot-msg').textContent = '';
  }
});

// ---------------------------------------------------------------- clicks and keys

document.addEventListener('click', (e) => {
  const w = e.target.closest('.q-text .w');
  if (w) return editing?.w === w ? closeEditor() : openEditor(w);
  const item = e.target.closest('.nb-item');
  if (item) {
    closeEditor();
    highlight(item.dataset.key);
    document.body.classList.remove('nb-open');
    occurrences(item.dataset.key)[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (e.target.closest('#nbToggle')) return document.body.classList.toggle('nb-open');
  if (e.target.closest('.nb-close')) return document.body.classList.remove('nb-open');
  if (editing && !e.target.closest('#ed')) closeEditor();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return closeEditor();
  const w = e.target.closest?.('.q-text .w');
  if (w && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openEditor(w);
  }
});

addEventListener('resize', () => editing && placeEditor());

$('reset').addEventListener('click', () => {
  if (!confirm('清空所有答题进度和笔记？这一步不能撤销。')) return;
  localStorage.removeItem(STORE);
  location.reload();
});

// ---------------------------------------------------------------- start

renderWords();
renderNotebook();
for (const id of SLOT_IDS) renderSlot(id);
for (const id of SLOT_IDS) {
  if (!state.solved[id]) continue;
  try {
    await showNote(id, fromB64(state.solved[id].k));
  } catch {
    // the answer changed since this was solved
    delete state.solved[id];
    renderSlot(id);
    save();
  }
}
updateProgress();
