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
 * wherever the player has cut "crr" out. The panel steps through the word's
 * other places; for a piece the player cut, it also lists the other words
 * that contain the same letters. The page never cuts a word on its own:
 * finding Crr in Crrupel stays the player's move. The notebook lists every
 * reading (drag to reorder); opening an entry lists and steps through its
 * places too.
 *
 * Answers are checked against hashes (seal.js). A right answer only gets a
 * seal; wrong answers are counted per slot (each different wrong answer
 * once). Once every slot is solved, the report, the answers with their
 * notes, and the dictionary open together at the bottom. Everything stays in
 * this browser; 遗忘答案 clears it for the next player.
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
const smooth = () => (still.matches ? 'auto' : 'smooth');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const state = load();
function load() {
  let s = {};
  try {
    s = JSON.parse(localStorage.getItem(STORE)) ?? {};
  } catch {
    /* start afresh */
  }
  return {
    solved: s.solved ?? {}, // slot → { k: the slot's key, typed: what the player wrote }
    notes: s.notes ?? {}, // spelling → reading
    splits: s.splits ?? {}, // word → letter positions cut at
    open: s.open ?? {}, // set → true when its letter is open
    wrong: s.wrong ?? {}, // slot → the different wrong answers tried (normalized)
    order: s.order ?? [], // the notebook's order
    started: s.started ?? 0, // first letter opened
    finished: s.finished ?? 0, // last slot solved
  };
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
/** slot → the id of its question's first slot (the question's anchor) */
const QUESTION_OF = Object.fromEntries(ROUNDS.flatMap((r) => r.questions.flatMap((q) => q.slots.map((s) => [s.id, q.slots[0].id]))));
const tries = (id) => state.wrong[id]?.length ?? 0;
const wrongTotal = () => SLOT_IDS.reduce((n, id) => n + tries(id), 0);

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
                <span class="progress">已破译 <b id="count">0</b> / ${TOTAL}<small id="wrongCount"></small></span>
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
                  </div>
                </article>`,
                )
                .join('')}
            </div>
          </div></div>
        </section>`,
      ).join('')}

      <section class="appendix" id="dict"></section>
      <p class="reset-row"><button type="button" class="reset forget">遗忘答案，换人再来</button></p>
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
  if (open && animate && !state.started) state.started = Date.now();
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
  if (open) setTimeout(() => sec.scrollIntoView({ behavior: smooth(), block: 'start' }), 420);
  else letter.scrollIntoView({ behavior: smooth(), block: 'nearest' });
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

/** Brings a word into view (above the floating panel or drawer on narrow screens) and makes it pulse. */
function goTo(el) {
  const w = el.closest('.w');
  const r = w.getBoundingClientRect();
  const high = document.body.classList.contains('nb-open') || getComputedStyle(ed).position === 'fixed';
  scrollBy({ top: r.top - innerHeight * (high ? 0.2 : 0.3), behavior: smooth() });
  w.classList.remove('is-pulse');
  void w.offsetWidth;
  w.classList.add('is-pulse');
}

/** Jump buttons, one per place, named by question (·2, ·3 for a second, third time in one question). */
function chipsHtml(els, { here, sub = false, attr = 'data-w' } = {}) {
  const seen = {};
  return els
    .map((el, i) => {
      const w = el.closest('.w');
      const label = w.closest('.q').dataset.label;
      seen[label] = (seen[label] ?? 0) + 1;
      const isHere = w === here;
      const value = attr === 'data-w' ? WORDS.indexOf(w) : i;
      return `<button type="button" class="chip${isHere ? ' is-here' : ''}${sub ? ' is-sub' : ''}" ${attr}="${value}"${isHere ? ' disabled' : ''}>${esc(label)}${seen[label] > 1 ? `·${seen[label]}` : ''}</button>`;
    })
    .join('');
}

const stepperHtml = (at, n) =>
  `<div class="stepper"><button type="button" class="step" data-step="-1" aria-label="上一处">↑ 上一处</button><span>${at >= 0 ? at + 1 : '–'} / ${n}</span><button type="button" class="step" data-step="1" aria-label="下一处">下一处 ↓</button></div>`;
/** The next place to go to from position `at` (-1: none yet) among n, going `step` (±1). */
const stepFrom = (at, step, n) => (at < 0 ? (step > 0 ? 0 : n - 1) : (at + step + n) % n);

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
  scrollBy({ top: r.top - Math.min(innerHeight * 0.25, panelTop * 0.4), behavior: smooth() });
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

const exactWords = (key) => exactTargets(key).map((el) => el.closest('.w'));

/** Where the looked-up spelling occurs (step through, or jump), and for a piece, the words that contain it. */
function renderFind() {
  const { key, piece } = active;
  const exact = exactWords(key);
  let html = `<p class="ed-find-title">「${esc(displayOf(key))}」在打开的题里出现 ${exact.length} 次</p>`;
  if (exact.length > 1 || (exact.length && !exact.includes(editing.w))) html += stepperHtml(exact.indexOf(editing.w), exact.length);
  html += `<div class="chips">${chipsHtml(exact, { here: editing.w })}</div>`;
  if (piece && key.length >= 2) {
    // (grouped by word: Dasi with all its places, then the next word)
    const groups = new Map();
    for (const w of containTargets(key)) groups.set(w.dataset.t, [...(groups.get(w.dataset.t) ?? []), w]);
    html += groups.size
      ? `<p class="ed-find-title">含有「${esc(key)}」的其他词</p>${[...groups]
          .map(([t, words]) => `<div class="find-group"><b>${esc(t)}</b><div class="chips">${chipsHtml(words, { here: editing.w, sub: true })}</div></div>`)
          .join('')}`
      : `<p class="ed-find-title is-none">没有别的词含有「${esc(key)}」</p>`;
  }
  $('edFind').innerHTML = html;
}

/** Moves the panel to another word, keeping the looked-up spelling. */
function jump(w) {
  openEditor(w, true);
  goTo(w);
}

// (the panel handles its own clicks: what was clicked may be redrawn before
// the click reaches the page, which would otherwise read it as a click outside)
ed.addEventListener('click', (e) => {
  e.stopPropagation();
  if (e.target.closest('.ed-x')) return closeEditor();
  const chip = e.target.closest('.chip');
  if (chip) return jump(WORDS[Number(chip.dataset.w)]);
  const step = e.target.closest('.step');
  if (step) {
    const exact = exactWords(active.key);
    if (exact.length) jump(exact[stepFrom(exact.indexOf(editing.w), Number(step.dataset.step), exact.length)]);
    return;
  }
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
  if (v && !state.notes[key]) {
    fresh = key;
    state.order = [...state.order.filter((k) => k !== key), key];
  }
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

let shown = null; // the notebook entry opened to list its places
const cursor = {}; // spelling → index of the place last gone to from the notebook

/** The notebook's entries in the player's order; readings written since come last. */
function orderedKeys() {
  const order = state.order.filter((k) => k in state.notes);
  for (const k of Object.keys(state.notes).sort()) if (!order.includes(k)) order.push(k);
  state.order = order;
  return order;
}

function renderNotebook() {
  const keys = orderedKeys();
  $('nbToggle').textContent = keys.length ? `笔记本 · ${keys.length}` : '笔记本';
  const entry = (k) => {
    const places = exactTargets(k);
    const isOpen = k === shown;
    let more = '';
    if (isOpen) {
      more = places.length
        ? `<div class="nb-more">${stepperHtml(cursor[k] ?? -1, places.length)}<div class="chips">${chipsHtml(places, { attr: 'data-go' })}</div></div>`
        : `<div class="nb-more"><p class="nb-none">打开的题里没有这个词</p></div>`;
    }
    return `<li class="nb-li${isOpen ? ' is-open' : ''}" data-key="${k}">
      <div class="nb-row">
        <span class="nb-grip" title="拖动排序" aria-hidden="true"></span>
        <button type="button" class="nb-item${k === active?.key ? ' is-sel' : ''}${places.length ? '' : ' is-away'}" data-key="${k}" aria-expanded="${isOpen}">
          <b>${esc(displayOf(k))}</b><span>${esc(state.notes[k])}</span><small>${places.length ? `×${places.length}` : '—'}</small>
        </button>
      </div>
      ${more}
    </li>`;
  };
  nb.innerHTML = `
    <div class="nb-head"><h2>笔记本</h2><span class="nb-hint">${keys.length > 1 ? '拖动左侧排序' : ''}</span><button type="button" class="nb-close" aria-label="收起">×</button></div>
    ${
      keys.length
        ? `<ul class="nb-list">${keys.map(entry).join('')}</ul>`
        : `<p class="nb-empty">点题目里任意一个密语词，就能给它贴一张写着你猜测的签条。</p><p class="nb-empty">点字母之间的缝隙，可以把一个词拆成几段，分别注上意思。</p>`
    }`;
}

nb.addEventListener('click', (e) => {
  e.stopPropagation(); // (see the panel's click handler)
  if (e.target.closest('.nb-close')) return document.body.classList.remove('nb-open');
  const step = e.target.closest('.step');
  const chip = e.target.closest('.chip');
  if ((step || chip) && shown) {
    const places = exactTargets(shown);
    if (!places.length) return;
    const i = chip ? Number(chip.dataset.go) : stepFrom(cursor[shown] ?? -1, Number(step.dataset.step), places.length);
    cursor[shown] = i;
    goTo(places[i]);
    return renderNotebook();
  }
  const item = e.target.closest('.nb-item');
  if (!item) return;
  if (editing) closeEditor();
  const k = item.dataset.key;
  if (shown === k) {
    shown = null;
    active = null;
  } else {
    shown = k;
    active = { key: k, piece: isPiece(k) };
  }
  refresh();
  renderNotebook();
});

// Dragging entries by their grip reorders them (mouse; the grip is hidden on touch screens).
let dragKey = null;
const endDrag = () => {
  dragKey = null;
  for (const li of nb.querySelectorAll('.nb-li')) {
    li.draggable = false;
    li.classList.remove('is-drag', 'drop-before', 'drop-after');
  }
};
nb.addEventListener('pointerdown', (e) => {
  const grip = e.target.closest('.nb-grip');
  if (grip) grip.closest('.nb-li').draggable = true;
});
nb.addEventListener('pointerup', () => {
  if (!dragKey) endDrag();
});
nb.addEventListener('dragstart', (e) => {
  const li = e.target.closest('.nb-li');
  if (!li) return;
  dragKey = li.dataset.key;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragKey);
  li.classList.add('is-drag');
});
nb.addEventListener('dragover', (e) => {
  if (!dragKey) return;
  const li = e.target.closest('.nb-li');
  if (!li) return;
  e.preventDefault();
  const after = e.clientY > li.getBoundingClientRect().top + li.offsetHeight / 2;
  for (const other of nb.querySelectorAll('.drop-before, .drop-after')) other.classList.remove('drop-before', 'drop-after');
  if (li.dataset.key !== dragKey) li.classList.add(after ? 'drop-after' : 'drop-before');
});
nb.addEventListener('drop', (e) => {
  if (!dragKey) return;
  e.preventDefault();
  const li = nb.querySelector('.drop-before, .drop-after');
  if (li) {
    const order = orderedKeys().filter((k) => k !== dragKey);
    order.splice(order.indexOf(li.dataset.key) + (li.classList.contains('drop-after') ? 1 : 0), 0, dragKey);
    state.order = order;
    save();
  }
  endDrag();
  renderNotebook();
});
nb.addEventListener('dragend', endDrag);

// ---------------------------------------------------------------- answers

let unlocked = false; // everything solved and the final bundle opened

function triesHtml(id, solved) {
  const n = tries(id);
  if (solved) return `<span class="slot-tries is-done">${n ? `答错 ${n} 次` : '一次答对'}</span>`;
  return `<span class="slot-tries">${n ? `已答错 ${n} 次` : ''}</span>`;
}

function renderSlot(id, isNew = false) {
  const el = $(`slot-${id}`);
  const solved = state.solved[id];
  el.classList.toggle('is-solved', Boolean(solved));
  el.innerHTML = solved
    ? `<span class="slot-label">${esc(el.dataset.label)}</span><span class="slot-answer">${esc(solved.typed)}</span><span class="stamp${isNew ? ' is-new' : ''}">已破译</span>${triesHtml(id, true)}${unlocked ? `<a class="slot-link" href="#ans-${QUESTION_OF[id]}">解析 ↓</a>` : ''}`
    : `<form class="slot-form" data-slot="${id}">
        <label class="slot-label" for="in-${id}">${esc(el.dataset.label)}</label>
        <input id="in-${id}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" />
        <button type="submit">核对</button>
        <span class="slot-msg" aria-live="polite"></span>
        ${triesHtml(id, false)}
      </form>`;
}

function updateCounts(freshId) {
  const solved = (id) => Boolean(state.solved[id]);
  const n = SLOT_IDS.filter(solved).length;
  $('count').textContent = n;
  const m = wrongTotal();
  $('wrongCount').textContent = m ? ` · 答错 ${m} 次` : '';
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

// ---------------------------------------------------------------- the report, the answers, the dictionary

const RANKS = [
  [0, '料事如神'],
  [5, '运筹帷幄'],
  [12, '足智多谋'],
  [25, '愈挫愈勇'],
  [Infinity, '锲而不舍'],
];
const rankOf = (m) => RANKS.find(([max]) => m <= max)[1];

function duration(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} 分钟`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时 ${min % 60} 分`;
  return `${Math.floor(h / 24)} 天 ${h % 24} 小时`;
}
const dateOf = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
};

function reportHtml(isNew) {
  const m = wrongTotal();
  const firstTry = SLOT_IDS.filter((id) => !tries(id)).length;
  const time = state.started && state.finished > state.started ? duration(state.finished - state.started) : '—';
  return `<div class="report${isNew ? ' is-new' : ''}" id="report">
    <div class="report-inner">
      <p class="report-kicker"><span>CASE CLOSED</span><span>捷 报</span></p>
      <div class="report-title">
        <span class="report-big" aria-hidden="true">捷</span>
        <div><h2>全部破译</h2><p>${TOTAL} 格密语，一格不落。</p></div>
      </div>
      <dl class="report-stats">
        <div><dt>用时</dt><dd>${time}</dd></div>
        <div><dt>答错</dt><dd>${m} 次</dd></div>
        <div><dt>一次答对</dt><dd>${firstTry} / ${TOTAL}</dd></div>
      </dl>
      <div class="report-foot">
        <span class="report-rank"><small>评</small>${rankOf(m)}</span>
        <span class="report-date">${state.finished ? `破译于 ${dateOf(state.finished)}` : ''}</span>
      </div>
      <button type="button" class="forget report-forget">遗忘答案，换人再来</button>
    </div>
  </div>`;
}

function noteBody(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) =>
      /^词[：:]/.test(l)
        ? `<p class="note-words"><span class="note-tag">词</span>${wordsHtml(l.slice(2), false)}</p>`
        : `<p>${wordsHtml(l, false)}</p>`,
    )
    .join('');
}

function analysisHtml({ answers, notes }) {
  let html = `<div class="sheet analysis"><div class="sheet-head"><span class="sheet-kicker">ANSWERS</span><h2>题目解析</h2></div>`;
  for (const r of ROUNDS) {
    html += `<h3>${esc(r.name)}</h3>`;
    for (const q of r.questions) {
      html += `<article class="ans" id="ans-${q.slots[0].id}">
        <div class="ans-q"><span class="ans-no">${esc(q.no)}</span><p>${wordsHtml(q.text, false)}</p></div>
        ${q.slots
          .map(
            (s) => `<div class="ans-slot">
              <div class="ans-line">
                ${s.label ? `<span class="ans-label">${esc(s.label)}</span>` : ''}
                <span class="ans-name">${esc(answers[s.id] ?? '')}</span>
                <span class="ans-mine">你的答案：${esc(state.solved[s.id]?.typed ?? '')} · ${tries(s.id) ? `答错 ${tries(s.id)} 次` : '一次答对'}</span>
              </div>
              <div class="ans-note">${noteBody(notes[s.id] ?? '')}</div>
            </div>`,
          )
          .join('')}
      </article>`;
    }
  }
  return `${html}</div>`;
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

function lockedHtml(n) {
  const m = wrongTotal();
  return `<div class="locked">
    <span class="locked-seal" aria-hidden="true">秘</span>
    <p class="locked-title">题目解析与密语词典</p>
    <p>${TOTAL} 格全部破译之后，这里会出现你的破译成绩、每道题的答案与解析，以及完整的密语词典。</p>
    <p class="locked-count">${n} / ${TOTAL}${m ? ` · 答错 ${m} 次` : ''}</p>
  </div>`;
}

/** The answers, notes and dictionary, sealed with every slot's key together. */
async function openFinal() {
  try {
    const key = await dictionaryKeyOf(SLOT_IDS.map((id) => fromB64(state.solved[id].k)));
    return JSON.parse(await openText(key, FINAL));
  } catch {
    return null; // stale progress
  }
}

async function updateProgress(freshId) {
  const done = updateCounts(freshId);
  const final = done ? await openFinal() : null;
  if (!final) {
    unlocked = false;
    $('dict').innerHTML = lockedHtml(SLOT_IDS.filter((id) => state.solved[id]).length);
    return;
  }
  const isNew = Boolean(freshId);
  if (isNew && !state.finished) {
    state.finished = Date.now();
    save();
  }
  unlocked = true;
  $('dict').innerHTML = reportHtml(isNew) + analysisHtml(final) + dictionaryHtml(final.dictionary);
  for (const id of SLOT_IDS) renderSlot(id, id === freshId);
  if (isNew) {
    toast('全部破译！成绩、题目解析和密语词典都在页面最下面。');
    setTimeout(() => $('report').scrollIntoView({ behavior: smooth(), block: 'start' }), 1300);
  }
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
    // (each different wrong answer counts once)
    const tried = (state.wrong[id] ??= []);
    const again = tried.includes(norm);
    if (!again) {
      tried.push(norm);
      save();
    }
    form.classList.remove('is-wrong');
    void form.offsetWidth; // restart the shake
    form.classList.add('is-wrong');
    form.querySelector('.slot-msg').textContent = again ? '这个答案已经试过了' : '不对';
    form.querySelector('.slot-tries').textContent = `已答错 ${tries(id)} 次`;
    updateCounts();
    if (!unlocked) $('dict').innerHTML = lockedHtml(SLOT_IDS.filter((s) => state.solved[s]).length);
    return;
  }
  const key = await open(await wrapKeyOf(id, norm), wrapped);
  state.solved[id] = { k: toB64(key), typed: raw };
  if (!state.started) state.started = Date.now();
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
  if (e.target.closest('.forget')) {
    if (!confirm('遗忘这台设备上的所有答案、错题记录、笔记和拆词，让下一位玩家从头开始？这一步不能撤销。')) return;
    localStorage.removeItem(STORE);
    scrollTo(0, 0);
    location.reload();
    return;
  }
  const w = e.target.closest('.q-text .w');
  if (w) return editing?.w === w ? closeEditor() : openEditor(w);
  const letter = e.target.closest('.letter');
  if (letter) return setOpen(letter.dataset.round, !state.open[letter.dataset.round]);
  const fold = e.target.closest('.fold');
  if (fold) return setOpen(fold.dataset.round, false);
  if (e.target.closest('#nbToggle')) return document.body.classList.toggle('nb-open');
  if (editing) closeEditor();
  else if (active) {
    active = null;
    shown = null;
    refresh();
    renderNotebook();
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
