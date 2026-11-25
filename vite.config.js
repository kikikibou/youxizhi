import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs: the build works at any path (GitHub Pages project
  // sites live under /<repo>/, a custom domain lives at /).
  base: './',
  // 《大国小国》's phone page is written with Preact (game/client/*.tsx).
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  build: {
    chunkSizeWarningLimit: 900, // three.js alone is ~600 kB
    rolldownOptions: {
      input: {
        main: 'index.html',
        // 《大国小国》: a standalone phone page at /dgxg/ (no three.js, no passphrase gate)
        dgxg: 'dgxg/index.html',
      },
    },
  },
});
