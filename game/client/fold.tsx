/**
 * 换页：天黑、天亮时，整张图沿中间的折痕合上，合上时看到的是下一段的封面（「第 2 夜 · 天黑请闭眼」
 * 「第 2 天 · 天亮了」），再打开就是新的图。只动 transform 和 opacity；不想看动画的设置下不播放。
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { PlayerView } from '../engine/view.ts';
import { flags } from './flags.ts';

type To = 'night' | 'day';

const STAR = 'M0 -9 L2.6 -2.9 L8.6 -2.8 L4.1 1.2 L5.3 7.3 L0 4.2 L-5.3 7.3 L-4.1 1.2 L-8.6 -2.8 L-2.6 -2.9 Z';
const FLARE = 'M0 0 C6.4 -9 9.2 -21 0 -35 C-9.2 -21 -6.4 -9 0 0 Z';

function Cover({ to, day, code }: { to: To; day: number; code: string }) {
  const night = to === 'night';
  const ink = night ? '#e8ecf3' : '#1e1b17';
  return (
    <div class={`b-fold-cover ${night ? 'is-night' : 'is-day'}`}>
      <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect x="8" y="8" width="374" height="828" fill="none" stroke={ink} stroke-width="1.2" />
        <rect x="14" y="14" width="362" height="816" fill="none" stroke={ink} stroke-width="0.5" />
        <g transform="translate(195 400)">
          <circle r="58" fill="none" stroke={night ? '#7fa6c8' : ink} stroke-width="0.6" stroke-dasharray="1.5 3" />
          {night ? (
            <>
              <path d={FLARE} fill="#ff7a3d" transform="rotate(38)" />
              <path d={STAR} fill={ink} />
            </>
          ) : (
            <g fill="none" stroke={ink} stroke-linecap="round">
              <circle r="22" stroke-width="1.6" />
              <path d="M0 -34 V-44 M0 34 V44 M-34 0 H-44 M34 0 H44 M24 -24 L31 -31 M-24 24 L-31 31 M24 24 L31 31 M-24 -24 L-31 -31" stroke-width="1.6" />
            </g>
          )}
        </g>
      </svg>
      <p class="b-fold-t">{night ? `第 ${day} 夜` : `第 ${day} 天`}</p>
      <p class="b-fold-s">{night ? '天黑请闭眼' : '天亮了'}</p>
      <p class="b-fold-n">圆桌岛 · 房间 {code}</p>
    </div>
  );
}

function FoldOverlay({ to, day, code, onDone }: { to: To; day: number; code: string; onDone: () => void }) {
  return (
    <div class="b-fold" aria-hidden="true" onAnimationEnd={(e) => (e.target as Element).classList.contains('b-fold-r') && onDone()}>
      <div class="b-fold-l">
        <Cover to={to} day={day} code={code} />
      </div>
      <div class="b-fold-r">
        <div class="b-fold-shift">
          <Cover to={to} day={day} code={code} />
        </div>
      </div>
      <i class="b-fold-crease" />
    </div>
  );
}

/** 天黑（任何一步 → 夜晚）、天亮（夜晚 → 身份提示）时播放一次换页。 */
export function DayNightFold({ v, code }: { v: PlayerView; code: string }) {
  const k = v.step.k;
  const prev = useRef<string | null>(null);
  const [fold, setFold] = useState<{ to: To; day: number; key: number } | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = k;
    if (flags.still || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const firstNight = before === null && k === 'night' && v.day === 1 && !v.log.some((e) => e.t === 'clue');
    if ((before !== null && before !== 'night' && k === 'night') || firstNight) setFold({ to: 'night', day: v.day, key: Date.now() });
    else if (before === 'night' && k !== 'night' && k !== 'over') setFold({ to: 'day', day: v.day, key: Date.now() });
  }, [k, v.day]);
  if (!fold) return null;
  return <FoldOverlay key={fold.key} to={fold.to} day={fold.day} code={code} onDone={() => setFold(null)} />;
}
