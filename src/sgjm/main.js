/**
 * 解码与三国知识问答 (/sgjm/): a decoder's worksheet over a drifting campaign
 * map (map.js).
 *
 * The two sets of questions start as sealed letters; opening one tears its
 * seal strip and unfolds its sheet. Only open sheets take part in looking up
 * words.
 *
 * Every 密语 word in a question is a button. Clicking one highlights it
 * wherever it occurs in the open sheets and opens the annotation panel: the
 * player writes their reading (shown as a slip of paper pinned above the
 * word), or cuts the word between letters and writes a reading for each
 * piece. Readings are kept by spelling, so a piece "crr" read once shows
 * wherever the player has cut "crr" out. The panel lists the word's other
 * places to jump to; for a piece the player cut, also the other words that
 * contain the same letters. The page never cuts a word on its own: finding
 * Crr in Crrupel stays the player's move.
 *
 * Answers are checked against hashes (seal.js). A right answer only gets a
 * seal; the notes and the dictionary open once every slot is solved.
 * Progress, readings, cuts and open sheets stay in this browser.
 */
import '@fontsource-variable/noto-serif-sc';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './style.css';
import { mountMap } from './map.js';
import { INTRO, ROUNDS, SLOT_IDS } from './questions.js';
import { SLOTS, FINAL } from './answers.generated.js';
import { normalizeAnswer, checkOf, wrapKeyOf, open, openText, toB64, fromB64, dictionaryKeyOf } from './seal.js';

const STORE = 'sgjm:v1';
const TOTAL = SLOT_IDS.length;
const still = matchMedia('(prefers-reduced-motion: reduce)');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const state = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE)) ?? {};
    return { solved: s.solved ?? {}, notes: s.notes ?? {}, splits: s.splits ?? {}, open: s.open ?? {} };
  } catch {
    return { solved: {}, notes: {}, splits: {}, open: {} };
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

const hash = (s) => [...s].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381);
const slotsOf = (r) => r.questions.flatMap((q) => q.slots.map((s) => s.id));
const labelOf = (s) => (s.label ? `${s.label}：` : '答：');

// ---------------------------------------------------------------- the page

document.getElementById('app').innerHTML = `
  <canvas class="map" id="map" aria-hidden="true"></canvas>
  <div class="mist" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="veil" aria-hidden="true"></div>
  <div class="layout">
    <main class="file">
      <a class="back" href="../#/puzzle">← 问答 · 游戏之致西柚</a>
      <header class="scroll">
        <div class="rod"></div>
        <div class="scroll-body" id="scrollBody">
          <div class="scroll-paper">
            <div class="cover-meta"><span>FILE No. SGJM-01</span><span>${esc(INTRO.en.toUpperCase())}</span></div>
            <div class="title-row"><h1>${esc(INTRO.title)}</h1><span class="title-seal" aria-hidden="true">密</span></div>
            <p class="lead">${esc(INTRO.lead)}</p>
            <ul class="rules">${INTRO.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
            <div class="cover-foot">
              <div class="pips">
                ${ROUNDS.map((r) => `<div class="pip-group"><span>${esc(r.name)}</span><span class="pip-row">${slotsOf(r).map((id) => `<i class="pip" data-slot="${id}"></i>`).join('')}</span></div>`).join('')}
              </div>
              <div class="cover-side">
                <span class="progress">已破译 <b id="count">0</b> / ${TOTAL}</span>
                <span class="cover-stamp" id="coverStamp">待破译</span>
              </div>
            </div>
          </div>
        </div>
        <div class="rod" id="rodBottom"></div>
      </header>

      <div class="letters">
        ${ROUNDS.map(
          (r, i) => `
          <button type="button" class="letter" id="letter-${r.id}" data-round="${r.id}" aria-expanded="false" aria-controls="round-${r.id}" style="--i:${i}">
            <span class="letter-top"><span class="letter-kicker">${esc(r.en.toUpperCase())}</span><span>${r.questions.length} 题</span></span>
            <span class="letter-title">${esc(r.name)}</span>
            <span class="letter-blurb">${esc(r.blurb)}</span>
            <span class="band" aria-hidden="true">
              <span class="band-open">已拆封</span>
              <span class="band-half l"><em>密 函</em></span>
              <span class="band-half r"><em>${esc(r.seal)} 號</em></span>
              <span class="band-seal"><b class="l">封</b><b class="r">封</b></span>
            </span>
            <span class="letter-foot"><span>已破译 <b class="letter-count">0</b> / ${slotsOf(r).length}</span><span class="letter-act">拆封 →</span></span>
          </button>`,
        ).join('')}
      </div>

      ${ROUNDS.map(
        (r) => `
        <section class="round" id="round-${r.id}" data-round="${r.id}">
          <div class="sheet-wrap"><div class="sheet-inner">
            <div class="sheet">
              <div class="sheet-head">
                <span class="sheet-kicker">${esc(r.en.toUpperCase())}</span>
                <h2>${esc(r.name)}</h2>
                <button type="button" class="fold" data-round="${r.id}">收起 ↑</button>
              </div>
              ${r.questions
                .map(
                  (q, i) => `
                <article class="q" id="q-${q.slots[0].id}" data-label="${esc(r.short)} ${esc(q.no)}" style="--i:${i}">
                  <div class="q-no"><span>${esc(q.no)}</span></div>
                  <div class="q-body">
                    <p class="q-text">${wordsHtml(q.text, true)}</p>
                    <div class="q-slots">${q.slots.map((s) => `<div class="slot" id="slot-${s.id}" data-label="${esc(labelOf(s))}"></div>`).join('')}</div>
                    <div class="q-notes">${q.slots.map((s) => `<div class="note" id="note-${s.id}" data-label="${esc(s.label ?? '')}" hidden></div>`).join('')}</div>
                  </div>
                </article>`,
                )
                .join('')}
            </div>
          </div></div>
        </section>`,
      ).join('')}

      <section class="appendix" id="dict"></section>
      <p class="reset-row"><button type="button" class="reset" id="reset">清空进度和笔记</button></p>
    </main>
    <aside class="side" id="side">
      <div class="ed" id="ed" hidden></div>
      <div class="nb" id="nb"></div>
    </aside>
  </div>
  <button type="button" class="nb-toggle" id="nbToggle">笔记本</button>
  <div class="toast" id="toast" role="status"></div>`;

const $ = (id) => document.getElementById(id);
const ed = $('ed');
const nb = $('nb');
const WORDS = [...document.querySelectorAll('.q-text .w')];
mountMap($('map'));

// ---------------------------------------------------------------- sealed letters and sheets

const OPEN = '.round.is-open .q-text';

function setOpen(id, open, animate = true) {
  if (open) state.open[id] = true;
  else delete state.open[id];
  save();
  const sec = $(`round-${id}`);
  const letter = $(`letter-${id}`);
  sec.classList.toggle('is-open', open);
  letter.classList.toggle('is-open', open);
  letter.setAttribute('aria-expanded', String(open));
  letter.querySelector('.letter-act').textContent = open ? '收起 ↑' : '拆封 →';
  sec.querySelector('.sheet-wrap').inert = !open;
  if (!open && editing && sec.contains(editing.w)) closeEditor();
  refresh();
  renderNotebook();
  if (!animate) return;
  if (open) setTimeout(() => sec.scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth', block: 'start' }), 420);
  else letter.scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth', block: 'nearest' });
}

// ---------------------------------------------------------------- words, readings, highlights

let editing = null; // { w }: the word in the annotation panel
let active = null; // { key, piece }: the spelling looked up everywhere
let fresh = null; // a reading that was just written for the first time (its slip pops in)

const exactTargets = (key) => [...document.querySelectorAll(`${OPEN} .w[data-k="${key}"], ${OPEN} .seg[data-s="${key}"]`)];
/** Other words containing a piece's letters, uncut (only for pieces the player cut, two letters or more). */
const containTargets = (key) =>
  key.length < 2
    ? []
    : [...document.querySelectorAll(`${OPEN} .w`)].filter(
        (w) => w.dataset.k !== key && w.dataset.k.includes(key) && !w.querySelector(`.seg[data-s="${key}"]`),
      );

function tagHtml(text, key, kind) {
  const tilt = ((hash(key) % 5) - 2) * 1.4;
  return `<span class="tag tag-${kind}${key === fresh ? ' pop' : ''}" style="--r:${tilt}deg"><span>${esc(text)}</span></span>`;
}

/** Letters with the looked-up piece marked wherever it occurs inside them (in open sheets only). */
function marked(text, live) {
  const sub = live && active?.piece && active.key.length >= 2 ? active.key : null;
  if (!sub) return esc(text);
  const low = text.toLowerCase();
  let out = '';
  let from = 0;
  for (let at = low.indexOf(sub); at !== -1; at = low.indexOf(sub, from)) {
    out += `${esc(text.slice(from, at))}<mark class="sub-hit">${esc(text.slice(at, at + sub.length))}</mark>`;
    from = at + sub.length;
  }
  return out + esc(text.slice(from));
}

function renderWord(w) {
  const { t, k } = w.dataset;
  const cuts = state.splits[k];
  const whole = state.notes[k];
  const live = Boolean(w.closest('.round.is-open'));
  let html;
  let pieceTags = false;
  if (cuts) {
    html = segments(t, cuts)
      .map((s) => {
        const read = state.notes[s.key];
        pieceTags ||= Boolean(read);
        return `<span class="seg" data-s="${s.key}" data-txt="${esc(s.text)}">${s.key === active?.key ? esc(s.text) : marked(s.text, live)}${read ? tagHtml(read, s.key, 'piece') : ''}</span>`;
      })
      .join('');
  } else {
    html = k === active?.key ? esc(t) : marked(t, live);
  }
  // (with slips on the pieces above, the whole word's slip hangs below)
  if (whole) html += tagHtml(whole, k, pieceTags ? 'whole below' : 'whole');
  w.innerHTML = html;
}

function refresh() {
  for (const w of WORDS) renderWord(w);
  const hits = new Set(active ? exactTargets(active.key) : []);
  for (const el of document.querySelectorAll('.q-text .w, .q-text .seg')) el.classList.toggle('is-hit', hits.has(el));
  for (const el of nb.querySelectorAll('.nb-item')) el.classList.toggle('is-sel', el.dataset.key === active?.key);
}

/** How a spelling is shown: as it is written in the questions. */
function displayOf(key) {
  const w = document.querySelector(`.q-text .w[data-k="${key}"]`);
  if (w) return w.dataset.t;
  return document.querySelector(`.q-text .seg[data-s="${key}"]`)?.dataset.txt ?? key;
}
const isPiece = (key) => !document.querySelector(`.q-text .w[data-k="${key}"]`);

// ---------------------------------------------------------------- the annotation panel

function openEditor(w, keep = false) {
  editing?.w.classList.remove('is-cur');
  editing = { w };
  w.classList.add('is-cur');
  if (!keep || !active) active = { key: w.dataset.k, piece: false };
  renderEditor();
  ed.hidden = false;
  document.body.classList.add('editing');
  refresh();
  if (!keep) keepAbovePanel(w);
}

/** On narrower screens the panel floats over the page: keep the word in view above it. */
function keepAbovePanel(w) {
  if (getComputedStyle(ed).position !== 'fixed') return;
  const r = w.getBoundingClientRect();
  const panelTop = ed.getBoundingClientRect().top;
  if (r.top > 40 && r.bottom < panelTop - 16) return;
  scrollBy({ top: r.top - Math.min(innerHeight * 0.25, panelTop * 0.4), behavior: still.matches ? 'auto' : 'smooth' });
}

function closeEditor() {
  if (!editing) return;
  editing.w.classList.remove('is-cur');
  editing = null;
  active = null;
  ed.hidden = true;
  document.body.classList.remove('editing');
  refresh();
}

function renderEditor() {
  const { t, k } = editing.w.dataset;
  const cuts = state.splits[k] ?? [];
  const rows = [{ key: k, text: '整词', whole: true }, ...(cuts.length ? segments(t, cuts) : [])];
  ed.innerHTML = `
    <div class="ed-head">
      <span class="ed-title">批注</span>
      <span class="ed-where">${esc(editing.w.closest('.q').dataset.label)}</span>
      <button type="button" class="ed-x" aria-label="关闭">×</button>
    </div>
    <div class="ed-word" id="edWord"></div>
    <div class="ed-rows">
      ${rows
        .map(
          (r) => `<label class="ed-row${r.whole ? ' is-whole' : ''}" data-key="${r.key}" data-piece="${r.whole ? '' : '1'}">
            <span class="ed-key">${esc(r.text)}</span>
            <input data-key="${r.key}" value="${esc(state.notes[r.key] ?? '')}" placeholder="${r.whole ? '你对这个词的解读' : '这一段的意思'}" autocomplete="off" />
          </label>`,
        )
        .join('')}
    </div>
    <div class="ed-find" id="edFind"></div>
    <p class="ed-meta">点字母之间的缝隙可以拆词。拆出来的一段可以单独注释，也能找出含有同样字母的其他词。</p>`;
  renderLetters();
  renderFind();
}

function renderLetters() {
  const { t, k } = editing.w.dataset;
  const cuts = state.splits[k] ?? [];
  const sub = active?.piece ? active.key : null;
  const lit = new Array(t.length).fill(false);
  if (sub) {
    const low = t.toLowerCase();
    for (let at = low.indexOf(sub); at !== -1; at = low.indexOf(sub, at + 1)) lit.fill(true, at, at + sub.length);
  }
  $('edWord').innerHTML = [...t]
    .map(
      (c, i) =>
        (i ? `<button type="button" class="ed-cut${cuts.includes(i) ? ' on' : ''}" data-i="${i}" title="在这里拆开" aria-label="在 ${esc(t.slice(0, i))} 后面拆开"></button>` : '') +
        `<span class="ed-l${lit[i] ? ' is-lit' : ''}">${esc(c)}</span>`,
    )
    .join('');
  for (const row of ed.querySelectorAll('.ed-row')) row.classList.toggle('is-active', row.dataset.key === active?.key);
}

/** Where the looked-up spelling occurs (jump buttons), and for a piece, the words that contain it. */
function renderFind() {
  const { key, piece } = active;
  /** Jump buttons, one per place, named by question (·2, ·3 for a second, third time in one question). */
  const chips = (words, sub = false) => {
    const seen = {};
    return words
      .map((w) => {
        const label = w.closest('.q').dataset.label;
        seen[label] = (seen[label] ?? 0) + 1;
        const here = w === editing.w;
        return `<button type="button" class="chip${here ? ' is-here' : ''}${sub ? ' is-sub' : ''}" data-w="${WORDS.indexOf(w)}"${here ? ' disabled' : ''}>${esc(label)}${seen[label] > 1 ? `·${seen[label]}` : ''}</button>`;
      })
      .join('');
  };
  const exact = exactTargets(key).map((el) => el.closest('.w'));
  let html = `<p class="ed-find-title">「${esc(displayOf(key))}」在打开的题里出现 ${exact.length} 次</p><div class="chips">${chips(exact)}</div>`;
  if (piece && key.length >= 2) {
    // (grouped by word: Dasi with all its places, then the next word)
    const groups = new Map();
    for (const w of containTargets(key)) groups.set(w.dataset.t, [...(groups.get(w.dataset.t) ?? []), w]);
    html += groups.size
      ? `<p class="ed-find-title">含有「${esc(key)}」的其他词</p>${[...groups]
          .map(([t, words]) => `<div class="find-group"><b>${esc(t)}</b><div class="chips">${chips(words, true)}</div></div>`)
          .join('')}`
      : `<p class="ed-find-title is-none">没有别的词含有「${esc(key)}」</p>`;
  }
  $('edFind').innerHTML = html;
}

function jump(w) {
  openEditor(w, true);
  const r = w.getBoundingClientRect();
  scrollBy({ top: r.top - innerHeight * 0.3, behavior: still.matches ? 'auto' : 'smooth' });
  w.classList.remove('is-pulse');
  void w.offsetWidth;
  w.classList.add('is-pulse');
}

ed.addEventListener('click', (e) => {
  if (e.target.closest('.ed-x')) return closeEditor();
  const chip = e.target.closest('.chip');
  if (chip) return jump(WORDS[Number(chip.dataset.w)]);
  const cut = e.target.closest('.ed-cut');
  if (!cut) return;
  const { k } = editing.w.dataset;
  const cuts = new Set(state.splits[k] ?? []);
  const i = Number(cut.dataset.i);
  if (cuts.has(i)) cuts.delete(i);
  else cuts.add(i);
  if (cuts.size) state.splits[k] = [...cuts].sort((a, b) => a - b);
  else delete state.splits[k];
  save();
  // (a piece being looked up that this word no longer has: back to the whole word)
  const pieces = cuts.size ? segments(editing.w.dataset.t, state.splits[k]).map((s) => s.key) : [];
  if (active?.piece && !pieces.includes(active.key)) active = { key: k, piece: false };
  renderEditor();
  refresh();
  renderNotebook();
});

ed.addEventListener('input', (e) => {
  const key = e.target.dataset.key;
  if (!key) return;
  const v = e.target.value.trim();
  if (v && !state.notes[key]) fresh = key;
  if (v) state.notes[key] = v;
  else delete state.notes[key];
  save();
  refresh();
  fresh = null;
  renderNotebook();
});

ed.addEventListener('focusin', (e) => {
  const row = e.target.closest('.ed-row');
  if (!row || row.dataset.key === active?.key) return;
  active = { key: row.dataset.key, piece: row.dataset.piece === '1' };
  renderLetters();
  renderFind();
  refresh();
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
            .map((k) => {
              const n = exactTargets(k).length;
              return `<li><button type="button" class="nb-item${k === active?.key ? ' is-sel' : ''}${n ? '' : ' is-away'}" data-key="${k}">
                <b>${esc(displayOf(k))}</b><span>${esc(state.notes[k])}</span><small>${n ? `×${n}` : '—'}</small>
              </button></li>`;
            })
            .join('')}</ul>`
        : `<p class="nb-empty">点题目里任意一个密语词，就能给它贴一张写着你猜测的签条。</p><p class="nb-empty">点字母之间的缝隙，可以把一个词拆成几段，分别注上意思。</p>`
    }`;
}

// ---------------------------------------------------------------- answers

function renderSlot(id, isNew = false) {
  const el = $(`slot-${id}`);
  const solved = state.solved[id];
  el.classList.toggle('is-solved', Boolean(solved));
  el.innerHTML = solved
    ? `<span class="slot-label">${esc(el.dataset.label)}</span><span class="slot-answer">${esc(solved.typed)}</span><span class="stamp${isNew ? ' is-new' : ''}">已破译</span>`
    : `<form class="slot-form" data-slot="${id}">
        <label class="slot-label" for="in-${id}">${esc(el.dataset.label)}</label>
        <input id="in-${id}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" />
        <button type="submit">核对</button>
        <span class="slot-msg" aria-live="polite"></span>
      </form>`;
}

function updateCounts(freshId) {
  const solved = (id) => Boolean(state.solved[id]);
  const n = SLOT_IDS.filter(solved).length;
  $('count').textContent = n;
  for (const pip of document.querySelectorAll('.pip')) {
    pip.classList.toggle('is-on', solved(pip.dataset.slot));
    if (pip.dataset.slot === freshId) pip.classList.add('is-new');
  }
  for (const r of ROUNDS) $(`letter-${r.id}`).querySelector('.letter-count').textContent = slotsOf(r).filter(solved).length;
  const done = n === TOTAL;
  const stamp = $('coverStamp');
  stamp.textContent = done ? '全部破译' : '待破译';
  stamp.classList.toggle('is-done', done);
  return done;
}

function noteHtml(text, label) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    `<div class="note-head">出题人注${label ? ` · ${esc(label)}` : ''}</div>` +
    lines
      .map((l) =>
        /^词[：:]/.test(l)
          ? `<p class="note-words"><span class="note-tag">词</span>${wordsHtml(l.slice(2), false)}</p>`
          : `<p>${wordsHtml(l, false)}</p>`,
      )
      .join('')
  );
}

function dictionaryHtml(text) {
  let html = `<div class="sheet"><div class="sheet-head"><span class="sheet-kicker">APPENDIX</span><h2>密语词典</h2></div>`;
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
  return `${html}</div>`;
}

/** Once every slot is solved: the notes under each question and the dictionary. */
async function unlockFinal(fresh) {
  try {
    const key = await dictionaryKeyOf(SLOT_IDS.map((id) => fromB64(state.solved[id].k)));
    const { notes, dictionary } = JSON.parse(await openText(key, FINAL));
    for (const id of SLOT_IDS) {
      const el = $(`note-${id}`);
      el.innerHTML = noteHtml(notes[id] ?? '', el.dataset.label);
      el.hidden = false;
      el.classList.toggle('is-new', fresh);
    }
    $('dict').innerHTML = dictionaryHtml(dictionary);
    $('dict').classList.toggle('is-new', fresh);
    if (fresh) toast('全部破译！每道题下面的出题人注和最后的密语词典都已经解锁。');
    return true;
  } catch {
    return false; // stale progress: fall back to the locked sheet
  }
}

function lockedHtml(n) {
  return `<div class="locked">
    <span class="locked-seal" aria-hidden="true">秘</span>
    <p class="locked-title">出题人注与密语词典</p>
    <p>${TOTAL} 格全部破译之后，每道题下面会出现出题人注，这里会出现完整的密语词典。</p>
    <p class="locked-count">${n} / ${TOTAL}</p>
  </div>`;
}

async function updateProgress(freshId) {
  const done = updateCounts(freshId);
  if (done && (await unlockFinal(Boolean(freshId)))) return;
  $('dict').innerHTML = lockedHtml(SLOT_IDS.filter((id) => state.solved[id]).length);
}

let toastTimer = 0;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 5200);
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
  updateProgress(id);
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
  const letter = e.target.closest('.letter');
  if (letter) return setOpen(letter.dataset.round, !state.open[letter.dataset.round]);
  const fold = e.target.closest('.fold');
  if (fold) return setOpen(fold.dataset.round, false);
  const item = e.target.closest('.nb-item');
  if (item) {
    if (editing) closeEditor();
    active = { key: item.dataset.key, piece: isPiece(item.dataset.key) };
    refresh();
    document.body.classList.remove('nb-open');
    const first = exactTargets(active.key)[0];
    if (first) {
      const r = first.getBoundingClientRect();
      scrollBy({ top: r.top - innerHeight * 0.3, behavior: still.matches ? 'auto' : 'smooth' });
    }
    return;
  }
  if (e.target.closest('#nbToggle')) return document.body.classList.toggle('nb-open');
  if (e.target.closest('.nb-close')) return document.body.classList.remove('nb-open');
  if (e.target.closest('#ed, .nb')) return;
  if (editing) closeEditor();
  else if (active) {
    active = null;
    refresh();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return closeEditor();
  const w = e.target.closest?.('.q-text .w');
  if (w && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openEditor(w);
  }
});

$('reset').addEventListener('click', () => {
  if (!confirm('清空所有答题进度、笔记和拆词？这一步不能撤销。')) return;
  localStorage.removeItem(STORE);
  location.reload();
});

// ---------------------------------------------------------------- start

document.body.classList.add('no-anim');
for (const r of ROUNDS) setOpen(r.id, Boolean(state.open[r.id]), false);
for (const id of SLOT_IDS) renderSlot(id);
renderNotebook();
updateProgress();
requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('no-anim')));

// the scroll unrolls
if (!still.matches) {
  const body = $('scrollBody');
  const timing = { duration: 1150, delay: 200, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'backwards' };
  body.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], timing);
  $('rodBottom').animate([{ transform: `translateY(${-body.offsetHeight}px)` }, { transform: 'none' }], timing);
}
