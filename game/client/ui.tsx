/**
 * 通用小部件：标志、面板、倒计时、圆桌座次、迷你座次图、选人、按住查看身份（护照）、记录、私密频道、输入框。
 * 视觉是「图纸」风格：白底细线 + 珊瑚红 / 电光蓝两种油墨；夜晚换成靛蓝底，蓝色当主角。
 */

import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Avatar } from './avatar.tsx';
import type { ComponentChildren } from 'preact';
import type { Channel } from '../engine/types.ts';
import type { PlayerView, PublicPlayer } from '../engine/view.ts';
import type { RoomConnection } from './net.ts';
import { ANSWER, ROLE, ROLE_DUTY, describe } from './text.ts';

/** 预览器用：强制某些界面处于打开状态。 */
export const previewFlags = {
  holdOpen: false,
  dossier: null as null | 'clues' | 'votes' | 'secret' | 'all',
  revealed: false,
  drawing: false,
  noPhaseCard: false,
};

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** 每隔 ms 重新渲染一次。 */
export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/**
 * 标志：一大一小两个圆叠印——大圆是大国的词，小圆是小国的词，叠在一起的那一块就是两个词之间的「联系」。
 * 像双色印刷两种油墨叠出第三种颜色（这里用墨色）。
 */
export function Mark({ size = 26 }: { size?: number }) {
  const id = useId();
  return (
    <svg class="mark" aria-hidden="true" width={size} height={(size * 21) / 30} viewBox="0 0 30 21">
      <defs>
        <clipPath id={`mk${id}`}>
          <circle cx="10.5" cy="10.5" r="10" />
        </clipPath>
      </defs>
      <circle cx="10.5" cy="10.5" r="10" class="mark-big" />
      <circle cx="23" cy="10.5" r="6.5" class="mark-small" />
      <circle cx="23" cy="10.5" r="6.5" class="mark-lap" clip-path={`url(#mk${id})`} />
    </svg>
  );
}

/** 标志放在一个 SVG 坐标系里（圆桌中心等处用）。cx, cy 是大圆圆心，r 是大圆半径。 */
export function MarkAt({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const id = useId();
  const sx = cx + r * 1.25;
  const sr = r * 0.65;
  return (
    <g aria-hidden="true">
      <defs>
        <clipPath id={`ma${id}`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r} class="mark-big" />
      <circle cx={sx} cy={cy} r={sr} class="mark-small" />
      <circle cx={sx} cy={cy} r={sr} class="mark-lap" clip-path={`url(#ma${id})`} />
    </g>
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
          <MarkAt cx={143} cy={150} r={11} />
        </svg>
        {ripple ? <i class="rt-ripple" aria-hidden="true" /> : null}
        {seats.map((s, i) => {
          const a = angle(i);
          const cls = `rt-tag ${s.me ? 'is-me' : ''} ${s.out ? 'is-out' : ''} ${s.offline ? 'is-offline' : ''} ${s.active ? 'is-active' : ''} ${s.on ? 'is-on' : ''}`;
          const inner = (
            <>
              {s.num !== undefined ? <b>{pad2(s.num)}</b> : null}
              <Avatar id={s.id} size={tilt ? 26 : 22} class="rt-avatar" />
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
      <MarkAt cx={71} cy={75} r={6} />
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
          <Avatar id={v.me.id} size={78} />
          <small>国旗 / FLAG</small>
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

/* ================================================================ 计时轨道、插图、转场、背景 */

/** 倒计时轨道：一条刻度尺，剩余的部分涂满，随时间缩短。total 是这一步的总时长（毫秒）。 */
export function Track({ deadline, offset, total }: { deadline: number | null; offset: number; total: number | null }) {
  useTick(250);
  if (deadline === null || !total) return null;
  const left = Math.max(0, deadline - (Date.now() + offset));
  const frac = Math.min(1, left / total);
  return (
    <div class={`track ${left <= 5000 ? 'is-low' : ''}`} role="progressbar" aria-label="剩余时间" aria-valuemin={0} aria-valuemax={Math.round(total / 1000)} aria-valuenow={Math.ceil(left / 1000)}>
      <i class="track-fill" style={{ transform: `scaleX(${frac})` }} />
      <i class="track-head" style={{ left: `${frac * 100}%` }} />
    </div>
  );
}

export type ArtKind = 'night' | 'clue' | 'discussion' | 'vote' | 'exit' | 'turn' | 'relief' | 'race' | 'bigChance' | 'over' | 'lobby' | 'archive';

/** 每一步的小插图（线描 + 两种油墨）。 */
export function StepArt({ k, size = 64 }: { k: ArtKind; size?: number }) {
  return (
    <svg class="art" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {k === 'night' ? (
        <>
          <circle cx="32" cy="32" r="27" class="art-dash" />
          <path d="M40 14 A18 18 0 1 0 50 44 A14 14 0 1 1 40 14 Z" class="art-hl" />
          <path d="M14 16 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z M50 50 l1.4 3.6 3.6 1.4 -3.6 1.4 -1.4 3.6 -1.4 -3.6 -3.6 -1.4 3.6 -1.4z" class="art-acc" />
        </>
      ) : k === 'clue' ? (
        <>
          <path d="M8 12 H56 V42 H30 L18 54 V42 H8 Z" class="art-paper" />
          <rect x="16" y="20" width="32" height="14" class="art-hl" />
          <path d="M20 27 H44" class="art-line-on" />
        </>
      ) : k === 'discussion' ? (
        <>
          <path d="M6 10 H38 V32 H20 L12 40 V32 H6 Z" class="art-hl" />
          <path d="M26 24 H58 V46 H52 V54 L44 46 H26 Z" class="art-paper" />
          <path d="M33 33 H51 M33 39 H45" class="art-line" />
        </>
      ) : k === 'vote' ? (
        <>
          <rect x="22" y="6" width="20" height="24" class="art-acc" transform="rotate(-8 32 18)" />
          <path d="M27 18 l4 4 8 -9" class="art-line-on" transform="rotate(-8 32 18)" />
          <path d="M8 30 H56 V58 H8 Z" class="art-paper" />
          <path d="M20 30 H44" class="art-slot" />
          <rect x="8" y="44" width="48" height="6" class="art-hl" />
        </>
      ) : k === 'exit' ? (
        <>
          <rect x="10" y="12" width="44" height="40" rx="3" class="art-stamp" transform="rotate(-10 32 32)" />
          <text x="32" y="38" class="art-text" transform="rotate(-10 32 32)">
            OUT
          </text>
        </>
      ) : k === 'turn' ? (
        <>
          <circle cx="32" cy="32" r="24" class="art-line" />
          <circle cx="32" cy="32" r="14" class="art-line" />
          <circle cx="32" cy="32" r="5" class="art-hl" />
          <path d="M32 2 V14 M32 50 V62 M2 32 H14 M50 32 H62" class="art-line" />
        </>
      ) : k === 'relief' ? (
        <>
          <circle cx="32" cy="32" r="24" class="art-paper" />
          <path d="M32 8 A24 24 0 0 1 56 32 H44 A12 12 0 0 0 32 20 Z M32 56 A24 24 0 0 1 8 32 H20 A12 12 0 0 0 32 44 Z" class="art-hl" />
          <circle cx="32" cy="32" r="12" class="art-line" />
        </>
      ) : k === 'race' ? (
        <>
          <circle cx="30" cy="36" r="22" class="art-paper" />
          <path d="M26 6 H34 M30 6 V14 M30 36 L30 22" class="art-line" />
          <path d="M40 24 L50 24 L42 38 L54 38 L34 62 L38 44 L28 44 Z" class="art-acc" />
        </>
      ) : k === 'bigChance' ? (
        <>
          <path d="M14 6 V60" class="art-line" />
          <path d="M14 8 H52 L44 20 L52 32 H14 Z" class="art-hl" />
          <circle cx="14" cy="60" r="3" class="art-ink" />
        </>
      ) : k === 'over' ? (
        <>
          <rect x="22" y="22" width="20" height="36" class="art-hl" />
          <rect x="4" y="34" width="18" height="24" class="art-paper" />
          <rect x="42" y="42" width="18" height="16" class="art-acc" />
          <path d="M32 4 l3 7 7 1 -5 5 1.5 7 -6.5 -3.5 -6.5 3.5 1.5 -7 -5 -5 7 -1z" class="art-ink" />
        </>
      ) : k === 'lobby' ? (
        <>
          <circle cx="32" cy="32" r="16" class="art-hl" />
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i * Math.PI) / 3;
            return <rect key={i} x={32 + 25 * Math.cos(a) - 4} y={32 + 25 * Math.sin(a) - 4} width="8" height="8" class="art-ink" />;
          })}
        </>
      ) : (
        <>
          <path d="M6 18 H24 L28 12 H58 V54 H6 Z" class="art-paper" />
          <rect x="14" y="24" width="36" height="22" class="art-hl" />
          <path d="M18 30 H46 M18 36 H38 M18 42 H42" class="art-line-on" />
        </>
      )}
    </svg>
  );
}

/** 换步骤时的标题卡：一条色带从左边扫进来，大标题砸下来，再扫出去。 */
export function PhaseCard({ kicker, title, art }: { kicker: string; title: string; art: ArtKind }) {
  const [show, setShow] = useState(!previewFlags.noPhaseCard);
  if (!show) return null;
  return (
    <div class="phasecard" aria-hidden="true" onAnimationEnd={(e) => e.target === e.currentTarget && setShow(false)}>
      <div class="pc-band">
        <span class="pc-kicker">{kicker}</span>
        <b class="pc-title">{title}</b>
        <span class="pc-art">
          <StepArt k={art} size={88} />
        </span>
      </div>
    </div>
  );
}

/** 背景：一张慢慢平移的领土图（颜色跟着昼夜变）。 */
export function MapBackdrop() {
  return (
    <div class="mapbg" aria-hidden="true">
      <i />
    </div>
  );
}

/** 等待中：转圈的虚线环 + 文字。 */
export function Loader({ children }: { children: ComponentChildren }) {
  return <p class="waiting">{children}</p>;
}
