/** 通用小部件：倒计时、座位条、选人、按住查看身份、记录、私密频道。 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Channel } from '../engine/types.ts';
import type { PlayerView, PublicPlayer } from '../engine/view.ts';
import type { RoomConnection } from './net.ts';
import { ANSWER, ROLE, ROLE_DUTY, describe } from './text.ts';

/** 每隔 ms 重新渲染一次。 */
export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function Countdown({ deadline, offset, label }: { deadline: number | null; offset: number; label?: string }) {
  useTick(250);
  if (deadline === null) return null;
  const left = Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000));
  return (
    <span class={`clock ${left <= 5 ? 'is-low' : ''}`} aria-label={`${label ?? '剩余'} ${left} 秒`}>
      {label ? <small>{label}</small> : null}
      {left}
      <i>s</i>
    </span>
  );
}

/** 一圈座位（按座位号排）：谁出局、谁在行动、哪个是我。 */
export function SeatStrip({ v, active, marks }: { v: PlayerView; active?: string | null; marks?: Record<string, string> }) {
  return (
    <ol class="seats" aria-label="座位">
      {v.players.map((p) => (
        <li class={`seat ${p.alive ? '' : 'is-out'} ${p.id === active ? 'is-active' : ''} ${p.id === v.me.id ? 'is-me' : ''}`} key={p.id}>
          <b>{p.seat + 1}</b>
          <span>{p.name}</span>
          {marks?.[p.id] ? <em>{marks[p.id]}</em> : null}
        </li>
      ))}
    </ol>
  );
}

export function PlayerPicker({
  players,
  value,
  onPick,
  disabled,
}: {
  players: PublicPlayer[];
  value: string | null;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div class="picker" role="radiogroup">
      {players.map((p) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === p.id}
          class={`pick ${value === p.id ? 'is-on' : ''}`}
          disabled={disabled}
          onClick={() => onPick(p.id)}
          key={p.id}
        >
          <b>{p.seat + 1}</b>
          {p.name}
        </button>
      ))}
    </div>
  );
}

/**
 * 按住查看身份。所有私密信息（词、白板身份、队友、裁判的私下回答、夜晚该选哪一项）都只在按住时显示，
 * 面对面玩时旁边的人瞄一眼屏幕也看不到。
 */
export function HoldIdentity({ v }: { v: PlayerView }) {
  const [open, setOpen] = useState(false);
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  const answers = v.log.filter((e) => e.t === 'answer');
  const night = v.step.k === 'night' ? v.step : null;
  const show = (e: Event) => {
    e.preventDefault();
    setOpen(true);
  };
  const hide = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        class="hold"
        onPointerDown={show}
        onPointerUp={hide}
        onPointerLeave={hide}
        onPointerCancel={hide}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setOpen(true)}
        onKeyUp={hide}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span>按住查看我的身份</span>
        <small>{v.me.alive ? '松手即隐藏' : '你已出局 · 松手即隐藏'}</small>
      </button>
      {open ? (
        <div class="identity" aria-live="polite">
          {v.me.word !== null ? (
            <>
              <p class="id-kicker">你的词</p>
              <p class="id-word">{v.me.word}</p>
              <p class="id-note">你不知道自己是大国还是小国，也不知道谁和你同一国。</p>
            </>
          ) : (
            <>
              <p class="id-kicker">你是白板阵营</p>
              <p class="id-word">{ROLE[v.me.blank!.role]}</p>
              <p class="id-note">{ROLE_DUTY[v.me.blank!.role]}。目标是猜中大国词。</p>
              <p class="id-note">
                {v.me.blank!.teammates.length
                  ? `你能认出的队友：${v.me.blank!.teammates.map((t) => `${name(t.id)}（${t.role ? ROLE[t.role] : '白板阵营'}）`).join('、')}`
                  : '你看不到其他队友。'}
              </p>
              {night?.decides.length ? (
                <p class="id-tonight">今晚你的选择决定：{night.decides.map((d) => (d === 'start' ? '起始玩家' : '方向')).join('和')}</p>
              ) : null}
              {answers.length ? (
                <ul class="id-answers">
                  {answers.map((a, i) => (
                    <li key={i}>
                      「{a.question}」→ <b>{ANSWER[a.answer]}</b>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}

/** 整局记录，按天分段。 */
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
    <section class="log">
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
    <section class="chat">
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

export function Card({ children, tone }: { children: ComponentChildren; tone?: 'night' | 'accent' }) {
  return <section class={`card ${tone ? `card--${tone}` : ''}`}>{children}</section>;
}

/** 一行输入 + 提交按钮。 */
export function TextAction({
  placeholder,
  max,
  button,
  onSubmit,
  disabled,
  autoFocus,
}: {
  placeholder: string;
  max: number;
  button: string;
  onSubmit: (text: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const len = Array.from(text.trim()).length;
  return (
    <form
      class="row"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() || len > max) return;
        onSubmit(text.trim());
        setText('');
      }}
    >
      <input value={text} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus} onInput={(e) => setText(e.currentTarget.value)} />
      <button type="submit" class="btn btn--accent" disabled={disabled || !text.trim() || len > max}>
        {button}
      </button>
      {len > max ? <p class="hint-bad">最多 {max} 个字</p> : null}
    </form>
  );
}
