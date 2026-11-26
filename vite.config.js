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
        // 页面预览器：每个画面并排看（数据来自规则引擎，不连服务器）
        dgxgPreview: 'dgxg/preview.html',
        // 试运行时的旧地址，跳到 /dgxg/
        dgxgB: 'dgxg/b/index.html',
        dgxgBPreview: 'dgxg/b/preview.html',
        // 解码与三国知识问答: a page of its own at /sgjm/ (no three.js, no passphrase gate)
        sgjm: 'sgjm/index.html',
      },
    },
  },
});
