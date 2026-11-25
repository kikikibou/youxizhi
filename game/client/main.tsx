import '@fontsource/unbounded/latin-700.css';
import '@fontsource/unbounded/latin-900.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import '@fontsource/doto/latin-900.css';
import '@fontsource-variable/noto-sans-sc';
import './style.css';
import './style-layers.css';

import { render } from 'preact';
import { App } from './app.tsx';

render(<App />, document.getElementById('app')!);
