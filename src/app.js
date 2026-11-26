import { PAGES } from './pages.js';
import { World } from './three/World.js';
import { renderNav, renderPages, renderFooter, Drawer, passHtml } from './ui.js';
import { mountTimer } from './tools/timer.js';
import { mountDaily } from './tools/daily.js';
import { PALETTES, paletteById, paletteCss, initialPaletteId } from './palettes.js';
import { PoemInk } from './poemink.js';

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
// The poems' letters drawn again over the 3D frame, so they change colour
// inside the reveal like the 3D titles (poemink.js).
const poemInk = new PoemInk([...stage.querySelectorAll('.page')]);
world.overlays.push(poemInk);

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
  poemInk.setInk(p.ink);
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

// The character in the polaroid icon at the top left is each page's own
// (PAGES[].glyph): on a page change the old one drops out and the new one in.
const glyphEl = $('.brand-box i');
let glyphTimer = 0;
function setGlyph(g, animate) {
  if (!g || !glyphEl) return;
  clearTimeout(glyphTimer);
  const show = () => {
    glyphEl.textContent = g;
    glyphEl.classList.toggle('is-mark', /^[？?！!]$/.test(g)); // (punctuation: set smaller, see style.css)
    glyphEl.classList.remove('is-out');
  };
  if (!animate) return show();
  glyphEl.classList.add('is-out');
  glyphTimer = setTimeout(show, 260);
}

/** Bring a page's content in `delay` ms from now (once the camera is nearly there). */
function showPage(idx, delay) {
  setTimeout(() => {
    if (current !== idx || spot) return;
    const el = pageEls[idx];
    el.classList.add('is-active');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (current === idx && !spot) el.classList.add('is-in');
      }),
    );
    // After the entrance, let the text drop its own compositing layer: layered
    // text loses sub-pixel anti-aliasing on Windows and looks softer.
    setTimeout(() => {
      if (current === idx && !spot) el.classList.add('is-settled');
    }, 1700);
  }, delay);
}

function go(id, mode = 'fly') {
  const idx = ids.indexOf(id);
  if (idx === current) return;
  if (spot) dropSpot(); // (another page chosen from a close-up: fly there instead)
  const prev = current;
  current = idx;
  lastNav = performance.now();

  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === id));
  document.title = `${PAGES[idx].nav} · 游戏之致西柚`;
  setGlyph(PAGES[idx].glyph, prev >= 0);

  if (prev >= 0) {
    const old = pageEls[prev];
    if (old.contains(document.activeElement)) document.activeElement.blur(); // (no typing into a page that's gone)
    old.classList.remove('is-in', 'is-settled');
    setTimeout(() => {
      if (current !== prev) old.classList.remove('is-active');
    }, 550);
  }

  bottom.classList.add('is-swapping');
  setTimeout(() => {
    if (current !== idx || spot) return; // (at a close-up the footer stays away: closeSpot brings it)
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

  showPage(idx, delay);
}

window.addEventListener('hashchange', () => go(currentId()));

/* -------------------------------------------------------------- close-ups */
// A card with a `spot` (pages.js) doesn't leave at once: its page steps
// aside, the camera cranes up to a place on the building, and a boarding
// pass opens there. 返回 (or Esc) flies back down to the page. 登机 tears off
// the stub, drops the camera into the spot and, the screen gone to the other
// site's dark, goes there in this tab (Back returns to the pass).
const spotEl = $('#spot');
const takeoff = $('#takeoff');
let spot = null; // { idx, c, landed } while at a close-up

/** `back`: coming back from the card's site, the camera rises again from the spot. */
function openSpot(idx, c, back = false) {
  spot = { idx, c, landed: false };
  if (back) world.placeAtDive(c.spot);
  const el = pageEls[idx];
  if (el.contains(document.activeElement)) document.activeElement.blur();
  el.classList.remove('is-in', 'is-settled');
  bottom.classList.add('is-swapping');
  document.body.classList.add('is-spot');
  spotEl.innerHTML = passHtml(c);
  spotEl.setAttribute('aria-hidden', 'false');
  world.flyToSpot(c.spot, back ? 2 : undefined).then(() => {
    if (spot?.c !== c || spot.landed) return;
    spot.landed = true;
    spotEl.classList.add('is-open');
  });
}

/** Leave a close-up's pass behind (the camera is about to fly elsewhere). */
function dropSpot() {
  spot = null;
  spotEl.classList.remove('is-open', 'is-boarding');
  spotEl.setAttribute('aria-hidden', 'true');
  if (spotEl.contains(document.activeElement)) document.activeElement.blur();
  document.body.classList.remove('is-spot');
}

/** 返回: fly back down to the page. */
function closeSpot() {
  if (!spot) return;
  const idx = spot.idx;
  dropSpot();
  world.flyTo(idx);
  const delay = world.flight.duration * 1000;
  setTimeout(() => {
    if (current !== idx || spot) return;
    renderFooter(PAGES[idx], bottom);
    bottom.classList.remove('is-swapping');
  }, delay * 0.7);
  showPage(idx, delay * 0.62);
}

/** 登机: tear off the stub, drop into the spot, go dark, leave. */
function board() {
  if (!spot?.landed) return;
  const c = spot.c;
  spot.landed = false;
  spotEl.classList.add('is-boarding');
  takeoff.querySelector('.takeoff-motto').textContent = c.spot.pass.motto;
  // (so that Back, even if it loads this site afresh, comes back to this pass)
  try {
    sessionStorage.setItem(SPOT_KEY, JSON.stringify({ page: ids[spot.idx], card: PAGES[spot.idx].cards.indexOf(c) }));
  } catch {
    /* storage unavailable */
  }
  setTimeout(() => {
    if (spot?.c !== c) return;
    world.dive();
    takeoff.classList.add('is-on');
    setTimeout(() => {
      if (spot?.c === c) location.assign(c.href);
    }, 2100);
  }, 380);
}

spotEl.addEventListener('click', (e) => {
  if (e.target.closest('.pass-back')) closeSpot();
  const boardLink = e.target.closest('.pass-board');
  // (a modified click, e.g. into a new tab, goes the browser's own way)
  if (boardLink && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
    e.preventDefault();
    board();
  }
});
// The current page's own name in the nav (or Esc) also flies back down.
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-nav]');
  if (spot && a && a.dataset.nav === ids[current]) closeSpot();
});
// Back from the other site with this page kept as it was: the camera rises
// back up from the pad and the pass is there again.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  takeBackSpot();
  takeoff.classList.remove('is-on');
  if (!spot) return;
  world.flyToSpot(spot.c.spot, 1.6).then(() => {
    if (!spot) return;
    spot.landed = true;
    spotEl.classList.remove('is-boarding');
    spotEl.classList.add('is-open');
  });
});

// Back from the other site with this one loaded afresh: board() left a note
// of the pass. (Read once; only a Back or Forward to the same page uses it.)
const SPOT_KEY = 'youxizhi-spot';
function takeBackSpot() {
  let s = null;
  try {
    s = JSON.parse(sessionStorage.getItem(SPOT_KEY) || 'null');
    sessionStorage.removeItem(SPOT_KEY);
  } catch {
    /* storage unavailable */
  }
  const how = performance.getEntriesByType?.('navigation')[0]?.type;
  if (!s || how !== 'back_forward' || s.page !== currentId()) return null;
  const c = PAGES[ids.indexOf(s.page)]?.cards[s.card];
  return c?.spot ? c : null;
}

function step(dir) {
  if (drawer.isOpen || spot) return;
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
  if (spot && e.key === 'Escape') return closeSpot();
  if (e.target.closest?.('input, textarea')) return; // (typing, e.g. in a poem's blank)
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
  else if (card.dataset.spot && !spot) openSpot(current, PAGES[current].cards[card.dataset.spot]);
  else if (card.dataset.href) location.href = card.dataset.href;
});

/* ------------------------------------------------------------------- loop */

let last = performance.now();
let lastRaw = last;
let due = 0;
function frame(now) {
  requestAnimationFrame(frame);
  world.trackRaw(now - lastRaw);
  lastRaw = now;
  // Frame-rate cap (see fpsTarget; the debug panel can change it): skip
  // frames until the next one is due.
  const cap = world.fpsTarget;
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
  const back = takeBackSpot();
  if (back) {
    go(currentId(), 'jump');
    openSpot(current, back, true);
  } else go(currentId(), 'intro');
  requestAnimationFrame((t) => {
    last = lastRaw = t;
    frame(t);
    setTimeout(() => loader.classList.add('is-done'), 250);
  });
})();

/* ------------------------------------------------------------- debug panel */
// Frame rate, resolution and quality switches (debug mode, see above). What
// is chosen there is kept on this device (per address) and applies with the
// panel hidden too.
try {
  const saved = JSON.parse(localStorage.getItem('youxizhi-quality') || '{}');
  if (saved && Object.keys(saved).length) world.setQuality(saved);
} catch {
  /* storage unavailable */
}
if (debugOn) import('./debug.js').then((m) => m.mountDebug(world));
