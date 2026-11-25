/**
 * 新功能的联机测试：头像同步、默认不限时、房主「跳过等待」、题库勾选、提前获胜阈值。
 * 用法：node --dns-result-order=ipv4first game/server/test/features.ts [服务器地址]
 */

import { BASE, Phone, check, failures, sleep } from './phone.ts';

async function main() {
  const res = await fetch(`${BASE}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const { code } = (await res.json()) as { code: string };
  console.log(`房间 ${code}`);

  const host = new Phone('房主', code);
  await host.join();
  const others = ['乙', '丙', '丁', '戊', '己'].map((n) => new Phone(n, code));
  for (const p of others) await p.join();

  console.log('默认设置');
  check(host.room!.settings.untimed === true, '新房间默认不限时');
  check(!('difficulty' in host.room!.settings) && !('revealOnExit' in host.room!.settings), '难度、出局公布身份已经去掉');
  check(Array.isArray(host.room!.bank.banks) && host.room!.bank.banks.length >= 1, '大厅里能看到题库列表');

  console.log('头像');
  const got = others[0].next((m) => m.t === 'avatars' && m.avatars[host.id] === 'p:7');
  host.send({ t: 'avatar', avatar: 'p:7' });
  await got;
  check(true, '换头像后其他人收到新头像');
  const drawn = 'd:0A1B2C3D,4E5F';
  const got2 = others[1].next((m) => m.t === 'avatars' && m.avatars[host.id] === drawn);
  host.send({ t: 'avatar', avatar: drawn });
  await got2;
  check(true, '手绘头像也能同步');
  const err = host.next((m) => m.t === 'error');
  host.send({ t: 'avatar', avatar: 'javascript:alert(1)' });
  check(((await err) as { message: string }).message.includes('头像'), '格式不对的头像被拒绝');
  const late = new Phone('庚', code);
  const welcomeAvatars = new Promise<Record<string, string>>((resolve) => {
    const orig = late.next((m) => m.t === 'avatars');
    void orig.then((m) => resolve((m as { avatars: Record<string, string> }).avatars));
  });
  await late.open();
  late.send({ t: 'join', name: '庚' });
  const av = await welcomeAvatars;
  check(av[host.id] === drawn, '后加入的人一进来就拿到所有头像');
  await late.next((m) => m.t === 'state');
  late.send({ t: 'leave' });
  await sleep(300);

  console.log('提前获胜阈值和题库');
  const s1 = host.next((m) => m.t === 'state' && m.room.settings.wipeoutThreshold === 1 && m.room.settings.wipeoutVsBlanks);
  host.send({ t: 'settings', settings: { wipeoutThreshold: 1, wipeoutVsBlanks: true } });
  await s1;
  check(true, '阈值可以设成数字，也能打开「少于白板」');
  host.send({ t: 'settings', settings: { wipeoutThreshold: 99 } });
  await sleep(300);
  check(host.room!.settings.wipeoutThreshold === 1, '超出范围的阈值被忽略');
  host.send({ t: 'settings', settings: { banks: [] } });
  await sleep(300);
  check(host.room!.settings.banks === null, '题库不能一个都不勾');

  console.log('不限时 + 跳过等待');
  const started = host.next((m) => m.t === 'state' && !!m.game && m.game.step.k === 'night');
  host.send({ t: 'start' });
  await started;
  check(host.game!.step.k === 'night' && host.game!.step.deadline === null, '夜晚没有截止时间');
  const notHost = others[0].next((m) => m.t === 'error');
  others[0].send({ t: 'skip' });
  check(((await notHost) as { message: string }).message.includes('房主'), '只有房主能跳过等待');
  const toClue = host.next((m) => m.t === 'state' && !!m.game && m.game.step.k === 'clue');
  host.send({ t: 'skip' });
  await toClue;
  check(true, '房主跳过等待后夜晚结束，进入身份提示');
  const st = host.game!.step;
  if (st.k === 'clue') {
    const first = st.order[0];
    const skipped = host.next((m) => m.t === 'state' && !!m.game && m.game.step.k === 'clue' && m.game.step.idx === 1);
    host.send({ t: 'skip' });
    await skipped;
    check(host.game!.log.some((e) => e.t === 'clue' && e.player === first && e.text === null), '跳过的人记为没有给提示');
  }

  for (const p of [host, ...others]) p.close();
  console.log(failures ? `\n${failures} 处失败` : '\n全部通过');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
