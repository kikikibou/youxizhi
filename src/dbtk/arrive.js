import { LED } from '../leddots.js';
import { gridCanvas, nameBoard, NAME_ROWS, paintDots } from '../ledboard.js';

/**
 * 从小镇进来时的开场：小镇的转场（ledveil.js）最后停在一块行情屏上，黑底、暗灯珠、
 * 中间亮着黄色点阵的「大辩题库」，然后跳到这一页（并在 sessionStorage 里留一个
 * youxizhi-arrive 记号）。这一页就从同一块屏开始：同样的网格、同样的灯珠（ledboard.js
 * 按窗口大小排，两边一模一样），然后展开——
 * - 屏从名字的中线往上下两边一行一行地熄掉、让开，熄掉的那一行先闪一下白，露出下面的页面；
 * - 名字缩小、飞到页头，落在「大辩题库」标题的位置上，交接给标题本身。
 * 记号只认一次、只认 20 秒内的；直接打开（群里的链接）没有开场。
 * 减少动态效果：屏直接淡出。
 *
 * index.html 里有一小段内联脚本：看到记号就先给 <html> 加 is-arriving，页面藏起来、
 * 底色是屏的黑，等这里把第一帧画好再露出来，免得先闪一下没开场的页面。
 */

const KEY = 'youxizhi-arrive';
const FLY = [0.12, 0.82]; // 名字飞进页头
const OPEN = [0.2, 0.98]; // 屏从中间往上下让开
const SWAP = [0.72, 0.94]; // 灯珠淡出，页头的标题淡入
const END = 1.02;
const STILL_END = 0.45;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, [a, b]) => clamp01((t - a) / (b - a));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** 是从小镇的转场进来的就画好第一帧并返回 { play(h1) }，否则返回 null。 */
export function arrive() {
  const root = document.documentElement;
  let from = null;
  try {
    from = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    sessionStorage.removeItem(KEY);
  } catch {
    /* 没有存储：不开场 */
  }
  if (from?.kind !== 'led' || !(Date.now() - from.at < 20e3)) {
    root.classList.remove('is-arriving');
    return null;
  }

  const k = Math.min(window.devicePixelRatio || 1, 2);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const b = nameBoard(window.innerWidth, window.innerHeight, k);
  const canvas = document.createElement('canvas');
  canvas.className = 'arrive';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = b.width;
  canvas.height = b.height;
  // （按这一刻的窗口定死大小：之后页面怎么排，屏都和小镇那块对得上）
  canvas.style.width = `${b.width / k}px`;
  canvas.style.height = `${b.height / k}px`;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const grid = gridCanvas(b);

  const from0 = b.name.map((n) => b.at(n.c, n.r)); // 名字在屏上的位置
  const before = b.lines.map((_, j) => b.lines.slice(0, j).reduce((a, l) => a + l.cols, 0)); // 每行前面有几列（手机上「题库」接在「大辩」后面）
  const total = b.lines.reduce((a, l) => a + l.cols, 0);
  const yMid = b.oy + b.mid[1] * b.pitch; // 名字的中线：屏从这里让开

  /** 一行灯珠（屏让开时边上那一行闪白）。 */
  const rowDots = (r) => Array.from({ length: b.cols }, (_, i) => b.at(i, r));

  /** 第 t 秒的样子；box：页头标题在屏上的位置（设备像素）。 */
  function render(t, box) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const p = b.pitch;
    // 屏：从中线往上下，一整行一整行地让开
    const o = ease(span(t, OPEN));
    const reach = Math.max(yMid, canvas.height - yMid) + p;
    const top = Math.max(0, b.oy + Math.floor((yMid - o * reach - b.oy) / p) * p);
    const bot = Math.min(canvas.height, b.oy + Math.ceil((yMid + o * reach - b.oy) / p) * p);
    const open = o > 0 && bot > top;
    if (!open) ctx.drawImage(grid, 0, 0);
    else {
      if (top > 0) ctx.drawImage(grid, 0, 0, canvas.width, top, 0, 0, canvas.width, top);
      if (bot < canvas.height) ctx.drawImage(grid, 0, bot, canvas.width, canvas.height - bot, 0, bot, canvas.width, canvas.height - bot);
      // 边上的两行先闪白再熄：靠边那行亮，再往外一行淡一些
      if (o < 1) {
        const rTop = Math.round((top - b.oy) / p) - 1;
        const rBot = Math.round((bot - b.oy) / p);
        const fade = 1 - span(t, [OPEN[1] - 0.12, OPEN[1]]);
        ctx.globalAlpha = 0.9 * fade;
        paintDots(ctx, b.R, [[LED.white, [...(top > 0 ? rowDots(rTop) : []), ...(bot < canvas.height ? rowDots(rBot) : [])], false]]);
        ctx.globalAlpha = 0.3 * fade;
        paintDots(ctx, b.R, [[LED.white, [...(top > 0 ? rowDots(rTop - 1) : []), ...(bot < canvas.height ? rowDots(rBot + 1) : [])], false]]);
        ctx.globalAlpha = 1;
      }
    }
    // 名字：缩小、飞到页头标题上，再交给标题
    const f = box ? ease(span(t, FLY)) : 0;
    const a = 1 - span(t, SWAP);
    if (a <= 0) return;
    const pts = f === 0 ? from0 : b.name.map((n, j) => {
      const [x0, y0] = from0[j];
      const x1 = box.x + ((before[n.line] + n.i + 0.5) / total) * box.w;
      const y1 = box.y + ((n.row + 0.5) / NAME_ROWS) * box.h;
      return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
    });
    const r = f === 0 ? b.R : b.R + ((box.h / NAME_ROWS) * 0.42 - b.R) * f;
    ctx.globalAlpha = a;
    paintDots(ctx, r, [[LED.yellow, pts, false]]);
    ctx.globalAlpha = 1;
  }

  render(0, null);
  root.classList.remove('is-arriving');

  /** 页头标题的字在屏上的位置（设备像素）。 */
  const measure = (h1) => {
    const range = document.createRange();
    range.selectNodeContents(h1);
    const q = range.getBoundingClientRect();
    return { x: q.left * k, y: q.top * k, w: q.width * k, h: q.height * k };
  };

  return {
    /** 展开；h1：页头的「大辩题库」。结束时把画布拿掉。 */
    play(h1) {
      if (!still) h1.style.opacity = '0';
      const t0 = performance.now();
      const end = still ? STILL_END : END;
      let raf = 0;
      let timer = 0;
      return new Promise((resolve) => {
        const finish = () => {
          cancelAnimationFrame(raf);
          clearTimeout(timer);
          canvas.remove();
          h1.style.opacity = '';
          resolve();
        };
        const tick = (now) => {
          const t = (now - t0) / 1000;
          if (t >= end) return finish();
          if (still) canvas.style.opacity = String(1 - t / end);
          else {
            render(t, measure(h1));
            h1.style.opacity = String(span(t, SWAP));
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        timer = setTimeout(finish, end * 1000 + 400); // （后台标签页没有帧：到点直接收尾）
      });
    },
    /** 停在第 t 秒（开发时看每一帧用）。 */
    seek(t, h1) {
      h1.style.opacity = String(span(t, SWAP));
      render(t, measure(h1));
    },
  };
}
