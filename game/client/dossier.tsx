/**
 * 档案：白天、夜晚都能打开的全屏面板，把整局的信息按「人 × 天」排好，不用上下翻长长的记录。
 * - 线索：每人每天说的词排成一张表，横着看同一个人的变化，竖着看同一天的全部提示。
 * - 投票：选一天，圆桌上画出谁投了谁，旁边是票数。
 * - 秘密：只有白板阵营有——队友、裁判私下的回答。
 * - 全部：按时间的完整记录。
 */

import { useId, useState } from 'preact/hooks';
import type { LogEntry, PlayerView } from '../engine/view.ts';
import { Avatar } from './avatar.tsx';
import { ANSWER, DIR, FACTION, ROLE, ROLE_DUTY, VERDICT, describe } from './text.ts';
import { StepArt, pad2, previewFlags } from './ui.tsx';

type Tab = 'clues' | 'votes' | 'secret' | 'all';
type E<T extends LogEntry['t']> = Extract<LogEntry, { t: T }>;

export function Dossier({ v, onClose }: { v: PlayerView; onClose: () => void }) {
  const blank = !!v.me.blank;
  const [tab, setTab] = useState<Tab>(previewFlags.dossier && (previewFlags.dossier !== 'secret' || blank) ? previewFlags.dossier : 'clues');
  const tabs: [Tab, string, string][] = [
    ['clues', '线索', 'CLUES'],
    ['votes', '投票', 'VOTES'],
    ...(blank ? ([['secret', '秘密', 'SECRET']] as [Tab, string, string][]) : []),
    ['all', '全部', 'LOG'],
  ];
  return (
    <div class="dossier" role="dialog" aria-modal="true" aria-label="档案">
      <header class="dz-head">
        <StepArt k="archive" size={40} />
        <span class="dz-title">
          <b>档案</b>
          <small>ARCHIVE · 第 {v.day} 天</small>
        </span>
        <button type="button" class="dz-close" onClick={onClose} aria-label="关闭档案">
          ×
        </button>
      </header>
      <nav class="dz-tabs" role="tablist">
        {tabs.map(([k, cn, en]) => (
          <button type="button" role="tab" aria-selected={tab === k} class={tab === k ? 'is-on' : ''} onClick={() => setTab(k)} key={k}>
            {cn}
            <small>{en}</small>
          </button>
        ))}
      </nav>
      <div class="dz-body" key={tab}>
        {tab === 'clues' ? <Clues v={v} /> : tab === 'votes' ? <Votes v={v} /> : tab === 'secret' ? <Secret v={v} /> : <AllLog v={v} />}
      </div>
    </div>
  );
}

const nameOf = (v: PlayerView) => (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';

/* ------------------------------------------------------------------ 线索 */

function Clues({ v }: { v: PlayerView }) {
  const name = nameOf(v);
  const clues = v.log.filter((e): e is E<'clue'> => e.t === 'clue');
  const nights = new Map(v.log.filter((e): e is E<'night'> => e.t === 'night').map((e) => [e.day, e]));
  const days = [...new Set([...nights.keys(), ...clues.map((c) => c.day)])].sort((a, b) => a - b);
  const said = new Map(clues.map((c) => [`${c.day}:${c.player}`, c.text]));
  const outDay = new Map<string, number>();
  for (const e of v.log) if (e.t === 'votes') for (const id of e.out) outDay.set(id, e.day);
  const turns = v.log.filter((e): e is E<'turn'> => e.t === 'turn');
  if (!days.length) return <p class="dz-empty">还没有人给过身份提示。</p>;
  return (
    <>
      <div class="dz-matrix" role="region" aria-label="每人每天的身份提示" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">玩家</th>
              {days.map((d) => {
                const n = nights.get(d);
                return (
                  <th scope="col" key={d}>
                    <b>D{pad2(d)}</b>
                    {n ? (
                      <small>
                        {name(n.start)} · {n.dir === 'cw' ? '↻' : '↺'}
                      </small>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {v.players.map((p) => {
              const od = outDay.get(p.id);
              return (
                <tr key={p.id} class={`${p.id === v.me.id ? 'is-me' : ''} ${p.alive ? '' : 'is-out'}`}>
                  <th scope="row">
                    <span class="dz-who">
                      <Avatar id={p.id} size={22} />
                      <b>{pad2(p.seat + 1)}</b>
                      <span>{p.name}</span>
                    </span>
                    {od ? <em>D{od} 出局</em> : null}
                  </th>
                  {days.map((d) => {
                    const key = `${d}:${p.id}`;
                    const has = said.has(key);
                    const t = said.get(key);
                    return (
                      <td key={d}>
                        {has ? t === null ? <span class="dz-none">没给</span> : <span class="tile tile--sm">{t}</span> : od && d > od ? <span class="dz-gone">/</span> : <span class="dz-wait">·</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p class="dz-hint">横着看同一个人每天的提示，竖着看同一天的所有提示。表格可以左右滑。</p>
      {turns.length ? (
        <section class="dz-section">
          <h4>第二阶段</h4>
          <ol class="dz-list">
            {turns.map((t, i) => (
              <li key={i} class={t.action === 'guess' ? (t.verdict === 'correct' ? 'is-good' : 'is-bad') : ''}>
                <Avatar id={t.player} size={20} />
                <b>{name(t.player)}</b>
                {t.action === 'timeout' ? (
                  <span>超时</span>
                ) : t.action === 'guess' ? (
                  <span>
                    猜「{t.text}」<em>{VERDICT[t.verdict]}</em>
                  </span>
                ) : (
                  <span>
                    问{FACTION[t.target]}的词「{t.text}」<em>{ANSWER[t.verdict]}</em>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ 投票 */

function Votes({ v }: { v: PlayerView }) {
  const name = nameOf(v);
  const rounds = v.log.filter((e): e is E<'votes'> => e.t === 'votes');
  const [sel, setSel] = useState(rounds.length - 1);
  const id = useId();
  if (!rounds.length) return <p class="dz-empty">还没有投过票。</p>;
  const r = rounds[Math.min(sel, rounds.length - 1)];
  const n = v.players.length;
  const me = v.me.seat;
  const pos = (pid: string, rad = 96) => {
    const p = v.players.find((x) => x.id === pid)!;
    const a = ((90 + (360 * (p.seat - me)) / n) * Math.PI) / 180;
    return [130 + rad * Math.cos(a), 130 + rad * Math.sin(a)] as const;
  };
  const tally = new Map<string, string[]>();
  for (const [voter, target] of Object.entries(r.ballots)) tally.set(target, [...(tally.get(target) ?? []), voter]);
  const ranked = [...tally.entries()].sort((a, b) => b[1].length - a[1].length);
  const max = ranked[0]?.[1].length ?? 1;
  return (
    <>
      {rounds.length > 1 ? (
        <div class="dz-days" role="tablist" aria-label="选择哪一天">
          {rounds.map((x, i) => (
            <button type="button" role="tab" aria-selected={i === sel} class={i === sel ? 'is-on' : ''} onClick={() => setSel(i)} key={i}>
              D{pad2(x.day)}
            </button>
          ))}
        </div>
      ) : null}
      <svg class="dz-votes" viewBox="0 0 260 260" role="img" aria-label={`第 ${r.day} 天的投票：箭头从投票人指向被投的人`}>
        <defs>
          <marker id={`ar${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" class="dz-arrowhead" />
          </marker>
        </defs>
        <circle cx="130" cy="130" r="76" class="dz-table" />
        <circle cx="130" cy="130" r="110" class="dz-ring" />
        {Object.entries(r.ballots).map(([voter, target]) => {
          if (voter === target) {
            const [x, y] = pos(voter, 112);
            return <circle key={voter} cx={x} cy={y} r="9" class="dz-self" />;
          }
          const [x1, y1] = pos(voter, 82);
          const [x2, y2] = pos(target, 82);
          const mx = (x1 + x2) / 2 + (130 - (x1 + x2) / 2) * 0.35;
          const my = (y1 + y2) / 2 + (130 - (y1 + y2) / 2) * 0.35;
          const out = r.out.includes(target);
          return <path key={voter} d={`M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`} class={`dz-arrow ${out ? 'is-out' : ''}`} marker-end={`url(#ar${id})`} />;
        })}
        {v.players.map((p) => {
          const [x, y] = pos(p.id, 100);
          const out = r.out.includes(p.id);
          return (
            <g key={p.id} class={`dz-seat ${out ? 'is-out' : ''} ${p.id === v.me.id ? 'is-me' : ''}`}>
              <rect x={x - 15} y={y - 9} width="30" height="18" />
              <text x={x} y={y + 0.5}>
                {Array.from(p.name).slice(0, 2).join('')}
              </text>
            </g>
          );
        })}
      </svg>
      <ol class="dz-tally">
        {ranked.map(([target, voters]) => (
          <li key={target} class={r.out.includes(target) ? 'is-out' : ''}>
            <span class="dz-who">
              <Avatar id={target} size={22} />
              <b>{name(target)}</b>
              {r.out.includes(target) ? <em>出局</em> : null}
            </span>
            <span class="dz-bar">
              <i style={{ width: `${(voters.length / max) * 100}%` }} />
            </span>
            <b class="dz-count">{voters.length}</b>
            <small class="dz-voters">{voters.map(name).join('、')}</small>
          </li>
        ))}
      </ol>
    </>
  );
}

/* ------------------------------------------------------------------ 秘密 */

function Secret({ v }: { v: PlayerView }) {
  const name = nameOf(v);
  const b = v.me.blank!;
  const answers = v.log.filter((e): e is E<'answer'> => e.t === 'answer');
  return (
    <>
      <section class="dz-section dz-role">
        <h4>你的身份</h4>
        <p>
          <b>{ROLE[b.role]}</b>
          {ROLE_DUTY[b.role]}。目标是猜中大国词。
        </p>
      </section>
      <section class="dz-section">
        <h4>队友</h4>
        {b.teammates.length ? (
          <ul class="dz-list">
            {b.teammates.map((t) => (
              <li key={t.id}>
                <Avatar id={t.id} size={20} />
                <b>{name(t.id)}</b>
                <span>{t.role ? ROLE[t.role] : '白板阵营'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="dz-empty">你看不到其他队友。</p>
        )}
      </section>
      <section class="dz-section">
        <h4>裁判私下的回答</h4>
        {answers.length ? (
          <ol class="dz-list">
            {answers.map((a, i) => (
              <li key={i}>
                <span>「{a.question}」</span>
                <em class="dz-answer">{ANSWER[a.answer]}</em>
              </li>
            ))}
          </ol>
        ) : (
          <p class="dz-empty">还没有。白板出局时问裁判的问题，回答会在下一个夜晚出现在这里。</p>
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ 全部 */

export function logGroups(v: PlayerView) {
  const name = nameOf(v);
  const groups: { title: string; items: { text: string; tone?: string }[] }[] = [];
  let cur = { title: '开局', items: [] as { text: string; tone?: string }[] };
  for (const e of v.log) {
    if (e.t === 'night') {
      if (cur.items.length) groups.push(cur);
      cur = { title: `第 ${e.day} 天 · 从 ${name(e.start)} 开始${DIR[e.dir]}`, items: [] };
      continue;
    } else if (e.t === 'phase2') {
      if (cur.items.length) groups.push(cur);
      cur = { title: '第二阶段', items: [] };
    }
    const d = describe(e, name);
    if (d) cur.items.push(d);
  }
  if (cur.items.length) groups.push(cur);
  return groups.reverse();
}

function AllLog({ v }: { v: PlayerView }) {
  const groups = logGroups(v);
  return (
    <div class="log">
      {groups.map((g, gi) => (
        <div class="log-day" key={gi}>
          <h4>{g.title}</h4>
          <ol>
            {g.items.map((it, i) => (
              <li class={it.tone ? `tone-${it.tone}` : ''} key={i}>
                {it.text}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
