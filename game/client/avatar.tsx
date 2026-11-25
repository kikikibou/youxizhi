/**
 * 头像：每个人是一个「国家」，头像就是自己的国旗。
 * - 默认图案 'p:<0–23>'：8 种旗面 × 3 种配色；没设置过的人按 id 分一个。
 * - 手绘 'd:<笔画>'：64×64 的格子，见 shared/protocol.ts 的 AVATAR_RE。
 */

import { createContext } from 'preact';
import { useContext, useMemo, useRef, useState } from 'preact/hooks';
import { AVATAR_MAX, AVATAR_PRESETS } from '../shared/protocol.ts';

/** 房间里所有人的头像（id → 头像字符串），由 RoomScreen 提供。 */
export const AvatarContext = createContext<Record<string, string>>({});

const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';

export type Stroke = [number, number][];

export function encodeDrawing(strokes: Stroke[]): string {
  return `d:${strokes
    .filter((s) => s.length)
    .map((s) => s.map(([x, y]) => ALPHA[clamp(x)] + ALPHA[clamp(y)]).join(''))
    .join(',')}`;
}
const clamp = (v: number) => Math.max(0, Math.min(63, Math.round(v)));

export function decodeDrawing(s: string): Stroke[] {
  return s
    .slice(2)
    .split(',')
    .map((part) => {
      const pts: Stroke = [];
      for (let i = 0; i + 1 < part.length; i += 2) pts.push([ALPHA.indexOf(part[i]), ALPHA.indexOf(part[i + 1])]);
      return pts;
    })
    .filter((s) => s.length);
}

/** 没设置头像的人：按 id 稳定地分一个默认图案。 */
export function defaultAvatar(id: string): string {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `p:${h % AVATAR_PRESETS}`;
}

export function randomPreset(except?: string | null): string {
  let v: string;
  do v = `p:${Math.floor(Math.random() * AVATAR_PRESETS)}`;
  while (v === except);
  return v;
}

const INK = '#0a0a0a';
const PAPER = '#ffffff';
const CORAL = '#ff5a46';
const BLUE = '#1f14ff';
/** [底色, 主色, 点缀] */
const PALETTES: [string, string, string][] = [
  [PAPER, CORAL, INK],
  [PAPER, BLUE, CORAL],
  [INK, CORAL, PAPER],
];

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** 默认图案：8 种旗面 × 3 种配色。 */
function PresetArt({ n }: { n: number }) {
  const [bg, fg, ac] = PALETTES[Math.floor(n / 8) % 3];
  const k = n % 8;
  return (
    <>
      <rect width="64" height="64" fill={bg} />
      {k === 0 ? (
        <>
          <rect y="0" width="64" height="21" fill={fg} />
          <rect y="43" width="64" height="21" fill={ac} />
        </>
      ) : k === 1 ? (
        <>
          <rect width="26" height="64" fill={fg} />
          <circle cx="44" cy="32" r="11" fill={ac} />
        </>
      ) : k === 2 ? (
        <>
          <path d="M0 64 L0 8 L56 64 Z" fill={fg} />
          <rect x="42" y="8" width="14" height="14" fill={ac} />
        </>
      ) : k === 3 ? (
        <>
          <circle cx="32" cy="32" r="18" fill={fg} />
          <circle cx="32" cy="32" r="25" fill="none" stroke={ac} stroke-width="3" stroke-dasharray="4 4" />
        </>
      ) : k === 4 ? (
        <>
          <rect x="18" width="14" height="64" fill={fg} />
          <rect y="25" width="64" height="14" fill={fg} />
          <rect x="23" width="4" height="64" fill={ac} />
          <rect y="30" width="64" height="4" fill={ac} />
        </>
      ) : k === 5 ? (
        <>
          <rect width="32" height="32" fill={fg} />
          <rect x="32" y="32" width="32" height="32" fill={fg} />
          <path d="M32 20 L44 32 L32 44 L20 32 Z" fill={ac} />
        </>
      ) : k === 6 ? (
        <>
          <rect y="0" width="64" height="32" fill={fg} />
          <path d="M0 0 L30 32 L0 64 Z" fill={ac} />
        </>
      ) : (
        <>
          <rect x="6" y="6" width="52" height="52" fill={fg} />
          <polygon points={star(32, 33, 18)} fill={ac} />
        </>
      )}
    </>
  );
}

function DrawnArt({ strokes }: { strokes: Stroke[] }) {
  return (
    <>
      <rect width="64" height="64" fill={PAPER} />
      {strokes.map((s, i) =>
        s.length === 1 ? (
          <circle key={i} cx={s[0][0]} cy={s[0][1]} r="1.8" fill={INK} />
        ) : (
          <polyline key={i} points={s.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={INK} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ),
      )}
    </>
  );
}

/** 一个头像。value 不给时，从 AvatarContext 按 id 找；都没有就用默认图案。 */
export function Avatar({ id, value, size = 24, class: cls }: { id: string; value?: string | null; size?: number; class?: string }) {
  const ctx = useContext(AvatarContext);
  const v = value ?? ctx[id] ?? defaultAvatar(id);
  const strokes = useMemo(() => (v.startsWith('d:') ? decodeDrawing(v) : null), [v]);
  return (
    <svg class={`avatar ${cls ?? ''}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {strokes ? <DrawnArt strokes={strokes} /> : <PresetArt n={Number(v.slice(2)) || 0} />}
    </svg>
  );
}

/** 画板：在 64×64 的格子上画。 */
export function DrawPad({ initial, onSave, onCancel }: { initial: string | null; onSave: (v: string) => void; onCancel: () => void }) {
  const [strokes, setStrokes] = useState<Stroke[]>(() => (initial?.startsWith('d:') ? decodeDrawing(initial) : []));
  const cur = useRef<Stroke | null>(null);
  const box = useRef<SVGSVGElement>(null);
  const [, redraw] = useState(0);
  const encoded = encodeDrawing(strokes);
  const full = encoded.length > AVATAR_MAX - 40;

  const at = (e: PointerEvent): [number, number] => {
    const r = box.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 64, ((e.clientY - r.top) / r.height) * 64];
  };
  const down = (e: PointerEvent) => {
    if (full) return;
    e.preventDefault();
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* 有的浏览器不支持就算了 */
    }
    const p = at(e);
    cur.current = [[clamp(p[0]), clamp(p[1])]];
    setStrokes((s) => [...s, cur.current!]);
  };
  const move = (e: PointerEvent) => {
    const c = cur.current;
    if (!c) return;
    const [x, y] = at(e);
    const [lx, ly] = c[c.length - 1];
    if (Math.hypot(x - lx, y - ly) < 1.4) return; // 太密的点不记，省空间
    c.push([clamp(x), clamp(y)]);
    redraw((n) => n + 1);
  };
  const up = () => {
    cur.current = null;
    setStrokes((s) => [...s]);
  };

  return (
    <div class="drawpad">
      <svg ref={box} class="drawpad-board" viewBox="0 0 64 64" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="画板：用手指画你的国旗">
        <DrawnArt strokes={strokes} />
        <path d="M32 0 V64 M0 32 H64" class="drawpad-guide" />
      </svg>
      <div class="drawpad-meter" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (encoded.length / AVATAR_MAX) * 100)}%` }} />
      </div>
      {full ? <p class="hint-bad">画满了：撤销几笔，或者先保存</p> : null}
      <div class="drawpad-actions">
        <button type="button" class="btn" disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))}>
          撤销
        </button>
        <button type="button" class="btn" disabled={!strokes.length} onClick={() => setStrokes([])}>
          清空
        </button>
        <button type="button" class="btn" onClick={onCancel}>
          取消
        </button>
        <button type="button" class="btn btn--accent" disabled={!strokes.length} onClick={() => onSave(encoded)}>
          用这个
        </button>
      </div>
    </div>
  );
}
