/**
 * 往一个已有的房间里加机器人凑人数（调试手机页面用）。机器人只看自己的视图行动，Ctrl+C 结束。
 *
 *   node game/server/test/bots.ts http://127.0.0.1:8788 <房间号> <人数> [密码]
 */

import { Phone, sleep } from './phone.ts';

const code = process.argv[3];
const n = Number(process.argv[4] ?? 6);
const password = process.argv[5];
const NAMES = ['小橘', '小柚', '小桃', '小梨', '小杏', '小枣', '小莓', '小榴', '小柿', '小枇', '小杷'];

async function main() {
  const phones: Phone[] = [];
  for (let i = 0; i < n; i++) {
    const p = new Phone(NAMES[i] ?? `机器人${i + 1}`, code);
    const r = await p.join(password);
    if (r.t !== 'welcome') throw new Error(`${p.name} 加入失败：${r.t === 'error' ? r.message : r.t}`);
    p.bot = true;
    phones.push(p);
    console.log(`${p.name} 已加入`);
  }
  console.log('机器人就位，Ctrl+C 结束');
  for (;;) {
    await sleep(5000);
    for (const p of phones) void p.play();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
