/** 页面外壳：首页（建房 / 加入）、进房间、在大厅和对局之间切换、断线提示、错误提示、屏幕常亮。 */

import { useEffect, useState } from 'preact/hooks';
import { NAME_MAX, ROOM_CODE } from '../shared/protocol.ts';
import { GameScreen } from './game.tsx';
import { JudgeScreen } from './judge.tsx';
import { Lobby } from './lobby.tsx';
import { RoomConnection, createRoom, roomInfo, store, type RoomInfo, type Snapshot } from './net.ts';
import { HOW_TO } from './text.ts';
import { AvatarContext } from './avatar.tsx';
import { BIG, BORDER, NODE, SMALL_LEFT, SMALL_MAIN, SMALL_RIGHT } from './logo.tsx';
import { Card, CropMarks, MapBackdrop, Mark } from './ui.tsx';

function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const code = hash.match(/^#\/(\d{4})$/)?.[1] ?? null;
  return (
    <>
      <MapBackdrop />
      <CropMarks />
      {code ? <Room code={code} key={code} /> : <Home />}
    </>
  );
}

/* ================================================================ 首页 */

/**
 * 首页的标志动画：「大」字形的领土从左边滑进来，「小」字形的三个岛依次冒出来，
 * 两国之间的国界画出来，国界上的联系点亮起。
 */
export function Hero() {
  return (
    <svg class="hero" viewBox="0 0 360 250" role="img" aria-label="大国小国的标志：左边一块像「大」字的领土，右边一组像「小」字的群岛，两国共用一段国界">
      <g class="hero-reg">
        {[
          [14, 12],
          [346, 12],
          [14, 238],
          [346, 238],
        ].map(([x, y], i) => (
          <g key={i} style={{ '--d': `${i * 60}ms` }} class="hero-regmark">
            <circle cx={x} cy={y} r="6" />
            <path d={`M${x} ${y - 12} V${y + 12} M${x - 12} ${y} H${x + 12}`} />
          </g>
        ))}
      </g>
      <path class="hero-grid" d="M30 85 H330 M30 165 H330 M100 22 V228 M260 22 V228" />
      <g transform="translate(20 25) scale(2)">
        <polygon points={BIG} class="hero-ghost hero-ghost--b" />
        <g class="hero-ghost hero-ghost--a">
          <polygon points={SMALL_MAIN} />
          <polygon points={SMALL_LEFT} />
          <polygon points={SMALL_RIGHT} />
        </g>
        <g class="hero-big">
          <polygon points={BIG} class="mark-big mark-coast" />
        </g>
        <g class="hero-small">
          <polygon points={SMALL_MAIN} class="mark-small mark-coast hero-isle" style={{ '--d': '0ms' }} />
          <polygon points={SMALL_LEFT} class="mark-small mark-coast hero-isle" style={{ '--d': '120ms' }} />
          <polygon points={SMALL_RIGHT} class="mark-small mark-coast hero-isle" style={{ '--d': '240ms' }} />
        </g>
        <path d={BORDER} class="mark-border hero-border" />
        <circle cx={NODE.cx} cy={NODE.cy} r="4" class="mark-node hero-node" />
        <circle cx={NODE.cx} cy={NODE.cy} r="9" class="hero-pulse" />
      </g>
    </svg>
  );
}

function Brand({ small }: { small?: boolean }) {
  return (
    <header class={`brand ${small ? 'brand--small' : ''}`}>
      <a href="../#/games" class="back">
        ← 游戏之致西柚 · 消遣
      </a>
      {small ? null : <Hero />}
      <h1 class="brand-title reg">大国小国</h1>
      <p class="brand-en">DAGUO · XIAOGUO</p>
      <p class="brand-sub">一个词，一句联系，一场面对面的推理</p>
    </header>
  );
}

export function Home() {
  const [name, setName] = useState(store.get('name') ?? '');
  const [pw, setPw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nameOk = Array.from(name.trim()).length >= 1 && Array.from(name.trim()).length <= NAME_MAX;

  const create = async () => {
    if (!nameOk) return setErr('先填一个名字');
    setBusy(true);
    setErr(null);
    try {
      const c = await createRoom(pw.trim() || null);
      store.set('name', name.trim());
      sessionStorage.setItem(`dgxg:create:${c}`, JSON.stringify({ name: name.trim(), password: pw.trim() || undefined }));
      location.hash = `#/${c}`;
    } catch (e) {
      // fetch 本身失败（TypeError）= 根本连不上服务器
      setErr(e instanceof TypeError ? '连不上游戏服务器，请检查网络或稍后再试' : e instanceof Error ? e.message : '建房失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="home">
      <Brand />
      <Card>
        <h3 class="section-title">
          <span>你的名字</span>
          <small>NAME</small>
        </h3>
        <label class="field">
          <span>大家在桌上看到的名字 · 最多 {NAME_MAX} 字</span>
          <input value={name} maxLength={NAME_MAX} placeholder="例：阿乐" onInput={(e) => setName(e.currentTarget.value)} />
        </label>
      </Card>

      <Card>
        <h3 class="section-title">
          <span>建房间</span>
          <small>NEW ROOM</small>
        </h3>
        <label class="field">
          <span>房间口令（可选，不填就不设）</span>
          <input value={pw} maxLength={32} placeholder="例：鱿鱼" onInput={(e) => setPw(e.currentTarget.value)} />
        </label>
        <button type="button" class="btn btn--accent btn--wide btn--big" disabled={busy} onClick={create}>
          {busy ? '正在建房…' : '建房间'}
        </button>
      </Card>

      <Card>
        <h3 class="section-title">
          <span>加入房间</span>
          <small>JOIN</small>
        </h3>
        <form
          class="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ROOM_CODE.test(code)) return setErr('房间号是 4 位数字');
            if (nameOk) store.set('name', name.trim());
            location.hash = `#/${code}`;
          }}
        >
          <input
            class="code-input"
            value={code}
            inputMode="numeric"
            maxLength={4}
            placeholder="0000"
            aria-label="4 位房间号"
            onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, ''))}
          />
          <button type="submit" class="btn" disabled={code.length !== 4}>
            进入
          </button>
        </form>
      </Card>

      {err ? <p class="toast">{err}</p> : null}

      <Card class="howto-card">
        <h3 class="section-title">
          <span>怎么玩</span>
          <small>HOW TO</small>
        </h3>
        <details class="howto">
          <summary>展开规则速览</summary>
          {HOW_TO.map(([t, d]) => (
            <p key={t}>
              <b>{t}</b>
              {d}
            </p>
          ))}
          <p class="note">6–12 人，面对面坐成一圈，各用各的手机。裁判由系统担任。</p>
        </details>
      </Card>
    </div>
  );
}

/* ================================================================ 房间 */

function useSnapshot(conn: RoomConnection): Snapshot {
  const [snap, setSnap] = useState(conn.snap);
  useEffect(() => conn.subscribe(() => setSnap(conn.snap)), [conn]);
  return snap;
}

/** 在房间里时保持屏幕常亮（浏览器支持时）。 */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let stopped = false;
    const request = async () => {
      try {
        if (document.visibilityState === 'visible' && !stopped) lock = await (navigator as any).wakeLock.request('screen');
      } catch {
        /* 用户或系统不允许 */
      }
    };
    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release();
    };
  }, [on]);
}

function Room({ code }: { code: string }) {
  const [conn] = useState(() => new RoomConnection(code));
  const snap = useSnapshot(conn);
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);
  /** 看完结算点了「回到房间」的那一局（记在本机，刷新后不再弹结算）。 */
  const [dismissed, setDismissedState] = useState(() => Number(store.get(`dismissed:${code}`) ?? 0));
  const setDismissed = (n: number) => {
    setDismissedState(n);
    store.set(`dismissed:${code}`, String(n));
  };
  useWakeLock(snap.joined);

  useEffect(() => {
    const pending = sessionStorage.getItem(`dgxg:create:${code}`);
    if (conn.token) conn.connect();
    else if (pending) {
      sessionStorage.removeItem(`dgxg:create:${code}`);
      const { name, password } = JSON.parse(pending) as { name: string; password?: string };
      conn.join(name, password);
    } else {
      roomInfo(code)
        .then(setInfo)
        .catch(() => setInfoErr('连不上服务器，请检查网络'));
      conn.connect();
    }
    return () => conn.stop();
  }, [conn, code]);

  return <RoomScreen code={code} conn={conn} snap={snap} info={info} infoErr={infoErr} dismissed={dismissed} setDismissed={setDismissed} />;
}

/** 房间里的画面（只看 snap 画图，预览器也直接用它）。 */
export function RoomScreen({
  code,
  conn,
  snap,
  info,
  infoErr,
  dismissed,
  setDismissed,
}: {
  code: string;
  conn: RoomConnection;
  snap: Snapshot;
  info: RoomInfo | null;
  infoErr: string | null;
  dismissed: number;
  setDismissed: (n: number) => void;
}) {
  if (snap.bye) {
    return (
      <div class="home">
        <Brand small />
        <Card>
          <h3 class="section-title">
            <span>已离开房间</span>
            <small>BYE</small>
          </h3>
          <p class="lead">{snap.bye}</p>
          <a class="btn btn--accent btn--wide" href="#/">
            回到首页
          </a>
        </Card>
      </div>
    );
  }

  let body;
  if (!snap.joined || !snap.room) {
    body = conn.token ? <p class="waiting center">正在连接房间 {code}…</p> : <JoinForm conn={conn} code={code} info={info} infoErr={infoErr} snap={snap} />;
  } else if (snap.game && (snap.game.phase !== 'over' || dismissed !== snap.room.gameNo)) {
    body = <GameScreen conn={conn} snap={snap} onLeave={() => setDismissed(snap.room!.gameNo)} />;
  } else if (snap.judge && (snap.judge.phase !== 'over' || dismissed !== snap.room.gameNo)) {
    body = <JudgeScreen conn={conn} snap={snap} onLeave={() => setDismissed(snap.room!.gameNo)} />;
  } else {
    body = <Lobby conn={conn} snap={snap} lastGame={!!snap.game || !!snap.judge} onShowLast={() => setDismissed(0)} />;
  }

  return (
    <AvatarContext.Provider value={snap.avatars}>
    <div class="room">
      <nav class="topline">
        <a href="#/" class="topline-brand">
          <Mark />
          大国小国
        </a>
        <span class="topline-room">
          <i class={`live ${snap.status === 'open' ? 'is-on' : ''}`} aria-hidden="true" />
          ROOM {code}
        </span>
      </nav>
      {snap.joined && snap.status !== 'open' ? <p class="offline">连接断开，正在重连…</p> : null}
      {body}
      <Toast snap={snap} />
    </div>
    </AvatarContext.Provider>
  );
}

function Toast({ snap }: { snap: Snapshot }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!snap.error) return;
    const t = setTimeout(() => tick((x) => x + 1), 4000);
    return () => clearTimeout(t);
  }, [snap.error?.at]);
  if (!snap.error || !snap.joined || Date.now() - snap.error.at > 4000) return null;
  return (
    <p class="toast" role="alert">
      {snap.error.message}
    </p>
  );
}

function JoinForm({ conn, code, info, infoErr, snap }: { conn: RoomConnection; code: string; info: RoomInfo | null; infoErr: string | null; snap: Snapshot }) {
  const [name, setName] = useState(store.get('name') ?? '');
  const [pw, setPw] = useState('');
  if (infoErr) return <p class="waiting center">{infoErr}</p>;
  if (!info) return <p class="waiting center">正在查找房间 {code}…</p>;
  if (!info.exists) {
    return (
      <div class="home">
        <Brand small />
        <Card>
          <h3 class="section-title">
            <span>找不到房间</span>
            <small>404</small>
          </h3>
          <p class="lead">房间 {code} 不存在，或者已经关闭了</p>
          <a class="btn btn--accent btn--wide" href="#/">
            回到首页
          </a>
        </Card>
      </div>
    );
  }
  return (
    <div class="home">
      <Brand small />
      <div class="join-code">
        <span class="kicker">房间号 / ROOM NO.</span>
        <b class="reg">{code}</b>
        <span class="join-meta">
          {info.hasPassword ? <em class="chip chip--lock">有口令</em> : <em class="chip">无口令</em>}
          <em class="chip">{info.members} 人在里面</em>
        </span>
      </div>
      <Card>
        <h3 class="section-title">
          <span>加入房间</span>
          <small>ENTRY PERMIT</small>
        </h3>
        {info.inGame ? <p class="note">这个房间正在对局，这一局结束后才能加入。</p> : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            store.set('name', name.trim());
            conn.join(name.trim(), pw.trim() || undefined);
          }}
        >
          <label class="field">
            <span>你的名字 / NAME</span>
            <input value={name} maxLength={NAME_MAX} onInput={(e) => setName(e.currentTarget.value)} autoFocus />
          </label>
          {info.hasPassword ? (
            <label class="field">
              <span>房间口令 / PASSWORD</span>
              <input value={pw} maxLength={32} onInput={(e) => setPw(e.currentTarget.value)} />
            </label>
          ) : null}
          <button type="submit" class="btn btn--accent btn--wide btn--big" disabled={!name.trim()}>
            加入
          </button>
        </form>
        {snap.error ? <p class="hint-bad">{snap.error.message}</p> : null}
      </Card>
    </div>
  );
}
