/** 私密频道（白板阵营频道、大国频道）：从底下抽出来的一张密信纸，只有队友看得到。 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Channel } from '../engine/types.ts';
import type { PlayerView } from '../engine/view.ts';
import type { RoomConnection } from './net.ts';

export function Chat({ v, conn, channel, title, onClose }: { v: PlayerView; conn: RoomConnection; channel: Channel; title: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const msgs = v.log.filter((e): e is Extract<typeof e, { t: 'chat' }> => e.t === 'chat' && e.channel === channel);
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  useEffect(() => {
    list.current?.scrollTo(0, list.current.scrollHeight);
  }, [msgs.length]);
  const send = () => {
    if (!text.trim()) return;
    conn.act({ a: 'chat', channel, text });
    setText('');
  };
  return (
    <div class="b-chat" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section class="b-chat-sheet">
        <header>
          <b>{title}</b>
          <small>只有队友看得到</small>
          <button type="button" class="b-x" aria-label="关闭" onClick={onClose}>
            ×
          </button>
        </header>
        <ol ref={list}>
          {msgs.map((m, i) => (
            <li key={i} class={m.player === v.me.id ? 'is-me' : ''}>
              <b>{m.player === v.me.id ? '你' : name(m.player)}</b>
              <span>{m.text}</span>
            </li>
          ))}
          {!msgs.length ? <li class="is-empty">还没有消息</li> : null}
        </ol>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input value={text} maxLength={200} placeholder="写给队友" onInput={(e) => setText(e.currentTarget.value)} />
          <button type="submit" disabled={!text.trim()}>
            发送
          </button>
        </form>
      </section>
    </div>
  );
}
