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
  const action = c.go ? `data-go="${c.go}"` : c.tool ? `data-tool="${c.tool}"` : '';
  const ready = c.go || c.ready;
  const tag = c.go ? 'ENTER →' : ready ? 'OPEN' : 'SOON';
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
function fitPoems() {
  for (const page of document.querySelectorAll('.page')) {
    const poem = page.querySelector('.poem');
    const panel = page.querySelector('.panel');
    if (!poem || !panel) continue;
    page.style.removeProperty('--panel-gap');
    const a = poem.getBoundingClientRect();
    let b = panel.getBoundingClientRect();
    const side = a.width > 0 && a.left < b.right && b.left < a.right;
    const short = a.bottom + 6 - b.top; // (px the panel would have to come down)
    if (side && short > 0) {
      const gap = parseFloat(getComputedStyle(panel).getPropertyValue('--panel-gap')) || PANEL_GAP_MIN;
      page.style.setProperty('--panel-gap', `${Math.max(PANEL_GAP_MIN, gap - Math.ceil(short))}px`);
      b = panel.getBoundingClientRect();
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
        <div class="poem-eyebrow reveal" style="--d:1">${esc(p.eyebrow)}</div>
        <div class="poem-lines reveal" style="--d:2">${p.poem.map(esc).join('<br>')}</div>
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
}

/** [label, value] pairs, each set as a label over its value. */
const items = (pairs) =>
  `<div class="strip-items">${pairs.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`;

// Great Vibes leaves a word-sized gap after an apostrophe: wrap it so CSS can close it up.
const script = (s) => esc(s).replace(/(’|&#39;)/g, '<i>$1</i>');

// The content panel sits a fixed gap above the footer strip, however tall the
// strip's copy makes it (see .panel in style.css).
let footEl = null;
function measureFoot() {
  const strip = footEl?.querySelector('.strip');
  if (!strip) return;
  const foot = footEl.getBoundingClientRect().bottom - strip.getBoundingClientRect().top;
  document.documentElement.style.setProperty('--foot', `${Math.max(0, Math.ceil(foot))}px`);
  fitPoems(); // (the panels moved)
}
const footSize = new ResizeObserver(measureFoot);

/**
 * Fill the footer strip (its frame and the key hint are static in index.html):
 * left a heading with stars over [label, value] items, centre two lines under
 * the script title on the top edge, right a heading with a badge over items.
 */
export function renderFooter(page, el) {
  const f = page.footer;
  el.querySelector('.strip-script').innerHTML = script(f.center.script);
  el.querySelector('.strip-cells').innerHTML = `
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
  }
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
