/**
 * 页面预览器（/dgxg/preview.html）：每个画面放进一个手机大小的框里并排看。
 * 场景在 preview-data.ts（真的规则引擎走一局 7 人游戏），这里再加几个 12 人的。按钮点了不会发出去。
 */

import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/noto-serif-sc';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/space-mono/latin-400.css';
import './styles.ts';
import './preview.css';

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { RoomConnection } from './net.ts';
import { SCENES, Sim, gameSnap, idOf, type Scene, type SceneData } from './preview-data.ts';
import { RoomScreen } from './app.tsx';
import { flags } from './flags.ts';
import { Home } from './home.tsx';

const params = new URLSearchParams(location.search);
const sceneId = params.get('scene');

/** 12 人（一个房间最多的人数）：看挤的时候排不排得下。 */
const TWELVE: [string, string][] = [
  ['a', '阿乐'],
  ['b', '林夕'],
  ['c', '小满'],
  ['d', '周周'],
  ['e', '老陈'],
  ['f', '米粒'],
  ['g', '七七'],
  ['h', '豆豆'],
  ['i', '阿杰'],
  ['j', '小雨'],
  ['k', '老王'],
  ['l', '大白'],
];
const sim12 = () => new Sim({}, 7, TWELVE);
const CROWDED: Scene[] = [
  {
    id: 'b12-night',
    group: '12 人',
    title: '12 人 · 夜晚（起点白板）',
    note: '12 个座位围着圆桌',
    build: () => {
      const s = sim12();
      const p = s.g.players.find((x) => x.faction === 'blank' && x.role !== 'white')!;
      return { kind: 'room', snap: gameSnap(s, p.id) };
    },
  },
  {
    id: 'b12-clue',
    group: '12 人',
    title: '12 人 · 身份提示',
    note: '两段各 6 站，字小一号',
    build: () => {
      const s = sim12();
      s.night('c', 'cw');
      s.clues(5);
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'big')) };
    },
  },
  {
    id: 'b12-vote',
    group: '12 人',
    title: '12 人 · 投票',
    note: '选票三列；12 块选区',
    build: () => {
      const s = sim12();
      s.night('c', 'cw');
      s.clues();
      s.discuss();
      return { kind: 'room', snap: gameSnap(s, idOf(s, 'small')) };
    },
  },
  {
    id: 'b12-turn',
    group: '12 人',
    title: '12 人 · 第二阶段',
    note: '海岸上 12 个座位',
    build: () => {
      const s = sim12();
      for (const b of s.of('blank')) s.dayVoting(b.id);
      const st = s.step;
      if (st.k !== 'turn') throw new Error(`没有进入第二阶段：${st.k}`);
      return { kind: 'room', snap: gameSnap(s, st.order[st.idx]) };
    },
  },
];
const LIST = [...SCENES, ...CROWDED];

/** 假连接：组件调用的方法都在，但什么都不发。 */
function fakeConn(token: string | null): RoomConnection {
  const noop = () => {};
  return {
    code: '3572',
    get token() {
      return token;
    },
    send: noop,
    act: noop,
    settings: noop,
    join: noop,
    connect: noop,
    stop: noop,
    subscribe: () => noop,
  } as unknown as RoomConnection;
}

function SceneView({ id }: { id: string }) {
  const scene = LIST.find((s) => s.id === id);
  if (!scene) return <p class="pv-error">没有这个场景：{id}</p>;
  let data: SceneData;
  try {
    data = scene.build();
  } catch (e) {
    return (
      <p class="pv-error">
        场景「{scene.title}」生成失败：{e instanceof Error ? e.message : String(e)}
      </p>
    );
  }
  if (data.kind === 'home') return <Home />;
  if (data.kind !== 'room') return null;
  flags.hold = !!data.hold;
  flags.dossier = data.dossier ?? null;
  flags.revealed = !!data.revealed;
  flags.still = true;
  return (
    <RoomScreen
      code="3572"
      conn={fakeConn(data.token === undefined ? 'preview' : data.token)}
      snap={data.snap}
      info={data.info ?? null}
      infoErr={null}
      dismissed={0}
      setDismissed={() => {}}
    />
  );
}

const DEVICES = [
  { id: 'phone', label: '390 × 844', w: 390, h: 844 },
  { id: 'small', label: '360 × 740', w: 360, h: 740 },
  { id: 'se', label: '375 × 667', w: 375, h: 667 },
  { id: 'large', label: '430 × 932', w: 430, h: 932 },
] as const;

function Gallery() {
  const groups = [...new Set(LIST.map((s) => s.group))];
  const [group, setGroup] = useState<string>('全部');
  const [device, setDevice] = useState<(typeof DEVICES)[number]['id']>('phone');
  const [scale, setScale] = useState(0.5);
  const [nonce, setNonce] = useState(0);
  const d = DEVICES.find((x) => x.id === device)!;
  const list = LIST.filter((s) => group === '全部' || s.group === group);
  useEffect(() => {
    document.title = '大国小国 · 页面预览';
  }, []);
  return (
    <div class="pv">
      <header class="pv-bar">
        <div class="pv-brand">
          <b>大国小国 · 页面预览</b>
          <small>{list.length} 个画面 · 数据来自真实规则引擎，按钮不会发出去</small>
        </div>
        <div class="pv-controls">
          <span class="pv-seg" role="radiogroup" aria-label="分组">
            {['全部', ...groups].map((g) => (
              <button type="button" role="radio" aria-checked={group === g} class={group === g ? 'is-on' : ''} onClick={() => setGroup(g)} key={g}>
                {g}
              </button>
            ))}
          </span>
          <span class="pv-seg" role="radiogroup" aria-label="屏幕尺寸">
            {DEVICES.map((x) => (
              <button type="button" role="radio" aria-checked={device === x.id} class={device === x.id ? 'is-on' : ''} onClick={() => setDevice(x.id)} key={x.id}>
                {x.label}
              </button>
            ))}
          </span>
          <label class="pv-scale">
            <span>缩放 {Math.round(scale * 100)}%</span>
            <input type="range" min="0.3" max="1" step="0.05" value={scale} onInput={(e) => setScale(Number(e.currentTarget.value))} />
          </label>
          <button type="button" class="pv-btn" onClick={() => setNonce((n) => n + 1)}>
            重新载入
          </button>
          <a class="pv-btn" href="./" target="_blank" rel="noreferrer">
            打开正式页面 ↗
          </a>
        </div>
      </header>
      <main class="pv-grid">
        {list.map((s, i) => (
          <figure class="pv-item" key={s.id} id={s.id}>
            <figcaption>
              <b>
                <i>{String(i + 1).padStart(2, '0')}</i>
                {s.title}
              </b>
              <small>{s.note}</small>
              <a href={`?scene=${s.id}`} target="_blank" rel="noreferrer">
                单独打开 ↗
              </a>
            </figcaption>
            <div class="pv-frame" style={{ width: `${d.w * scale}px`, height: `${d.h * scale}px` }}>
              <iframe
                key={`${s.id}-${nonce}-${device}`}
                src={`?scene=${s.id}`}
                title={s.title}
                loading="lazy"
                style={{ width: `${d.w}px`, height: `${d.h}px`, transform: `scale(${scale})` }}
              />
            </div>
          </figure>
        ))}
      </main>
    </div>
  );
}

const root = document.getElementById('app')!;
if (sceneId) {
  render(<SceneView id={sceneId} />, root);
} else {
  document.body.classList.add('pv-body');
  render(<Gallery />, root);
}
