/**
 * 通用小部件：标志、面板、倒计时、圆桌座次、迷你座次图、选人、按住查看身份（护照）、记录、私密频道、输入框。
 * 视觉是「图纸」风格：白底细线 + 珊瑚红 / 电光蓝两种油墨；夜晚换成靛蓝底，蓝色当主角。
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Channel } from '../engine/types.ts';
import type { PlayerView, PublicPlayer } from '../engine/view.ts';
import type { RoomConnection } from './net.ts';
import { ANSWER, ROLE, ROLE_DUTY, describe } from './text.ts';

/** 预览器用：强制「按住看身份」处于打开状态。 */
export const previewFlags = { holdOpen: false };

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** 每隔 ms 重新渲染一次。 */
export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** 标志：大块珊瑚红是「大」，小块蓝是「小」，一根线是两个词之间的联系。 */
export function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg class="mark" aria-hidden="true" width={size} height={(size * 18) / 21} viewBox="0 0 21 18">
      <rect x="0" y="5" width="13" height="13" class="mark-big" />
      <rect x="15" y="0" width="6" height="6" class="mark-small" />
      <path d="M12.5 5.5 L15.5 2.5" class="mark-link" />
    </svg>
  );
}

/** 屏幕四角的裁切角标。 */
export function CropMarks() {
  return (
    <div class="crops" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

export function Card({ children, tone, class: cls }: { children: ComponentChildren; tone?: 'night' | 'accent'; class?: string }) {
  return <section class={`card ${tone ? `card--${tone}` : ''} ${cls ?? ''}`}>{children}</section>;
}

export function Countdown({ deadline, offset, label }: { deadline: number | null; offset: number; label?: string }) {
  useTick(250);
  if (deadline === null) return null;
  const left = Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000));
  return (
    <span class={`clock ${left <= 5 ? 'is-low' : ''}`} role="timer" aria-label={`${label ?? '剩余'} ${left} 秒`}>
      {label ? <small>{label}</small> : null}
      <b>{left}</b>
      <i>SEC</i>
    </span>
  );
}

/* ================================================================ 圆桌 */

export interface TableSeat {
  id: string;
  name: string;
  /** 座位号（从 1 起）；大厅里还没分座位时不给。 */
  num?: number;
  me?: boolean;
  out?: boolean;
  offline?: boolean;
  active?: boolean;
  /** 选中（夜晚、投票）。 */
  on?: boolean;
  disabled?: boolean;
  tag?: string;
}

/**
 * 一张圆桌，座位按顺时针排一圈。tilt > 0 时桌面斜放、名牌立起来（大厅）；
 * 给了 onPick 时名牌是按钮（夜晚选人、投票）。
 */
export function RoundTable({
  seats,
  tilt = 0,
  onPick,
  label,
  ripple,
}: {
  seats: TableSeat[];
  tilt?: number;
  onPick?: (id: string) => void;
  label: string;
  ripple?: boolean;
}) {
  const n = Math.max(seats.length, 1);
  // 「我」固定坐在靠近自己的一侧（正下方），其余人按顺时针排开
  const meAt = Math.max(0, seats.findIndex((s) => s.me));
  const angle = (i: number) => ((90 + (360 * (i - meAt)) / n) * Math.PI) / 180;
  const ticks = Array.from({ length: n }, (_, i) => {
    const a = angle(i);
    return `M${150 + 140 * Math.cos(a)} ${150 + 140 * Math.sin(a)} L${150 + 149 * Math.cos(a)} ${150 + 149 * Math.sin(a)}`;
  }).join(' ');
  return (
    <div
      class={`rt ${tilt ? 'rt--tilt' : 'rt--flat'} ${n > 9 ? 'rt--crowded' : ''}`}
      style={{ '--tilt': `${tilt}deg` }}
      role={onPick ? 'radiogroup' : 'group'}
      aria-label={label}
    >
      <div class="rt-plane">
        <svg class="rt-deco" viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r="149" class="rt-ring" />
          <path d={ticks} class="rt-ticks" />
          <circle cx="150" cy="150" r="98" class="rt-table" />
          <circle cx="153" cy="153" r="98" class="rt-reg-b" />
          <circle cx="147" cy="154" r="98" class="rt-reg-a" />
          <circle cx="150" cy="150" r="40" class="rt-inner" />
          <rect x="138" y="141" width="18" height="18" class="mark-big" />
          <rect x="158" y="133" width="7" height="7" class="mark-small" />
        </svg>
        {ripple ? <i class="rt-ripple" aria-hidden="true" /> : null}
        {seats.map((s, i) => {
          const a = angle(i);
          const cls = `rt-tag ${s.me ? 'is-me' : ''} ${s.out ? 'is-out' : ''} ${s.offline ? 'is-offline' : ''} ${s.active ? 'is-active' : ''} ${s.on ? 'is-on' : ''}`;
          const inner = (
            <>
              {s.num !== undefined ? <b>{pad2(s.num)}</b> : null}
              <span class="rt-name">{s.name}</span>
              {s.tag ? <em>{s.tag}</em> : null}
            </>
          );
          return (
            <div class="rt-seat" style={{ left: `${50 + 40.5 * Math.cos(a)}%`, top: `${50 + 40.5 * Math.sin(a)}%`, '--d': `${i * 50}ms` }} key={s.id}>
              {tilt ? <i class={`rt-dot ${s.me ? 'is-me' : ''} ${s.out || s.offline ? 'is-out' : ''}`} /> : null}
              <span class="rt-stand">
                {onPick ? (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!!s.on}
                    class={cls}
                    disabled={s.disabled}
                    title={s.name}
                    onClick={() => onPick(s.id)}
                  >
                    {inner}
                  </button>
                ) : (
                  <span class={cls} title={s.name}>
                    {inner}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 迷你座次图（对局顶部）：编号方块围一圈，标出我、出局的人、正在行动的人；
 * 发言时画一道从起点出发、按方向绕一圈的箭头。
 */
export function MiniTable({ v, active, start, dir }: { v: PlayerView; active?: string | null; start?: string | null; dir?: 'cw' | 'ccw' | null }) {
  const n = v.players.length;
  // 和大圆桌一样：我在正下方
  const base = (seat: number) => 90 + (360 * (seat - v.me.seat)) / n;
  const pos = (seat: number, r: number) => {
    const a = (base(seat) * Math.PI) / 180;
    return [75 + r * Math.cos(a), 75 + r * Math.sin(a)] as const;
  };
  let arc: { d: string; head: string; dot: readonly [number, number] } | null = null;
  const sp = start ? v.players.find((p) => p.id === start) : null;
  if (sp && dir) {
    const sgn = dir === 'cw' ? 1 : -1;
    const a0 = base(sp.seat) + sgn * 10;
    const a1 = a0 + sgn * 300;
    const pt = (deg: number, r = 64) => [75 + r * Math.cos((deg * Math.PI) / 180), 75 + r * Math.sin((deg * Math.PI) / 180)] as const;
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    const [tx, ty] = pt(a1 + sgn * 9);
    const [bx1, by1] = pt(a1 - sgn * 1, 70);
    const [bx2, by2] = pt(a1 - sgn * 1, 58);
    arc = {
      d: `M${x0.toFixed(1)} ${y0.toFixed(1)} A64 64 0 1 ${dir === 'cw' ? 1 : 0} ${x1.toFixed(1)} ${y1.toFixed(1)}`,
      head: `M${tx.toFixed(1)} ${ty.toFixed(1)} L${bx1.toFixed(1)} ${by1.toFixed(1)} L${bx2.toFixed(1)} ${by2.toFixed(1)} Z`,
      dot: [x0, y0],
    };
  }
  return (
    <svg class="mini" viewBox="0 0 150 150" role="img" aria-label={`座次：共 ${n} 人${active ? `，现在轮到 ${v.players.find((p) => p.id === active)?.name ?? ''}` : ''}`}>
      <circle cx="75" cy="75" r="70" class="mini-ring" />
      <circle cx="77" cy="76.5" r="33" class="rt-reg-b" />
      <circle cx="73" cy="77.5" r="33" class="rt-reg-a" />
      <circle cx="75" cy="75" r="33" class="mini-table" />
      <circle cx="75" cy="75" r="29" class="mini-hatch" />
      <rect x="68" y="69" width="11" height="11" class="mark-big" />
      <rect x="80" y="64" width="5" height="5" class="mark-small" />
      {arc ? (
        <>
          <path d={arc.d} class="mini-arc" />
          <path d={arc.head} class="mini-head" />
          <circle cx={arc.dot[0]} cy={arc.dot[1]} r="4" class="mini-head" />
        </>
      ) : null}
      {v.players.map((p) => {
        const [x, y] = pos(p.seat, 50);
        const me = p.id === v.me.id;
        if (!p.alive) {
          return (
            <g key={p.id} class="mini-out">
              <rect x={x - 6.5} y={y - 6.5} width="13" height="13" />
              <path d={`M${x - 4.5} ${y - 4.5} L${x + 4.5} ${y + 4.5} M${x + 4.5} ${y - 4.5} L${x - 4.5} ${y + 4.5}`} />
            </g>
          );
        }
        return (
          <g key={p.id} class={`mini-seat ${me ? 'is-me' : ''}`}>
            <rect x={x - 6.5} y={y - 6.5} width="13" height="13" />
            <text x={x} y={y + 0.6}>
              {p.seat + 1}
            </text>
            {p.id === active ? (
              <path
                class="mini-now"
                d={`M${x - 12} ${y - 6} V${y - 12} H${x - 6} M${x + 6} ${y - 12} H${x + 12} V${y - 6} M${x + 12} ${y + 6} V${y + 12} H${x + 6} M${x - 6} ${y + 12} H${x - 12} V${y + 6}`}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** 方格选人（第二阶段等不需要圆桌的地方）。 */
export function PlayerPicker({ players, value, onPick, disabled }: { players: PublicPlayer[]; value: string | null; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <div class="picker" role="radiogroup">
      {players.map((p) => (
        <button type="button" role="radio" aria-checked={value === p.id} class={`pick ${value === p.id ? 'is-on' : ''}`} disabled={disabled} onClick={() => onPick(p.id)} key={p.id}>
          <b>{pad2(p.seat + 1)}</b>
          {p.name}
        </button>
      ))}
    </div>
  );
}

/** 一排计数小格：done 格涂满。 */
export function Ticks({ n, done, label }: { n: number; done: number; label?: string }) {
  return (
    <span class="ticks" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {Array.from({ length: n }, (_, i) => (
        <i class={i < done ? 'on' : ''} key={i} />
      ))}
    </span>
  );
}

/* ================================================================ 身份（护照） */

/**
 * 按住查看身份。所有私密信息（词、白板身份、队友、裁判的私下回答、夜晚该选哪一项）都只在按住时显示，
 * 面对面玩时旁边的人瞄一眼屏幕也看不到。按住时整屏换成一本「临时护照」。
 */
export function HoldIdentity({ v }: { v: PlayerView }) {
  const [open, setOpen] = useState(previewFlags.holdOpen);
  const show = (e: PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* 有的浏览器不支持就算了 */
    }
    setOpen(true);
  };
  const hide = () => setOpen(previewFlags.holdOpen);
  return (
    <>
      <button
        type="button"
        class={`hold ${open ? 'is-open' : ''}`}
        onPointerDown={show}
        onPointerUp={hide}
        onPointerCancel={hide}
        onLostPointerCapture={hide}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setOpen(true)}
        onKeyUp={hide}
        onContextMenu={(e) => e.preventDefault()}
      >
        <i class="hold-stripes" aria-hidden="true" />
        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 26 26" class="hold-eye">
          <path d="M2 13s4-7 11-7 11 7 11 7-4 7-11 7S2 13 2 13z" />
          <circle cx="13" cy="13" r="3.2" />
        </svg>
        <span class="hold-label">
          <b>{open ? '看着呢' : '按住看身份'}</b>
          <small>{open ? '松手就藏好 · RELEASE TO HIDE' : v.me.alive ? 'HOLD · 别让旁边的人瞄到' : '你已出局 · HOLD'}</small>
        </span>
      </button>
      {open ? (
        <div class="passport-screen" aria-live="polite">
          <Passport v={v} />
        </div>
      ) : null}
    </>
  );
}

function mrz(parts: string[], len = 34): string {
  return parts.join('<').replace(/[^A-Z0-9<]/g, '').padEnd(len, '<').slice(0, len);
}

export function Passport({ v }: { v: PlayerView }) {
  const seat = pad2(v.me.seat + 1);
  const blank = v.me.blank;
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  const answers = v.log.filter((e) => e.t === 'answer');
  const night = v.step.k === 'night' ? v.step : null;
  const big = blank ? ROLE[blank.role].replace(/（.*）/, '') : (v.me.word ?? '');
  const len = Array.from(big).length;
  const size = len <= 2 ? 84 : len <= 3 ? 68 : len <= 4 ? 54 : 40;
  return (
    <div class="passport">
      <div class="pp-band">
        <Mark size={24} />
        <span class="pp-title">
          <b>大国小国 · 临时护照</b>
          <small>PROVISIONAL PASSPORT</small>
        </span>
        <span class="pp-no">SEAT {seat}</span>
      </div>
      <div class="pp-top">
        <div class="pp-photo" aria-hidden="true">
          <svg viewBox="0 0 93 117">
            <circle cx="46.5" cy="44" r="18" />
            <path d="M12 117 C12 86 28 72 46.5 72 C65 72 81 86 81 117" />
          </svg>
        </div>
        <dl class="pp-fields">
          <div>
            <dt>姓名 / NAME</dt>
            <dd>{v.me.name}</dd>
          </div>
          <div>
            <dt>座位 / SEAT</dt>
            <dd>
              {seat} 号{v.me.alive ? '' : ' · 已出局'}
            </dd>
          </div>
          <div>
            <dt>国籍 / NATIONALITY</dt>
            <dd class="pp-nation">
              {blank ? (
                '白板阵营'
              ) : (
                <>
                  未知<em>大国？小国？</em>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>签发 / ISSUED</dt>
            <dd>第 {v.day} 天</dd>
          </div>
        </dl>
      </div>
      <p class="pp-kicker">
        <span>{blank ? '你的身份 / ROLE' : '你的词 / YOUR WORD'}</span>
        <span class="pp-scan-label">扫描 SCAN</span>
      </p>
      <div class="pp-word">
        <span style={{ fontSize: `${size}px` }}>{big}</span>
        <i class="pp-scanline" aria-hidden="true" />
      </div>
      {blank ? (
        <ul class="pp-notes">
          <li>{ROLE_DUTY[blank.role]}。目标是猜中大国词。</li>
          <li>
            {blank.teammates.length
              ? `你能认出的队友：${blank.teammates.map((t) => `${name(t.id)}（${t.role ? ROLE[t.role] : '白板阵营'}）`).join('、')}`
              : '你看不到其他队友。'}
          </li>
          {night?.decides.length ? <li class="pp-tonight">今晚你的选择决定：{night.decides.map((d) => (d === 'start' ? '起始玩家' : '方向')).join('和')}</li> : null}
          {answers.map((a, i) => (
            <li class="pp-answer" key={i}>
              裁判私下回答「{a.question}」→ <b>{ANSWER[a.answer]}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p class="pp-note">你不知道自己是大国还是小国，也不知道谁和你同一国。</p>
      )}
      <span class="pp-stamp" aria-hidden="true">
        <b>入境 · ADMITTED</b>
        <small>DAY {pad2(v.day)}</small>
      </span>
      <div class="pp-mrz" aria-hidden="true">
        <small>MACHINE READABLE ZONE</small>
        <span>{mrz(['P', 'DGX', `SEAT${seat}`, ''])}</span>
        <span>{mrz([`D${pad2(v.day)}`, blank ? 'BLANK' : 'UNKNOWN', v.me.alive ? 'A' : 'X'])}</span>
      </div>
    </div>
  );
}

/* ================================================================ 记录 */

/** 整局记录，按天分段，最近的在上面。 */
export function GameLog({ v }: { v: PlayerView }) {
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  const groups: { title: string; items: { text: string; tone?: string }[] }[] = [];
  let cur = { title: '开局', items: [] as { text: string; tone?: string }[] };
  for (const e of v.log) {
    if (e.t === 'night') {
      if (cur.items.length) groups.push(cur);
      cur = { title: `第 ${e.day} 天`, items: [] };
    } else if (e.t === 'phase2') {
      if (cur.items.length) groups.push(cur);
      cur = { title: '第二阶段', items: [] };
    }
    const d = describe(e, name);
    if (d) cur.items.push(d);
  }
  if (cur.items.length) groups.push(cur);
  return (
    <section class="card log">
      <h3 class="section-title">
        <span>记录</span>
        <small>LOG</small>
      </h3>
      {groups
        .slice()
        .reverse()
        .map((g, gi) => (
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
    </section>
  );
}

/** 私密频道（第二阶段的白板频道、大国的一次机会）。 */
export function Chat({ v, conn, channel, title }: { v: PlayerView; conn: RoomConnection; channel: Channel; title: string }) {
  const [text, setText] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const msgs = v.log.filter((e): e is Extract<typeof e, { t: 'chat' }> => e.t === 'chat' && e.channel === channel);
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  useEffect(() => {
    list.current?.scrollTo(0, list.current.scrollHeight);
  }, [msgs.length]);
  return (
    <section class="card chat">
      <h3 class="section-title">
        <span>{title}</span>
        <small>PRIVATE</small>
      </h3>
      <ol ref={list}>
        {msgs.map((m, i) => (
          <li key={i} class={m.player === v.me.id ? 'is-me' : ''}>
            <b>{name(m.player)}</b>
            {m.text}
          </li>
        ))}
        {!msgs.length ? <li class="empty">还没有消息</li> : null}
      </ol>
      <form
        class="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          conn.act({ a: 'chat', channel, text });
          setText('');
        }}
      >
        <input value={text} maxLength={200} placeholder="只有队友看得到" onInput={(e) => setText(e.currentTarget.value)} />
        <button type="submit" class="btn">
          发送
        </button>
      </form>
    </section>
  );
}

/** 一行输入 + 提交按钮。字数上限不大时，下面有一排字数格。 */
export function TextAction({
  placeholder,
  max,
  button,
  onSubmit,
  disabled,
  autoFocus,
  label,
}: {
  placeholder: string;
  max: number;
  button: string;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const [text, setText] = useState('');
  const len = Array.from(text.trim()).length;
  const over = len > max;
  return (
    <form
      class="action"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || over) return;
        onSubmit(text.trim());
        setText('');
      }}
    >
      <label class="action-head">
        <span>{label ?? placeholder}</span>
        <span class={over ? 'is-over' : ''}>
          {len} / {max}
        </span>
      </label>
      <div class="row">
        <span class="action-input">
          <input value={text} placeholder={placeholder} aria-label={label ?? placeholder} disabled={disabled} autoFocus={autoFocus} onInput={(e) => setText(e.currentTarget.value)} />
          {max <= 20 ? (
            <span class="meter" aria-hidden="true">
              {Array.from({ length: max }, (_, i) => (
                <i class={i < len ? 'on' : ''} key={i} />
              ))}
            </span>
          ) : null}
        </span>
        <button type="submit" class="btn btn--accent" disabled={disabled || !text.trim() || over}>
          {button}
        </button>
      </div>
      {over ? <p class="hint-bad">最多 {max} 个字</p> : null}
    </form>
  );
}
