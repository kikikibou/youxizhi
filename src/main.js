import '@fontsource/anton';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/great-vibes';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource-variable/noto-sans-sc';
import latinDot from '@fontsource/oswald/files/oswald-latin-500-normal.woff2?url';
import antonExtra from './fonts/anton-extra.woff2?url';
import fatface from './fonts/loader/fatface.woff2?url';
import blackletter from './fonts/loader/blackletter.woff2?url';
import neon from './fonts/loader/neon.woff2?url';
import mono from './fonts/loader/mono.woff2?url';
import inscription from './fonts/loader/inscription.woff2?url';
import rounded from './fonts/loader/rounded.woff2?url';
import shade from './fonts/loader/shade.woff2?url';
import './style.css';

import { gate } from './gate.js';
import { paletteById, paletteCss, initialPaletteId } from './palettes.js';

// The Chinese fonts set the middle dot (·) a full em wide, which leaves wide
// gaps round it in Chinese copy; 'Latin Dot' (first in --cn, style.css) sets
// just that character from Oswald, at its ordinary width.
document.fonts.add(new FontFace('Latin Dot', `url(${latinDot}) format('woff2')`, { unicodeRange: 'U+00B7', weight: '100 900' }));
// What Anton lacks for the 3D lettering, drawn from Anton itself: Greek
// capitals and the side arrows (see scripts/anton-extra.py; FONTS.display).
document.fonts.add(new FontFace('Anton Extra', `url(${antonExtra}) format('woff2')`, { unicodeRange: 'U+0391-03A9, U+2190, U+2192', weight: '400' }));

/**
 * While the street loads, the loading word (PAMPLEMOUSSE) runs through faces
 * the site doesn't otherwise use, each in a spirit of its own (only its
 * letters: scripts/loader-faces.py), and settles on the site's own Anton when
 * the street is ready, or while the passphrase is asked. (scale: evens out
 * how wide they set the word, about as wide as Space Mono's; a face joins
 * once its file has loaded)
 */
const LOADER_FACES = [
  { family: 'Loader Fatface', url: fatface, scale: 0.93 },
  { family: 'Loader Neon', url: neon, scale: 0.76 },
  { family: 'Loader Blackletter', url: blackletter, scale: 0.76 },
  { family: 'Loader Mono', url: mono, scale: 1 },
  { family: 'Loader Inscription', url: inscription, scale: 0.85 },
  { family: 'Loader Shade', url: shade, scale: 0.76 },
  { family: 'Loader Rounded', url: rounded, scale: 0.96 },
];
const LOADER_STEP = 260; // ms per face
function loaderFaces() {
  const loader = document.getElementById('loader');
  const word = loader?.querySelector('.loader-word');
  if (!word || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const f of LOADER_FACES) {
    new FontFace(f.family, `url(${f.url}) format('woff2')`)
      .load()
      .then((face) => {
        document.fonts.add(face);
        f.ready = true;
      })
      .catch(() => {});
  }
  const show = (f) => {
    word.style.fontFamily = f ? `"${f.family}", var(--display)` : '';
    word.style.setProperty('--face', f ? f.scale : 1);
  };
  let k = 0;
  const timer = setInterval(() => {
    if (loader.classList.contains('is-done')) {
      show(null);
      clearInterval(timer);
    } else if (loader.classList.contains('is-gated')) show(null);
    else {
      // (the next face in turn that has loaded)
      for (let i = 0; i < LOADER_FACES.length; i++) {
        const f = LOADER_FACES[k++ % LOADER_FACES.length];
        if (f.ready) return show(f);
      }
    }
  }, LOADER_STEP);
}
loaderFaces();

// Page colours for the chosen scheme before anything is shown (the
// passphrase screen too); app.js reuses this element when switching.
const paletteStyle = document.createElement('style');
paletteStyle.id = 'palette-css';
paletteStyle.textContent = paletteCss(paletteById(initialPaletteId()));
document.head.appendChild(paletteStyle);

// The passphrase gate comes first; the 3D app (and three.js) loads only after it.
gate().then(() => import('./app.js'));
