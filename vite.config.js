import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs: the build works at any path (GitHub Pages project
  // sites live under /<repo>/, a custom domain lives at /).
  base: './',
  build: {
    chunkSizeWarningLimit: 900, // three.js alone is ~600 kB
  },
});
