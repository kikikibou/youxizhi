/** DOM overlay: nav, per-page poster layouts, footer, drawer. */

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderNav(pages, el) {
  el.innerHTML = pages
    .map((p) => `<a href="#/${p.id}" data-nav="${p.id}"><small>${p.no} · ${p.en}</small><span>${esc(p.nav)}</span></a>`)
    .join('');
}

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
 * meet when both sit on the right: then the poem steps aside, so it never
 * covers the panel's copy.
 */
function fitPoems() {
  for (const page of document.querySelectorAll('.page')) {
    const poem = page.querySelector('.poem');
    const panel = page.querySelector('.panel');
    if (!poem || !panel) continue;
    const a = poem.getBoundingClientRect();
    const b = panel.getBoundingClientRect();
    const meet = a.width > 0 && a.left < b.right && b.left < a.right && a.bottom + 6 > b.top;
    page.classList.toggle('is-crowded', meet);
  }
}
const panelSizes = new ResizeObserver(() => fitPoems());
window.addEventListener('resize', fitPoems);

export function renderPages(pages, el) {
  el.innerHTML = pages
    .map(
      (p) => `
    <section class="page" data-page="${p.id}" data-side="${p.side || 'right'}" aria-label="${esc(p.nav)}">
      <div class="poem">
        <div class="poem-eyebrow reveal" style="--d:1">${esc(p.eyebrow)}</div>
        <div class="poem-lines reveal" style="--d:2">${p.poem.map(esc).join('<br>')}</div>
        <div class="poem-small reveal" style="--d:3">${esc(p.poemSmall)}</div>
      </div>
      <div class="panel">
        <div class="brush reveal${p.label.compact ? ' is-compact' : ''}" style="--d:3">
          <div class="brush-title">${esc(p.label.title)}<em>${esc(p.label.script)}</em>${esc(p.label.title2)}</div>
          <div class="brush-lines">${p.label.lines.map(esc).join(p.label.compact ? ' · ' : '<br>')}</div>
        </div>
        <div class="sheet reveal" style="--d:4">
          ${[].concat(p.intro).map((t) => `<p class="intro">${esc(t)}</p>`).join('')}
          <ul class="cards">${p.cards.map(cardHtml).join('')}</ul>
        </div>
      </div>
    </section>`,
    )
    .join('');
  el.querySelectorAll('.poem, .panel').forEach((n) => panelSizes.observe(n));
}

/**
 * Footer lines: plain strings, or [name, value] rows, set as a table with
 * dotted leaders ('table') or as "name: value" ('pairs').
 */
function footLines(lines, rowStyle, lead = '') {
  if (!lines.some(Array.isArray)) {
    return `<div class="ft-lines">${[lead, ...lines].filter(Boolean).map(esc).join('<br>')}</div>`;
  }
  const row = (l) => {
    if (!Array.isArray(l)) return `<div class="ft-row">${esc(l)}</div>`;
    const [k, v] = l;
    return rowStyle === 'table'
      ? `<div class="ft-row"><span>${esc(k)}</span><i></i><b>${esc(v)}</b></div>`
      : `<div class="ft-row"><span>${esc(k)}:</span> ${esc(v)}</div>`;
  };
  const head = lead ? `<div class="ft-row">${esc(lead)}</div>` : '';
  return `<div class="ft-lines ft-${rowStyle}">${head}${lines.map(row).join('')}</div>`;
}

// The content panel sits just above the footer column on its side, however
// tall that column's copy makes it (see .panel in style.css).
const footSizes = new ResizeObserver((entries) => {
  for (const e of entries) {
    const side = e.target.classList.contains('ft-left') ? 'left' : 'right';
    document.documentElement.style.setProperty(`--foot-${side}`, `${Math.ceil(e.target.offsetHeight)}px`);
  }
  fitPoems(); // (the panels moved)
});

export function renderFooter(page, el) {
  const f = page.footer;
  el.innerHTML = `
    <div class="ft-left">
      <div class="ft-title">${esc(f.left.title)}</div>
      <div class="ft-stars">${'★'.repeat(f.left.stars)}${'☆'.repeat(5 - f.left.stars)}</div>
      ${footLines(f.left.lines, 'table', f.left.sub)}
    </div>
    <div class="ft-center">
      <div class="ft-script">${esc(f.center.script)}</div>
      ${footLines(f.center.lines, 'pairs')}
    </div>
    <div class="ft-right">
      <div class="ft-title">${esc(f.right.title)}</div>
      <div class="ft-sub">${esc(f.right.sub)}</div>
      ${footLines(f.right.lines, 'pairs')}
    </div>`;
  footSizes.disconnect();
  el.querySelectorAll('.ft-left, .ft-right').forEach((c) => footSizes.observe(c));
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
