/**
 * 页面预览器（/dgxg/preview.html）：把每个画面放进一个手机大小的框里并排看。
 * 每个框是一个 iframe（?scene=…），里面渲染真的组件和真的引擎状态，不连服务器，按钮点了也不会发出去。
 */

import '@fontsource/unbounded/latin-700.css';
import '@fontsource/unbounded/latin-900.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import '@fontsource/doto/latin-900.css';
import '@fontsource-variable/noto-sans-sc';
import './style.css';
import './preview.css';

import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Home, RoomScreen } from './app.tsx';
import type { RoomConnection } from './net.ts';
import { SCENES, type SceneData } from './preview-data.ts';
import { CropMarks, Mark, previewFlags } from './ui.tsx';

const params = new URLSearchParams(location.search);
const sceneId = params.get('scene');

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
  const scene = SCENES.find((s) => s.id === id);
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
  previewFlags.holdOpen = data.kind === 'room' && !!data.hold;
  return (
    <>
      <CropMarks />
      {data.kind === 'home' ? (
        <Home />
      ) : (
        <RoomScreen
          code="3572"
          conn={fakeConn(data.token === undefined ? 'preview' : data.token)}
          snap={data.snap}
          info={data.info ?? null}
          infoErr={null}
          dismissed={0}
          setDismissed={() => {}}
        />
      )}
    </>
  );
}

const DEVICES = [
  { id: 'phone', label: '390 × 844', w: 390, h: 844 },
  { id: 'small', label: '360 × 740', w: 360, h: 740 },
  { id: 'large', label: '430 × 932', w: 430, h: 932 },
] as const;

function Gallery() {
  const groups = [...new Set(SCENES.map((s) => s.group))];
  const [group, setGroup] = useState<string>('全部');
  const [device, setDevice] = useState<(typeof DEVICES)[number]['id']>('phone');
  const [scale, setScale] = useState(0.55);
  const [nonce, setNonce] = useState(0);
  const d = DEVICES.find((x) => x.id === device)!;
  const list = SCENES.filter((s) => group === '全部' || s.group === group);
  useEffect(() => {
    document.title = '大国小国 · 页面预览';
  }, []);
  return (
    <div class="pv">
      <header class="pv-bar">
        <div class="pv-brand">
          <Mark size={24} />
          <span>
            <b>大国小国 · 页面预览</b>
            <small>PREVIEW · {list.length} SCREENS · 数据来自真实规则引擎，按钮不会发出去</small>
          </span>
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
          <button type="button" class="pv-replay" onClick={() => setNonce((n) => n + 1)}>
            重播动效
          </button>
          <a class="pv-live" href="./" target="_blank" rel="noreferrer">
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
