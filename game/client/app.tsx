/** 页面外壳：首页、进房间、在大厅 / 对局 / 主持人台之间切换、断线提示、错误提示、屏幕常亮。 */

import { useEffect, useState } from 'preact/hooks';
import { RoomConnection, roomInfo, store, type RoomInfo, type Snapshot } from './net.ts';
import { GameScreen } from './game.tsx';
import { Bye, Connecting, Home, JoinForm, NotFound } from './home.tsx';
import { JudgeScreen } from './judge.tsx';
import { Lobby } from './lobby.tsx';

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
  return code ? <Room code={code} key={code} /> : <Home />;
}

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
  if (snap.bye) return <Bye text={snap.bye} />;

  let body;
  if (!snap.joined || !snap.room) {
    if (conn.token) body = <Connecting text={`正在连接房间 ${code}…`} />;
    else if (infoErr) body = <Connecting text={infoErr} />;
    else if (!info) body = <Connecting text={`正在查找房间 ${code}…`} />;
    else if (!info.exists) body = <NotFound code={code} />;
    else body = <JoinForm conn={conn} code={code} info={info} snap={snap} />;
  } else if (snap.game && (snap.game.phase !== 'over' || dismissed !== snap.room.gameNo)) {
    body = <GameScreen conn={conn} snap={snap} onLeave={() => setDismissed(snap.room!.gameNo)} />;
  } else if (snap.judge && (snap.judge.phase !== 'over' || dismissed !== snap.room.gameNo)) {
    body = <JudgeScreen conn={conn} snap={snap} onLeave={() => setDismissed(snap.room!.gameNo)} />;
  } else {
    body = <Lobby conn={conn} snap={snap} lastGame={!!snap.game || !!snap.judge} onShowLast={() => setDismissed(0)} />;
  }

  return (
    <>
      {snap.joined && snap.status !== 'open' ? <p class="b-offline">连接断开，正在重连…</p> : null}
      {body}
      <Toast snap={snap} />
    </>
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
    <p class="b-toast" role="alert">
      {snap.error.message}
    </p>
  );
}
