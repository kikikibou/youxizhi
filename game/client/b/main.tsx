import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/noto-serif-sc';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/space-mono/latin-400.css';
import './styles.ts';

import { render } from 'preact';
import { App } from './app.tsx';

render(<App />, document.getElementById('app')!);
