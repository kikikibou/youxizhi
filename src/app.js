import { PAGES } from './pages.js';
import { World } from './three/World.js';
import { renderNav, renderPages, renderFooter, Drawer } from './ui.js';
import { mountTimer } from './tools/timer.js';
import { mountDaily } from './tools/daily.js';
import { PALETTES, paletteById, paletteCss, initialPaletteId } from './palettes.js';

const TOOLS = { timer: mountTimer, daily: mountDaily };
const ids = PAGES.map((p) => p.id);

const $ = (s) => document.querySelector(s);
const nav = $('#nav');
const stage = $('#stage');
const bottom = $('#bottom');
const loader = $('#loader');
const dnBtn = $('#daynight');
const drawer = new Drawer($('#drawer'));

renderNav(PAGES, nav);
renderPages(PAGES, stage);

const world = new World($('#gl'), PAGES);

// Debug mode ("back office"): open the site once with ?debug (?debug=0 turns
// it off again); remembered on this device. Shows the performance panel and
// the colour-scheme switcher.
let debugOn = false;
try {
  const flag = new URLSearchParams(location.search).get('debug');
  if (flag === '0') localStorage.removeItem('youxizhi-debug');
  else if (flag !== null) localStorage.setItem('youxizhi-debug', '1');
  debugOn = !!localStorage.getItem('youxizhi-debug');
} catch {
  /* storage unavailable */
}

/* ---------------------------------------------------------- colour scheme */
// A switcher for comparing colour schemes (palettes.js); the choice is
// remembered on this device. P cycles through them. Visitors only ever see
// the default scheme (西柚): the switcher shows in debug mode only.
// (main.js already applied the page colours before the passphrase screen)
let paletteStyle = document.getElementById('palette-css');
if (!paletteStyle) {
  paletteStyle = document.createElement('style');
  paletteStyle.id = 'palette-css';
  document.head.appendChild(paletteStyle);
}
const palEl = $('#palette');
palEl.hidden = !debugOn;
const palMenu = palEl.querySelector('.pal-menu');
const swatches = (p) => [p.sky.dayTop, p.building, p.accent, p.ink].map((c) => `<i style="background:${c}"></i>`).join('');
palMenu.innerHTML = PALETTES.map(
  (p) => `<button class="pal-item" type="button" role="menuitem" data-pal="${p.id}">
    <span class="pal-sw">${swatches(p)}</span><b>${p.name}<small>${p.en}</small></b><span>${p.note}</span></button>`,
).join('');
function applyPalette(id, persist) {
  const p = paletteById(id);
  paletteStyle.textContent = paletteCss(p);
  world.setPalette(p);
  palEl.querySelector('.pal-dots').innerHTML = swatches(p);
  palEl.querySelector('.pal-name').textContent = p.name;
  palMenu.querySelectorAll('.pal-item').forEach((b) => b.classList.toggle('is-on', b.dataset.pal === p.id));
  if (persist) {
    try {
      localStorage.setItem('youxizhi-palette', p.id);
    } catch {
      /* storage unavailable */
    }
  }
}
applyPalette(initialPaletteId(), false);
const setPalOpen = (open) => {
  palEl.classList.toggle('is-open', open);
  palEl.querySelector('.pal-btn').setAttribute('aria-expanded', String(open));
};
palEl.querySelector('.pal-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  setPalOpen(!palEl.classList.contains('is-open'));
});
palMenu.addEventListener('click', (e) => {
  const item = e.target.closest('.pal-item');
  if (!item) return;
  applyPalette(item.dataset.pal, true);
  setPalOpen(false);
});
document.addEventListener('click', (e) => {
  if (!palEl.contains(e.target)) setPalOpen(false);
});
window.addEventListener('keydown', (e) => {
  if (!debugOn || (e.key !== 'p' && e.key !== 'P')) return;
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  const i = PALETTES.findIndex((p) => p.id === world.palette?.id);
  applyPalette(PALETTES[(i + 1) % PALETTES.length].id, true);
});
// Scrolling or swiping over the menu shouldn't change pages.
for (const ev of ['wheel', 'touchstart', 'touchend']) palEl.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
if (import.meta.env.DEV) {
  // Debug helpers for driving the scene from devtools.
  window.__world = world;
  window.__step = (n = 60) => {
    for (let i = 0; i < n; i++) world.update(1 / 60);
  };
  // Jump straight to a page (no flight) in day or night.
  window.__show = (i, night = false) => {
    world.setNight(night);
    world.night = night ? 1 : 0;
    document.documentElement.dataset.theme = night ? 'night' : 'day';
    world.jumpTo(i);
    pageEls.forEach((p, k) => p.classList.toggle('is-active', k === i));
    pageEls.forEach((p, k) => p.classList.toggle('is-in', k === i));
    window.__step(30);
  };
  // Copy the current frame into an <img> so screenshots of a background tab are accurate.
  window.__snap = async (i = null, night = false, ui = true) => {
    if (i !== null) window.__show(i, night);
    window.__step(1);
    let img = document.getElementById('__dbgimg');
    if (!img) {
      img = document.createElement('img');
      img.id = '__dbgimg';
      Object.assign(img.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', zIndex: 1, pointerEvents: 'none' });
      document.body.appendChild(img);
    }
    img.src = world.canvas.toDataURL('image/png');
    await new Promise((r) => (img.onload = r));
    const uiEl = document.querySelector('.ui');
    uiEl.style.zIndex = ui ? 3 : 0;
    uiEl.style.visibility = ui ? '' : 'hidden';
    loader.style.display = 'none';
  };
}

/* -------------------------------------------------------------- day/night */

// Day or night follows the visitor's own clock (day from 06:00 to 19:00).
// The toggle overrides it, but only until the clock next changes over
// (the next 06:00 or 19:00); then it follows the clock again. While the
// page is open it switches by itself at those times.
const root = document.documentElement;
const DAY_FROM = 6;
const NIGHT_FROM = 19;
const clockSaysNight = (d = new Date()) => d.getHours() >= NIGHT_FROM || d.getHours() < DAY_FROM;
/** The next 06:00 or 19:00 after `d` (ms). */
function nextChange(d = new Date()) {
  const n = new Date(d);
  n.setMinutes(0, 0, 0);
  for (let i = 0; i < 25; i++) {
    n.setHours(n.getHours() + 1);
    if (n.getHours() === DAY_FROM || n.getHours() === NIGHT_FROM) return n.getTime();
  }
  return d.getTime() + 12 * 3600e3;
}
function readOverride() {
  try {
    const o = JSON.parse(localStorage.getItem('theme-override') || 'null');
    if (o && Date.now() < o.until) return o.night;
    localStorage.removeItem('theme-override');
  } catch {
    /* storage unavailable */
  }
  return null;
}
function applyTheme(night) {
  root.dataset.theme = night ? 'night' : 'day';
  dnBtn.querySelector('.dn-label').textContent = night ? 'NIGHT' : 'DAY';
  world.setNight(night);
}
const wantedNight = () => readOverride() ?? clockSaysNight();
try {
  localStorage.removeItem('theme'); // the old "forever" choice
} catch {
  /* storage unavailable */
}
applyTheme(wantedNight());
world.night = world.nightTarget;
dnBtn.addEventListener('click', () => {
  const night = root.dataset.theme !== 'night';
  applyTheme(night);
  try {
    localStorage.setItem('theme-override', JSON.stringify({ night, until: nextChange() }));
  } catch {
    /* storage unavailable */
  }
});
// Check once a minute (and on coming back to the tab) whether the clock has
// changed over.
const followClock = () => {
  const night = wantedNight();
  if ((root.dataset.theme === 'night') !== night) applyTheme(night);
};
setInterval(followClock, 60e3);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) followClock();
});

/* ----------------------------------------------------------------- router */

let current = -1;
let lastNav = 0;
const pageEls = [...stage.querySelectorAll('.page')];

function currentId() {
  const id = location.hash.replace(/^#\/?/, '');
  return ids.includes(id) ? id : 'home';
}

function go(id, mode = 'fly') {
  const idx = ids.indexOf(id);
  if (idx === current) return;
  const prev = current;
  current = idx;
  lastNav = performance.now();

  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === id));
  document.title = `${PAGES[idx].nav} · 游戏之西柚`;

  if (prev >= 0) {
    const old = pageEls[prev];
    old.classList.remove('is-in', 'is-settled');
    setTimeout(() => {
      if (current !== prev) old.classList.remove('is-active');
    }, 550);
  }

  bottom.classList.add('is-swapping');
  setTimeout(() => {
    if (current !== idx) return;
    renderFooter(PAGES[idx], bottom);
    bottom.classList.remove('is-swapping');
  }, mode === 'jump' ? 0 : 900);

  let delay = 0;
  if (mode === 'jump') world.jumpTo(idx);
  else if (mode === 'intro') {
    world.intro(idx);
    delay = world.flight.duration * 1000 * 0.6;
  } else {
    world.flyTo(idx);
    delay = world.flight.duration * 1000 * 0.62;
  }

  setTimeout(() => {
    if (current !== idx) return;
    const el = pageEls[idx];
    el.classList.add('is-active');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    // After the entrance, let the text drop its own compositing layer: layered
    // text loses sub-pixel anti-aliasing on Windows and looks softer.
    setTimeout(() => {
      if (current === idx) el.classList.add('is-settled');
    }, 1700);
  }, delay);
}

window.addEventListener('hashchange', () => go(currentId()));

function step(dir) {
  if (drawer.isOpen) return;
  if (performance.now() - lastNav < 1400) return;
  const next = (current + dir + ids.length) % ids.length;
  location.hash = `#/${ids[next]}`;
}

window.addEventListener(
  'wheel',
  (e) => {
    if (drawer.isOpen || e.target.closest('.sheet, .drawer')) return;
    if (Math.abs(e.deltaY) < 24) return;
    step(e.deltaY > 0 ? 1 : -1);
  },
  { passive: true },
);

window.addEventListener('keydown', (e) => {
  if (drawer.isOpen) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
});

// Touch swipe on phones.
let touchX = null;
window.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
window.addEventListener(
  'touchend',
  (e) => {
    if (touchX === null || e.target.closest('.sheet, .drawer')) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
    touchX = null;
  },
  { passive: true },
);

window.addEventListener('pointermove', (e) => {
  world.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
});

stage.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card || card.disabled) return;
  if (card.dataset.go) location.hash = `#/${card.dataset.go}`;
  else if (card.dataset.tool && TOOLS[card.dataset.tool]) drawer.open(TOOLS[card.dataset.tool]);
});

/* ------------------------------------------------------------------- loop */

let last = performance.now();
let lastRaw = last;
let due = 0;
function frame(now) {
  requestAnimationFrame(frame);
  world.trackRaw(now - lastRaw);
  lastRaw = now;
  // Optional frame-rate cap (debug panel): skip frames until the next one is due.
  const cap = world.quality.fpsCap;
  if (cap) {
    if (now < due - 3) return;
    due = Math.max(due + 1000 / cap, now);
  }
  world.trackFrame(now - last);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.update(dt);
}

(async () => {
  await world.buildTypography();
  world.warmUp();
  go(currentId(), 'intro');
  requestAnimationFrame((t) => {
    last = lastRaw = t;
    frame(t);
    setTimeout(() => loader.classList.add('is-done'), 250);
  });
})();

/* ------------------------------------------------------------- debug panel */
// Frame rate, resolution and quality switches (debug mode, see above).
if (debugOn) import('./debug.js').then((m) => m.mountDebug(world));
