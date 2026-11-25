/** DOM overlay: nav, per-page poster layouts, footer, drawer. */
import { infinity00 } from './infinity.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderNav(pages, el) {
  el.innerHTML = pages
    .map((p) => `<a href="#/${p.id}" data-nav="${p.id}"><small>${p.no} · ${p.en}</small><span>${esc(p.nav)}</span></a>`)
    .join('');
}

/** Escaped copy in which *words* are set in italic (see .intro em). */
const emph = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

function cardHtml(c, i) {
  const action = c.go ? `data-go="${c.go}"` : c.tool ? `data-tool="${c.tool}"` : c.href ? `data-href="${esc(c.href)}"` : '';
  const ready = c.go || c.ready;
  const tag = c.go ? 'ENTER →' : c.href && ready ? 'PLAY →' : ready ? 'OPEN' : 'SOON';
  return `
    <li class="reveal" style="--d:${6 + i}">
      <button class="card" type="button" ${action} ${ready ? '' : 'disabled'}>
        <span class="card-no">${esc(c.no)}</span>
        <span class="card-main">
          <span class="card-title">${esc(c.title)}<i>${esc(c.en)}</i></span>
          <span class="card-desc">${esc(c.desc)}</span>
        </span>
        <span class="card-tag ${ready ? 'is-ready' : ''}">${tag}</span>
      </button>
    </li>`;
}

/**
 * On a short screen a page's poem (top right) and its content panel can
 * meet when both sit on the right. Then the panel first gives back some of
 * its gap above the footer (--panel-gap, down to PANEL_GAP_MIN), and only if
 * that isn't enough does the poem step aside, so it never covers the panel's copy.
 */
const PANEL_GAP_MIN = 23;
// (where the panel stands with the strip open: while it is folded the panel
// is moved down by `translate`, perhaps part way, see --fold-drop)
function openRect(panel) {
  const r = panel.getBoundingClientRect();
  const t = getComputedStyle(panel).translate;
  const dy = t === 'none' ? 0 : parseFloat(t.split(' ')[1] || 0);
  return { left: r.left, right: r.right, top: r.top - dy, bottom: r.bottom - dy };
}
function fitPoems() {
  for (const page of document.querySelectorAll('.page')) {
    const poem = page.querySelector('.poem');
    const panel = page.querySelector('.panel');
    if (!poem || !panel) continue;
    page.style.removeProperty('--panel-gap');
    const a = poem.getBoundingClientRect();
    let b = openRect(panel);
    const side = a.width > 0 && a.left < b.right && b.left < a.right;
    const short = a.bottom + 6 - b.top; // (px the panel would have to come down)
    if (side && short > 0) {
      const gap = parseFloat(getComputedStyle(panel).getPropertyValue('--panel-gap')) || PANEL_GAP_MIN;
      page.style.setProperty('--panel-gap', `${Math.max(PANEL_GAP_MIN, gap - Math.ceil(short))}px`);
      b = openRect(panel);
    }
    page.classList.toggle('is-crowded', side && a.bottom + 6 > b.top);
  }
}
/** A ticket's small lines run together on one line, or stack when that doesn't fit. */
function fitTickets() {
  for (const el of document.querySelectorAll('.ticket-lines')) {
    el.classList.remove('is-stacked');
    if (el.scrollWidth > el.clientWidth + 1) el.classList.add('is-stacked');
  }
}
const panelSizes = new ResizeObserver(() => fitPoems());
const ticketSizes = new ResizeObserver(() => fitTickets()); // (e.g. when the fonts arrive)
window.addEventListener('resize', () => {
  fitTickets();
  fitPoems();
});

/** 'zh' for copy with Chinese characters in it, else 'en' (the CSS sets each in its own type). */
const lang = (s) => (/[\u3400-\u9fff]/.test(s) ? 'zh' : 'en');

/**
 * The page's ticket: a stub with the page number, a perforation, and the
 * face with the title, an optional subtitle, a script watermark (decoration)
 * and one line of small print. Home's 00 is drawn as an infinity sign (infinity.js).
 */
function ticketHtml(p) {
  const t = p.label;
  return `
        <div class="ticket reveal" style="--d:3">
          <div class="ticket-stub"><b>${p.no === '00' ? infinity00() : esc(p.no)}</b><small>${esc(p.en)}</small></div>
          <div class="ticket-main">
            ${t.mark ? `<span class="ticket-mark" aria-hidden="true">${esc(t.mark)}</span>` : ''}
            <div class="ticket-title"><b>${esc(t.title)}</b>${t.sub ? `<span lang="${lang(t.sub)}">${esc(t.sub)}</span>` : ''}</div>
            <div class="ticket-lines" lang="${lang(t.lines.join(''))}">${t.lines.map((l) => `<span>${esc(l)}</span>`).join('<i> · </i>')}</div>
          </div>
        </div>`;
}

export function renderPages(pages, el) {
  el.innerHTML = pages
    .map(
      (p) => `
    <section class="page" data-page="${p.id}" data-side="${p.side || 'right'}"${p.poemTone ? ` data-poem="${p.poemTone}"` : ''} aria-label="${esc(p.nav)}">
      <div class="poem">
        <div class="poem-eyebrow reveal" style="--d:1">${eyebrowHtml(p.eyebrow)}</div>
        <div class="poem-lines reveal" style="--d:2" lang="${lang(p.poem.join(''))}">${p.poem.map((l) => `<span>${esc(l)}</span>`).join('')}</div>
        <div class="poem-small reveal" style="--d:3">${esc(p.poemSmall)}</div>
      </div>
      <div class="panel">
        ${ticketHtml(p)}
        <div class="sheet reveal" style="--d:4">
          ${[].concat(p.intro).map((t) => `<p class="intro">${emph(t)}</p>`).join('')}
          <ul class="cards">${p.cards.map(cardHtml).join('')}</ul>
        </div>
      </div>
    </section>`,
    )
    .join('');
  el.querySelectorAll('.poem, .panel').forEach((n) => panelSizes.observe(n));
  el.querySelectorAll('.ticket-lines span').forEach((n) => ticketSizes.observe(n));
  el.querySelectorAll('.blank').forEach(wireBlank);
}

/**
 * A poem's eyebrow: words, or a blank to fill in ({ blank: 'Q' }): one
 * letter, "?" until it is typed; the right one lights up (.blank in style.css).
 */
function eyebrowHtml(e) {
  const rule = '<i class="poem-rule"></i>';
  if (typeof e === 'string') return `${rule}<span class="poem-eyebrow-text">${esc(e)}</span>`;
  return `${rule}<label class="blank">
      <input class="blank-input" maxlength="1" placeholder="?" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="填一个字母" data-answer="${esc(e.blank)}">
      <span class="blank-letter" aria-hidden="true">${esc(e.blank)}</span>
    </label>`;
}

function wireBlank(box) {
  const input = box.querySelector('input');
  const answer = input.dataset.answer.toUpperCase();
  let clear = 0;
  const check = () => {
    const v = input.value.trim().slice(-1).toUpperCase();
    if (!v || box.classList.contains('is-solved')) return;
    clearTimeout(clear);
    if (v === answer) {
      input.value = v;
      input.readOnly = true;
      input.tabIndex = -1;
      input.blur();
      input.setAttribute('aria-label', `答对了：${answer}`);
      box.classList.add('is-solved');
      return;
    }
    // Wrong: a shake, and the letter goes again.
    box.classList.remove('is-wrong');
    void box.offsetWidth; // (restarts the animation)
    box.classList.add('is-wrong');
    clear = setTimeout(() => {
      input.value = '';
      box.classList.remove('is-wrong');
    }, 420);
  };
  // (with an input method, only once the letter is committed)
  input.addEventListener('input', (e) => !e.isComposing && check());
  input.addEventListener('compositionend', check);
  input.addEventListener('keydown', (e) => e.key === 'Escape' && input.blur());
}

/** [label, value] pairs, each set as a label over its value. */
const items = (pairs) =>
  `<div class="strip-items">${pairs.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;

// Great Vibes leaves a word-sized gap after an apostrophe: wrap it so CSS can close it up.
const script = (s) => esc(s).replace(/(’|&#39;)/g, '<i>$1</i>');

// The content panel sits a fixed gap above the footer strip, however tall the
// strip's copy makes it (see .panel in style.css). It is measured open; while
// the strip is folded (see the fold below) the panel comes down by the cells'
// height (--fold-drop), so it keeps that gap above the one line left. The
// cells' full height also sets how far they open (--cells-h).
let footEl = null;
function measureFoot() {
  const strip = footEl?.querySelector('.strip');
  if (!strip) return;
  fitFine();
  const cells = strip.querySelector('.strip-cells');
  // (the cells' height when open, from their contents, which keep their
  // places however far the cells are folded; offsets are from .strip, whose
  // top is the cells' top)
  let full = 0;
  for (const cell of cells.children) {
    const pad = parseFloat(getComputedStyle(cell).paddingBottom);
    for (const c of cell.children) full = Math.max(full, c.offsetTop + c.offsetHeight + pad);
  }
  full += parseFloat(getComputedStyle(cells).paddingBottom);
  cells.style.setProperty('--cells-h', `${Math.ceil(full)}px`);
  fold.full = Math.ceil(full);
  dropPanel();
  const foot = footEl.getBoundingClientRect().bottom - strip.getBoundingClientRect().top + (full - cells.clientHeight);
  const value = `${Math.max(0, Math.ceil(foot))}px`;
  if (document.documentElement.style.getPropertyValue('--foot') === value) return;
  document.documentElement.style.setProperty('--foot', value);
  fitPoems(); // (the panels moved)
}
const footSize = new ResizeObserver(measureFoot);
let observedCells = [];

/**
 * The strip is decoration, so it doesn't stay open: it comes in with each
 * page, holds a while, then folds down to its script title on one line
 * (.bottom.is-folded in style.css). Pointing at it opens it again (moving off
 * folds it after a moment); a click, or Enter / Space when it has the focus,
 * pins it open, another folds it. On a touch screen a tap does the same.
 *
 * That is the strip with ?strip=fold in the address. Otherwise it is one line
 * of fine print over a hairline that stays (.bottom.m-fine, see fineHtml).
 */
const FOLD_AFTER = 5000; // ms after a page's strip has come in
const FOLD_OFF = 700; // ms after the pointer moves off it
const FINE = new URLSearchParams(location.search).get('strip') !== 'fold';
const fold = { el: null, timer: 0, pinned: false, inside: false, full: 0 };
function dropPanel() {
  const drop = fold.el?.classList.contains('is-folded') ? fold.full : 0;
  document.documentElement.style.setProperty('--fold-drop', `${drop}px`);
}
function setFolded(folded) {
  if (FINE) return;
  fold.el.classList.toggle('is-folded', folded);
  fold.el.querySelector('.strip').setAttribute('aria-expanded', String(!folded));
  dropPanel();
}
function foldLater(ms) {
  clearTimeout(fold.timer);
  fold.timer = setTimeout(() => {
    if (!fold.pinned && !fold.inside) setFolded(true);
  }, ms);
}
function initFold(el) {
  fold.el = el;
  if (FINE) {
    el.classList.add('m-fine');
    return;
  }
  const strip = el.querySelector('.strip');
  strip.tabIndex = 0;
  strip.setAttribute('role', 'button');
  strip.setAttribute('aria-label', '底栏：展开或收起');
  const open = () => {
    fold.inside = true;
    clearTimeout(fold.timer);
    setFolded(false);
  };
  const off = () => {
    fold.inside = false;
    foldLater(FOLD_OFF);
  };
  const toggle = () => {
    fold.pinned = !fold.pinned;
    clearTimeout(fold.timer);
    setFolded(!fold.pinned);
  };
  strip.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && open());
  strip.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && off());
  strip.addEventListener('focus', () => strip.matches(':focus-visible') && open());
  strip.addEventListener('blur', off);
  strip.addEventListener('click', toggle);
  strip.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggle();
  });
}
/** A page's strip has come in: open (unless pinned, it folds again later). */
function foldArrive() {
  setFolded(false);
  foldLater(FOLD_AFTER);
}

/**
 * The fine print (.fine in style.css): a hairline across the foot with the
 * script title on it about a third of the way along, and the copy standing
 * just above the line on either side of the title (which rises between):
 * the centre's lines run on at the left, the two cells' figures at the
 * right. It never wraps: what doesn't fit is left out, in the order data-fit
 * gives (the right cell's items from its last, its heading, the left cell's
 * items, its heading, last the lines), see fitFine.
 */
function fineHtml(f) {
  const rk = f.right.items.length;
  const lk = f.left.items.length;
  const item = ([k, v], n) => `<div data-fit="${n}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
  return `
    <div class="fine">
      <p class="fine-l" data-fit="${rk + lk + 3}">${f.center.lines.map(esc).join(' ')}</p>
      <div class="fine-r">
        <div class="fine-cell">
          <div class="strip-head" data-fit="${rk + lk + 2}"><b>${esc(f.left.title)}</b><span class="strip-stars" role="img" aria-label="${f.left.stars} / 5">${'★'.repeat(f.left.stars)}<i>${'★'.repeat(5 - f.left.stars)}</i></span></div>
          <div class="strip-items">${f.left.items.map((it, i) => item(it, rk + 1 + lk - i)).join('')}</div>
        </div>
        <div class="fine-cell">
          <div class="strip-head" data-fit="${rk + 1}"><b>${esc(f.right.title)}</b></div>
          <div class="strip-items">${f.right.items.map((it, i) => item(it, rk - i)).join('')}</div>
        </div>
      </div>
      <i class="fine-rule fine-rule--l"></i>
      <span class="fine-mid"><span class="strip-script fine-script">${script(f.center.script)}</span></span>
      <i class="fine-rule fine-rule--r"></i>
    </div>`;
}
function fitFine() {
  const fine = footEl?.querySelector('.fine');
  if (!fine) return;
  const parts = [...fine.querySelectorAll('[data-fit]')].sort((a, b) => a.dataset.fit - b.dataset.fit);
  const cells = [...fine.querySelectorAll('.fine-cell')];
  // (a cell with nothing left in it goes too, with its rule)
  const tidy = () => cells.forEach((c) => (c.hidden = [...c.querySelectorAll('[data-fit]')].every((p) => p.hidden)));
  const right = fine.querySelector('.fine-r');
  const over = () => fine.scrollWidth > fine.clientWidth + 1 || right.scrollWidth > right.clientWidth + 1;
  parts.forEach((p) => (p.hidden = false));
  tidy();
  for (const p of parts) {
    if (!over()) break;
    p.hidden = true;
    tidy();
  }
}

/**
 * Fill the footer strip (its frame and the key hint are static in index.html):
 * left a heading with stars over [label, value] items, centre two lines under
 * the script title on the top edge, right a heading with a badge over items.
 * (Or the fine print's one row, see fineHtml.)
 */
export function renderFooter(page, el) {
  const f = page.footer;
  el.querySelector('.strip-script').innerHTML = script(f.center.script);
  if (FINE) el.querySelector('.strip-cells').innerHTML = fineHtml(f);
  else el.querySelector('.strip-cells').innerHTML = `
    <div class="strip-cell ft-left">
      <div class="strip-head"><b>${esc(f.left.title)}</b><span class="strip-stars" role="img" aria-label="${f.left.stars} / 5">${'★'.repeat(f.left.stars)}<i>${'★'.repeat(5 - f.left.stars)}</i></span></div>
      ${items(f.left.items)}
    </div>
    <div class="strip-cell ft-center">
      <p>${f.center.lines.map(esc).join('<br>')}</p>
    </div>
    <div class="strip-cell ft-right">
      <div class="strip-head"><b>${esc(f.right.title)}</b><span class="strip-badge">${esc(f.right.badge)}</span></div>
      ${items(f.right.items)}
    </div>`;
  if (footEl !== el) {
    footEl = el;
    footSize.observe(el.querySelector('.strip'));
    window.addEventListener('resize', measureFoot);
    initFold(el);
  }
  // (the cells too: clipped while folded, their copy can grow without the strip doing so, e.g. as fonts arrive)
  observedCells.forEach((c) => footSize.unobserve(c));
  observedCells = [...el.querySelectorAll('.strip-cell, .fine')];
  observedCells.forEach((c) => footSize.observe(c));
  fitFine();
  foldArrive();
}

export class Drawer {
  constructor(root) {
    this.root = root;
    this.body = root.querySelector('#drawer-body');
    this.cleanup = null;
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() {
    return this.root.classList.contains('is-open');
  }

  open(mount) {
    this.cleanup?.();
    this.body.innerHTML = '';
    this.cleanup = mount(this.body) || null;
    this.root.classList.add('is-open');
    this.root.setAttribute('aria-hidden', 'false');
  }

  close() {
    this.root.classList.remove('is-open');
    this.root.setAttribute('aria-hidden', 'true');
    this.cleanup?.();
    this.cleanup = null;
  }
}
