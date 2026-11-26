/**
 * 规则图解：七张分步的小图，每张用对局里同一种地图的画法，配两三行字。
 * 换到一张时，图上的东西按顺序动起来，演一遍就停在最后一帧（可以「再放一遍」）；
 * 左右滑、点下面的界碑、「上一步 / 下一步」或方向键换张。首页「怎么玩」和大厅都能打开。
 * 例子是同一局：7 人，大国（阿乐、小满、周周）拿「鱿鱼」，小国（老陈、七七）拿「股票」，白板是林夕、米粒；你是小满。
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { P2, VOTE } from './art.ts';
import { Border, Coast, Dot, Plate, QPin, Stone, Territories, markerAt, seatPlace } from './atlas.tsx';
import { BIG, Btn, INK, MUTED, PAGE, SMALL, Stage, WL } from './board.tsx';
import { along } from './seats.ts';

const NAMES = ['阿乐', '林夕', '小满', '周周', '老陈', '米粒', '七七'];
const N = NAMES.length;
const ME = 2;
const ACC = 'var(--acc)';
const NIGHT_ACC = '#ff6a3d';

/** 第 s 秒开始。 */
const at = (s: number) => ({ animationDelay: `${s}s` });
const HALO = (c = PAGE, w = 4) => `paint-order: stroke; stroke: ${c}; stroke-width: ${w}px; stroke-linejoin: round`;
const serif = (size: number, weight = 700, fill = INK) => `font-family: var(--serif); font-weight: ${weight}; font-size: ${size}px; fill: ${fill}`;

/** 岛在图里往上挪一点（圆桌岛原来的坐标是整张 390 × 844 画板上的）。 */
const ISLAND_DY = -118;
const seat = (k: number, w = 44) => seatPlace(k, N, w);

function Verdict({ x, y, ok }: { x: number; y: number; ok: boolean }) {
  return (
    <g>
      <rect x={x} y={y - 13} width="38" height="17" fill={ok ? INK : PAGE} stroke={INK} stroke-width="1" />
      <text x={x + 19} y={y} text-anchor="middle" style={serif(11.5, 900, ok ? '#ffffff' : INK)}>
        {ok ? '✓ 猜中' : '✗ 猜错'}
      </text>
    </g>
  );
}

/* ================================================================ 1 三方，两个词 */

function ArtSides() {
  const cols = [
    { x: 72, label: '大国', names: ['阿乐', '小满', '周周'], word: '鱿鱼', fill: BIG },
    { x: 195, label: '小国', names: ['老陈', '七七'], word: '股票', fill: SMALL },
    { x: 318, label: '白板', names: ['林夕', '米粒'], word: null, fill: '#fdfaf2' },
  ];
  let k = 0;
  return (
    <g>
      {cols.map((c, ci) => (
        <g key={c.label}>
          <g class="t-in" style={at(0.1 + ci * 0.1)}>
            <rect x={c.x - 48} y="24" width="16" height="11" fill={c.fill} stroke={INK} stroke-width="0.8" stroke-dasharray={c.word ? undefined : '2 1.5'} />
            <text x={c.x - 27} y="34" style={serif(16, 900)}>
              {c.label}
            </text>
            <text x={c.x + 48} y="34" text-anchor="end" style={`font-family: var(--cond); font-weight: 500; font-size: 13px; fill: ${MUTED}`}>
              {c.names.length} 人
            </text>
            <path d={`M${c.x - 48} 44 H${c.x + 48}`} stroke={INK} stroke-width="1" />
          </g>
          {c.names.map((n, r) => {
            const y = 70 + r * 34;
            const me = n === NAMES[ME];
            const d = 0.4 + k++ * 0.08;
            return (
              <g key={n}>
                <circle class="t-pop" style={at(d)} cx={c.x - 34} cy={y} r="10" fill={c.fill} stroke={INK} stroke-width="1.2" stroke-dasharray={c.word ? undefined : '2.4 1.6'} />
                {me ? <circle class="t-pop" style={at(3.0)} cx={c.x - 34} cy={y} r="14.5" fill="none" stroke={ACC} stroke-width="1.8" /> : null}
                <text class="t-in" x={c.x - 18} y={y + 5} style={`${serif(14)}; animation-delay: ${d}s`}>
                  {n}
                  {me ? (
                    <tspan dx="2" style="font-family: var(--sans); font-size: 10px; fill: var(--acc-text)">
                      你
                    </tspan>
                  ) : null}
                </text>
              </g>
            );
          })}
          <g class="t-up" style={at(1.1 + ci * 0.2)}>
            <rect x={c.x - 43} y="199" width="92" height="42" fill={INK} opacity="0.14" />
            <rect x={c.x - 46} y="196" width="92" height="42" fill={c.word ? c.fill : PAGE} stroke={INK} stroke-width="1.2" stroke-dasharray={c.word ? undefined : '4 3'} />
            {c.word ? (
              <text x={c.x} y="225" text-anchor="middle" style={serif(22, 900)}>
                {c.word}
              </text>
            ) : (
              <text x={c.x} y="222" text-anchor="middle" style={serif(13, 700, MUTED)}>
                没有词
              </text>
            )}
          </g>
        </g>
      ))}
      <text class="t-in" x="20" y="188" style={`font-size: 10.5px; fill: ${MUTED}; animation-delay: 1s`}>
        每人拿到的词
      </text>
      <path class="t-draw" style={at(2.0)} pathLength="1" d="M72 240 V268 H195 V240" fill="none" stroke={INK} stroke-width="1.4" />
      <g class="t-up" style={at(2.5)}>
        <text x="134" y="292" text-anchor="middle" style={`${serif(15, 900)}; ${HALO()}`}>
          联系：都能「炒」
        </text>
        <text x="134" y="309" text-anchor="middle" style={`font-size: 10.5px; fill: ${MUTED}`}>
          两个词之间微妙的关系
        </text>
      </g>
    </g>
  );
}

/* ================================================================ 2 夜晚 */

const STAR = 'M0 -9 L2.6 -2.9 L8.6 -2.8 L4.1 1.2 L5.3 7.3 L0 4.2 L-5.3 7.3 L-4.1 1.2 L-8.6 -2.8 L-2.6 -2.9 Z';
const FLARE = 'M0 0 C6.4 -9 9.2 -21 0 -35 C-9.2 -21 -6.4 -9 0 0 Z';

function ArtNight({ motion }: { motion: boolean }) {
  const LX = 196;
  const LY = 292;
  const start = seat(6);
  const ang = (Math.atan2(start.at.y - LY, start.at.x - LX) * 180) / Math.PI;
  const ink = '#e8ecf3';
  return (
    <g>
      <rect x="17" y="7" width="362" height="348" fill={INK} opacity="0.25" />
      <rect x="14" y="4" width="362" height="348" fill="#132033" />
      <rect x="20" y="10" width="350" height="336" fill="none" stroke="#7fa6c8" stroke-width="0.6" />
      <g transform={`translate(0 ${ISLAND_DY - 22})`}>
        <g fill="none" stroke="#7fa6c8" stroke-width="0.6">
          {(P2.waterlines as { d: string; op: number }[]).slice(0, 4).map((w, i) => (
            <path key={i} d={w.d} opacity={w.op * 0.7} stroke-dasharray="2 3" />
          ))}
        </g>
        <path d={P2.coast} fill="#1b2c45" stroke={ink} stroke-width="1.3" />
        <path d={P2.coastIn} fill="none" stroke="#7fa6c8" stroke-width="0.6" stroke-dasharray="3 3" />
        <g transform={`translate(${LX} ${LY})`}>
          <g transform={`rotate(${ang.toFixed(1)})`}>
            <path d="M0 0 L150 -22 A152 152 0 0 1 150 22 Z" fill="#ffe7a3" opacity="0.28" />
            <path d="M0 0 L150 0" stroke="#ffe7a3" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.7" />
            {motion ? <animateTransform attributeName="transform" type="rotate" from={`${(ang - 230).toFixed(1)}`} to={`${ang.toFixed(1)}`} dur="1.9s" begin="0s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" /> : null}
          </g>
          <path d={FLARE} fill="#ff7a3d" transform="rotate(38)" />
          <path d={STAR} fill={ink} />
        </g>
        {NAMES.map((n, k) => {
          const s = seat(k);
          return (
            <g key={n}>
              <circle cx={s.at.x} cy={s.at.y} r="4.5" fill={ink} />
              <text x={s.label.x} y={s.label.y} text-anchor={s.anchor} style={`${serif(13, 700, ink)}; ${HALO('#132033', 3)}`}>
                {n}
              </text>
            </g>
          );
        })}
        <circle class="t-pop" style={at(2.0)} cx={start.at.x} cy={start.at.y} r="10" fill="none" stroke={NIGHT_ACC} stroke-width="2" />
        {motion
          ? [0, 1, 2, 3].map((k) => (
              <path key={k} d="M-5 -4 L5 0 L-5 4 Z" fill={NIGHT_ACC} opacity="0">
                <set attributeName="opacity" to="1" begin={`${2.9 + k * 1.25}s`} />
                <animateMotion dur="5s" begin={`${2.9 + k * 1.25}s`} repeatCount="indefinite" rotate="auto-reverse" keyPoints="1;0" keyTimes="0;1" calcMode="linear" {...({ path: P2.coast } as Record<string, string>)} />
              </path>
            ))
          : null}
      </g>
      <g class="t-up" style={at(2.2)}>
        <path d={STAR} transform="translate(34 307) scale(0.7)" fill={NIGHT_ACC} />
        <text x="48" y="312" style="font-size: 12.5px; fill: #e8ecf3">
          起点白板定明天从谁开始：<tspan style="font-weight: 700">七七</tspan>
        </text>
      </g>
      <g class="t-up" style={at(3.1)}>
        <path d="M29 330 A6 6 0 1 1 37 335" fill="none" stroke={NIGHT_ACC} stroke-width="1.6" />
        <path d="M37 331 L38 336 L33 336" fill="none" stroke={NIGHT_ACC} stroke-width="1.4" />
        <text x="48" y="335" style="font-size: 12.5px; fill: #e8ecf3">
          方向白板定往哪边轮：<tspan style="font-weight: 700">顺时针</tspan>
        </text>
      </g>
    </g>
  );
}

/* ================================================================ 3 白天：每人说一个词 */

function ArtClues() {
  const order = [6, 0, 1, 2, 3, 4, 5];
  const clues = ['涨停', '翻身', '红色', '下锅', '海边', '牛市', '潮汐'];
  const pos = [
    [70, 36],
    [70, 76],
    [70, 116],
    [126, 214],
    [126, 254],
    [126, 294],
    [126, 334],
  ];
  const t = (k: number) => 0.4 + k * 0.5;
  return (
    <g>
      <path d="M70 18 V132 L126 188 V352" fill="none" stroke="#fbf6e8" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M70 18 V132 L126 188 V352" fill="none" stroke="#7a4e8a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M58 18 H82 M114 352 H138" stroke={INK} stroke-width="3" />
      <text x="88" y="22" style={`font-size: 10.5px; fill: ${MUTED}`}>
        起点 · 顺时针
      </text>
      {order.map((s, k) => {
        const [x, y] = pos[k];
        const name = NAMES[s];
        const me = s === ME;
        const nameW = 30 + (me ? 12 : 0);
        return (
          <g key={s}>
            <circle cx={x} cy={y} r="8.5" fill={PAGE} stroke={INK} stroke-width="2.6" />
            <circle class="t-pop" style={at(t(k))} cx={x} cy={y} r="3.6" fill={INK} />
            <circle class="t-blink" style={at(t(k))} cx={x} cy={y} r="13" fill="none" stroke={ACC} stroke-width="2" />
            <text x={x + 17} y={y + 5} style={`${serif(14)}; ${HALO()}`}>
              {name}
              {me ? (
                <tspan dx="2" style="font-family: var(--sans); font-size: 10px; fill: var(--acc-text)">
                  你
                </tspan>
              ) : null}
            </text>
            <text class="t-up" style={`${serif(17, 900)}; ${HALO()}; animation-delay: ${t(k)}s`} x={x + 19 + nameW} y={y + 6}>
              「{clues[k]}」
            </text>
          </g>
        );
      })}
      <g class="t-in" style={at(4.0)}>
        <path d="M184 112 L246 98" stroke={INK} stroke-width="0.9" />
        <circle cx="184" cy="112" r="2" fill={INK} />
        <text x="250" y="96" style={serif(13.5, 900)}>
          太含糊
        </text>
        <text x="250" y="113" style={`font-size: 11.5px; fill: ${MUTED}`}>
          会被当成白板
        </text>
      </g>
      <g class="t-in" style={at(4.6)}>
        <path d="M252 210 L268 196" stroke={INK} stroke-width="0.9" />
        <circle cx="252" cy="210" r="2" fill={INK} />
        <text x="272" y="192" style={serif(13.5, 900)}>
          太准了
        </text>
        <text x="272" y="209" style={`font-size: 11.5px; fill: ${MUTED}`}>
          对方一猜就中
        </text>
      </g>
    </g>
  );
}

/* ================================================================ 4 投票 */

function ArtVote() {
  const [HX, HY] = VOTE.hub;
  const h = Math.PI / N;
  const ang = (k: number) => -Math.PI / 2 + (2 * Math.PI * k) / N;
  const votes: [number, number][] = [
    [1, 0.5],
    [2, 0.75],
    [1, 1.0],
    [6, 1.25],
    [1, 1.5],
    [2, 1.75],
    [1, 2.0],
  ];
  const count = new Map<number, number>();
  return (
    <g>
      <defs>
        <clipPath id="t-vote-coast">
          <path d={VOTE.coast} />
        </clipPath>
        <pattern id="t-out" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#f6f0e0" />
          <path d="M0 0 V6" stroke={INK} stroke-width="1.1" opacity="0.5" />
        </pattern>
      </defs>
      <g transform="translate(0 -124)">
        <g fill="none" stroke={WL} stroke-width="0.6">
          {(VOTE.waterlines as { d: string; op: number }[]).slice(0, 3).map((w, i) => (
            <path key={i} d={w.d} opacity={w.op} />
          ))}
        </g>
        <path d={VOTE.coast} fill="#ebe0c5" />
        <path class="t-in" style={at(2.7)} d={`M${HX} ${HY} L${HX + 400 * Math.cos(ang(1) - h)} ${HY + 400 * Math.sin(ang(1) - h)} A400 400 0 0 1 ${HX + 400 * Math.cos(ang(1) + h)} ${HY + 400 * Math.sin(ang(1) + h)} Z`} fill="url(#t-out)" clip-path="url(#t-vote-coast)" />
        <g clip-path="url(#t-vote-coast)" stroke="#ffffff" stroke-width="1.4" stroke-dasharray="4 3">
          {NAMES.map((_, k) => (
            <path key={k} d={`M${HX} ${HY} L${HX + 300 * Math.cos(ang(k) - h)} ${HY + 300 * Math.sin(ang(k) - h)}`} />
          ))}
        </g>
        <path d={VOTE.coast} fill="none" stroke={INK} stroke-width="1.6" />
        <circle cx={HX} cy={HY} r="15" fill={PAGE} stroke={INK} stroke-width="1" />
        <text x={HX} y={HY + 4} text-anchor="middle" style={serif(9.5, 700)}>
          圆桌
        </text>
        {NAMES.map((n, k) => {
          const p = along(VOTE.pts, HX, HY, ang(k), 0.62);
          const me = k === ME;
          return (
            <text key={n} x={p.x} y={p.y} text-anchor="middle" style={serif(14, 900)}>
              {n}
              {me ? (
                <tspan dx="2" style="font-family: var(--sans); font-size: 10px; fill: var(--acc-text)">
                  你
                </tspan>
              ) : null}
            </text>
          );
        })}
        {votes.map(([k, s], i) => {
          const p = along(VOTE.pts, HX, HY, ang(k), 0.62);
          const c = count.get(k) ?? 0;
          count.set(k, c + 1);
          return <path key={i} class="t-pop" style={at(s)} d={`M${p.x - 12 + c * 7} ${p.y + 8} l-1.5 13`} stroke={INK} stroke-width="2" stroke-linecap="round" />;
        })}
        {(() => {
          const p = along(VOTE.pts, HX, HY, ang(1), 0.62);
          return (
            <g class="t-pop" style={at(3.0)}>
              <rect x={p.x - 20} y={p.y - 32} width="40" height="17" fill={INK} />
              <text x={p.x} y={p.y - 19} text-anchor="middle" style={serif(11.5, 900, '#ffffff')}>
                出局
              </text>
            </g>
          );
        })()}
      </g>
      <text class="t-in" style={`font-size: 12px; fill: #1e1b17; animation-delay: 3.4s`} x="20" y="326">
        林夕是白板。出局时可以选：
      </text>
      <g class="t-up" style={at(3.7)}>
        <rect x="20" y="336" width="168" height="36" fill={PAGE} stroke={INK} stroke-width="1" />
        <rect x="27" y="343" width="22" height="22" fill={BIG} stroke={INK} stroke-width="0.8" />
        <text x="38" y="359" text-anchor="middle" style={serif(15, 900)}>
          ?
        </text>
        <text x="56" y="352" style={serif(12.5, 900)}>
          猜大国的词
        </text>
        <text x="56" y="366" style={`font-size: 10px; fill: ${MUTED}`}>
          猜中，白板直接赢
        </text>
      </g>
      <g class="t-up" style={at(3.9)}>
        <rect x="198" y="336" width="172" height="36" fill={PAGE} stroke={INK} stroke-width="1" />
        <path d="M206 344 H228 V358 H216 L211 363 V358 H206 Z" fill="none" stroke={INK} stroke-width="1.2" stroke-linejoin="round" />
        <text x="236" y="352" style={serif(12.5, 900)}>
          问裁判一个问题
        </text>
        <text x="236" y="366" style={`font-size: 10px; fill: ${MUTED}`}>
          是 / 否，只有白板看得到
        </text>
      </g>
    </g>
  );
}

/* ================================================================ 5 第二阶段 */

function ArtPhase2() {
  const out = new Set([1, 5]);
  const ring = (k: number, s: number, stay: boolean) => {
    const p = seat(k).at;
    return <circle class={stay ? 't-pop' : 't-blink t-long'} style={at(s)} cx={p.x} cy={p.y} r="11" fill="none" stroke={ACC} stroke-width="2" />;
  };
  return (
    <g>
      <g transform={`translate(0 ${ISLAND_DY})`}>
        <defs>
          <pattern id="q-hb" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0 V7" stroke="#d9b54a" stroke-width="0.7" />
          </pattern>
          <pattern id="q-hs" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <path d="M0 0 V7" stroke="#87b46c" stroke-width="0.7" />
          </pattern>
        </defs>
        <Territories />
        <Border />
        <Coast />
        <Plate x={158} y={262} cap="大国的词" word={null} />
        <g class="t-out" style={at(4.1)}>
          <Plate x={266} y={304} cap="小国的词" word={null} />
        </g>
        <g class="t-pop" style={at(4.1)}>
          <Plate x={266} y={304} cap="小国的词" word="股票" size={24} />
        </g>
        <g class="t-pop" style={at(2.5)}>
          <QPin x={214} y={344} who="小满" q="是吃的吗？" ans="否" rot={2} />
        </g>
        {NAMES.map((n, k) => {
          const s = seat(k);
          return (
            <g key={n}>
              <Dot x={s.at.x} y={s.at.y} out={out.has(k)} />
              <text x={s.label.x} y={s.label.y} text-anchor={s.anchor} style={`${serif(13.5, 700, out.has(k) ? '#8b8273' : INK)}; ${HALO('#d8e3df', 4)}`}>
                {n}
                {k === ME ? (
                  <tspan dx="2" style="font-family: var(--sans); font-size: 10px; fill: var(--acc-text)">
                    你
                  </tspan>
                ) : null}
              </text>
            </g>
          );
        })}
        {ring(4, 0.5, false)}
        {ring(2, 2.0, false)}
        {ring(0, 3.5, true)}
      </g>
      <g class="t-blink t-long" style={at(0.5)}>
        <text x="20" y="342" style="font-size: 13px; fill: #1e1b17">
          <tspan style="font-weight: 700">老陈</tspan>（小国）猜大国的词「章鱼」
        </text>
        <Verdict x={318} y={342} ok={false} />
      </g>
      <g class="t-blink t-long" style={at(2.0)}>
        <text x="20" y="342" style="font-size: 13px; fill: #1e1b17">
          <tspan style="font-weight: 700">小满</tspan>问裁判：小国的词是吃的吗？
        </text>
        <rect x="318" y="329" width="38" height="17" fill={PAGE} stroke={INK} stroke-width="1" />
        <text x="337" y="342" text-anchor="middle" style={serif(11.5, 900)}>
          否
        </text>
      </g>
      <g class="t-up" style={at(3.5)}>
        <text x="20" y="342" style="font-size: 13px; fill: #1e1b17">
          <tspan style="font-weight: 700">阿乐</tspan>（大国）猜小国的词「股票」
        </text>
        <Verdict x={318} y={342} ok />
      </g>
      <text class="t-up" style={`${serif(14, 900)}; animation-delay: 4.5s`} x="20" y="368">
        大国先猜中，拿到第一。
      </text>
    </g>
  );
}

/* ================================================================ 6 抢答 */

function ArtRace() {
  const hints = ['都和一个动词有关', '这个动词厨房里也用得上', '都能「炒」'];
  const t = (k: number) => 0.4 + k * 1.2;
  return (
    <g>
      <g transform={`translate(0 ${ISLAND_DY})`}>
        <defs>
          <pattern id="q-hb" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0 V7" stroke="#d9b54a" stroke-width="0.7" />
          </pattern>
          <pattern id="q-hs" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <path d="M0 0 V7" stroke="#87b46c" stroke-width="0.7" />
          </pattern>
        </defs>
        <Territories />
        <Border />
        <Coast />
        <Plate x={128} y={296} cap="大国的词" word={null} />
        <g class="t-out" style={at(4.6)}>
          <Plate x={278} y={330} cap="小国的词" word={null} />
        </g>
        <g class="t-pop" style={at(4.6)}>
          <Plate x={278} y={330} cap="小国的词" word="股票" size={24} />
        </g>
        {hints.map((_, k) => {
          const p = markerAt(k, hints.length);
          return (
            <g key={k}>
              <g opacity="0.9">
                <Stone x={p.x} y={p.y} n={k + 1} state="todo" />
              </g>
              <g class="t-pop" style={at(t(k))}>
                <Stone x={p.x} y={p.y} n={k + 1} state="done" />
              </g>
            </g>
          );
        })}
        {(() => {
          const p = markerAt(2, 3);
          return (
            <text x={p.x + 13} y={p.y + 4} style={`font-size: 10px; letter-spacing: 0.15em; fill: ${MUTED}; ${HALO('#fbf3dc', 4)}`}>
              联系
            </text>
          );
        })()}
        <g class="t-pop" style={at(4.1)}>
          <path d="M298 236 L312 226 H362 V252 H312 Z" fill={PAGE} stroke={INK} stroke-width="1" stroke-linejoin="round" />
          <text x="337" y="244" text-anchor="middle" style={serif(12.5, 900)}>
            股票！
          </text>
          <text x="337" y="266" text-anchor="middle" style={`font-size: 10.5px; fill: #1e1b17; ${HALO('#d8e3df', 3)}`}>
            周周抢答
          </text>
        </g>
      </g>
      {hints.map((h, k) => (
        <g key={k} class="t-up" style={at(t(k))}>
          <g transform={`translate(30 ${306 + k * 24})`}>
            <path d="M-7 7 V-4 Q-7 -9 0 -9 Q7 -9 7 -4 V7 Z" fill={INK} />
            <text y="4" text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 10.5px; fill: #ffffff">
              {k + 1}
            </text>
          </g>
          <text x="46" y={311 + k * 24} style={`font-size: 13px; fill: #1e1b17; ${k === hints.length - 1 ? 'font-weight: 700' : ''}`}>
            {k === hints.length - 1 ? '联系：' : '提示：'}
            {h}
          </text>
        </g>
      ))}
    </g>
  );
}

/* ================================================================ 7 名次 */

function ArtRank() {
  const SL = 232;
  const zones = [
    { f: 'small', x0: 40, x1: 140, h: 34, rank: '02', label: '小国 +1', fill: SMALL },
    { f: 'big', x0: 140, x1: 250, h: 104, rank: '01', label: '大国 +3', fill: BIG },
    { f: 'blank', x0: 250, x1: 350, h: 12, rank: '03', label: '白板 0', fill: '#fbf8ef' },
  ];
  const ridge = (x0: number, x1: number, h: number) => {
    const w = x1 - x0;
    const p: [number, number][] = [
      [x0, SL],
      [x0 + w * 0.18, SL - h * 0.22],
      [x0 + w * 0.32, SL - h * 0.5],
      [x0 + w * 0.42, SL - h * 0.44],
      [x0 + w * 0.5, SL - h],
      [x0 + w * 0.6, SL - h * 0.72],
      [x0 + w * 0.72, SL - h * 0.62],
      [x0 + w * 0.86, SL - h * 0.24],
      [x1, SL],
    ];
    return p;
  };
  const line = (p: [number, number][]) => `M${p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')}`;
  return (
    <g>
      <g class="t-rise" style={at(0.2)}>
        <rect x="20" y={SL} width="350" height="40" fill="#c9dcd8" />
        <path d={`M20 ${SL + 8} H40 M20 ${SL + 16} H34 M350 ${SL + 8} H370 M356 ${SL + 16} H370`} stroke={WL} stroke-width="0.7" />
        {zones.map((z) => {
          const p = ridge(z.x0, z.x1, z.h);
          return (
            <g key={z.f}>
              <path d={`${line(p)} L${z.x1} ${SL + 40} L${z.x0} ${SL + 40} Z`} fill={z.fill} />
              <path d={line(p)} fill="none" stroke={INK} stroke-width="1.6" stroke-linejoin="round" />
            </g>
          );
        })}
        <path d={`M140 ${SL} L144 ${SL + 40} M250 ${SL} L254 ${SL + 40}`} stroke={INK} stroke-width="0.9" stroke-dasharray="4 2.5" />
        <path d={`M20 ${SL + 40} H370`} stroke={INK} stroke-width="1.3" />
      </g>
      {zones.map((z, i) => {
        const cx = (z.x0 + z.x1) / 2;
        const sy = SL - z.h;
        return (
          <g key={z.f} class="t-pop" style={at(1.0 + i * 0.25)}>
            <path d={`M${cx - 6} ${sy + 1} L${cx} ${sy - 9} L${cx + 6} ${sy + 1} Z`} fill={PAGE} stroke={INK} stroke-width="1.2" />
            <text x={cx} y={sy - 30} text-anchor="middle" style="font-family: var(--cond); font-weight: 500; font-size: 19px; fill: #1e1b17">
              {z.rank}
            </text>
            <text x={cx} y={sy - 14} text-anchor="middle" style={serif(12.5, 900)}>
              {z.label}
            </text>
          </g>
        );
      })}
      <g class="t-up" style={at(2.0)}>
        <text x="20" y="306" style="font-size: 12.5px; fill: #1e1b17">
          <tspan style="font-weight: 700">①</tspan> 大国先猜中小国的词：第一名
        </text>
      </g>
      <g class="t-up" style={at(2.6)}>
        <text x="20" y="328" style="font-size: 12.5px; fill: #1e1b17">
          <tspan style="font-weight: 700">②</tspan> 小国和白板抢答大国的词「鱿鱼」，小国先中：第二
        </text>
      </g>
      <g class="t-up" style={at(3.2)}>
        <text x="20" y="350" style="font-size: 12.5px; fill: #1e1b17">
          <tspan style="font-weight: 700">③</tspan> 最后揭晓：鱿鱼 / 股票，联系是都能「炒」
        </text>
      </g>
    </g>
  );
}

/* ================================================================ 图解本身 */

interface Step {
  title: string;
  lines: string[];
  art: (motion: boolean) => ComponentChildren;
}

const STEPS: Step[] = [
  {
    title: '三方，两个词',
    lines: ['大国人最多，小国少一些，各拿一个词，两个词之间有个微妙的联系。', '白板没有词，要混在里面装作有词。', '你（图里的小满）只看得到自己的词「鱿鱼」，不知道自己是大国还是小国，也不知道谁是白板。'],
    art: () => <ArtSides />,
  },
  {
    title: '夜晚：白板安排顺序',
    lines: ['每晚所有人都低头看手机，谁也看不出谁是白板。', '白板决定第二天从谁开始说、按什么方向轮。'],
    art: (m) => <ArtNight motion={m} />,
  },
  {
    title: '白天：每人说一个词',
    lines: ['从起点开始轮流，每人说一个和自己的词有关的词。', '说得太含糊，会被当成白板；说得太准，第二阶段对方一下就能猜中你的词。'],
    art: () => <ArtClues />,
  },
  {
    title: '投票：票最多的出局',
    lines: ['说完自由讨论，然后投票，票最多的出局（平票一起出局）。', '出局的白板可以猜一次大国的词，猜中白板直接赢。', '两国要做的：把白板全部投出去。'],
    art: () => <ArtVote />,
  },
  {
    title: '第二阶段：猜对方的词',
    lines: ['白板全部出局后，活着的国家玩家轮流猜「对方国家」的词，或者问裁判一个是非问题。', '先猜中的一方拿第一。', '第一轮没人猜中时，白板阵营有一次翻盘：问一个问题、猜一次大国的词。'],
    art: () => <ArtPhase2 />,
  },
  {
    title: '抢答：提示一块块立起来',
    lines: ['两轮都没人猜中就抢答：每隔一段时间，国界上立一块界碑，写一条提示。', '提示放完，最后一块才是联系。谁先猜中谁赢，猜错要等 10 秒再猜。'],
    art: () => <ArtRace />,
  },
  {
    title: '名次',
    lines: ['第一名 +3，第二名 +1，第三名 0。', '一方拿到第一后，另外两方抢答第一名的词争第二；白板第一时，大国有一次机会猜小国的词。'],
    art: () => <ArtRank />,
  },
];

const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function RulesTour({ onClose, start = 0 }: { onClose: () => void; start?: number }) {
  const [i, setI] = useState(start);
  const [dir, setDir] = useState<1 | -1>(1);
  const [take, setTake] = useState(0);
  const [motion] = useState(() => !reduced());
  const down = useRef<{ x: number; y: number } | null>(null);
  const last = i === STEPS.length - 1;
  const go = (k: number) => {
    if (k < 0 || k >= STEPS.length || k === i) return;
    setDir(k > i ? 1 : -1);
    setI(k);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [i]);
  const step = STEPS[i];
  return (
    <div class="b-tour" role="dialog" aria-modal="true" aria-label="规则图解">
      <Stage bg="atlas" label="规则图解">
        <p class="b-tour-k">怎么玩 · 图解</p>
        <p class="b-tour-no">
          <b>{i + 1}</b> / {STEPS.length}
        </p>
        <button type="button" class="b-x b-tour-x" aria-label="关闭" onClick={onClose}>
          ×
        </button>
        <div
          class={`b-tour-page ${motion ? (dir > 0 ? 'is-next' : 'is-prev') : ''}`}
          key={i}
          onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const d = down.current;
            down.current = null;
            if (!d) return;
            const dx = e.clientX - d.x;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - d.y)) go(dx < 0 ? i + 1 : i - 1);
          }}
        >
          <h2 class="b-tour-t">{step.title}</h2>
          <svg class="b-tour-art" key={take} width="390" height="380" viewBox="0 0 390 380" aria-hidden="true">
            {step.art(motion)}
          </svg>
          <ul class="b-tour-text" aria-live="polite">
            {step.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        {motion ? (
          <button type="button" class="b-tour-replay" onClick={() => setTake((t) => t + 1)}>
            <svg width="13" height="13" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M16 10 A6 6 0 1 1 13.5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              <path d="M10.5 2.5 L14.5 5 L11 8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            再放一遍
          </button>
        ) : null}
        <nav class="b-tour-nav" aria-label="第几步">
          {STEPS.map((s, k) => (
            <button type="button" key={k} class={`b-tour-stone ${k === i ? 'is-on' : k < i ? 'is-done' : ''}`} aria-label={`第 ${k + 1} 步：${s.title}`} aria-current={k === i ? 'step' : undefined} onClick={() => go(k)}>
              <svg width="22" height="24" viewBox="-11 -12 22 24" aria-hidden="true">
                <path d="M-8 9 V-4 Q-8 -10 0 -10 Q8 -10 8 -4 V9 Z" />
                <text y="4" text-anchor="middle">
                  {k + 1}
                </text>
              </svg>
            </button>
          ))}
        </nav>
        <button type="button" class="b-tour-prev" disabled={i === 0} onClick={() => go(i - 1)}>
          ← 上一步
        </button>
        <div class="b-tour-next">
          <Btn onClick={() => (last ? onClose() : go(i + 1))}>{last ? '知道了，开始玩' : '下一步 →'}</Btn>
        </div>
      </Stage>
    </div>
  );
}
