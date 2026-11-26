/**
 * 对局：每一步一张图（夜航海图、地铁线路、分区图、未定的国界、历史疆域图），
 * 右上角「按住看词」和「档案」；按住时身份图放上来、沿折痕打开，松手折回去收走；
 * 档案是一本测量手簿，推上来、翻开封面，第一页是每轮的提示和投票总表。
 */

import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import type { Timers } from '../engine/rules.ts';
import type { PlayerView, StepView } from '../engine/view.ts';
import type { RoomConnection, Snapshot } from './net.ts';
import { deadlineOf } from './text.ts';
import { Chat } from './chat.tsx';
import { DayScreen } from './day.tsx';
import { DossierLayer } from './dossier.tsx';
import { flags } from './flags.ts';
import { DayNightFold } from './fold.tsx';
import { IdentityLayer, holdHandlers } from './identity.tsx';
import { NightScreen } from './night.tsx';
import { OverScreen } from './over.tsx';
import { PhaseTwo } from './phase2.tsx';
import { ExitScreen, VoteScreen } from './vote.tsx';

/** 每一步的屏幕都拿到这些。 */
export interface G {
  v: PlayerView;
  snap: Snapshot;
  conn: RoomConnection;
  name: (id: string) => string;
  offset: number;
  /** 这一步的总时长（毫秒），画倒计时圆环用。 */
  total: number | null;
  /** 按住看词。 */
  hold: (on: boolean) => void;
  openFile: () => void;
  /** 档案里有上次打开之后的新一轮记录。 */
  fresh: boolean;
  /** 私密频道（白板阵营 / 大国频道）；没有时为 null。 */
  chat: { title: string; open: () => void } | null;
  /** 房主在不限时的局里可以跳过等待。 */
  skip: (() => void) | null;
  onLeave: () => void;
}

function totalOf(s: StepView, t: Timers | undefined): number | null {
  if (!t) return null;
  switch (s.k) {
    case 'night':
      return t.night;
    case 'clue':
      return t.clue;
    case 'discussion':
      return t.discussion;
    case 'vote':
      return t.vote;
    case 'exit':
      return t.exitChoice;
    case 'turn':
      return t.turn;
    case 'relief':
      return s.stage === 'ask' ? t.reliefAsk : t.reliefGuess;
    case 'bigChance':
      return t.bigChance;
    case 'race':
      return t.hintInterval;
    default:
      return null;
  }
}

function waitsForever(s: StepView): boolean {
  if (s.k === 'race' || s.k === 'over') return false;
  if (s.k === 'exit') return !!s.mine && s.mine.deadline === null && (s.mine.status === 'choosing' || s.mine.status === 'reask');
  return deadlineOf(s) === null;
}

export function GameScreen({ conn, snap, onLeave }: { conn: RoomConnection; snap: Snapshot; onLeave: () => void }) {
  const v = snap.game!;
  const s = v.step;
  const [holding, setHolding] = useState(flags.hold);
  const [file, setFile] = useState(flags.dossier !== null);
  const [chatOpen, setChatOpen] = useState(false);
  // 每投完一轮票，档案按钮上亮一个点，打开看过就灭；中途重连进来的不亮。
  const rounds = v.log.filter((e) => e.t === 'votes').length;
  const [seen, setSeen] = useState(rounds);
  const name = (id: string) => v.players.find((p) => p.id === id)?.name ?? '?';
  const room = snap.room;
  const canSkip = !!room && room.hostId === room.me && v.rules.untimed && waitsForever(s);

  let chat: { title: string; channel: 'blanks' | 'big' } | null = null;
  // 结束以后身份都公开了，私密频道就不再放在结算图上
  if (v.me.blank && v.phase === 2) chat = { title: '白板阵营频道', channel: 'blanks' };
  if (s.k === 'bigChance' && (s.canGuess || (v.me.word !== null && v.revealed.big === v.me.word && v.me.alive))) chat = { title: '大国频道', channel: 'big' };

  const g: G = {
    v,
    snap,
    conn,
    name,
    offset: snap.offset,
    total: totalOf(s, room?.settings.timers),
    hold: (on) => setHolding(on || flags.hold),
    openFile: () => {
      setSeen(rounds);
      setFile(true);
    },
    fresh: !file && rounds > seen,
    chat: chat ? { title: chat.title, open: () => setChatOpen(true) } : null,
    skip: canSkip ? () => confirm('跳过等待？这一步按时间到处理（没给提示记为没给，没投票视为投自己）。') && conn.send({ t: 'skip' }) : null,
    onLeave,
  };

  let screen: ComponentChildren = null;
  if (s.k === 'night') screen = <NightScreen g={g} s={s} />;
  else if (s.k === 'clue' || s.k === 'discussion') screen = <DayScreen g={g} s={s} />;
  else if (s.k === 'vote') screen = <VoteScreen g={g} s={s} />;
  else if (s.k === 'exit') screen = <ExitScreen g={g} s={s} />;
  else if (s.k === 'over') screen = <OverScreen g={g} />;
  else screen = <PhaseTwo g={g} s={s} />;

  return (
    <>
      {screen}
      <DayNightFold v={v} code={snap.room?.code ?? ''} />
      <IdentityLayer on={holding && s.k !== 'over'} v={v} snap={snap} />
      <DossierLayer
        on={file}
        v={v}
        onClose={() => {
          setSeen(rounds);
          setFile(false);
        }}
      />
      {chat && chatOpen ? <Chat v={v} conn={conn} channel={chat.channel} title={chat.title} onClose={() => setChatOpen(false)} /> : null}
    </>
  );
}

/** 折起来的地图：按住看词。 */
function MapIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
      <path d="M2.5 5 L7.5 3 L12.5 5 L17.5 3 V15 L12.5 17 L7.5 15 L2.5 17 Z" />
      <path d="M7.5 3 V15 M12.5 5 V17" stroke-width="1.2" />
    </svg>
  );
}

/** 线圈手簿：档案。 */
function BookIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7">
      <rect x="4" y="5" width="12" height="12.5" />
      <path d="M7 2.5 V7 M10 2.5 V7 M13 2.5 V7" stroke-width="1.5" stroke-linecap="round" />
      <path d="M7 11 H13 M7 14 H11" stroke-width="1.2" />
    </svg>
  );
}

/** 右上角：按住看词 + 档案（+ 私密频道、跳过等待）。 */
export function Chips({ g, label = '按住看词', hold = true, noSkip, style }: { g: G; label?: string; hold?: boolean; noSkip?: boolean; style?: Record<string, string> }) {
  return (
    <div class="b-chips" style={style}>
      {hold ? (
        <button type="button" class="b-chip b-chip--hold" aria-label={`${label}（按住不放）`} {...holdHandlers(g.hold)}>
          <span class="b-chip-ic">
            <MapIcon />
          </span>
          {label}
        </button>
      ) : null}
      <button type="button" class="b-chip b-chip--file" aria-label={g.fresh ? '档案（有新的一轮记录）' : '档案：每轮的提示和投票'} onClick={g.openFile}>
        <span class="b-chip-ic">
          <BookIcon />
        </span>
        档案
        {g.fresh ? <i class="b-chip-new" aria-hidden="true" /> : null}
      </button>
      {g.chat ? (
        <button type="button" class="b-chip b-chip--plain" onClick={g.chat.open}>
          <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 4 H17 V13 H9 L5 17 V13 H3 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          </svg>
          {g.chat.title}
        </button>
      ) : null}
      {g.skip && !noSkip ? (
        <button type="button" class="b-chip b-chip--plain" onClick={g.skip}>
          跳过等待
        </button>
      ) : null}
    </div>
  );
}
