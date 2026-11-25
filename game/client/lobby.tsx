/** 房间大厅：房间号和二维码、成员、规则设置、开局。 */

import { useMemo, useState } from 'preact/hooks';
import { renderSVG } from 'uqr';
import { DEFAULT_TIMERS, PRESETS, compositionError, type Composition, type Timers } from '../engine/rules.ts';
import type { RoomSettings, RoomView } from '../shared/protocol.ts';
import type { RoomConnection, Snapshot } from './net.ts';
import { resultLine } from './text.ts';
import { Card } from './ui.tsx';

/** 计时档位：在默认时长上整体乘一个系数（出局最短展示、冷却、裁判等待不变）。 */
const SCALED: (keyof Timers)[] = ['night', 'clue', 'discussion', 'vote', 'exitChoice', 'turn', 'reliefAsk', 'reliefGuess', 'hintInterval', 'bigChance'];
const PACES = [
  { id: 'fast', label: '紧凑', k: 2 / 3 },
  { id: 'normal', label: '标准', k: 1 },
  { id: 'slow', label: '宽松', k: 1.5 },
] as const;
function paceTimers(k: number): Timers {
  const t = { ...DEFAULT_TIMERS };
  for (const key of SCALED) t[key] = Math.round((DEFAULT_TIMERS[key] * k) / 1000) * 1000;
  return t;
}
function currentPace(t: Timers): string | null {
  return PACES.find((p) => SCALED.every((key) => paceTimers(p.k)[key] === t[key]))?.id ?? null;
}

export function shareLink(code: string): string {
  return `${location.origin}${location.pathname}#/${code}`;
}

export function Lobby({ conn, snap, lastGame, onShowLast }: { conn: RoomConnection; snap: Snapshot; lastGame: boolean; onShowLast: () => void }) {
  const room = snap.room!;
  const me = room.members.find((m) => m.id === room.me);
  const isHost = room.hostId === room.me;
  const link = shareLink(room.code);
  const qr = useMemo(() => renderSVG(link, { border: 1 }), [link]);
  const [copied, setCopied] = useState(false);
  const moderator = room.members.find((m) => m.id === room.moderatorId) ?? null;
  const isModerator = room.moderatorId === room.me;
  /** 玩家人数：主持人不算。 */
  const n = room.members.length - (moderator ? 1 : 0);

  return (
    <div class="lobby">
      <header class="room-head">
        <p class="phase-en">ROOM</p>
        <h1 class="room-code">{room.code}</h1>
        <p class="note">{room.hasPassword ? '有密码' : '没有密码'} · 让大家扫码或打开链接加入</p>
      </header>

      <Card>
        <div class="share">
          <div class="qr" dangerouslySetInnerHTML={{ __html: qr }} aria-label="房间二维码" />
          <div>
            <p class="link">{link}</p>
            <button
              type="button"
              class="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  prompt('复制这个链接', link);
                }
              }}
            >
              {copied ? '已复制' : '复制链接'}
            </button>
          </div>
        </div>
      </Card>

      {lastGame && room.gameNo > 0 ? (
        <button type="button" class="btn btn--ghost btn--wide" onClick={onShowLast}>
          查看第 {room.gameNo} 局的结算和记录
        </button>
      ) : null}

      <Card>
        <h3 class="section-title">
          <span>
            玩家 {n} 人{moderator ? ' · 主持人 1 人' : ''}
          </span>
          <small>{n < 6 ? `至少 6 人，还差 ${6 - n} 人` : n > 12 ? '最多 12 人' : 'PLAYERS'}</small>
        </h3>
        <ul class="members">
          {room.members.map((m) => (
            <li key={m.id} class={m.id === room.me ? 'is-me' : ''}>
              <i class={`dot ${m.online ? 'is-on' : ''}`} title={m.online ? '在线' : '离线'} />
              <span class="m-name">
                {m.name}
                {m.host ? <em>房主</em> : null}
                {m.id === room.moderatorId ? <em class="em-mod">主持人</em> : null}
              </span>
              <span class="m-score">{m.score} 分</span>
              {isHost ? (
                <span class="m-actions">
                  {m.id === room.moderatorId ? (
                    <button type="button" class="link-btn" onClick={() => conn.send({ t: 'moderator', id: null })}>
                      取消主持人
                    </button>
                  ) : (
                    <button type="button" class="link-btn" onClick={() => conn.send({ t: 'moderator', id: m.id })}>
                      设为主持人
                    </button>
                  )}
                  {m.id !== room.me ? (
                    <>
                      <button type="button" class="link-btn" onClick={() => conn.send({ t: 'transfer', id: m.id })}>
                        设为房主
                      </button>
                      <button type="button" class="link-btn" onClick={() => confirm(`请 ${m.name} 离开房间？`) && conn.send({ t: 'kick', id: m.id })}>
                        请离开
                      </button>
                    </>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p class="note">主持人不参与游戏：负责出题（自带词）或人工判定，也可以只旁观。</p>
      </Card>

      {isModerator ? <ModeratorCard conn={conn} room={room} /> : null}

      <Settings conn={conn} settings={room.settings} n={n} editable={isHost} judge={room.judge} />

      {isHost ? <PasswordCard conn={conn} has={room.hasPassword} /> : null}

      <div class="start">
        {isHost ? (
          <button type="button" class="btn btn--accent btn--wide btn--big" disabled={!!room.startBlocker} onClick={() => conn.send({ t: 'start' })}>
            {room.gameNo ? '开始下一局' : '开始游戏'}
          </button>
        ) : (
          <p class="waiting">等房主开始{me ? `（你是 ${me.name}）` : ''}</p>
        )}
        {room.startBlocker ? <p class="note">{room.startBlocker}</p> : null}
      </div>

      <MyName conn={conn} name={me?.name ?? ''} />
      <button
        type="button"
        class="btn btn--ghost btn--wide"
        onClick={() => {
          if (confirm('离开这个房间？')) conn.send({ t: 'leave' });
        }}
      >
        离开房间
      </button>
    </div>
  );
}

function Settings({ conn, settings: s, n, editable, judge }: { conn: RoomConnection; settings: RoomSettings; n: number; editable: boolean; judge: RoomView['judge'] }) {
  const preset = PRESETS[n];
  const comp = s.composition ?? preset;
  const set = (patch: Partial<RoomSettings>) => editable && conn.settings(patch);
  const pace = currentPace(s.timers);
  return (
    <Card>
      <h3 class="section-title">
        <span>规则</span>
        <small>{editable ? '房主可以修改' : '由房主设置'}</small>
      </h3>
      <dl class="settings">
        <dt>阵营</dt>
        <dd>
          {comp ? `${comp.big} 大国 · ${comp.small} 小国 · ${comp.blank} 白板` : '—'}
          {s.composition ? '（自定义）' : '（按人数预设）'}
          {editable ? <CompositionEditor conn={conn} current={s.composition} n={n} /> : null}
        </dd>

        <dt>白板互认</dt>
        <dd>
          <Choice
            value={s.recognition}
            disabled={!editable}
            options={[
              ['auto', '自动'],
              ['group', '分组互认'],
              ['oneWay', '单向认人'],
              ['all', '全员互认'],
            ]}
            onChange={(v) => set({ recognition: v as RoomSettings['recognition'] })}
          />
          <small>自动：2 个白板时单向认人（白板看得到黑板），3 个及以上分组互认</small>
        </dd>

        <dt>白板提前获胜</dt>
        <dd>
          <Choice
            value={String(s.wipeoutThreshold)}
            disabled={!editable}
            options={[
              ['0', '某国全部出局'],
              ['1', '某国只剩 1 人'],
            ]}
            onChange={(v) => set({ wipeoutThreshold: Number(v) as 0 | 1 })}
          />
        </dd>

        <dt>第二阶段提问</dt>
        <dd>
          <Toggle on={s.phase2Questions} disabled={!editable} onChange={(on) => set({ phase2Questions: on })} label="回合内可以改为向裁判提问" />
        </dd>

        <dt>出局公布身份</dt>
        <dd>
          <Toggle on={s.revealOnExit} disabled={!editable} onChange={(on) => set({ revealOnExit: on })} label="出局时公布「是白板 / 不是白板」" />
        </dd>

        <dt>同桌模式</dt>
        <dd>
          <Toggle on={s.tableMode} disabled={!editable} onChange={(on) => set({ tableMode: on })} label="夜晚所有人都操作手机，免得暴露白板" />
        </dd>

        <dt>题目难度</dt>
        <dd>
          <Choice
            value={String(s.difficulty)}
            disabled={!editable}
            options={[
              ['random', '随机'],
              ['1', '简单'],
              ['2', '中等'],
              ['3', '困难'],
            ]}
            onChange={(v) => set({ difficulty: v === 'random' ? 'random' : (Number(v) as 1 | 2 | 3) })}
          />
        </dd>

        <dt>节奏</dt>
        <dd>
          <Choice
            value={pace ?? 'custom'}
            disabled={!editable}
            options={[...PACES.map((p) => [p.id, p.label] as [string, string]), ...(pace ? [] : [['custom', '自定义'] as [string, string]])]}
            onChange={(v) => {
              const p = PACES.find((x) => x.id === v);
              if (p) set({ timers: paceTimers(p.k) });
            }}
          />
          <small>
            发言 {s.timers.clue / 1000} 秒 / 人 · 讨论 {s.timers.discussion / 1000} 秒 · 投票 {s.timers.vote / 1000} 秒
          </small>
        </dd>

        <dt>词对来源</dt>
        <dd>
          <Choice
            value={s.wordSource}
            disabled={!editable}
            options={[
              ['bank', '题库'],
              ['custom', '自带词'],
            ]}
            onChange={(v) => set({ wordSource: v as RoomSettings['wordSource'] })}
          />
          <small>自带词：由主持人在开局前填两个词和联系。</small>
        </dd>

        <dt>裁判方式</dt>
        <dd>
          <Choice
            value={s.judge}
            disabled={!editable}
            options={[
              ['llm', 'AI 裁判'],
              ['human', '主持人判定'],
            ]}
            onChange={(v) => set({ judge: v as RoomSettings['judge'] })}
          />
          {s.judge === 'human' ? <small>主持人在手机上手动判定提问和猜词；超过 3 分钟没判，自动按兜底处理。</small> : null}
        </dd>

        <dt>AI 裁判</dt>
        <dd>
          {judge.ai ? (
            <small>AI 裁判（{modelName(judge.model)}）：回答是非问题、判定猜词。写法完全一致的猜词直接判对。</small>
          ) : (
            <small>AI 裁判还没配置好：现在猜词只认完全一致的写法（含别名），提问一律答「无法判断」。</small>
          )}
        </dd>
      </dl>
    </Card>
  );
}

function CompositionEditor({ conn, current, n }: { conn: RoomConnection; current: Composition | null; n: number }) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState<Composition>(current ?? PRESETS[n] ?? { big: 3, small: 2, blank: 2 });
  const err = compositionError(c) ?? (c.big + c.small + c.blank !== n ? `加起来要等于现在的 ${n} 人` : null);
  if (!open) {
    return (
      <span class="inline-actions">
        <button type="button" class="link-btn" onClick={() => setOpen(true)}>
          自定义
        </button>
        {current ? (
          <button type="button" class="link-btn" onClick={() => conn.settings({ composition: null })}>
            恢复预设
          </button>
        ) : null}
      </span>
    );
  }
  const step = (k: keyof Composition, d: number) => setC({ ...c, [k]: Math.max(0, c[k] + d) });
  return (
    <div class="comp">
      {(['big', 'small', 'blank'] as const).map((k) => (
        <span class="stepper" key={k}>
          <small>{{ big: '大国', small: '小国', blank: '白板' }[k]}</small>
          <button type="button" onClick={() => step(k, -1)}>
            −
          </button>
          <b>{c[k]}</b>
          <button type="button" onClick={() => step(k, 1)}>
            +
          </button>
        </span>
      ))}
      {err ? <small class="hint-bad">{err}</small> : null}
      <span class="inline-actions">
        <button
          type="button"
          class="btn"
          disabled={!!compositionError(c)}
          onClick={() => {
            conn.settings({ composition: c });
            setOpen(false);
          }}
        >
          保存
        </button>
        <button type="button" class="link-btn" onClick={() => setOpen(false)}>
          取消
        </button>
      </span>
      <small>约束：大国 &gt; 小国 ≥ 2，白板 ≥ 1</small>
    </div>
  );
}

function PasswordCard({ conn, has }: { conn: RoomConnection; has: boolean }) {
  const [pw, setPw] = useState('');
  return (
    <Card>
      <h3 class="section-title">
        <span>房间密码</span>
        <small>{has ? '已设置' : '未设置'}</small>
      </h3>
      <form
        class="row"
        onSubmit={(e) => {
          e.preventDefault();
          conn.send({ t: 'password', password: pw.trim() || null });
          setPw('');
        }}
      >
        <input value={pw} maxLength={32} placeholder={has ? '输入新密码' : '设一个密码（可选）'} onInput={(e) => setPw(e.currentTarget.value)} />
        <button type="submit" class="btn" disabled={!pw.trim()}>
          设置
        </button>
      </form>
      {has ? (
        <button type="button" class="link-btn" onClick={() => conn.send({ t: 'password', password: null })}>
          取消密码
        </button>
      ) : null}
      <p class="note">已经在房间里的人不受影响；断线重连也不需要密码。</p>
    </Card>
  );
}

function MyName({ conn, name }: { conn: RoomConnection; name: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  if (!editing) {
    return (
      <button type="button" class="btn btn--ghost btn--wide" onClick={() => (setVal(name), setEditing(true))}>
        改名字（现在是 {name}）
      </button>
    );
  }
  return (
    <form
      class="row"
      onSubmit={(e) => {
        e.preventDefault();
        conn.send({ t: 'rename', name: val });
        setEditing(false);
      }}
    >
      <input value={val} maxLength={10} onInput={(e) => setVal(e.currentTarget.value)} autoFocus />
      <button type="submit" class="btn">
        保存
      </button>
    </form>
  );
}

function Choice({ value, options, onChange, disabled }: { value: string; options: [string, string][]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <span class="choice" role="radiogroup">
      {options.map(([v, label]) => (
        <button type="button" role="radio" aria-checked={value === v} class={`pick pick--sm ${value === v ? 'is-on' : ''}`} disabled={disabled} onClick={() => onChange(v)} key={v}>
          {label}
        </button>
      ))}
    </span>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} class={`switch ${on ? 'is-on' : ''}`} disabled={disabled} onClick={() => onChange(!on)}>
      <i />
      <span>{label}</span>
    </button>
  );
}

/** 'anthropic/claude-opus-5.5' → 'Claude Opus 5.5' */
function modelName(id: string | null): string {
  if (!id) return '未知模型';
  return id
    .replace(/^.*\//, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** 大厅里显示的上一局结果（一行）。 */
export function lastResultLine(snap: Snapshot): string | null {
  const r = snap.game?.result;
  return r && snap.game?.phase === 'over' ? resultLine(r) : null;
}

/** 主持人自己的面板：说明 + 自带词表单。 */
function ModeratorCard({ conn, room }: { conn: RoomConnection; room: RoomView }) {
  const custom = room.settings.wordSource === 'custom';
  const p = room.customPair;
  const [f, setF] = useState({
    wordA: p?.wordA ?? '',
    wordB: p?.wordB ?? '',
    senseA: p?.senseA ?? '',
    senseB: p?.senseB ?? '',
    aliasesA: p?.aliasesA?.join('、') ?? '',
    aliasesB: p?.aliasesB?.join('、') ?? '',
    link: p?.link ?? '',
    hints: p?.hints?.join('\n') ?? '',
  });
  const field = (k: keyof typeof f) => ({
    value: f[k],
    onInput: (e: { currentTarget: { value: string } }) => {
      const value = e.currentTarget.value;
      setF((prev) => ({ ...prev, [k]: value })); // 函数式更新：几个框同时变（粘贴、自动填充）也不会互相覆盖
    },
  });
  return (
    <Card tone="accent">
      <h3 class="section-title">
        <span>你是主持人</span>
        <small>MODERATOR</small>
      </h3>
      <p class="note">
        你不参与这一局。开局后你会看到两个词、所有人的身份和整局记录
        {room.settings.judge === 'human' ? '，并负责判定提问和猜词' : '；判定交给 AI 裁判，你旁观'}。
      </p>
      {custom ? (
        <form
          class="pair-form"
          onSubmit={(e) => {
            e.preventDefault();
            const list = (v: string) => v.split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean);
            conn.send({ t: 'customPair', pair: { ...f, aliasesA: list(f.aliasesA), aliasesB: list(f.aliasesB), hints: list(f.hints) } });
          }}
        >
          <p class="lead">出题：两个词和它们的联系</p>
          <div class="pair-cols">
            <label class="field">
              <span>词 A</span>
              <input maxLength={20} placeholder="例：鱿鱼" {...field('wordA')} />
            </label>
            <label class="field">
              <span>词 B</span>
              <input maxLength={20} placeholder="例：股票" {...field('wordB')} />
            </label>
          </div>
          <label class="field">
            <span>联系（两轮无人猜中后作为第一条提示公布）</span>
            <input maxLength={80} placeholder="例：都是可以「炒」的东西" {...field('link')} />
          </label>
          <details class="howto">
            <summary>可选：义项、别名、更多提示</summary>
            <div class="pair-cols">
              <label class="field">
                <span>A 的义项（裁判按这个理解）</span>
                <input maxLength={40} placeholder="例：海洋动物、食材" {...field('senseA')} />
              </label>
              <label class="field">
                <span>B 的义项</span>
                <input maxLength={40} placeholder="例：证券" {...field('senseB')} />
              </label>
              <label class="field">
                <span>A 的别名（用顿号隔开，猜到也算对）</span>
                <input placeholder="例：柔鱼、枪乌贼" {...field('aliasesA')} />
              </label>
              <label class="field">
                <span>B 的别名</span>
                <input {...field('aliasesB')} />
              </label>
            </div>
            <label class="field">
              <span>更多提示（每行一条，越往后越直白）</span>
              <textarea rows={3} {...field('hints')} />
            </label>
          </details>
          <button type="submit" class="btn btn--accent btn--wide">
            {p ? '更新词对' : '保存词对'}
          </button>
          {p ? (
            <p class="note">
              已保存：{p.wordA} / {p.wordB}。哪个给大国开局时随机决定。这对词开局后就用掉了，下一局要重新出题。
            </p>
          ) : null}
        </form>
      ) : (
        <p class="note">现在用题库出题。想自己出题，请房主把「词对来源」改成「自带词」。</p>
      )}
    </Card>
  );
}
