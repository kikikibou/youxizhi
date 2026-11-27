/**
 * 「搬给群友」的分享图：把主窗口里的那只辩题画成一张 1080 × 1440 的行情屏截图。
 * 黑底暗灯珠、点阵的「大辩题库」、辩题正文、题库人、正反方立场、票数，右下角一个二维码，
 * 扫码直接打开这一只（链接带 #DB 编号）。
 *
 * 辩题、题库人、立场是用户写的字，用系统字体画；固定文案用 DBTK Round，数字用 Doto。
 */
import { encode } from 'uqr';

const W = 1080;
const H = 1440;
const C = {
  screen: '#070807',
  off: '#1a1e1b',
  red: '#ff3b30',
  green: '#33d17a',
  yellow: '#ffcc33',
  white: '#f1eedf',
  dim: '#9a978a',
  who: '#d2cdbb',
  frame: 'rgba(255, 204, 51, 0.7)',
};
const SYS = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
const ROUND = '"DBTK Round", ' + SYS;
const DOT = 'Doto, ui-monospace, monospace';

function dots(ctx, pitch, r, color) {
  const p = document.createElement('canvas');
  p.width = p.height = pitch;
  const g = p.getContext('2d');
  g.fillStyle = color;
  g.beginPath();
  g.arc(pitch / 2, pitch / 2, r, 0, Math.PI * 2);
  g.fill();
  return ctx.createPattern(p, 'repeat');
}

/** 点阵字：先把字画在一张透明画布上，再只留下灯珠的位置。 */
function ledText(text, font, color, pitch = 7) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 8;
  const h = Math.ceil(parseInt(font.match(/(\d+)px/)[1], 10) * 1.25);
  c.width = w;
  c.height = h;
  g.font = font;
  g.textBaseline = 'top';
  g.fillStyle = color;
  g.fillText(text, 4, 2);
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = dots(g, pitch, pitch * 0.4, '#000');
  g.fillRect(0, 0, w, h);
  return c;
}

/** 不放在行首的字：标点和斜杠（「先捞手机/先提裤子」不要折成「/先提裤子」开头）。 */
const NO_START = new Set('，。、；：？！）」』》〉…—,.;:?!)/／');

/** 按宽度折行（逐字），返回行数组。 */
function wrap(ctx, text, width) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > width && line && !NO_START.has(ch)) {
      lines.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

function qr(ctx, text, x, y, size) {
  const { data, size: n } = encode(text, { ecc: 'M', border: 2 });
  const cell = size / n;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = C.screen;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (data[r][c]) ctx.fillRect(Math.floor(x + c * cell), Math.floor(y + r * cell), Math.ceil(cell), Math.ceil(cell));
}

/**
 * 画分享图。topic：主窗口里那只股；url：扫码打开的地址。
 * 返回 PNG 的 Blob。
 */
export async function drawCard(topic, url) {
  await Promise.all([
    document.fonts.load(`112px "DBTK Round"`),
    document.fonts.load('900 96px Doto'),
    document.fonts.load('700 40px Doto'),
  ]).catch(() => {});

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  // 屏幕：底色、暗灯珠、LED 模块缝
  ctx.fillStyle = C.screen;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = dots(ctx, 12, 2.4, C.off);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  for (let x = 270; x < W; x += 270) ctx.fillRect(x - 1, 0, 2, H);
  for (let y = 288; y < H; y += 288) ctx.fillRect(0, y - 1, W, 2);

  // 快讯条
  ctx.fillStyle = 'rgba(255, 204, 51, 0.06)';
  ctx.fillRect(0, 0, W, 76);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 76, W, 4);
  ctx.textBaseline = 'middle';
  ctx.font = `40px ${ROUND}`;
  ctx.fillStyle = C.white;
  ctx.fillText('快讯', 48, 40);
  ctx.font = `700 34px ${SYS}`;
  ctx.fillStyle = C.yellow;
  ctx.fillText('群友推荐了一道大辩题，扫码来站队', 148, 41);

  // 点阵标题和编号
  const title = ledText('大辩题库', `112px ${ROUND}`, C.yellow);
  ctx.drawImage(title, 44, 116);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.font = `900 52px ${DOT}`;
  ctx.fillStyle = C.white;
  ctx.fillText(topic.code, W - 52, 178);
  ctx.font = `700 28px ${SYS}`;
  ctx.fillStyle = C.dim;
  ctx.fillText('yxzzxy.com/dbtk', W - 52, 226);
  ctx.textAlign = 'left';

  // 主框
  const fx = 48;
  const fy = 290;
  const fw = W - 96;
  ctx.fillStyle = 'rgba(255, 204, 51, 0.05)';
  ctx.fillRect(fx, fy, fw, 790);
  ctx.strokeStyle = C.frame;
  ctx.lineWidth = 3;
  ctx.strokeRect(fx, fy, fw, 790);

  // 辩题正文：放不下就缩字号
  let size = 66;
  let lines;
  for (;;) {
    ctx.font = `800 ${size}px ${SYS}`;
    lines = wrap(ctx, topic.title, fw - 96);
    if (lines.length <= 5 || size <= 44) break;
    size -= 4;
  }
  lines = lines.slice(0, 6);
  const lh = Math.round(size * 1.38);
  ctx.fillStyle = C.white;
  let y = fy + 60 + size;
  for (const l of lines) {
    ctx.fillText(l, fx + 48, y);
    y += lh;
  }
  y += 6;
  ctx.font = `600 34px ${SYS}`;
  ctx.fillStyle = C.dim;
  ctx.fillText('题库人', fx + 48, y);
  ctx.fillStyle = C.who;
  ctx.fillText(topic.who, fx + 48 + ctx.measureText('题库人 ').width, y);

  // 正反方立场
  const by = fy + 790 - 300;
  const bw = (fw - 96 - 24) / 2;
  const stance = (x, color, side, text) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, by, bw, 110);
    ctx.fillStyle = C.screen;
    ctx.font = `44px ${ROUND}`;
    ctx.fillText(side, x + 28, by + 52);
    ctx.font = `700 30px ${SYS}`;
    let t = text;
    while (t.length > 1 && ctx.measureText(t).width > bw - 56) t = t.slice(0, -1);
    ctx.fillText(t === text ? t : t.slice(0, -1) + '…', x + 28, by + 92);
  };
  stance(fx + 48, C.red, '看正', topic.pro ? `${topic.pro} 一方有利` : '正方有利');
  stance(fx + 48 + bw + 24, C.green, '看反', topic.con ? `${topic.con} 一方有利` : '反方有利');

  // 票数（增长一律黄色）
  ctx.font = `900 104px ${DOT}`;
  ctx.fillStyle = C.yellow;
  const votes = String(topic.votes);
  ctx.fillText(votes, fx + 44, fy + 790 - 50);
  const vw = ctx.measureText(votes).width;
  ctx.font = `44px ${ROUND}`;
  ctx.fillStyle = C.white;
  ctx.fillText('票', fx + 60 + vw, fy + 790 - 54);
  if (topic.monthVotes) {
    ctx.font = `700 30px ${SYS}`;
    ctx.fillStyle = C.dim;
    ctx.textAlign = 'right';
    ctx.fillText(`本月 +${topic.monthVotes}`, fx + fw - 48, fy + 790 - 58);
    ctx.textAlign = 'left';
  }

  // 底部：口号和二维码
  const qs = 260;
  qr(ctx, url, W - 48 - qs, H - 48 - qs, qs);
  ctx.font = `52px ${ROUND}`;
  ctx.fillStyle = C.yellow;
  ctx.fillText('扫码来站队', 48, H - 48 - qs + 70);
  ctx.font = `700 34px ${SYS}`;
  ctx.fillStyle = C.white;
  ctx.fillText('推荐这个辩题，为它投票', 48, H - 48 - qs + 140);
  ctx.fillStyle = C.dim;
  ctx.font = `600 30px ${SYS}`;
  ctx.fillText('我们授权所有人使用这些辩题，', 48, H - 48 - qs + 200);
  ctx.fillText('只是请千万不要忘记题库。', 48, H - 48 - qs + 244);

  return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
}
