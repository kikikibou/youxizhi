/** DOM overlay: nav, per-page poster layouts, footer, drawer. */
import { infinity00 } from './infinity.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderNav(pages, el) {
  el.innerHTML = pages
    .map((p) => `<a href="#/${p.id}" data-nav="${p.id}"><small>${p.no} · ${p.en}</small><span>${esc(p.nav)}</span></a>`)
    .join('');
}

/** Escaped copy in which **words** are set in bold and *words* in italic (see .intro b, .intro em). */
const emph = (s) =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

function cardHtml(c, i) {
  // (a card with a close-up flies there first: see openSpot in app.js)
  const action = c.go ? `data-go="${c.go}"` : c.tool ? `data-tool="${c.tool}"` : c.spot ? `data-spot="${i}"` : c.href ? `data-href="${esc(c.href)}"` : '';
  const ready = c.go || c.ready;
  // (a link to another site: VISIT; a page of this one: PLAY)
  const tag = c.go ? 'ENTER →' : c.href && ready ? (/^https?:/.test(c.href) ? 'VISIT →' : 'PLAY →') : ready ? 'OPEN' : 'SOON';
  return `
    <li class="reveal" style="--d:${6 + i}">
      <button class="card" type="button" ${action} ${ready ? '' : 'disabled'}>
        <span class="card-no">${esc(c.no)}</span>
        <span class="card-main">
          <span class="card-title">${esc(c.title)} <i>${esc(c.en)}</i></span>
          <span class="card-desc">${esc(c.desc)}</span>
        </span>
        <span class="card-tag ${ready ? 'is-ready' : ''}">${tag}</span>
      </button>
    </li>`;
}

/**
 * The other site's emblem, for the stub of a boarding pass: gold rays, wide
 * and narrow in turn, round a gold ring, and in it the black touchstone with
 * a streak of gold rubbed on it (after debatestone.com's first plate).
 */
function emblemSvg() {
  const [cx, cy] = [75, 92];
  const rays = Array.from({ length: 24 }, (_, k) => {
    const a = (k / 24) * Math.PI * 2 + 0.1;
    const h = k % 2 ? 0.025 : 0.06;
    const p = (ang, d) => `${(cx + Math.cos(ang) * d).toFixed(1)},${(cy + Math.sin(ang) * d).toFixed(1)}`;
    return `${p(a - h, 30)} ${p(a + h, 30)} ${p(a + h, 260)} ${p(a - h, 260)}`;
  });
  return `<svg class="pass-emblem" viewBox="0 0 150 250" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
    ${rays.map((r, k) => `<polygon points="${r}" fill="${k % 2 ? '#e8b04b' : '#c8862f'}" opacity="${k % 2 ? 0.55 : 0.8}"/>`).join('')}
    <circle cx="${cx}" cy="${cy}" r="31" fill="#14110d" stroke="#e8b04b" stroke-width="1.6"/>
    <circle cx="${cx}" cy="${cy}" r="27" fill="none" stroke="#e8b04b" stroke-width="0.6" opacity="0.6"/>
    <polygon points="57,89 65,79 86,80 94,90 89,104 64,106 55,98" fill="#2a241e"/>
    <polygon points="65,79 86,80 94,90 80,88 62,87" fill="#40372e"/>
    <path d="M62 99 Q75 94 88 86" stroke="#e8b04b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </svg>`;
}

/**
 * 大国小国's globe (the one turning at the top of its first page,
 * game/client/globe.svg), drawn still: the sea under a graticule, 大 and 小
 * as two countries with a border between them, in a ring of the
 * black-and-white degree scale its map frames have. SVG elements centred on
 * (cx, cy), the ball r across, the ring 8 more; `id` keeps its defs apart
 * from another copy's on the same page.
 */
function atlasGlobe(id, cx, cy, r) {
  const meridians = [0.35, 0.7, 0.92].map((k) => `<ellipse cx="${cx}" cy="${cy}" rx="${(r * k).toFixed(1)}" ry="${r}"/>`).join('');
  const parallels = [-0.62, -0.3, 0.3, 0.62].map((k) => {
    const y = cy + r * k;
    const w = r * Math.sqrt(1 - k * k);
    return `<line x1="${(cx - w).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(cx + w).toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  });
  const scale = 2 * Math.PI * (r + 5);
  const k = r / 36; // (the countries were drawn for a ball 36 across)
  return `
    <defs>
      <radialGradient id="${id}-sea" cx="40%" cy="34%" r="70%"><stop offset="0" stop-color="#e6f0ee"/><stop offset="0.6" stop-color="#d4e3e1"/><stop offset="1" stop-color="#b7cdcc"/></radialGradient>
      <clipPath id="${id}-ball"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r + 8 * k}" fill="none" stroke="#1e1b17" stroke-width="${0.8 * k}"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 5 * k}" fill="none" stroke="#1e1b17" stroke-width="${4 * k}" stroke-dasharray="${((scale * k) / 48).toFixed(2)}"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 2 * k}" fill="none" stroke="#1e1b17" stroke-width="${0.8 * k}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}-sea)"/>
    <g clip-path="url(#${id}-ball)">
      <g fill="none" stroke="#5f8f93" stroke-width="${0.6 * k}" opacity="0.7">${meridians}${parallels.join('')}</g>
      <g font-family="'Noto Sans SC Variable', 'Noto Sans SC', sans-serif" font-weight="900" stroke="#1e1b17" stroke-width="${1.3 * k}" paint-order="stroke" stroke-linejoin="round">
        <text x="${cx - 15 * k}" y="${cy + 13 * k}" font-size="${40 * k}" text-anchor="middle" fill="#efc965" transform="rotate(-8 ${cx - 15 * k} ${cy})">大</text>
        <text x="${cx + 19 * k}" y="${cy + 14 * k}" font-size="${30 * k}" text-anchor="middle" fill="#a9cf8f" transform="rotate(6 ${cx + 19 * k} ${cy})">小</text>
      </g>
      <path d="M${cx + 3 * k} ${cy - r} Q${cx - 2 * k} ${cy - 8 * k} ${cx + 4 * k} ${cy + 4 * k} T${cx + k} ${cy + r}" fill="none" stroke="#1e1b17" stroke-width="${k}" stroke-dasharray="${3 * k} ${2 * k}"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1e1b17" stroke-width="${1.3 * k}"/>`;
}

/** 大国小国's emblem, for the stub of its ride ticket: its globe, small. */
function atlasEmblemSvg() {
  return `<svg class="pass-emblem" viewBox="0 0 150 250" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${atlasGlobe('stub', 75, 74, 36)}</svg>`;
}

/**
 * The cover of 大国小国's folded map (its way in, foldmap.js): map paper in
 * its frame of the degree scale, its globe, its name.
 */
export function foldCoverHtml(c) {
  return `
    <div class="fold-cover">
      <svg class="fold-cover-globe" viewBox="0 0 100 100" aria-hidden="true">${atlasGlobe('cover', 50, 50, 40)}</svg>
      <b>${esc(c.title)}</b>
      <small>${esc(c.en)}</small>
    </div>`;
}

/**
 * A small map of the Three Kingdoms (around 220–230) for 解码与三国知识问答's
 * stub, after the campaign map behind its page (src/sgjm/map.js, the same
 * borders, coast, rivers and colours, fewer points): the realms in soft
 * washes on the land, the sea tinted, the Yellow River and the Yangtze, each
 * realm's name and a vermilion dot at its capital, in a ruled frame.
 * (Degrees straight onto the plane: x = (lon - 101) * cos 31°, y = 41.5 - lat.)
 */
const SANGUO_MAP = (() => {
  const P = ([lon, lat]) => `${((lon - 101) * 0.857).toFixed(2)},${(41.5 - lat).toFixed(2)}`;
  const line = (pts) => pts.map(P).join(' ');
  const WEI_SHU = [[97, 36.6], [100.5, 35.8], [102.5, 35.2], [104.0, 34.3], [105.2, 33.9], [106.3, 33.6], [107.8, 33.5], [109.4, 33.2]];
  const WEI_WU = [[109.4, 33.2], [110.6, 32.6], [111.6, 31.9], [112.6, 31.4], [113.8, 31.2], [115.0, 31.3], [116.3, 31.2], [117.4, 31.35], [118.3, 31.7], [119.2, 32.5], [120.5, 33.5]];
  const SHU_WU = [[109.4, 33.2], [109.8, 32.3], [109.9, 31.2], [109.6, 30.0], [109.0, 28.8], [108.3, 27.2], [107.0, 25.5], [105.5, 24.5], [103.5, 23.5], [101.5, 23.0], [97, 22.6]];
  const COAST = [
    [123.5, 39.95], [122.0, 39.2], [121.3, 38.85], [121.9, 40.2], [121.0, 40.9], [120.4, 40.3], [119.6, 39.9], [118.8, 39.2],
    [117.8, 38.9], [117.7, 38.4], [118.9, 37.6], [119.6, 37.15], [120.4, 37.55], [121.4, 37.6], [122.5, 37.25], [120.8, 36.4],
    [119.3, 35.1], [119.6, 34.5], [120.3, 33.6], [120.8, 32.7], [121.9, 31.7], [121.9, 31.0], [121.3, 30.6], [122.0, 29.6],
    [121.2, 28.2], [120.2, 26.8], [119.2, 25.4], [117.9, 24.2], [116.3, 23.1], [114.3, 22.4], [113.0, 22.0], [111.0, 21.5], [110.4, 21.0],
  ];
  const LAND = [[124, 43], ...COAST, [96, 20], [96, 43]];
  const ISLAND = [[121.0, 25.3], [121.9, 25.0], [121.2, 22.8], [120.8, 21.9], [120.1, 23.6], [120.6, 24.6]];
  const HE = [[100.5, 36.1], [103.8, 36.1], [104.8, 37.0], [105.9, 37.6], [106.8, 39.6], [107.8, 40.5], [110.4, 40.4], [111.1, 39.8], [110.4, 37.3], [110.4, 34.6], [112.5, 34.85], [114.6, 35.3], [116.3, 36.5], [118.2, 37.6], [118.9, 37.65]];
  const JIANG = [[100.5, 26.8], [102.9, 27.0], [103.7, 28.3], [105.5, 28.9], [107.5, 29.9], [108.4, 30.8], [110.4, 30.95], [112.2, 30.3], [113.2, 29.4], [114.3, 30.6], [116.0, 29.8], [117.8, 31.0], [118.8, 32.1], [120.3, 32.0], [121.9, 31.4]];
  const REALMS = [
    ['魏', '63, 95, 143', [97, 45], [[127, 45], [127, 37], ...WEI_WU.slice().reverse(), ...WEI_SHU.slice().reverse()], [113.6, 37.6]],
    ['蜀', '77, 122, 73', null, [...WEI_SHU, ...SHU_WU], [104.3, 29.4]],
    ['吴', '176, 85, 58', null, [...WEI_WU, [127, 37], [127, 18], [97, 18], ...SHU_WU.slice().reverse()], [115.4, 27.0]],
  ];
  const fills = REALMS.map(([, rgb, first, pts]) => `<polygon points="${line(first ? [first, ...pts] : pts)}" fill="rgba(${rgb}, 0.36)"/>`).join('');
  const names = REALMS.map(([n, rgb, , , at]) => {
    const [x, y] = P(at).split(',');
    return `<text x="${x}" y="${y}" fill="rgb(${rgb})">${n}</text>`;
  }).join('');
  const capitals = [[112.45, 34.62], [104.07, 30.67], [118.78, 32.04]].map((c) => {
    const [x, y] = P(c).split(',').map(Number);
    return `<rect x="${(x - 0.32).toFixed(2)}" y="${(y - 0.32).toFixed(2)}" width="0.64" height="0.64"/>`;
  }).join('');
  return `<svg class="pass-map" viewBox="0 0 18 20" aria-hidden="true">
    <defs><clipPath id="pass-map-land"><polygon points="${line(LAND)}"/><polygon points="${line(ISLAND)}"/></clipPath></defs>
    <rect width="18" height="20" fill="rgba(112, 150, 165, 0.28)"/>
    <g clip-path="url(#pass-map-land)"><rect width="18" height="20" fill="#f4ecd8"/>${fills}</g>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="${line(WEI_SHU)}" stroke="rgba(46, 40, 34, 0.45)" stroke-width="0.12" stroke-dasharray="0.45 0.3"/>
      <polyline points="${line(WEI_WU)}" stroke="rgba(46, 40, 34, 0.45)" stroke-width="0.12" stroke-dasharray="0.45 0.3"/>
      <polyline points="${line(SHU_WU)}" stroke="rgba(46, 40, 34, 0.45)" stroke-width="0.12" stroke-dasharray="0.45 0.3"/>
      <polyline points="${line(HE)}" stroke="rgb(196, 160, 98)" stroke-width="0.3"/>
      <polyline points="${line(JIANG)}" stroke="rgb(112, 150, 165)" stroke-width="0.34"/>
      <polyline points="${line(COAST)}" stroke="rgba(46, 40, 34, 0.7)" stroke-width="0.14"/>
      <polygon points="${line(ISLAND)}" stroke="rgba(46, 40, 34, 0.7)" stroke-width="0.14"/>
    </g>
    <g fill="#b5321f">${capitals}</g>
    <g class="pass-map-names">${names}</g>
    <rect x="0.25" y="0.25" width="17.5" height="19.5" fill="none" stroke="rgba(46, 40, 34, 0.75)" stroke-width="0.16"/>
  </svg>`;
})();

/**
 * 解码与三国知识问答's stub: a small hanging scroll (its page's title hangs on
 * one), a map of the Three Kingdoms on the paper and its seal under it.
 */
function sealStubHtml(c, p) {
  return `<div class="pass-emblem pass-scroll" aria-hidden="true">
    <i class="pass-rod"></i>
    <span class="pass-scroll-paper">${SANGUO_MAP}<span class="pass-seal">${esc(p.seal || '')}</span></span>
    <i class="pass-rod"></i>
  </div>`;
}

/** The other site's address as its stub prints it (this site's own pages with their path). */
function hostOf(href) {
  const u = new URL(href, location.href);
  const path = u.pathname.replace(/\/$/, '');
  return u.host + (u.origin === location.origin ? path : '');
}

/**
 * A card's boarding pass (its spot.pass in pages.js), shown where the camera
 * lands at its close-up: the face in this site's paper and ink, the stub in
 * the other site's look (`kind`: 攻错's black and gold by default; 'atlas',
 * 大国小国's map paper and globe; 'seal', 解码与三国知识问答's hanging scroll
 * and seal). `head`, `board` and `mark` (the sign at the end of the route)
 * change its wording for a ride or a pass rather than a flight. The
 * board button is a real link (so it can open in a new tab too); app.js
 * plays the leaving first.
 */
export function passHtml(c) {
  const p = c.spot.pass;
  const board = p.board || '登机';
  return `
    <div class="pass${p.kind ? ` pass--${p.kind}` : ''}" role="dialog" aria-label="${esc(c.title)} · ${esc(p.label || '登机牌')}">
      <div class="pass-main">
        <p class="pass-head"><span>${esc(p.head || 'BOARDING PASS · 登机牌')}</span><span>${esc(p.flight)}</span></p>
        <div class="pass-route">
          <span class="pass-port"><small>FROM</small><b>西柚</b><i>Pamplemousse</i></span>
          <span class="pass-path" data-mark="${esc(p.mark ?? 'H')}" aria-hidden="true"></span>
          <span class="pass-port"><small>TO</small><b>${esc(c.title)}</b><i>${esc(c.en)}</i></span>
        </div>
        <p class="pass-text">${emph(p.text)}</p>
        <dl class="pass-fields">${p.fields.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <div class="pass-actions">
          <a class="pass-board" href="${esc(c.href)}">${esc(board)} <span aria-hidden="true">→</span></a>
          <button class="pass-back" type="button">返回</button>
          <span class="pass-keys" aria-hidden="true">↓ / ESC</span>
        </div>
      </div>
      <div class="pass-stub">
        ${p.kind === 'atlas' ? atlasEmblemSvg() : p.kind === 'seal' ? sealStubHtml(c, p) : emblemSvg()}
        <span class="pass-motto">${esc(p.motto)}</span>
        <small>${esc(hostOf(c.href))}</small>
      </div>
    </div>`;
}

/**
 * On a short screen a page's poem (top right) and its content panel can
 * meet when both sit on the right. Then the panel first gives back some of
 * its gap above the footer (--panel-gap, down to PANEL_GAP_MIN); if that
 * isn't enough it stops below the poem and its sheet scrolls (.panel.is-held
 * in style.css), and only when that would leave it shorter than PANEL_MIN
 * does the poem step aside, so it never covers the panel's copy.
 * A panel never reaches up into the top bar either: past it, it is held too.
 */
const PANEL_GAP_MIN = 23;
const PANEL_MIN = 300;
const TOP_CLEAR = 14; // (px below the top bar)
// (where the panel stands with the strip open: while it is folded the panel
// is moved down by `translate`, perhaps part way, see --fold-drop)
function openRect(panel) {
  const r = panel.getBoundingClientRect();
  const t = getComputedStyle(panel).translate;
  const dy = t === 'none' ? 0 : parseFloat(t.split(' ')[1] || 0);
  return { left: r.left, right: r.right, top: r.top - dy, bottom: r.bottom - dy };
}
function fitPoems() {
  const bar = document.querySelector('.topbar');
  const top = bar ? bar.getBoundingClientRect().bottom + TOP_CLEAR : 0;
  for (const page of document.querySelectorAll('.page')) {
    const poem = page.querySelector('.poem');
    const panel = page.querySelector('.panel');
    if (!poem || !panel) continue;
    page.style.removeProperty('--panel-gap');
    panel.style.removeProperty('max-height');
    panel.classList.remove('is-held', 'is-folded', 'can-fold');
    const a = poem.getBoundingClientRect();
    let b = openRect(panel);
    const side = a.width > 0 && a.left < b.right && b.left < a.right;
    // (a page whose title stands above its panel keeps the panel below it: panelTop in pages.js)
    const title = panel.dataset.top ? parseFloat(panel.dataset.top) * window.innerHeight : 0;
    const open = panel.classList.contains('is-open'); // (the visitor unfolded the intro)
    // First, where the panel would reach past the top bar, the title or a
    // poem beside it, its intro folds after the first paragraph (a 展开
    // link unfolds it, and then it may cover the title).
    if (b.top < Math.max(top, title, side ? a.bottom + 6 : 0) && panel.querySelector('.intro-more')) {
      panel.classList.add('can-fold');
      if (!open) {
        panel.classList.add('is-folded');
        b = openRect(panel);
      }
    }
    const short = a.bottom + 6 - b.top; // (px the panel would have to come down)
    let crowded = false;
    let limit = open ? top : Math.max(top, title); // (the highest the panel's top may stand)
    if (side && short > 0) {
      const gap = parseFloat(getComputedStyle(panel).getPropertyValue('--panel-gap')) || PANEL_GAP_MIN;
      page.style.setProperty('--panel-gap', `${Math.max(PANEL_GAP_MIN, gap - Math.ceil(short))}px`);
      b = openRect(panel);
      if (a.bottom + 6 > b.top) {
        if (b.bottom - (a.bottom + 6) >= PANEL_MIN) limit = Math.max(limit, a.bottom + 6);
        else crowded = true;
      }
    }
    // (a few px over are let be, rather than scrolling a sheet that far)
    if (b.top < limit - 12) {
      panel.style.maxHeight = `${Math.floor(b.bottom - limit)}px`;
      panel.classList.add('is-held');
    }
    page.classList.toggle('is-crowded', crowded);
  }
}
/**
 * A ticket's small lines run together on one line; when that doesn't fit
 * they wrap between items into as few rows as will do, as evenly as they can
 * (4 items: 2 + 2 rather than 3 + 1). A separator where a row ends becomes
 * the break (i.is-break in style.css).
 */
function fitTickets() {
  for (const el of document.querySelectorAll('.ticket-lines')) {
    const items = [...el.querySelectorAll('span')];
    const seps = [...el.querySelectorAll('i')];
    seps.forEach((s) => s.classList.remove('is-break'));
    const room = el.clientWidth + 1;
    const w = items.map((n) => n.getBoundingClientRect().width);
    const sep = seps.length ? seps[0].getBoundingClientRect().width : 0;
    let best = null;
    // (every way of breaking between items: n is at most a handful)
    for (let mask = 0; mask < 1 << seps.length; mask++) {
      let rows = 1, widest = 0, row = w[0];
      for (let k = 1; k < items.length; k++) {
        if (mask & (1 << (k - 1))) {
          widest = Math.max(widest, row);
          rows++;
          row = w[k];
        } else row += sep + w[k];
      }
      widest = Math.max(widest, row);
      const fits = widest <= room;
      // (fitting first; then fewer rows, then the narrowest widest row; when
      // nothing fits, the narrowest)
      const better =
        !best ||
        (fits !== best.fits
          ? fits
          : fits
            ? rows < best.rows || (rows === best.rows && widest < best.widest - 0.5)
            : widest < best.widest - 0.5);
      if (better) best = { mask, fits, rows, widest };
    }
    seps.forEach((s, k) => s.classList.toggle('is-break', !!(best.mask & (1 << k))));
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
        <div class="poem-small reveal" style="--d:3"><span>${esc(p.poemSmall)}</span></div>
      </div>
      <div class="panel"${p.panelTop ? ` data-top="${p.panelTop}"` : ''}>
        ${ticketHtml(p)}
        <div class="sheet reveal" style="--d:4">
          ${introHtml(p.intro)}
          <ul class="cards">${p.cards.map(cardHtml).join('')}</ul>
        </div>
      </div>
    </section>`,
    )
    .join('');
  el.querySelectorAll('.poem, .panel').forEach((n) => panelSizes.observe(n));
  // (the items, for when the fonts arrive; the line itself, for when the
  // room it has changes, e.g. as the stub's digits arrive in their face)
  el.querySelectorAll('.ticket-lines, .ticket-lines span').forEach((n) => ticketSizes.observe(n));
  el.querySelectorAll('.blank').forEach(wireBlank);
  for (const btn of el.querySelectorAll('.intro-toggle')) {
    btn.addEventListener('click', () => {
      btn.closest('.panel').classList.toggle('is-open', 'more' in btn.dataset);
      fitPoems();
    });
  }
}

/**
 * A page's intro, one paragraph each. When the panel is short of room the
 * paragraphs after the first fold away behind a 展开 link at the end of
 * the first, and 收起 at the end of the last folds them again (see fitPoems).
 */
function introHtml(intro) {
  const ps = [].concat(intro);
  const more = ' <button class="intro-toggle" type="button" data-more>展开 ▾</button>';
  const less = ' <button class="intro-toggle" type="button" data-less>收起 ▴</button>';
  return ps
    .map((t, k) => {
      const last = k === ps.length - 1;
      return `<p class="intro${k ? ' intro-more' : ''}">${emph(t)}${k === 0 && !last ? more : ''}${k && last ? less : ''}</p>`;
    })
    .join('');
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
