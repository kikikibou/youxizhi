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

// Page colours for the chosen scheme before anything is shown (the
// passphrase screen too); app.js reuses this element when switching.
const paletteStyle = document.createElement('style');
paletteStyle.id = 'palette-css';
paletteStyle.textContent = paletteCss(paletteById(initialPaletteId()));
document.head.appendChild(paletteStyle);

// The passphrase gate comes first; the 3D app (and three.js) loads only after it.
gate().then(() => import('./app.js'));
