/** 房间大厅：房间号和二维码、成员、规则设置、开局。 */

import { useMemo, useState } from 'preact/hooks';
import { renderSVG } from 'uqr';
import { DEFAULT_TIMERS, PRESETS, compositionError, type Composition, type Timers } from '../engine/rules.ts';
import type { RoomSettings } from '../shared/protocol.ts';
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
  const n = room.members.length;

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
          <span>玩家 {n} 人</span>
          <small>{n < 6 ? `至少 6 人，还差 ${6 - n} 人` : n > 12 ? '最多 12 人' : 'PLAYERS'}</small>
        </h3>
        <ul class="members">
          {room.members.map((m) => (
            <li key={m.id} class={m.id === room.me ? 'is-me' : ''}>
              <i class={`dot ${m.online ? 'is-on' : ''}`} title={m.online ? '在线' : '离线'} />
              <span class="m-name">
                {m.name}
                {m.host ? <em>房主</em> : null}
              </span>
              <span class="m-score">{m.score} 分</span>
              {isHost && m.id !== room.me ? (
                <span class="m-actions">
                  <button type="button" class="link-btn" onClick={() => conn.send({ t: 'transfer', id: m.id })}>
                    设为房主
                  </button>
                  <button type="button" class="link-btn" onClick={() => confirm(`请 ${m.name} 离开房间？`) && conn.send({ t: 'kick', id: m.id })}>
                    请离开
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Settings conn={conn} settings={room.settings} n={n} editable={isHost} />

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

function Settings({ conn, settings: s, n, editable }: { conn: RoomConnection; settings: RoomSettings; n: number; editable: boolean }) {
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

        <dt>裁判</dt>
        <dd>
          <small>AI 裁判接入中。现在猜词只认完全一致的写法（含别名），提问一律答「无法判断」。</small>
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

/** 大厅里显示的上一局结果（一行）。 */
export function lastResultLine(snap: Snapshot): string | null {
  const r = snap.game?.result;
  return r && snap.game?.phase === 'over' ? resultLine(r) : null;
}
