/**
 * 舞台：一张 390 宽的设计画板，等比缩放到屏幕上；画板外面是同一张图的底纹和图框。
 * 「fit」：整张画板放进一屏（对局里的每一步，按钮总在屏幕里）；「scroll」：按宽度缩放，长了就往下滚（大厅、档案、主持人台）。
 * 还有几个到处用的小部件：图名框、右上角的小按钮、主按钮、手写栏、倒计时小圆环。
 */

import type { ComponentChildren, CSSProperties } from 'preact';
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';

export type Bg = 'day' | 'atlas' | 'paper' | 'night' | 'mat' | 'line';

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const INK = '#1e1b17';
export const MUTED = '#5d564c';
export const PAPER = '#f4ecda';
export const PAGE = '#fbf6ea';
export const BIG = '#efc965';
export const SMALL = '#a9cf8f';
export const WL = '#5f8f93';
export const ACC = 'var(--acc)';
export const ACC_TEXT = 'var(--acc-text)';

/** 每隔 ms 重新渲染一次。 */
export function useTick(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function viewport() {
  const vv = window.visualViewport;
  return { w: Math.min(window.innerWidth, 440), h: vv ? vv.height : window.innerHeight };
}

function useViewport() {
  const [vp, setVp] = useState(viewport);
  useLayoutEffect(() => {
    const on = () => setVp(viewport());
    window.addEventListener('resize', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, []);
  return vp;
}

export function Stage({
  bg,
  h = 844,
  mode = 'fit',
  frame = true,
  children,
  label,
  class: cls,
}: {
  bg: Bg;
  h?: number;
  mode?: 'fit' | 'scroll';
  frame?: boolean;
  children: ComponentChildren;
  label?: string;
  class?: string;
}) {
  const vp = useViewport();
  const u = mode === 'fit' ? Math.min(vp.w / 390, Math.max(vp.h, 480) / h) : vp.w / 390;
  const stageH = mode === 'fit' ? undefined : h * u;
  const left = (vp.w - 390 * u) / 2;
  const top = mode === 'fit' ? Math.max(0, (vp.h - h * u) / 2) : 0;
  return (
    <div class="b-root">
      <main class={`b-stage b-stage--${mode} b-bg-${bg} ${cls ?? ''}`} style={stageH ? { height: `${stageH}px` } : undefined} aria-label={label}>
        <Grain />
        {frame ? (
          <div class="b-frame" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <b />
          </div>
        ) : null}
        <div class="b-board" style={{ height: `${h}px`, transform: `translate(${left}px, ${top}px) scale(${u})` }}>
          {children}
        </div>
      </main>
    </div>
  );
}

function Grain() {
  return (
    <svg class="b-grain" aria-hidden="true" width="100%" height="100%">
      <filter id="b-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0.35 0 0 0 0 0.27 0 0 0 0 0.18 0 0 0 0.9 -0.3" />
      </filter>
      <rect width="100%" height="100%" filter="url(#b-grain)" />
    </svg>
  );
}

/** 一张画板坐标里的 SVG 层（390 × h）。 */
export function Layer({ h = 844, children, label, style }: { h?: number; children: ComponentChildren; label?: string; style?: CSSProperties }) {
  return (
    <svg
      width="390"
      height={h}
      viewBox={`0 0 390 ${h}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', ...style }}
    >
      {children}
    </svg>
  );
}

/** 一段设计稿里的静态 SVG（字符串），画在画板坐标里。 */
export function Art({ svg, h = 844, style }: { svg: string; h?: number; style?: CSSProperties }) {
  return (
    <svg
      width="390"
      height={h}
      viewBox={`0 0 390 ${h}`}
      aria-hidden="true"
      style={{ position: 'absolute', left: 0, top: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** 左上角的图名框。 */
export function TitleBlock({ kicker, title, sub, size = 28, style }: { kicker: string; title: ComponentChildren; sub?: ComponentChildren; size?: number; style?: CSSProperties }) {
  return (
    <div class="b-title" style={style}>
      <p class="k">{kicker}</p>
      <p class="t" style={{ fontSize: `${size}px` }}>
        {title}
      </p>
      {sub ? <p class="s">{sub}</p> : null}
    </div>
  );
}

export function EyeIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke={color} stroke-width="2" />
      <circle cx="10" cy="10" r="3" fill={color} />
    </svg>
  );
}

export function DocIcon() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" aria-hidden="true">
      <rect x="1.5" y="2" width="9" height="10" fill="none" stroke="currentColor" stroke-width="1.3" />
      <path d="M3 0.5 V3.5 M6 0.5 V3.5 M9 0.5 V3.5 M3.5 6.5 H8.5 M3.5 9 H7" stroke="currentColor" stroke-width="1" />
    </svg>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  ghost,
  icon,
  style,
  type = 'button',
}: {
  children: ComponentChildren;
  onClick?: () => void;
  disabled?: boolean;
  ghost?: boolean;
  icon?: ComponentChildren;
  style?: CSSProperties;
  type?: 'button' | 'submit';
}) {
  return (
    <button type={type} class={`b-btn ${ghost ? 'b-btn--ghost' : ''}`} disabled={disabled} onClick={onClick} style={style}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

/** 一行手写栏：小字说明 + 大字输入 + 字数。回车提交。 */
export function WriteLine({
  label,
  placeholder,
  max,
  value,
  onInput,
  onEnter,
  size = 22,
  disabled,
  autoFocus,
  style,
}: {
  label: ComponentChildren;
  placeholder?: string;
  max: number;
  value: string;
  onInput: (v: string) => void;
  onEnter?: () => void;
  size?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  style?: CSSProperties;
}) {
  const len = Array.from(value.trim()).length;
  return (
    <label class="b-write" style={style}>
      <small>{label}</small>
      <span>
        <input
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          enterKeyHint="send"
          style={{ fontSize: `${size}px` }}
          onInput={(e) => onInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.isComposing) {
              e.preventDefault();
              onEnter?.();
            }
          }}
        />
        <em class={len > max ? 'is-over' : ''}>
          {len} / {max}
        </em>
      </span>
    </label>
  );
}

/** 文字是否可以提交（非空且不超过字数）。 */
export const okText = (t: string, max: number) => {
  const n = Array.from(t.trim()).length;
  return n > 0 && n <= max;
};

/** 倒计时：小圆环 + 「还有 N 秒」。total 是这一步的总时长（毫秒）。 */
export function Timer({ deadline, offset, total, label = '还有', night }: { deadline: number | null; offset: number; total?: number | null; label?: string; night?: boolean }) {
  useTick(250);
  if (deadline === null) return null;
  const leftMs = Math.max(0, deadline - (Date.now() + offset));
  const left = Math.ceil(leftMs / 1000);
  const frac = total ? Math.min(1, leftMs / total) : 1;
  const ring = night ? 'rgba(232, 236, 243, 0.25)' : '#d8ceb7';
  const fg = left <= 5 ? 'var(--acc)' : night ? 'var(--night-ink)' : INK;
  return (
    <span class={`b-timer ${left <= 5 ? 'is-low' : ''}`} role="timer" aria-label={`${label} ${left} 秒`}>
      <svg width="14" height="14" viewBox="0 0 26 26" aria-hidden="true">
        <circle cx="13" cy="13" r="11" fill="none" stroke={ring} stroke-width="3" />
        <circle cx="13" cy="13" r="11" fill="none" stroke={fg} stroke-width="3" stroke-dasharray="69.1" stroke-dashoffset={(69.1 * (1 - frac)).toFixed(1)} transform="rotate(-90 13 13)" />
      </svg>
      {label} {left} 秒
    </span>
  );
}

/** 一排小方格计数（已投 / 已准备）。 */
export function Squares({ n, done, size = 9, gap = 3, color = INK }: { n: number; done: number; size?: number; gap?: number; color?: string }) {
  return (
    <svg width={n * (size + gap)} height={size + 1} viewBox={`0 0 ${n * (size + gap)} ${size + 1}`} aria-hidden="true" style={{ flex: 'none' }}>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={i * (size + gap) + 0.5} y="0.5" width={size} height={size} fill={i < done ? color : 'none'} stroke={color} stroke-width="1" />
      ))}
    </svg>
  );
}

/** 文字宽度的粗估（中文一字一个字号宽，英文数字半个）。 */
export function textWidth(s: string, size: number): number {
  let w = 0;
  for (const ch of s) w += /[\u0000-ÿ]/.test(ch) ? size * 0.55 : size;
  return w;
}
