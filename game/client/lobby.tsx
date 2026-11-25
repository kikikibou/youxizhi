/** 房间大厅：房间号和二维码、成员、规则设置、开局。 */

import type { ComponentChildren } from 'preact';
import { useId, useMemo, useState } from 'preact/hooks';
import { renderSVG } from 'uqr';
import { DEFAULT_TIMERS, MAX_PLAYERS, MIN_PLAYERS, PRESETS, compositionError, type Composition, type Timers } from '../engine/rules.ts';
import type { RoomSettings, RoomView } from '../shared/protocol.ts';
import type { RoomConnection, Snapshot } from './net.ts';
import { Avatar, DrawPad, defaultAvatar, randomPreset } from './avatar.tsx';
import { RULE_INFO, resultLine } from './text.ts';
import { Card, RoundTable, Ticks, pad2, previewFlags } from './ui.tsx';

/** 计时档位：在默认时长上整体乘一个系数（出局最短展示、冷却、裁判等待不变）。 */
const SCALED: (keyof Timers)[] = ['night', 'clue', 'discussion', 'vote', 'exitChoice', 'turn', 'reliefAsk', 'reliefGuess', 'hintInterval', 'bigChance'];
const PACES = [
  { id: 'untimed', label: '不限时' },
  { id: 'fast', label: '紧凑', k: 2 / 3 },
  { id: 'normal', label: '标准', k: 1 },
  { id: 'slow', label: '宽松', k: 1.5 },
] as const;
function paceTimers(k: number): Timers {
  const t = { ...DEFAULT_TIMERS };
  for (const key of SCALED) t[key] = Math.round((DEFAULT_TIMERS[key] * k) / 1000) * 1000;
  return t;
}
function currentPace(s: RoomSettings): string | null {
  if (s.untimed) return 'untimed';
  return PACES.find((p) => 'k' in p && SCALED.every((key) => paceTimers(p.k)[key] === s.timers[key]))?.id ?? null;
}

export function shareLink(code: string): string {
  return `${location.origin}${location.pathname}#/${code}`;
}

export function Lobby({ conn, snap, lastGame, onShowLast }: { conn: RoomConnection; snap: Snapshot; lastGame: boolean; onShowLast: () => void }) {
  const room = snap.room!;
  const me = room.members.find((m) => m.id === room.me);
  const isHost = room.hostId === room.me;
  const link = shareLink(room.code);
  const moderator = room.members.find((m) => m.id === room.moderatorId) ?? null;
  const isModerator = room.moderatorId === room.me;
  const players = room.members.filter((m) => m.id !== room.moderatorId);
  /** 玩家人数：主持人不算。 */
  const n = players.length;

  return (
    <div class="lobby">
      <header class="room-head">
        <div class="room-code-block">
          <span class="kicker">房间号 / ROOM NO.</span>
          <b class="room-code reg">{room.code}</b>
        </div>
        <div class="room-side">
          {room.hasPassword ? (
            <em class="chip chip--lock">
              <Padlock />
              有口令
            </em>
          ) : (
            <em class="chip">无口令</em>
          )}
          <span class="seatcount">
            <b>
              {pad2(n)}/{MAX_PLAYERS}
            </b>
            <Ticks n={MAX_PLAYERS} done={Math.min(n, MAX_PLAYERS)} label={`${n} 人入座，最多 ${MAX_PLAYERS} 人`} />
            <small>SEATS / 席位</small>
          </span>
        </div>
      </header>

      <RoundTable
        tilt={58}
        ripple
        label={`桌边 ${n} 人`}
        seats={players.map((m) => ({ id: m.id, name: m.name, me: m.id === room.me, offline: !m.online, tag: m.host ? '房主' : undefined }))}
      />
      <p class="table-note">
        {n < MIN_PLAYERS ? `至少 ${MIN_PLAYERS} 人，还差 ${MIN_PLAYERS - n} 人` : n > MAX_PLAYERS ? `最多 ${MAX_PLAYERS} 人` : '开局时随机排座位号，大家照号坐成一圈'}
        {moderator ? ` · 主持人 ${moderator.name} 不入座` : ''}
      </p>

      {isModerator ? null : <FlagCard conn={conn} me={room.me} current={snap.avatars[room.me] ?? null} />}

      <Legend settings={room.settings} n={n} hasPassword={room.hasPassword} />

      <Invite code={room.code} link={link} />

      {lastGame && room.gameNo > 0 ? (
        <button type="button" class="btn btn--ghost btn--wide" onClick={onShowLast}>
          查看第 {room.gameNo} 局的结算和记录
        </button>
      ) : null}

      <Card>
        <h3 class="section-title">
          <span>成员</span>
          <small>
            {n} PLAYERS{moderator ? ' + 1 MOD' : ''}
          </small>
        </h3>
        <ul class="members">
          {room.members.map((m, i) => (
            <li key={m.id} class={m.id === room.me ? 'is-me' : ''}>
              <b class="m-no">{pad2(i + 1)}</b>
              <Avatar id={m.id} size={26} />
              <i class={`dot ${m.online ? 'is-on' : ''}`} title={m.online ? '在线' : '离线'} />
              <span class="m-name">
                {m.name}
                {m.id === room.me ? <em class="em-me">你</em> : null}
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

      <Settings conn={conn} settings={room.settings} n={n} editable={isHost} judge={room.judge} bank={room.bank} />

      {isHost ? <PasswordCard conn={conn} has={room.hasPassword} /> : null}

      <div class="start">
        {isHost ? (
          <button type="button" class="btn btn--accent btn--wide btn--big" disabled={!!room.startBlocker} onClick={() => conn.send({ t: 'start' })}>
            {room.gameNo ? '开始下一局' : '开局'}
          </button>
        ) : (
          <p class="waiting">等房主开局{me ? `（你是 ${me.name}）` : ''}</p>
        )}
        {room.startBlocker ? <p class="note note--warn">{room.startBlocker}</p> : null}
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

function Padlock() {
  return (
    <svg aria-hidden="true" width="11" height="13" viewBox="0 0 12 14" class="padlock">
      <path d="M3 6.5V4.5a3 3 0 0 1 6 0v2" />
      <rect x="1" y="6.5" width="10" height="7.5" />
    </svg>
  );
}

/** 图例：这一局几个大国、几个小国、几个白板，裁判、节奏、口令。 */
function Legend({ settings: s, n, hasPassword }: { settings: RoomSettings; n: number; hasPassword: boolean }) {
  const comp = s.composition ?? PRESETS[n] ?? null;
  const pace = currentPace(s);
  const rows = [
    { k: 'big', label: '大国', count: comp?.big ?? 0 },
    { k: 'small', label: '小国', count: comp?.small ?? 0 },
    { k: 'blank', label: '白板', count: comp?.blank ?? 0 },
  ] as const;
  return (
    <section class="card legend">
      <h3 class="section-title">
        <span>图例</span>
        <small>LEGEND</small>
      </h3>
      <div class="legend-main">
        {rows.map((r) => (
          <div class="legend-row" key={r.k}>
            <i class={`swatch swatch--${r.k}`} aria-hidden="true" />
            <span class="legend-name">{r.label}</span>
            <span class="leader" aria-hidden="true" />
            <span class="legend-pics" aria-hidden="true">
              {Array.from({ length: Math.min(r.count, 6) }, (_, i) => (
                <i class={`pic pic--${r.k}`} key={i} />
              ))}
            </span>
            <b class="legend-n">{comp ? r.count : '–'}</b>
          </div>
        ))}
        <div class="legend-sum">
          <span>{comp ? `${comp.big} + ${comp.small} + ${comp.blank} = ${pad2(comp.big + comp.small + comp.blank)}` : `${pad2(n)} 人`}</span>
          <small>{comp ? (s.composition ? '自定义' : '按人数预设') : `${MIN_PLAYERS}–${MAX_PLAYERS} 人才能开`}</small>
        </div>
      </div>
      <dl class="legend-side">
        <div>
          <dt>裁判 JUDGE</dt>
          <dd>
            {s.judge === 'llm' ? (
              <>
                <em class="ai">AI</em>自动判
              </>
            ) : (
              '主持人判'
            )}
          </dd>
        </div>
        <div>
          <dt>节奏 PACE</dt>
          <dd>{PACES.find((p) => p.id === pace)?.label ?? '自定义'}</dd>
        </div>
        <div>
          <dt>口令 LOCK</dt>
          <dd class={hasPassword ? 'acc-text' : ''}>{hasPassword ? '已开启' : '未设'}</dd>
        </div>
      </dl>
    </section>
  );
}

/** 邀请：一张入境许可票根，二维码在存根上，点票面复制链接。 */
function Invite({ code, link }: { code: string; link: string }) {
  const qr = useMemo(() => renderSVG(link, { border: 1 }), [link]);
  const [copied, setCopied] = useState(false);
  return (
    <section class="card ticket">
      <h3 class="section-title">
        <span>邀请</span>
        <small>INVITE</small>
      </h3>
      <button
        type="button"
        class="ticket-main"
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
        <span class="kicker">
          <span>入境许可 ENTRY PERMIT</span>
          <span>№ {code}</span>
        </span>
        <b>{copied ? '已复制，发给大家吧' : '扫码进房 / 点这里复制链接'}</b>
        <span class="ticket-link">{link.replace(/^https?:\/\//, '')}</span>
      </button>
      <span class="perf" aria-hidden="true" />
      <div class="ticket-stub" role="img" aria-label="房间二维码" dangerouslySetInnerHTML={{ __html: qr }} />
    </section>
  );
}

function Settings({
  conn,
  settings: s,
  n,
  editable,
  judge,
  bank,
}: {
  conn: RoomConnection;
  settings: RoomSettings;
  n: number;
  editable: boolean;
  judge: RoomView['judge'];
  bank: RoomView['bank'];
}) {
  const preset = PRESETS[n];
  const comp = s.composition ?? preset;
  const set = (patch: Partial<RoomSettings>) => editable && conn.settings(patch);
  const pace = currentPace(s);
  const smallest = comp ? Math.min(comp.big, comp.small) : null;
  const picked = (name: string) => s.banks === null || s.banks.includes(name);
  const toggleBank = (name: string) => {
    const all = bank.banks.map((b) => b.name);
    const cur = s.banks ?? all;
    const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
    if (!next.length) return; // 至少留一个
    set({ banks: next.length === all.length ? null : next });
  };
  return (
    <Card class="rules-card">
      <h3 class="section-title">
        <span>规则</span>
        <small>RULES · {editable ? '房主可改' : '房主设置'}</small>
      </h3>
      <div class="rules">
        <Rule label="阵营" en="FACTIONS" info={RULE_INFO.composition}>
          <span class="rule-value">
            {comp ? `${comp.big} 大国 · ${comp.small} 小国 · ${comp.blank} 白板` : '—'}
            <small>{s.composition ? '自定义' : '按人数预设'}</small>
          </span>
          {editable ? <CompositionEditor conn={conn} current={s.composition} n={n} /> : null}
        </Rule>

        <Rule label="白板互认" en="RECOGNITION" info={RULE_INFO.recognition}>
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
        </Rule>

        <Rule label="白板提前获胜" en="EARLY WIN" info={RULE_INFO.wipeout}>
          <span class="threshold">
            <span>某国存活</span>
            <span class="stepper stepper--inline">
              <button type="button" disabled={!editable || s.wipeoutThreshold <= 0} onClick={() => set({ wipeoutThreshold: s.wipeoutThreshold - 1 })} aria-label="减一">
                −
              </button>
              <b>{s.wipeoutThreshold}</b>
              <button type="button" disabled={!editable || s.wipeoutThreshold >= 5} onClick={() => set({ wipeoutThreshold: s.wipeoutThreshold + 1 })} aria-label="加一">
                +
              </button>
            </span>
            <span>人（含）以下</span>
          </span>
          <small>{s.wipeoutThreshold === 0 ? '0 = 某国全部出局时白板获胜' : `某国只剩 ${s.wipeoutThreshold} 人或更少时白板获胜`}</small>
          {smallest !== null && s.wipeoutThreshold >= smallest ? <small class="hint-bad">现在的阵营里有一国只有 {smallest} 人：第一次投票后白板就会直接获胜</small> : null}
          <Toggle on={s.wipeoutVsBlanks} disabled={!editable} onChange={(on) => set({ wipeoutVsBlanks: on })} label="某国存活人数少于白板存活人数时，白板也获胜" />
        </Rule>

        <Rule label="第二阶段提问" en="PHASE II" info={RULE_INFO.phase2Questions}>
          <Toggle on={s.phase2Questions} disabled={!editable} onChange={(on) => set({ phase2Questions: on })} label="回合内可以改为向裁判提问 Yes / No 问题" />
        </Rule>

        <Rule label="同桌模式" en="SAME TABLE" info={RULE_INFO.tableMode}>
          <Toggle on={s.tableMode} disabled={!editable} onChange={(on) => set({ tableMode: on })} label="夜晚所有人都操作手机，免得暴露白板" />
        </Rule>

        <Rule label="节奏" en="PACE" info={RULE_INFO.pace}>
          <Choice
            value={pace ?? 'custom'}
            disabled={!editable}
            options={[...PACES.map((p) => [p.id, p.label] as [string, string]), ...(pace ? [] : [['custom', '自定义'] as [string, string]])]}
            onChange={(v) => {
              if (v === 'untimed') return set({ untimed: true });
              const p = PACES.find((x) => x.id === v);
              if (p && 'k' in p) set({ untimed: false, timers: paceTimers(p.k) });
            }}
          />
          <small>
            {s.untimed
              ? '每一步都等大家操作完；有人走开时，房主可以「跳过等待」。'
              : `身份提示 ${s.timers.clue / 1000} 秒 / 人 · 自由讨论 ${s.timers.discussion / 1000} 秒 · 投票 ${s.timers.vote / 1000} 秒`}
          </small>
        </Rule>

        <Rule label="词对来源" en="WORDS" info={RULE_INFO.wordSource}>
          <Choice
            value={s.wordSource}
            disabled={!editable}
            options={[
              ['bank', '题库'],
              ['custom', '自带词'],
            ]}
            onChange={(v) => set({ wordSource: v as RoomSettings['wordSource'] })}
          />
          {s.wordSource === 'custom' ? (
            <small>自带词：由主持人在开局前填两个词和联系。</small>
          ) : (
            <>
              <ul class="banks">
                {bank.banks.map((b) => (
                  <li key={b.name}>
                    <label class={`bank ${picked(b.name) ? 'is-on' : ''}`}>
                      <input type="checkbox" checked={picked(b.name)} disabled={!editable} onChange={() => toggleBank(b.name)} />
                      <i aria-hidden="true" />
                      <span class="bank-name">{b.name}</span>
                      <span class="bank-n">
                        {b.left}/{b.total}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <small>
                {bank.sample ? '还没导入正式题库，现在是 5 组示例。' : ''}勾选的题库共 {bank.total} 组，这个房间里还没人玩过的 {bank.left} 组。题目不分难度。
              </small>
            </>
          )}
        </Rule>

        <Rule label="裁判方式" en="JUDGE" info={RULE_INFO.judge}>
          <Choice
            value={s.judge}
            disabled={!editable}
            options={[
              ['llm', 'AI 裁判'],
              ['human', '主持人判定'],
            ]}
            onChange={(v) => set({ judge: v as RoomSettings['judge'] })}
          />
          <small>
            {s.judge === 'human'
              ? '主持人在手机上手动判定提问和猜词。'
              : judge.ai
                ? `AI 裁判（${modelName(judge.model)}）回答是非问题、判定猜词。`
                : 'AI 裁判还没配置好：猜词只认完全一致的写法（含别名），提问一律答「无法判断」。'}
          </small>
        </Rule>
      </div>
    </Card>
  );
}

/** 一条规则：标题行（带 ⓘ 说明按钮）+ 下面的选项。 */
function Rule({ label, en, info, children }: { label: string; en: string; info?: readonly string[]; children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div class="rule">
      <div class="rule-head">
        <span class="rule-label">{label}</span>
        <small>{en}</small>
        {info ? (
          <button type="button" class={`info ${open ? 'is-on' : ''}`} aria-expanded={open} aria-controls={id} aria-label={`${label}：规则说明`} onClick={() => setOpen(!open)}>
            i
          </button>
        ) : null}
      </div>
      {open && info ? (
        <ul class="info-box" id={id}>
          {info.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
      <div class="rule-body">{children}</div>
    </div>
  );
}

/** 我的国旗：大厅里换头像。 */
function FlagCard({ conn, me, current }: { conn: RoomConnection; me: string; current: string | null }) {
  const [drawing, setDrawing] = useState(previewFlags.drawing);
  return (
    <Card class="flag-card">
      <h3 class="section-title">
        <span>我的国旗</span>
        <small>FLAG · 头像</small>
      </h3>
      {drawing ? (
        <DrawPad
          initial={current}
          onSave={(v) => {
            conn.send({ t: 'avatar', avatar: v });
            setDrawing(false);
          }}
          onCancel={() => setDrawing(false)}
        />
      ) : (
        <div class="flag-row">
          <Avatar id={me} value={current ?? defaultAvatar(me)} size={92} class="flag-big" />
          <div class="flag-side">
            <p class="lead">每个人都是一个国家</p>
            <p class="note">画一面你的国旗，会出现在圆桌、护照和档案里。不想画就点「随机」。</p>
            <div class="flag-actions">
              <button type="button" class="btn" onClick={() => setDrawing(true)}>
                ✎ 画一面
              </button>
              <button type="button" class="btn" onClick={() => conn.send({ t: 'avatar', avatar: randomPreset(current) })}>
                ⟳ 随机
              </button>
            </div>
          </div>
        </div>
      )}
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
        <span>口令</span>
        <small>PASSWORD · {has ? '已设置' : '未设置'}</small>
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
    judgeNote: p?.judgeNote ?? '',
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
            <label class="field">
              <span>裁判须知（给 AI 裁判的补充说明，玩家看不到）</span>
              <textarea rows={2} maxLength={200} placeholder="例：问「能不能炒」答是；「墨鱼」不算鱿鱼" {...field('judgeNote')} />
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
