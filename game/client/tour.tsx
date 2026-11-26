/**
 * 规则图解：八页，文案照规则说明来。每页的文字一段一段出来，图跟着这一段动；「」里的词加粗。
 * 每段停够了自动出下一段，轻点画面直接看下一段；左右滑、点下面的界碑、「上一页 / 下一页」或方向键换页。
 * 右上角「完整规则」打开文字版完整规则。例子用规则讲解专用的「雷达 / 射手」（它不在能抽到的题里）：
 * 7 人，大国 阿乐 小满 周周（雷达），小国 老陈 七七（射手），白板 林夕 米粒。
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { P2 } from './art.ts';
import { Border, Coast, Plate, Stone, Territories } from './atlas.tsx';
import { BIG, Btn, INK, MUTED, PAGE, SMALL, Stage } from './board.tsx';
import { LinkLine, LinkTag } from './over.tsx';
import { Rich, RulesDoc } from './rulesdoc.tsx';

type F = 'big' | 'small' | 'blank';

const ACC = 'var(--acc)';
const BLANK = '#fdfaf2';
const GREY = '#e2d8c2';
const NAMES = ['阿乐', '林夕', '小满', '周周', '老陈', '米粒', '七七'];
const SIDE: Record<string, F> = { 阿乐: 'big', 小满: 'big', 周周: 'big', 老陈: 'small', 七七: 'small', 林夕: 'blank', 米粒: 'blank' };
const FILL: Record<F, string> = { big: BIG, small: SMALL, blank: BLANK };
const CAMP: Record<F, string> = { big: '大国', small: '小国', blank: '白板' };

/** 第 s 秒开始。 */
const at = (s: number) => ({ animationDelay: `${s}s` });
const serif = (size: number, weight = 700, fill = INK) => `font-family: var(--serif); font-weight: ${weight}; font-size: ${size}px; fill: ${fill}`;
const HALO = (c = PAGE, w = 4) => `paint-order: stroke; stroke: ${c}; stroke-width: ${w}px; stroke-linejoin: round`;

/** 一个玩家：圆点 + 名字。f 为空：还不知道阵营（灰）。 */
function Tok({ x, y, f, name, r = 11, halo }: { x: number; y: number; f?: F | null; name?: string; r?: number; halo?: boolean }) {
  return (
    <g>
      {halo ? <circle cx={x} cy={y} r={r + 3} fill={PAGE} /> : null}
      <circle cx={x} cy={y} r={r} stroke={INK} stroke-width="1.3" stroke-dasharray={f === 'blank' ? '2.6 1.8' : undefined} style={{ fill: f ? FILL[f] : GREY, transition: 'fill 0.6s' }} />
      {name ? (
        <text x={x} y={y + r + 15} text-anchor="middle" style={`${serif(12.5)}${halo ? `; ${HALO('#fbf3dc', 4)}` : ''}`}>
          {name}
        </text>
      ) : null}
    </g>
  );
}

/** 图名框：黑底白字的小牌子，像地图左上角的图名。 */
function Tag({ x, y, children, w = 72 }: { x: number; y: number; children: string; w?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="21" fill={INK} />
      <text x={x + w / 2} y={y + 15} text-anchor="middle" style={`${serif(12, 900, '#ffffff')}; letter-spacing: 0.2em`}>
        {children}
      </text>
    </g>
  );
}

function Hatches() {
  return (
    <defs>
      <pattern id="q-hb" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0 V7" stroke="#d9b54a" stroke-width="0.7" />
      </pattern>
      <pattern id="q-hs" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <path d="M0 0 V7" stroke="#87b46c" stroke-width="0.7" />
      </pattern>
    </defs>
  );
}

/* ================================================================ 1 大国小国是什么 */

function Art1({ beat }: { beat: number }) {
  const cols: Record<F, number> = { big: 70, small: 195, blank: 320 };
  const seen: Record<F, number> = { big: 0, small: 0, blank: 0 };
  const sorted = beat >= 2;
  return (
    <g>
      <g class="t-up" style={at(0.1)}>
        <text x="195" y="56" text-anchor="middle" style={`${serif(40, 900)}; letter-spacing: 0.3em`}>
          大国小国
        </text>
        <path d="M118 72 H272" stroke={INK} stroke-width="1" />
        <path d="M118 76 H272" stroke={INK} stroke-width="1" />
        <text x="195" y="96" text-anchor="middle" style={`font-size: 12px; letter-spacing: 0.1em; fill: ${MUTED}`}>
          基于微妙联系的猜词类身份推理游戏
        </text>
      </g>
      {sorted
        ? (['big', 'small', 'blank'] as const).map((f, i) => (
            <g key={f} class="t-up" style={at(0.2 + i * 0.12)}>
              <rect x={cols[f] - 46} y="126" width="15" height="11" fill={FILL[f]} stroke={INK} stroke-width="0.8" stroke-dasharray={f === 'blank' ? '2 1.5' : undefined} />
              <text x={cols[f] - 26} y="137" style={serif(16, 900)}>
                {CAMP[f]}
              </text>
              <path d={`M${cols[f] - 46} 146 H${cols[f] + 46}`} stroke={INK} stroke-width="1" />
            </g>
          ))
        : null}
      {NAMES.map((n, k) => {
        const f = SIDE[n];
        const j = seen[f]++;
        const fx = j < 2 ? cols[f] + (j ? 22 : -22) : cols[f];
        const fy = j < 2 ? 176 : 224;
        const rx = 51 + k * 48;
        const ry = 196;
        return (
          <g key={n} class="t-pop" style={at(0.45 + k * 0.07)}>
            <g style={{ transform: sorted ? 'none' : `translate(${rx - fx}px, ${ry - fy}px)`, transition: `transform 0.8s cubic-bezier(0.5, 0, 0.25, 1) ${0.15 + k * 0.07}s` }}>
              <Tok x={fx} y={fy} f={sorted ? f : null} name={n} />
            </g>
          </g>
        );
      })}
      {sorted ? (
        <text class="t-up" style={`${serif(13.5, 900)}; letter-spacing: 0.15em; animation-delay: 1.4s`} x="195" y="282" text-anchor="middle">
          寻找队友 · 投票 · 猜词
        </text>
      ) : null}
    </g>
  );
}

/* ================================================================ 2 两个词，一个微妙的联系 */

function Art2({ beat }: { beat: number }) {
  const [bx, by] = P2.plateBig;
  const [sx, sy] = P2.plateSmall;
  return (
    <g>
      <Hatches />
      <g transform="translate(23.4 -96) scale(0.88)">
        <g class="t-in" style={at(0.05)}>
          <g fill="none" stroke="#5f8f93" stroke-width="0.7">
            {(P2.waterlines as { d: string; op: number }[]).slice(0, 4).map((w, i) => (
              <path key={i} d={w.d} opacity={w.op} />
            ))}
          </g>
          <Territories />
          <Border />
          <Coast />
        </g>
        {beat >= 3 ? (
          <>
            <g key="bw" class="t-pop" style={at(0.1)}>
              <Plate x={bx} y={by} cap="大国词" word="雷达" />
            </g>
            <g key="sw" class="t-pop" style={at(0.45)}>
              <Plate x={sx} y={sy} cap="小国词" word="射手" />
            </g>
          </>
        ) : (
          <g class="t-up" style={at(0.4)}>
            <Plate x={bx} y={by} cap="大国词" word={null} />
            <Plate x={sx} y={sy} cap="小国词" word={null} />
          </g>
        )}
        {beat >= 2 && beat < 4 ? (
          <g class="t-pop" style={at(0.2)}>
            <LinkTag />
          </g>
        ) : null}
        {beat >= 4 ? (
          <>
            <LinkTag fading />
            <LinkLine link="都是蚊香的品牌" big="雷达" small="射手" play />
          </>
        ) : null}
      </g>
    </g>
  );
}

/* ================================================================ 3 你拿到了什么 */

function Sheet({ x, title, children }: { x: number; title: string; children: ComponentChildren }) {
  return (
    <g>
      <rect x={x + 3} y="13" width="166" height="214" fill={INK} opacity="0.14" />
      <rect x={x} y="10" width="166" height="214" fill="#f6efdd" stroke={INK} stroke-width="1.2" />
      <rect x={x + 4} y="14" width="158" height="206" fill="none" stroke={INK} stroke-width="0.5" />
      <text x={x + 83} y="37" text-anchor="middle" style={`${serif(12.5, 900)}; letter-spacing: 0.3em`}>
        {title}
      </text>
      <path d={`M${x + 16} 46 H${x + 150}`} stroke={INK} stroke-width="0.8" />
      {children}
    </g>
  );
}

function Art3({ beat }: { beat: number }) {
  const bars: [F, number][] = [
    ['big', 3],
    ['small', 2],
    ['blank', 2],
  ];
  let bx = 33;
  return (
    <g>
      <g class="t-up" style={at(0.1)}>
        <Sheet x={20} title="你的词">
          <text x="103" y="100" text-anchor="middle" style={`${serif(32, 900)}; letter-spacing: 0.12em`}>
            雷达
          </text>
          <text x="103" y="126" text-anchor="middle" style={`font-size: 11.5px; fill: ${MUTED}`}>
            我是大国，还是小国？
          </text>
          {bars.map(([f, c]) => {
            const w = c * 20;
            const x0 = bx;
            bx += w;
            return (
              <g key={f}>
                <rect x={x0} y="168" width={w} height="12" fill={FILL[f]} stroke={INK} stroke-width="0.8" />
                <text x={x0 + w / 2} y="162" text-anchor="middle" style={serif(10.5)}>
                  {CAMP[f]} {c}
                </text>
              </g>
            );
          })}
          <text x="103" y="203" text-anchor="middle" style={`font-size: 10.5px; fill: ${MUTED}`}>
            大国的人比小国多
          </text>
        </Sheet>
      </g>
      {beat >= 2 ? (
        <g class="t-up" style={at(0.1)}>
          <Sheet x={204} title="你的身份">
            <text x="287" y="92" text-anchor="middle" style={`${serif(28, 900)}; letter-spacing: 0.24em`}>
              白板
            </text>
            <text x="287" y="112" text-anchor="middle" style={`font-size: 10.5px; fill: ${MUTED}`}>
              没有词
            </text>
            {[0, 1].map((k) => (
              <rect key={k} class="t-pop" style={at(0.6 + k * 0.15)} x={266 + k * 24} y="126" width="18" height="18" fill="#ffffff" stroke={INK} stroke-width="1.2" />
            ))}
            <text x="287" y="162" text-anchor="middle" style={serif(12, 900)}>
              大国词有 2 个字
            </text>
            <g class="t-in" style={at(1.0)}>
              <text x="230" y="199" style={`font-size: 10.5px; fill: ${MUTED}`}>
                队友
              </text>
              <Tok x={266} y={195} f="blank" r={7} />
              <text x="278" y="199" style={serif(12)}>
                米粒
              </text>
            </g>
          </Sheet>
        </g>
      ) : null}
      {beat >= 3 ? (
        <g class="t-up" style={at(0.1)}>
          <path d="M34 242 H356 L346 256 L356 270 H34 L44 256 Z" fill={INK} />
          <text x="195" y="261" text-anchor="middle" style={`${serif(14, 900, '#ffffff')}; letter-spacing: 0.1em`}>
            白板：猜对大国词，就获胜
          </text>
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================ 4 两个阶段 */

function Art4({ beat }: { beat: number }) {
  const st = NAMES.map((n, k) => ({ n, x: 58 + k * 46 }));
  const LY = 62;
  return (
    <g>
      <Hatches />
      {/* 第一阶段：一条线上的七站 */}
      <g class="t-up" style={at(0.1)}>
        <rect x="20" y="8" width="350" height="118" fill={PAGE} stroke={INK} stroke-width="1.2" />
        <Tag x={20} y={8}>
          第一阶段
        </Tag>
        <path d={`M36 ${LY} H354`} stroke="#fbf6e8" stroke-width="12" stroke-linecap="round" />
        <path d={`M36 ${LY} H354`} stroke="#7a4e8a" stroke-width="6" stroke-linecap="round" />
        {st.map(({ n, x }) => (
          <g key={n}>
            <circle cx={x} cy={LY} r="7" fill={PAGE} stroke={INK} stroke-width="2.2" />
            <text x={x} y={LY + 25} text-anchor="middle" style={serif(12)}>
              {n}
            </text>
          </g>
        ))}
      </g>
      {beat >= 2 ? (
        <g>
          {st
            .filter(({ n }) => SIDE[n] === 'blank')
            .map(({ n, x }, k) => (
              <g key={n}>
                <circle class="t-pop" style={at(0.3 + k * 0.6)} cx={x} cy={LY} r="7" fill={BLANK} stroke={INK} stroke-width="1.6" stroke-dasharray="2.6 1.8" />
                <path class="t-draw" pathLength="1" style={at(0.5 + k * 0.6)} d={`M${x - 10} ${LY + 10} L${x + 10} ${LY - 10}`} stroke={INK} stroke-width="2.4" stroke-linecap="round" />
              </g>
            ))}
          <text class="t-up" style={`${serif(12.5, 900)}; animation-delay: 1.7s`} x="195" y="114" text-anchor="middle">
            白板全部出局 → 公开宣布进入第二阶段
          </text>
        </g>
      ) : null}
      <path class="t-in" style={at(0.5)} d="M195 130 V146 M189 140 L195 146 L201 140" fill="none" stroke={INK} stroke-width="1.4" />
      {/* 第二阶段：两国隔着国界 */}
      <g class="t-up" style={at(0.4)}>
        <path d="M20 150 H226 L180 276 H20 Z" fill={BIG} />
        <path d="M20 150 H226 L180 276 H20 Z" fill="url(#q-hb)" opacity="0.55" />
        <path d="M226 150 H370 V276 H180 Z" fill={SMALL} />
        <path d="M226 150 H370 V276 H180 Z" fill="url(#q-hs)" opacity="0.55" />
        <path d="M226 150 L180 276" stroke="#fbf6e8" stroke-width="7" />
        <path d="M226 150 L180 276" stroke={INK} stroke-width="1.5" stroke-dasharray="9 3 1.6 3" />
        <rect x="20" y="150" width="350" height="126" fill="none" stroke={INK} stroke-width="1.2" />
        <Tag x={20} y={150}>
          第二阶段
        </Tag>
      </g>
      {beat >= 3 ? (
        <g>
          {['阿乐', '小满', '周周'].map((n, k) => (
            <g key={n} class="t-pop" style={at(0.05 * k)}>
              <Tok x={50 + k * 42} y={202} f="big" name={n} r={10} halo />
            </g>
          ))}
          {['老陈', '七七'].map((n, k) => (
            <g key={n} class="t-pop" style={at(0.2 + 0.05 * k)}>
              <Tok x={278 + k * 46} y={202} f="small" name={n} r={10} halo />
            </g>
          ))}
          <path class="t-draw" pathLength="1" style={at(0.6)} d="M142 196 C176 172 224 172 258 196" fill="none" stroke={INK} stroke-width="1.5" />
          <path class="t-pop" style={at(1.1)} d="M258 196 l-10 -2 l5 -7 Z" fill={INK} />
          <path class="t-pop" style={at(1.1)} d="M142 196 l10 -2 l-5 -7 Z" fill={INK} />
          <text class="t-in" style={`${serif(11.5, 900)}; ${HALO('#f3e6bd', 4)}; animation-delay: 1s`} x="200" y="172" text-anchor="middle">
            轮流猜对方国家的词
          </text>
          <g class="t-up" style={at(1.6)}>
            <path d="M104 248 V266 M104 249 H122 L117 254 L122 259 H104" fill={ACC} stroke={INK} stroke-width="1" />
            <text x="128" y="264" style={`${serif(13, 900)}; ${HALO('#f3e6bd', 4)}`}>
              先猜对的阵营：第一名
            </text>
          </g>
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================ 5 第一阶段的一天 */

function Art5({ beat }: { beat: number }) {
  const order = ['小满', '周周', '老陈', '米粒', '七七', '阿乐', '林夕'];
  const clues = ['天线', '信号', '靶心', '夏天', '弓箭', '屏幕', '奥运'];
  const xs = order.map((_, k) => 42 + k * 51);
  const Y = 120;
  const votes: [number, number][] = [
    [3, 4],
    [6, 2],
    [1, 1],
  ];
  return (
    <g>
      <g class="t-up" style={at(0.1)}>
        <rect x="20" y="10" width="200" height="40" fill="#132033" />
        <path d="M43 21.5 A9 9 0 1 0 43 38.5 A7 7 0 1 1 43 21.5 Z" fill="#e8ecf3" />
        <text x="56" y="27" style="font-size: 10px; letter-spacing: 0.2em; fill: #9fb3c8">
          夜晚 · 白板暗中决定
        </text>
        <text x="56" y="43" style="font-size: 12px; fill: #e8ecf3">
          从 <tspan style="font-weight: 700">小满</tspan> 开始，往右轮
        </text>
      </g>
      <g class="t-up" style={at(0.4)}>
        <path d={`M26 ${Y} H364`} stroke="#fbf6e8" stroke-width="12" stroke-linecap="round" />
        <path d={`M26 ${Y} H364`} stroke="#7a4e8a" stroke-width="6" stroke-linecap="round" />
        {order.map((n, k) => (
          <g key={n}>
            <circle cx={xs[k]} cy={Y} r="7.5" fill={PAGE} stroke={INK} stroke-width="2.4" />
            <text x={xs[k]} y={Y + 26} text-anchor="middle" style={serif(12)}>
              {n}
            </text>
          </g>
        ))}
        <circle class="t-pop" style={at(0.9)} cx={xs[0]} cy={Y} r="12.5" fill="none" stroke={ACC} stroke-width="2" />
      </g>
      {beat >= 2
        ? order.map((n, k) => (
            <g key={n} class="t-up" style={at(0.15 + k * 0.35)}>
              <circle cx={xs[k]} cy={Y} r="3.4" fill={INK} />
              <text x={xs[k]} y={Y - 17} text-anchor="middle" style={`${serif(14, 900)}; ${HALO()}`}>
                {clues[k]}
              </text>
            </g>
          ))
        : null}
      {beat >= 3 ? (
        <g>
          <text class="t-in" style={`${serif(12, 900, MUTED)}; animation-delay: 0s`} x="366" y="35" text-anchor="end">
            同样的顺序，再轮一圈
          </text>
          {order.map((n, k) => (
            <g key={n} class="t-blink" style={{ animationDelay: `${0.3 + k * 0.45}s`, animationDuration: '0.7s' }}>
              <circle cx={xs[k]} cy={Y} r="12.5" fill="none" stroke={ACC} stroke-width="2.2" />
              <path d={`M${xs[k] - 13} ${Y - 66} h26 v15 h-8 l-5 6 v-6 h-13 Z`} fill={PAGE} stroke={INK} stroke-width="1" />
              <text x={xs[k]} y={Y - 55} text-anchor="middle" style={`font-size: 11px; font-weight: 700; fill: ${INK}`}>
                …
              </text>
            </g>
          ))}
        </g>
      ) : null}
      {beat >= 4 ? (
        <g>
          {votes.map(([k, nv], vi) =>
            Array.from({ length: nv }, (_, i) => (
              <path key={`${vi}-${i}`} class="t-pop" style={at(0.2 + (vi * 4 + i) * 0.12)} d={`M${xs[k] - 9 + i * 5} ${Y + 36} l-1.5 12`} stroke={INK} stroke-width="2" stroke-linecap="round" />
            )),
          )}
          <g class="t-pop" style={at(1.5)}>
            <path d={`M${xs[3] - 11} ${Y + 11} L${xs[3] + 11} ${Y - 11}`} stroke={INK} stroke-width="2.6" stroke-linecap="round" />
            <rect x={xs[3] - 20} y={Y + 56} width="40" height="18" fill={INK} />
            <text x={xs[3]} y={Y + 69} text-anchor="middle" style={serif(11.5, 900, '#ffffff')}>
              出局
            </text>
          </g>
          <text class="t-in" style={`font-size: 11px; fill: ${MUTED}; animation-delay: 1.9s`} x="195" y={Y + 110} text-anchor="middle">
            票最多的出局，平票的一起出局
          </text>
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================ 6 分寸 */

function Art6({ beat }: { beat: number }) {
  const PX = 195;
  const PY = 66;
  const L = 112;
  const ang = beat >= 3 ? 0 : beat >= 2 ? 10 : -10;
  const rad = (ang * Math.PI) / 180;
  const T = 'transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)';
  const pan = (s: -1 | 1, label: string, sub: string, load: ComponentChildren) => {
    const ex = PX + s * L * Math.cos(rad);
    const ey = PY + s * L * Math.sin(rad);
    const hx = PX + s * L;
    return (
      <g style={{ transform: `translate(${(ex - hx).toFixed(1)}px, ${(ey - PY).toFixed(1)}px)`, transition: T }}>
        <path d={`M${hx} ${PY} L${hx - 40} ${PY + 66} M${hx} ${PY} L${hx + 40} ${PY + 66}`} stroke={INK} stroke-width="1" />
        <g transform={`translate(${hx} ${PY + 56})`}>{load}</g>
        <path d={`M${hx - 50} ${PY + 66} H${hx + 50} L${hx + 38} ${PY + 80} H${hx - 38} Z`} fill={PAGE} stroke={INK} stroke-width="1.3" />
        <text x={hx} y={PY + 102} text-anchor="middle" style={serif(13.5, 900)}>
          {label}
        </text>
        <text x={hx} y={PY + 120} text-anchor="middle" style={`font-size: 11px; fill: ${MUTED}`}>
          {sub}
        </text>
      </g>
    );
  };
  return (
    <g class="t-up" style={at(0.1)}>
      <path d={`M${PX} ${PY} L${PX - 24} 222 H${PX + 24} Z`} fill={GREY} stroke={INK} stroke-width="1.3" />
      <path d={`M${PX - 64} 222 H${PX + 64}`} stroke={INK} stroke-width="2.6" />
      <g style={{ transform: `rotate(${ang}deg)`, transformOrigin: `${PX}px ${PY}px`, transition: T }}>
        <rect x={PX - L - 4} y={PY - 3.5} width={2 * L + 8} height="7" fill={INK} />
        {[-1, 1].map((s) => (
          <circle key={s} cx={PX + s * L} cy={PY} r="3" fill={PAGE} stroke={INK} stroke-width="1" />
        ))}
      </g>
      <circle cx={PX} cy={PY} r="7" fill={ACC} stroke={INK} stroke-width="1.3" />
      {pan(
        -1,
        '说得太含糊',
        '像白板，会被投出去',
        <text y="4" text-anchor="middle" style={serif(20, 900, MUTED)}>
          ？
        </text>,
      )}
      {pan(
        1,
        '说得太准',
        '对方国家一猜就中',
        <g>
          <circle r="9" fill="#ffffff" stroke={INK} stroke-width="1.2" />
          <circle r="5" fill="none" stroke={INK} stroke-width="1.2" />
          <circle r="1.6" fill={INK} />
        </g>,
      )}
      {beat >= 3 ? (
        <text class="t-pop" style={`${serif(16, 900)}; letter-spacing: 0.2em; animation-delay: 0.9s`} x={PX} y="30" text-anchor="middle">
          刚刚好
        </text>
      ) : null}
    </g>
  );
}

/* ================================================================ 7 白板的能力 */

function Art7({ beat }: { beat: number }) {
  const rows: { title: string; sub: string; from: number }[] = [
    { title: '被投出去时：猜一次大国词', sub: '猜对就获胜', from: 2 },
    { title: '或者：问裁判一个是非问题', sub: '答案只有白板阵营看得到', from: 2 },
    { title: '某国被投出去太多：白板直接获胜', sub: '第一阶段，每次投票后检查', from: 3 },
    { title: '第二阶段第一轮没人猜中：救济', sub: '再问一个问题（公开），然后猜一次大国词', from: 4 },
  ];
  const y0 = 66;
  const gap = 50;
  return (
    <g>
      <g class="t-up" style={at(0.1)}>
        <Tok x={40} y={24} f="blank" r={13} />
        <text x="62" y="30" style={`${serif(15, 900)}; letter-spacing: 0.2em`}>
          白板
        </text>
        <path d={`M40 40 V${y0 + gap * 3}`} stroke={INK} stroke-width="1.2" stroke-dasharray="3 3" />
        {rows.map((_, k) => (
          <Stone key={k} x={40} y={y0 + gap * k} n={k + 1} state="todo" />
        ))}
      </g>
      {rows.map((r, k) =>
        beat >= r.from ? (
          <g key={k} class="t-up" style={at(0.15 + (r.from === 2 ? k * 0.4 : 0))}>
            <Stone x={40} y={y0 + gap * k} n={k + 1} state="done" />
            <text x="60" y={y0 + gap * k - 2} style={serif(13.5, 900)}>
              {r.title}
            </text>
            <text x="60" y={y0 + gap * k + 16} style={`font-size: 11px; fill: ${MUTED}`}>
              {r.sub}
            </text>
          </g>
        ) : null,
      )}
    </g>
  );
}

/* ================================================================ 8 开一局 */

function Art8({ beat }: { beat: number }) {
  const CX = 290;
  const CY = 92;
  return (
    <g>
      <g class="t-up" style={at(0.1)}>
        <path d="M40 40 Q70 30 100 42 Q130 30 160 40 V146 Q130 136 100 148 Q70 136 40 146 Z" fill={PAGE} stroke={INK} stroke-width="1.4" />
        <path d="M100 42 V148" stroke={INK} stroke-width="1" />
        {[0, 1, 2, 3, 4].map((k) => (
          <path key={k} d={`M52 ${64 + k * 16} H90 M110 ${64 + k * 16} H148`} stroke="#b9b09d" stroke-width="2" />
        ))}
        <text x="100" y="176" text-anchor="middle" style={`${serif(14, 900)}; letter-spacing: 0.15em`}>
          完整规则
        </text>
        <text x="100" y="194" text-anchor="middle" style={`font-size: 11px; fill: ${MUTED}`}>
          右上角随时能打开
        </text>
      </g>
      {beat >= 2 ? (
        <g>
          <circle class="t-pop" style={at(0.1)} cx={CX} cy={CY} r="34" fill={GREY} stroke={INK} stroke-width="1.3" />
          {NAMES.map((n, k) => {
            const a = -Math.PI / 2 + (2 * Math.PI * k) / NAMES.length;
            return (
              <g key={n} class="t-pop" style={at(0.3 + k * 0.08)}>
                <Tok x={CX + 54 * Math.cos(a)} y={CY + 50 * Math.sin(a)} f={SIDE[n]} r={8} />
              </g>
            );
          })}
          <text class="t-pop" style={`${serif(13, 900)}; animation-delay: 1s`} x={CX} y={CY + 5} text-anchor="middle">
            开一局
          </text>
          <text class="t-up" style={`${serif(14, 900)}; letter-spacing: 0.15em; animation-delay: 1.2s`} x={CX} y="176" text-anchor="middle">
            实际玩一局
          </text>
        </g>
      ) : null}
    </g>
  );
}

/* ================================================================ 文案 */

interface Beat {
  text: string;
  /** 小字的备注。 */
  note?: boolean;
  /** 段后放一个「打开完整规则」。 */
  doc?: boolean;
}

interface Page {
  title: string;
  artH: number;
  Art: (p: { beat: number }) => ComponentChildren;
  beats: Beat[];
}

const PAGES: Page[] = [
  {
    title: '大国小国是什么',
    artH: 292,
    Art: Art1,
    beats: [{ text: '「大国小国」是一款基于微妙联系的猜词类身份推理游戏。' }, { text: '玩家们会被分配进「大国」「小国」「白板」三个阵营，通过寻找队友、投票、猜词，帮助自己所在的阵营获得游戏胜利。' }],
  },
  {
    title: '两个词，一个联系',
    artH: 282,
    Art: Art2,
    beats: [
      { text: '游戏开始时，所有「大国」玩家都会拿到同一个词，所有「小国」玩家则会拿到另一个词。' },
      { text: '「大国词」和「小国词」之间，存在某种比「谁是卧底」更加遥远的微妙联系。' },
      { text: '这种联系有多微妙呢？举例来说：这局游戏中「大国词」是「雷达」，「小国词」是「射手」。' },
      { text: '这两个词的微妙联系在于：「它们都是蚊香的品牌」。' },
      { text: '※ 我们知道这并不是大多数人都知道的知识，所以只拿它来举例。正式游戏中只会出现大多数人都知道的联系。', note: true },
    ],
  },
  {
    title: '你拿到了什么',
    artH: 276,
    Art: Art3,
    beats: [
      { text: '游戏开始时，如果你拿到了词，说明你的阵营是「大国」或者「小国」。「大国」的人数比「小国」多，你可以以此为线索，慢慢确定自己的阵营和队友。' },
      { text: '如果你是「白板」，你拿不到任何词，但你会知道（部分）白板队友是谁，以及「大国词」有几个字。' },
      { text: '「白板」的胜利条件很简单：猜对「大国词」，就可以获胜。' },
    ],
  },
  {
    title: '两个阶段',
    artH: 280,
    Art: Art4,
    beats: [
      { text: '游戏分成两个阶段。' },
      { text: '在第一阶段，「大国」和「小国」可能会希望先联手，把所有「白板」都投出去。所有白板都被投出去之后，会公开宣布进入第二阶段。' },
      { text: '「大国」和「小国」的胜利条件，只有进入第二阶段后才可能满足：存活的「大国」和「小国」玩家轮流猜对方国家的词，先猜对的阵营获得第一名。' },
    ],
  },
  {
    title: '第一阶段的一天',
    artH: 236,
    Art: Art5,
    beats: [
      { text: '在第一阶段，每一天，大家都按照「白板」在夜晚暗中指定的顺序发言：' },
      { text: '首先，每个玩家说出一个跟自己的词有关的词（「身份提示」）。' },
      { text: '然后，按照相同的顺序，每人再轮流自由发言一段（「轮流发言」）。' },
      { text: '所有人发言结束后进入投票：大家投出自己怀疑是「白板」的玩家，票最多的人出局。' },
    ],
  },
  {
    title: '分寸',
    artH: 236,
    Art: Art6,
    beats: [
      { text: '所以一般来说，「大国」和「小国」玩家需要在第一阶段透露一些自己的词是什么，来找到队友、把白板投出去。' },
      { text: '但另一方面，又不能说得太过详细，向对方国家暴露自己的词，让自己在第二阶段陷入不利。' },
      { text: '把握这两者之间的平衡，是「大国小国」玩家非常重要的能力。' },
    ],
  },
  {
    title: '白板的能力',
    artH: 236,
    Art: Art7,
    beats: [
      { text: '是的，「白板」会比较难玩。但相应的，「白板」也有各种能力。' },
      { text: '「白板」在投票中被投出去时，可以立刻猜一次「大国词」（猜对就获胜），也可以问裁判一个能用「是 / 否」回答的问题，答案只有「白板」阵营能看到——或许这就是破局的钥匙？' },
      { text: '另外，在第一阶段，如果某一个国家被投出去的人太多，「白板」也会直接获胜。' },
      { text: '又或者在第二阶段，「大国」和「小国」第一轮都没有猜中，「白板」阵营（包括已经出局的白板）也会获得救济机会：再问裁判一个「是 / 否」问题（这次大家都看得到），然后猜一次「大国词」。' },
    ],
  },
  {
    title: '开一局吧',
    artH: 206,
    Art: Art8,
    beats: [{ text: '游戏还有更多可选规则与细节，可以在文字版「完整规则」里查阅。', doc: true }, { text: '不过比起长篇大论，更好的办法是实际开一局游戏体验一下。' }],
  },
];

/** 这一段停多久（秒）：按字数，短的也停一会儿。 */
const dwell = (b: Beat) => Math.max(2.8, Math.min(8.5, 1.6 + Array.from(b.text).length * 0.11));
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const TEXT_BOTTOM = 696;

export function RulesTour({ onClose, start = 0 }: { onClose: () => void; start?: number }) {
  const [motion] = useState(() => !reduced());
  const [i, setI] = useState(start);
  const [dir, setDir] = useState<1 | -1>(1);
  const page = PAGES[i];
  const total = page.beats.length;
  const [beat, setBeat] = useState(motion ? 1 : total);
  const [take, setTake] = useState(0);
  const [doc, setDoc] = useState(false);
  const down = useRef<{ x: number; y: number } | null>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const last = i === PAGES.length - 1;
  const done = beat >= total;

  const go = (k: number) => {
    if (k < 0 || k >= PAGES.length || k === i) return;
    setDir(k > i ? 1 : -1);
    setI(k);
    setBeat(motion ? 1 : PAGES[k].beats.length);
  };
  /** 主按钮：这一页还没放完就「继续」出下一段，放完了才换页。 */
  const primary = () => {
    if (!done) setBeat(beat + 1);
    else if (last) onClose();
    else go(i + 1);
  };
  const replay = () => {
    setBeat(1);
    setTake((t) => t + 1);
  };
  // 这一段停够了就出下一段（看完整规则时先停着）
  useEffect(() => {
    if (doc || beat >= total) return;
    const t = window.setTimeout(() => setBeat((b) => Math.min(total, b + 1)), dwell(page.beats[beat - 1]) * 1000);
    return () => clearTimeout(t);
  }, [i, beat, take, doc]);
  // 新出的一段滚到看得见
  useLayoutEffect(() => {
    const el = textRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: beat > 1 ? 'smooth' : 'auto' });
  }, [i, beat]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (doc) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') primary();
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if ((e.key === ' ' || e.key === 'Enter') && beat < total && e.target === document.body) {
        e.preventDefault();
        setBeat(beat + 1);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [i, beat, doc]);

  const textTop = 104 + page.artH + 6;
  return (
    <div class="b-tour" role="dialog" aria-modal="true" aria-label="规则图解">
      <Stage bg="atlas" label="规则图解">
        <p class="b-tour-k">怎么玩 · 图解</p>
        <button type="button" class="b-tour-doc" onClick={() => setDoc(true)}>
          <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
            <path d="M2.5 4.5 Q6 3 10 4.6 Q14 3 17.5 4.5 V16 Q14 14.6 10 16.2 Q6 14.6 2.5 16 Z" />
            <path d="M10 4.6 V16.2" />
          </svg>
          完整规则
        </button>
        <p class="b-tour-no">
          <b>{i + 1}</b> / {PAGES.length}
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
            const dy = e.clientY - d.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? i + 1 : i - 1);
            else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && beat < total) setBeat(beat + 1); // 轻点：直接看下一段
          }}
        >
          <h2 class="b-tour-t">{page.title}</h2>
          {motion ? (
            <button type="button" class="b-tour-replay" aria-label="重放这一页" title="重放这一页" onPointerUp={(e) => e.stopPropagation()} onClick={replay}>
              <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M16 10 A6 6 0 1 1 13.5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M10.5 2.5 L14.5 5 L11 8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          ) : null}
          <svg class="b-tour-art" key={take} width="390" height={page.artH} viewBox={`0 0 390 ${page.artH}`} aria-hidden="true">
            <page.Art beat={beat} />
          </svg>
          <div class="b-tour-text" ref={textRef} style={{ top: `${textTop}px`, height: `${TEXT_BOTTOM - textTop}px` }} aria-live="polite">
            {page.beats.slice(0, beat).map((b, k) => (
              <div key={`${take}-${k}`} class={`b-tour-beat${b.note ? ' is-note' : ''}${k === beat - 1 ? ' is-new' : ''}`}>
                <p>
                  <Rich text={b.text} />
                </p>
                {b.doc ? (
                  <button type="button" class="b-tour-open" onPointerUp={(e) => e.stopPropagation()} onClick={() => setDoc(true)}>
                    打开完整规则 →
                  </button>
                ) : null}
              </div>
            ))}
            {beat < total ? <p class="b-tour-more">轻点画面，看下一段</p> : null}
          </div>
        </div>
        <nav class="b-tour-nav" aria-label="第几页">
          {PAGES.map((p, k) => (
            <button type="button" key={k} class={`b-tour-stone ${k === i ? 'is-on' : k < i ? 'is-done' : ''}`} aria-label={`第 ${k + 1} 页：${p.title}`} aria-current={k === i ? 'step' : undefined} onClick={() => go(k)}>
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
          ← 上一页
        </button>
        <div class="b-tour-next">
          <Btn onClick={primary}>{!done ? '继续' : last ? '知道了，开始玩' : '下一页 →'}</Btn>
        </div>
      </Stage>
      {doc ? <RulesDoc onClose={() => setDoc(false)} /> : null}
    </div>
  );
}
