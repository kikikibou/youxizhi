/**
 * 主持人、自带词、人工裁判的端到端测试：7 个玩家机器人 + 1 个主持人机器人。
 *
 *   node --dns-result-order=ipv4first game/server/test/moderator.ts http://127.0.0.1:8788 [human|llm|both]
 *
 * 为了稳定走到第二阶段，测试借主持人视图（看得到谁是白板）让玩家机器人先投白板——只有测试这么做，
 * 真实玩家的界面上没有这些信息。
 */

import type { JudgeView } from '../../engine/view.ts';
import { BASE, FAST, Phone, check, failures, sleep } from './phone.ts';

const modes = (process.argv[3] ?? 'both') === 'both' ? (['human', 'llm'] as const) : ([process.argv[3]] as ('human' | 'llm')[]);
const PAIR = { wordA: '海盐', wordB: '芝士', link: '都能做成奶盖', senseA: '海盐：调味用的盐', senseB: '芝士：奶酪', aliasesB: ['奶酪'], hints: ['都和奶茶有关'] };

async function main() {
  const { code } = (await (await fetch(`${BASE}/rooms`, { method: 'POST', body: '{}' })).json()) as { code: string };
  console.log(`房间 ${code}`);
  const phones = ['阿甲', '阿乙', '阿丙', '阿丁', '阿戊', '阿己', '阿庚'].map((n) => new Phone(n, code));
  const mod = new Phone('主持', code);
  for (const p of phones) await p.join();
  await mod.join();
  const host = phones[0];
  await sleep(300);

  console.log('设置主持人和自带词');
  host.send({ t: 'moderator', id: mod.id });
  await host.next((m) => m.t === 'state' && m.room.moderatorId === mod.id);
  host.send({ t: 'settings', settings: { wordSource: 'custom', judge: 'human', timers: { ...host.room!.settings.timers, ...FAST } } });
  await host.next((m) => m.t === 'state' && m.room.settings.wordSource === 'custom' && m.room.settings.judge === 'human');
  check(/主持人填好词对/.test(host.room!.startBlocker ?? ''), `没填词时不能开局：${host.room!.startBlocker}`);
  phones[1].send({ t: 'customPair', pair: PAIR });
  await phones[1].next((m) => m.t === 'error');
  check(/只有主持人/.test(phones[1].errors.at(-1) ?? ''), '非主持人不能出题');
  mod.send({ t: 'customPair', pair: { ...PAIR, wordB: ' 海盐 ' } });
  await mod.next((m) => m.t === 'error');
  check(/不能一样/.test(mod.errors.at(-1) ?? ''), '两个词一样会被拒绝');

  let jv: JudgeView | null = null;
  mod.onState = (m) => (jv = m.judge);

  for (const [gi, mode] of modes.entries()) {
    console.log(`第 ${gi + 1} 局：${mode === 'human' ? '主持人判定' : 'AI 裁判'}`);
    host.send({ t: 'settings', settings: { judge: mode } });
    await host.next((m) => m.t === 'state' && m.room.settings.judge === mode);
    mod.send({ t: 'customPair', pair: PAIR });
    await mod.next((m) => m.t === 'state' && !!m.room.customPair);
    await Promise.all(phones.filter((p) => !p.room?.customPairReady).map((p) => p.next((m) => m.t === 'state' && m.room.customPairReady)));
    check(mod.room!.customPair?.wordA === '海盐', '主持人看得到自己填的词');
    check(phones.every((p) => !JSON.stringify(p.room).includes('海盐') && p.room!.customPairReady), '玩家只知道填好了，看不到词');
    check(host.room!.startBlocker === null, `可以开局（${host.room!.members.length} 人，其中 7 名玩家）`);
    if (mode === 'llm' && !host.room!.judge.ai) console.log('  （这台服务器没有配 AI 裁判，判定会走兜底）');

    // 玩家机器人：投票时投一个活着的白板（借主持人视图）；第二阶段第一位玩家第二轮直接猜中
    let askedCount = 0;
    for (const p of phones) {
      p.decide = (v) => {
        const j = jv as JudgeView | null;
        if (!j) return undefined;
        if (v.step.k === 'vote' && v.me.alive && !v.step.myVote) {
          const blank = j.players.find((x) => x.alive && x.faction === 'blank');
          return blank ? { a: 'vote', target: blank.id } : undefined;
        }
        if (v.step.k === 'turn' && v.step.actor === v.me.id && !v.step.judging) {
          // 第一轮都提问（考裁判），第二轮第一个人猜中
          if (v.step.round === 1) {
            askedCount += 1;
            return { a: 'ask', target: askedCount % 2 ? 'big' : 'small', text: askedCount % 2 ? '是一种调味品吗' : '是乳制品吗' };
          }
          const me = j.players.find((x) => x.id === v.me.id)!;
          return { a: 'guess', text: me.faction === 'big' ? (j.secret.small === '芝士' ? '奶酪' : j.secret.small) : j.secret.big };
        }
        return undefined;
      };
      p.bot = true;
    }
    // 主持人机器人：人工判定（提问一律答 unknown 以外的真实答案，猜词按答案判）
    let verdicts = 0;
    let hinted = false;
    mod.onState = (m) => {
      jv = m.judge;
      const j = m.judge;
      if (!j || j.judgeMode !== 'human') return;
      for (const r of j.pending) {
        const truth = r.kind === 'guess' ? 'wrong' : r.text.includes('调味') ? (r.target === 'big' ? (j.secret.big === '海盐' ? 'yes' : 'no') : j.secret.small === '海盐' ? 'yes' : 'no') : r.target === 'big' ? (j.secret.big === '芝士' ? 'yes' : 'no') : j.secret.small === '芝士' ? 'yes' : 'no';
        setTimeout(() => mod.send({ t: 'verdict', id: r.id, verdict: truth }), 200);
        verdicts += 1;
      }
      if (j.step.k === 'race' && j.step.nextHintAt !== null && !hinted) {
        hinted = true;
        mod.send({ t: 'hint' });
      }
    };
    for (const p of phones) void p.play();

    host.send({ t: 'start' });
    await Promise.all(phones.map((p) => p.next((m) => m.t === 'state' && !!m.game && m.room.gameNo === gi + 1)));
    await mod.next((m) => m.t === 'state' && !!m.judge);
    const j0 = jv as unknown as JudgeView;
    check(!!j0 && j0.players.length === 7 && j0.players.every((p) => p.faction), '主持人看得到 7 名玩家的身份');
    check(!mod.game, '主持人不在对局里');
    const words = new Set(phones.map((p) => p.game!.me.word).filter(Boolean));
    check(words.size === 2 && words.has('海盐') && words.has('芝士'), '玩家拿到的是主持人出的词');
    check(phones.every((p) => !JSON.stringify(p.game).includes(p.game!.me.word === '海盐' ? '芝士' : '海盐')), '玩家看不到对方的词');

    const over = await Promise.race([
      Promise.all(phones.map((p) => p.next((m) => m.t === 'state' && m.game?.phase === 'over', 400_000))),
      sleep(400_000).then(() => null),
    ]);
    check(!!over, '对局打完');
    const v = phones[0].game!;
    const asks = v.log.filter((e) => e.t === 'turn' && e.action === 'ask').map((e) => (e as { verdict: string }).verdict);
    console.log(`    结局：${JSON.stringify(v.result)}；第二阶段提问的回答：${asks.join(' ')}`);
    check(v.log.some((e) => e.t === 'phase2'), '走到了第二阶段');
    if (mode === 'human') {
      check(verdicts > 0 && asks.length > 0 && asks.every((a) => a === 'yes' || a === 'no'), `回答来自主持人（共判了 ${verdicts} 次）`);
    } else if (host.room!.judge.ai) {
      check(asks.length > 0 && asks.every((a) => a === 'yes' || a === 'no'), 'AI 裁判给出了是 / 否（兜底只会答「无法判断」）');
    }
    check(v.result?.first === 'big' || v.result?.first === 'small', '第二轮有人猜中，国家获得第一名');
    check(host.room!.customPair === null && !host.room!.customPairReady, '自带词用过一次就清空了');
    for (const p of phones) {
      p.bot = false;
      p.decide = undefined;
    }
    await sleep(500);
  }

  for (const p of [...phones, mod]) p.close();
  console.log(failures ? `\n${failures} 项没通过` : '\n全部通过');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
