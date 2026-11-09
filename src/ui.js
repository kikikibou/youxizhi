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
        <div class="brush reveal" style="--d:3">
          <div class="brush-title">${esc(p.label.title)}<em>${esc(p.label.script)}</em>${esc(p.label.title2)}</div>
          <div class="brush-lines">${p.label.lines.map(esc).join('<br>')}</div>
        </div>
        <div class="sheet reveal" style="--d:4">
          <p class="intro">${esc(p.intro)}</p>
          <ul class="cards">${p.cards.map(cardHtml).join('')}</ul>
        </div>
      </div>
    </section>`,
    )
    .join('');
}

export function renderFooter(page, el) {
  const f = page.footer;
  el.innerHTML = `
    <div class="ft-left">
      <div class="ft-title">${esc(f.left.title)}</div>
      <div class="ft-stars">${'★'.repeat(f.left.stars)}${'☆'.repeat(5 - f.left.stars)}</div>
      <div class="ft-lines">${esc(f.left.sub)}<br>${f.left.lines.map(esc).join('<br>')}</div>
    </div>
    <div class="ft-center">
      <div class="ft-script">${esc(f.center.script)}</div>
      <div class="ft-lines">${f.center.lines.map(esc).join('<br>')}</div>
    </div>
    <div class="ft-right">
      <div class="ft-title">${esc(f.right.title)}</div>
      <div class="ft-sub">${esc(f.right.sub)}</div>
      <div class="ft-lines">${f.right.lines.map(esc).join('<br>')}</div>
    </div>`;
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
