/**
 * 冒烟测试：对着本机（或线上）的房间服务器，用 7 个模拟手机连续打几局。
 *
 *   node game/server/test/smoke.ts http://127.0.0.1:8788
 *
 * 检查：建房和密码、房主权限、开局后每人只拿到自己的内容、断线重连、计时推进、
 * 结算计分、下一局换词对、请人离开。机器人只看自己收到的视图做决定。
 */

import { BASE, FAST, Phone, check, failures, sleep } from './phone.ts';

const GAMES = Number(process.argv[3] ?? 3);

async function main() {
  console.log(`服务器：${BASE}`);
  check((await (await fetch(BASE)).text()) === 'dgxg ok', '服务器在线');

  console.log('建房和密码');
  const created = (await (await fetch(`${BASE}/rooms`, { method: 'POST', body: JSON.stringify({ password: '芝麻开门' }) })).json()) as { code: string };
  const code = created.code;
  check(/^\d{4}$/.test(code), `建房成功，房间号 ${code}`);
  const info = (await (await fetch(`${BASE}/rooms/${code}`)).json()) as { exists: boolean; hasPassword: boolean };
  check(info.exists && info.hasPassword, '查询房间：存在、需要密码');
  const missing = (await (await fetch(`${BASE}/rooms/0000x`)).json()) as { error?: string };
  check(!!missing.error, '非法房间号被拒绝');

  const phones = ['阿甲', '阿乙', '阿丙', '阿丁', '阿戊', '阿己', '阿庚'].map((n) => new Phone(n, code));
  const [host, ...others] = phones;
  const noPw = await new Phone('路人', code).join();
  check(noPw.t === 'error' && /需要密码/.test(noPw.message), '不带密码加入被拒绝');
  const wrongPw = await new Phone('路人', code).join('不对');
  check(wrongPw.t === 'error' && /密码不对/.test(wrongPw.message), '密码错误被拒绝');
  check((await host.join('芝麻开门')).t === 'welcome', '房主加入');
  check(host.room?.hostId === host.id, '第一个加入的人是房主');
  for (const p of others) await p.join('芝麻开门');
  await sleep(300);
  check(host.room?.members.length === 7, '7 人都在房间里');
  check(host.room?.startBlocker === null, '7 人可以开局');
  const dup = await new Phone('阿甲', code).join('芝麻开门');
  check(dup.t === 'error', '重名被拒绝');

  console.log('房主权限');
  others[0].send({ t: 'start' });
  await others[0].next((m) => m.t === 'error');
  check(/只有房主/.test(others[0].errors.at(-1) ?? ''), '非房主不能开局');
  host.send({ t: 'settings', settings: { untimed: false, timers: { ...host.room!.settings.timers, ...FAST } } });
  await host.next((m) => m.t === 'state' && m.room.settings.timers.night === FAST.night);
  check(true, '房主改了计时');

  let reachedPhase2 = 0;
  for (let gameNo = 1; gameNo <= GAMES; gameNo++) {
    console.log(`第 ${gameNo} 局`);
    for (const p of phones) p.bot = true;
    host.send({ t: 'start' });
    await Promise.all(phones.map((p) => p.next((m) => m.t === 'state' && !!m.game && m.room.gameNo === gameNo)));
    check(phones.every((p) => p.game?.phase === 1), '所有人进入第一阶段');
    const words = phones.map((p) => p.game!.me.word);
    const blanks = phones.filter((p) => p.game!.me.blank);
    check(blanks.length === 2 && words.filter((w) => w === null).length === 2, '2 个白板没有词');
    check(new Set(words.filter(Boolean)).size === 2, '国家玩家只有两种词');
    check(phones.every((p) => !JSON.stringify(p.game).includes('"faction"')), '没有人的视图里有阵营字段');
    const firstPair = words.filter(Boolean);

    if (gameNo === 1) {
      // 断线重连：第 3 台手机断开，用 token 重新连上
      const p = phones[2];
      p.bot = false;
      p.close();
      await sleep(500);
      check(host.room?.members.find((m) => m.id === p.id)?.online === false, '断线后显示离线');
      const again = new Phone(p.name, code);
      const r = await again.join(undefined, p.token);
      check(r.t === 'welcome' && again.id === p.id && !!again.game, '凭 token 重连，回到同一局、不用密码');
      check(again.game?.me.word === p.game?.me.word, '重连后拿到的还是自己的词');
      again.bot = true;
      phones[2] = again;
    }

    const over = await Promise.race([
      Promise.all(phones.map((p) => p.next((m) => m.t === 'state' && m.game?.phase === 'over', 300_000))),
      sleep(300_000).then(() => null),
    ]);
    check(!!over, '对局打完');
    const v = phones[0].game!;
    const log = v.log.map((e) => e.t);
    if (log.includes('phase2')) reachedPhase2 += 1;
    console.log(`    结局：${JSON.stringify(v.result)}；第 ${v.day} 天；${log.includes('phase2') ? '进入过第二阶段' : '没进第二阶段'}`);
    // 裁判：提问的回答分布（兜底判定只会答 unknown），猜词判定的结果
    const asks: Record<string, number> = {};
    for (const e of v.log) {
      if ((e.t === 'turn' || e.t === 'relief') && 'verdict' in e && (e.action === 'ask')) asks[e.verdict] = (asks[e.verdict] ?? 0) + 1;
      if (e.t === 'exit' && e.questions) for (const q of e.questions) if (q.invalid) asks.invalid = (asks.invalid ?? 0) + 1;
    }
    // 出局提问的回答只发给白板：从白板的手机上收
    const priv = new Map<string, string>();
    for (const p of phones) for (const e of p.game?.log ?? []) if (e.t === 'answer') priv.set(e.question, e.answer);
    for (const a of priv.values()) asks[`私下:${a}`] = (asks[`私下:${a}`] ?? 0) + 1;
    console.log(`    裁判：${host.room!.judge.ai ? `AI（${host.room!.judge.model}）` : '兜底'}；提问回答分布 ${JSON.stringify(asks)}`);
    check(!!v.reveal && v.reveal.players.length === 7, '结算公布了所有人的身份');
    await sleep(300);
    const scores = host.room!.members.map((m) => m.score);
    check(v.result!.first === null || scores.some((s) => s > 0), `计分：${scores.join(' ')}`);
    check(host.room!.played.length === gameNo, `本房间记下了 ${gameNo} 个用过的词对`);
    for (const p of phones) p.bot = false;
    void firstPair;
  }

  console.log('请人离开');
  const leaver = phones[6];
  host.send({ t: 'kick', id: leaver.id });
  await leaver.next((m) => m.t === 'bye');
  check(/请出/.test(leaver.bye ?? ''), '被请离的人收到通知');
  await sleep(300);
  check(host.room?.members.length === 6, '房间剩 6 人');

  for (const p of phones) p.close();
  console.log(`\n进入第二阶段的对局：${reachedPhase2}/${GAMES}`);
  console.log(failures ? `\n${failures} 项没通过` : '\n全部通过');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
