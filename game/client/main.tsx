import '@fontsource/anton';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource-variable/noto-sans-sc';
import './style.css';

import { render } from 'preact';
import { App } from './app.tsx';

render(<App />, document.getElementById('app')!);
