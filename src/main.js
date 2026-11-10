import '@fontsource/anton';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/great-vibes';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource-variable/noto-sans-sc';
import './style.css';

import { gate } from './gate.js';
import { paletteById, paletteCss, initialPaletteId } from './palettes.js';

// Page colours for the chosen scheme before anything is shown (the
// passphrase screen too); app.js reuses this element when switching.
const paletteStyle = document.createElement('style');
paletteStyle.id = 'palette-css';
paletteStyle.textContent = paletteCss(paletteById(initialPaletteId()));
document.head.appendChild(paletteStyle);

// The passphrase gate comes first; the 3D app (and three.js) loads only after it.
gate().then(() => import('./app.js'));
