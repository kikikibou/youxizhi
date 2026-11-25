/**
 * 服务器重启 / 房间被回收后，对局能不能接着打。分两步跑，中间重启服务器：
 *
 *   node game/server/test/restart.ts http://127.0.0.1:8788 setup  <状态文件>
 *   （重启服务器）
 *   node game/server/test/restart.ts http://127.0.0.1:8788 resume <状态文件>
 *
 * setup：建房、7 人加入、开局，然后所有人断开（没人连着时计时也要照走）。
 * resume：7 人凭 token 重连，确认回到同一局、各自的词没变，机器人把这局打完。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { BASE, FAST, Phone, check, failures, sleep } from './phone.ts';

const mode = process.argv[3];
const file = process.argv[4];

async function setup() {
  const { code } = (await (await fetch(`${BASE}/rooms`, { method: 'POST', body: '{}' })).json()) as { code: string };
  const phones = ['甲', '乙', '丙', '丁', '戊', '己', '庚'].map((n) => new Phone(n, code));
  for (const p of phones) await p.join();
  const [host] = phones;
  // 讨论时间放长，保证重启时对局还没结束
  host.send({ t: 'settings', settings: { untimed: false, timers: { ...host.room!.settings.timers, ...FAST, discussion: 120_000 } } });
  await host.next((m) => m.t === 'state' && m.room.settings.timers.discussion === 120_000);
  host.send({ t: 'start' });
  await Promise.all(phones.map((p) => p.next((m) => m.t === 'state' && !!m.game)));
  await sleep(6000); // 让夜晚超时、线索开始，全靠服务器计时
  const saved = { code, phones: phones.map((p) => ({ name: p.name, token: p.token, id: p.id, word: p.game!.me.word, day: p.game!.day, step: p.game!.step.k })) };
  writeFileSync(file, JSON.stringify(saved, null, 2));
  for (const p of phones) p.close();
  console.log(`已保存：房间 ${code}，当前步骤 ${saved.phones[0].step}`);
  process.exit(0);
}

async function resume() {
  const saved = JSON.parse(readFileSync(file, 'utf8')) as { code: string; phones: { name: string; token: string; id: string; word: string | null; step: string }[] };
  const phones = saved.phones.map((s) => new Phone(s.name, saved.code));
  for (const [i, p] of phones.entries()) {
    const r = await p.join(undefined, saved.phones[i].token);
    check(r.t === 'welcome' && p.id === saved.phones[i].id, `${p.name} 凭 token 回到房间`);
  }
  check(phones.every((p) => !!p.game), '重启后对局还在');
  check(phones.every((p, i) => p.game!.me.word === saved.phones[i].word), '每个人的词没变');
  console.log(`  重启前：${saved.phones[0].step}；现在：第 ${phones[0].game!.day} 天 ${phones[0].game!.step.k}`);
  for (const p of phones) {
    p.bot = true;
    void p.play(); // 照着重连时收到的视图先动一次
  }
  const over = await Promise.race([
    Promise.all(phones.map((p) => p.next((m) => m.t === 'state' && m.game?.phase === 'over', 600_000))),
    sleep(600_000).then(() => null),
  ]);
  check(!!over, '重启后对局打完');
  console.log(`  结局：${JSON.stringify(phones[0].game?.result)}`);
  for (const p of phones) p.close();
  console.log(failures ? `\n${failures} 项没通过` : '\n全部通过');
  process.exit(failures ? 1 : 0);
}

(mode === 'setup' ? setup() : resume()).catch((e) => {
  console.error(e);
  process.exit(1);
});
