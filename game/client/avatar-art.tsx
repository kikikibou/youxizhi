/**
 * 默认头像：16 个卡通人物 + 8 只小动物，画在 64 × 64 的格子里。
 * 编号 0–23 就是头像字符串 'p:<n>'（服务器只认 0–23，见 shared/protocol.ts 的 AVATAR_PRESETS）。
 */

const INK = '#0a0a0a';
const PAPER = '#ffffff';
const CORAL = '#ff5a46';
const BLUE = '#1f14ff';
const SUN = '#ffc93c';
const BG = { coral: '#ffd9d2', blue: '#dcd9ff', sun: '#ffeaa6', mint: '#cdeedd' };
const SKIN = ['#ffdcbf', '#f3bd8f', '#cf9466', '#8f5d3d'];
const HAIR = { ink: '#1b1b1f', brown: '#7a4a2c', blond: '#f2c14e', coral: CORAL, blue: BLUE, grey: '#b4b4be' };

/** 描边：所有色块都是黑色粗描边，和整站的线稿风格一致。 */
const S = { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } as const;
const L = { ...S, fill: 'none' } as const;

const BODY = 'M7 66 C8 53 19 47.5 32 47.5 C45 47.5 56 53 57 66 Z';

type Hair = 'crop' | 'bowl' | 'spiky' | 'side' | 'bun' | 'pigtails' | 'long' | 'afro' | 'cap' | 'beanie' | 'bald' | 'mohawk';
type Eyes = 'dot' | 'happy' | 'big' | 'glasses' | 'wink' | 'sleepy' | 'shades';
type Mouth = 'smile' | 'grin' | 'o' | 'flat' | 'cat' | 'smirk' | 'teeth';
type Extra = 'blush' | 'freckles' | 'mustache';

interface Person {
  bg: string;
  skin: number;
  hair: Hair;
  hc: string;
  eyes: Eyes;
  mouth: Mouth;
  shirt: string;
  extra?: Extra[];
}

const PEOPLE: Person[] = [
  { bg: BG.coral, skin: 0, hair: 'crop', hc: HAIR.ink, eyes: 'dot', mouth: 'smile', shirt: BLUE, extra: ['blush'] },
  { bg: BG.blue, skin: 1, hair: 'bun', hc: HAIR.brown, eyes: 'happy', mouth: 'grin', shirt: CORAL, extra: ['blush'] },
  { bg: BG.sun, skin: 2, hair: 'spiky', hc: HAIR.ink, eyes: 'big', mouth: 'smirk', shirt: INK },
  { bg: BG.mint, skin: 0, hair: 'long', hc: HAIR.blond, eyes: 'wink', mouth: 'smile', shirt: CORAL, extra: ['blush'] },
  { bg: BG.coral, skin: 3, hair: 'afro', hc: HAIR.ink, eyes: 'glasses', mouth: 'grin', shirt: SUN },
  { bg: BG.blue, skin: 1, hair: 'cap', hc: CORAL, eyes: 'dot', mouth: 'teeth', shirt: PAPER },
  { bg: BG.sun, skin: 0, hair: 'bald', hc: HAIR.grey, eyes: 'glasses', mouth: 'flat', shirt: BLUE, extra: ['mustache'] },
  { bg: BG.mint, skin: 2, hair: 'pigtails', hc: HAIR.ink, eyes: 'big', mouth: 'o', shirt: CORAL, extra: ['freckles'] },
  { bg: BG.blue, skin: 0, hair: 'bowl', hc: HAIR.brown, eyes: 'sleepy', mouth: 'cat', shirt: SUN, extra: ['blush'] },
  { bg: BG.coral, skin: 1, hair: 'beanie', hc: BLUE, eyes: 'happy', mouth: 'smile', shirt: INK },
  { bg: BG.sun, skin: 3, hair: 'crop', hc: HAIR.ink, eyes: 'shades', mouth: 'smirk', shirt: CORAL },
  { bg: BG.mint, skin: 0, hair: 'side', hc: CORAL, eyes: 'dot', mouth: 'grin', shirt: BLUE },
  { bg: BG.blue, skin: 2, hair: 'long', hc: HAIR.ink, eyes: 'happy', mouth: 'smile', shirt: SUN, extra: ['blush'] },
  { bg: BG.coral, skin: 0, hair: 'mohawk', hc: BLUE, eyes: 'wink', mouth: 'teeth', shirt: INK },
  { bg: BG.sun, skin: 1, hair: 'side', hc: HAIR.grey, eyes: 'glasses', mouth: 'smile', shirt: CORAL, extra: ['mustache'] },
  { bg: BG.mint, skin: 1, hair: 'afro', hc: HAIR.brown, eyes: 'big', mouth: 'cat', shirt: BLUE, extra: ['blush'] },
];

/* ------------------------------------------------------------------ 人物的各个部件 */

/** 头后面的头发（长发、爆炸头、双马尾、发髻）。 */
function HairBack({ p }: { p: Person }) {
  switch (p.hair) {
    case 'long':
      return <path d="M15.5 32 C14 15 50 15 48.5 32 L50.5 55 C47 57.5 43 56 42 52 L22 52 C21 56 17 57.5 13.5 55 Z" fill={p.hc} {...S} />;
    case 'afro': {
      const c: [number, number][] = [
        [18, 26],
        [22, 17],
        [31, 12.5],
        [40.5, 14],
        [46.5, 21],
        [48, 30],
        [16, 34],
      ];
      return (
        <>
          {c.map(([x, y], i) => (
            <circle key={`o${i}`} cx={x} cy={y} r="9" fill={INK} />
          ))}
          {c.map(([x, y], i) => (
            <circle key={`f${i}`} cx={x} cy={y} r="7.6" fill={p.hc} />
          ))}
        </>
      );
    }
    case 'pigtails':
      return (
        <>
          <circle cx="13.5" cy="30" r="6.5" fill={p.hc} {...S} />
          <circle cx="50.5" cy="30" r="6.5" fill={p.hc} {...S} />
          <circle cx="17.5" cy="27" r="2" fill={CORAL} {...S} stroke-width="1.4" />
          <circle cx="46.5" cy="27" r="2" fill={CORAL} {...S} stroke-width="1.4" />
        </>
      );
    case 'bun':
      return <circle cx="32" cy="12" r="6.5" fill={p.hc} {...S} />;
    default:
      return null;
  }
}

const CROP = 'M17.5 30 C16.5 17 25 13.5 32 13.5 C39 13.5 47.5 17 46.5 30 C44 24.5 39 22 32 22 C25 22 20 24.5 17.5 30 Z';

/** 额头前面的头发、帽子。 */
function HairFront({ p }: { p: Person }) {
  switch (p.hair) {
    case 'crop':
    case 'bun':
    case 'pigtails':
      return <path d={CROP} fill={p.hc} {...S} />;
    case 'bowl':
      return <path d="M16.5 34 C14.5 14 49.5 14 47.5 34 L44.5 34 L44 27 L20 27 L19.5 34 Z" fill={p.hc} {...S} />;
    case 'spiky':
      return (
        <path
          d="M17.5 30 L15 18 L21.5 20.5 L22 11 L28.5 16 L32 7 L36 16 L42 11 L42.5 20.5 L49 18 L46.5 30 C43.5 24.5 38.5 22 32 22 C25.5 22 20.5 24.5 17.5 30 Z"
          fill={p.hc}
          {...S}
        />
      );
    case 'side':
      return (
        <path
          d="M17 32 C15 16 27 11 37 12 C45 13 49 21 47 32 C46 27 45 25 43 23 C37 27 27 27 20 24 C18.5 26.5 17.5 29 17 32 Z"
          fill={p.hc}
          {...S}
        />
      );
    case 'long':
      return (
        <path
          d="M17.5 33 C16 17 25 13.5 32 13.5 C39 13.5 48 17 46.5 33 C45 27 42 23.5 38 22 C35 26 27 27.5 20.5 26.5 C19 28.5 18 30.5 17.5 33 Z"
          fill={p.hc}
          {...S}
        />
      );
    case 'afro':
      return <path d="M18 29 C19.5 21 25.5 18.5 32 18.5 C38.5 18.5 44.5 21 46 29 C42 25 37.5 23.5 32 23.5 C26.5 23.5 22 25 18 29 Z" fill={p.hc} />;
    case 'cap':
      return (
        <>
          <path d="M17 29 C16 15 48 15 47 29 Z" fill={p.hc} {...S} />
          <path d="M40 27.5 C47 25.5 55 26.5 58.5 29.5 C54 31.5 46 31.5 40 30.5 Z" fill={p.hc} {...S} />
          <circle cx="32" cy="15.6" r="1.6" fill={INK} />
          <path d="M32 16 V28.5" {...L} stroke-width="1.2" />
        </>
      );
    case 'beanie':
      return (
        <>
          <path d="M16 31 C15 12 49 12 48 31 Z" fill={p.hc} {...S} />
          <rect x="15" y="25.5" width="34" height="7" rx="3" fill={p.hc} {...S} />
          <path d="M20 26 V32 M25 26 V32 M30 26 V32 M35 26 V32 M40 26 V32 M45 26 V32" {...L} stroke={PAPER} stroke-width="1.2" opacity="0.55" />
          <circle cx="32" cy="11" r="4.5" fill={PAPER} {...S} />
        </>
      );
    case 'bald':
      return (
        <>
          <path d="M17.6 35 C16 29 17 25.5 20.5 23 L21.5 31 Z" fill={p.hc} {...S} stroke-width="1.6" />
          <path d="M46.4 35 C48 29 47 25.5 43.5 23 L42.5 31 Z" fill={p.hc} {...S} stroke-width="1.6" />
          <path d="M24.5 21.5 Q28 18.5 32 18.2" {...L} stroke={PAPER} stroke-width="2.2" opacity="0.85" />
        </>
      );
    case 'mohawk':
      return <path d="M27 24 L25.5 9.5 L29.5 12.5 L31.5 5.5 L34.5 11.5 L38.5 8.5 L37.5 24 C34 22.8 30.5 22.8 27 24 Z" fill={p.hc} {...S} />;
  }
}

function EyesArt({ e }: { e: Eyes }) {
  switch (e) {
    case 'dot':
      return (
        <>
          <circle cx="26" cy="33" r="2.3" fill={INK} />
          <circle cx="38" cy="33" r="2.3" fill={INK} />
        </>
      );
    case 'happy':
      return <path d="M23 34.5 Q26 30.5 29 34.5 M35 34.5 Q38 30.5 41 34.5" {...L} stroke-width="2.2" />;
    case 'big':
      return (
        <>
          <circle cx="26" cy="33" r="3.4" fill={INK} />
          <circle cx="38" cy="33" r="3.4" fill={INK} />
          <circle cx="27.2" cy="31.8" r="1.2" fill={PAPER} />
          <circle cx="39.2" cy="31.8" r="1.2" fill={PAPER} />
        </>
      );
    case 'glasses':
      return (
        <>
          <circle cx="26" cy="33" r="5" fill={PAPER} fill-opacity="0.4" {...S} />
          <circle cx="38" cy="33" r="5" fill={PAPER} fill-opacity="0.4" {...S} />
          <path d="M31 33 Q32 31.6 33 33" {...L} stroke-width="1.6" />
          <circle cx="26" cy="33.4" r="1.8" fill={INK} />
          <circle cx="38" cy="33.4" r="1.8" fill={INK} />
        </>
      );
    case 'wink':
      return (
        <>
          <circle cx="26" cy="33" r="2.3" fill={INK} />
          <path d="M35.5 30.8 L40.5 33.3 L35.5 35.8" {...L} stroke-width="2.1" />
        </>
      );
    case 'sleepy':
      return <path d="M23 33 Q26 36 29 33 M35 33 Q38 36 41 33" {...L} stroke-width="2.1" />;
    case 'shades':
      return (
        <>
          <path d="M19.5 30 H30.5 V33.5 Q30.5 37.5 26.5 37.5 H23.5 Q19.5 37.5 19.5 33.5 Z" fill={INK} {...S} stroke-width="1.4" />
          <path d="M33.5 30 H44.5 V33.5 Q44.5 37.5 40.5 37.5 H37.5 Q33.5 37.5 33.5 33.5 Z" fill={INK} {...S} stroke-width="1.4" />
          <path d="M30.5 31 H33.5 M19.5 31 L17.5 30.3 M44.5 31 L46.5 30.3" {...L} stroke-width="1.6" />
          <path d="M22 32 L24.5 32 M36 32 L38.5 32" {...L} stroke={PAPER} stroke-width="1.2" />
        </>
      );
  }
}

function MouthArt({ m }: { m: Mouth }) {
  switch (m) {
    case 'smile':
      return <path d="M27.5 40.5 Q32 44.8 36.5 40.5" {...L} />;
    case 'grin':
      return (
        <>
          <path d="M26.5 39.5 Q32 48 37.5 39.5 Z" fill={INK} {...S} />
          <path d="M29.5 42.7 Q32 40.9 34.5 42.7 Q32 44.3 29.5 42.7 Z" fill={CORAL} />
        </>
      );
    case 'o':
      return <ellipse cx="32" cy="42" rx="2.2" ry="2.7" fill={INK} />;
    case 'flat':
      return <path d="M28.5 42.3 H35.5" {...L} />;
    case 'cat':
      return <path d="M27.5 40.5 Q29.75 43.6 32 40.5 Q34.25 43.6 36.5 40.5" {...L} />;
    case 'smirk':
      return <path d="M28 42 Q33.5 43.6 37 39.5" {...L} />;
    case 'teeth':
      return (
        <>
          <path d="M26.5 39.5 H37.5 Q37 46.5 32 46.5 Q27 46.5 26.5 39.5 Z" fill={PAPER} {...S} />
          <path d="M27.2 42.3 H36.8" {...L} stroke-width="1.2" />
        </>
      );
  }
}

function ExtraArt({ x, hc }: { x: Extra; hc: string }) {
  switch (x) {
    case 'blush':
      return (
        <>
          <ellipse cx="22.3" cy="39" rx="3" ry="1.8" fill={CORAL} opacity="0.45" />
          <ellipse cx="41.7" cy="39" rx="3" ry="1.8" fill={CORAL} opacity="0.45" />
        </>
      );
    case 'freckles':
      return (
        <g fill="#a0522d" opacity="0.75">
          {[
            [21.5, 38],
            [24, 39.6],
            [21, 40.8],
            [42.5, 38],
            [40, 39.6],
            [43, 40.8],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="0.85" />
          ))}
        </g>
      );
    case 'mustache':
      return <path d="M25.5 40.6 Q28.5 36.6 32 39 Q35.5 36.6 38.5 40.6 Q35 41.9 32 40.7 Q29 41.9 25.5 40.6 Z" fill={hc} {...S} stroke-width="1.5" />;
  }
}

function PersonArt({ p }: { p: Person }) {
  const skin = SKIN[p.skin];
  return (
    <>
      <rect width="64" height="64" fill={p.bg} />
      <path d={BODY} fill={p.shirt} {...S} />
      <path d="M27 48 L32 53.5 L37 48" {...L} stroke={p.shirt === INK ? PAPER : INK} stroke-width="1.6" />
      <HairBack p={p} />
      <circle cx="17.5" cy="34" r="3.6" fill={skin} {...S} />
      <circle cx="46.5" cy="34" r="3.6" fill={skin} {...S} />
      <ellipse cx="32" cy="32" rx="14.5" ry="15.5" fill={skin} {...S} />
      <HairFront p={p} />
      {(p.extra ?? []).filter((x) => x !== 'mustache').map((x) => (
        <ExtraArt key={x} x={x} hc={p.hc} />
      ))}
      <EyesArt e={p.eyes} />
      <MouthArt m={p.mouth} />
      {p.extra?.includes('mustache') ? <ExtraArt x="mustache" hc={p.hc} /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ 小动物 */

const blush = (y = 39, dx = 10.5) => (
  <>
    <ellipse cx={32 - dx} cy={y} rx="3" ry="1.8" fill={CORAL} opacity="0.45" />
    <ellipse cx={32 + dx} cy={y} rx="3" ry="1.8" fill={CORAL} opacity="0.45" />
  </>
);
const shiny = (x1: number, x2: number, y: number, r = 2.6) => (
  <>
    <circle cx={x1} cy={y} r={r} fill={INK} />
    <circle cx={x2} cy={y} r={r} fill={INK} />
    <circle cx={x1 + r * 0.35} cy={y - r * 0.38} r={r * 0.36} fill={PAPER} />
    <circle cx={x2 + r * 0.35} cy={y - r * 0.38} r={r * 0.36} fill={PAPER} />
  </>
);

function Cat() {
  const fur = '#f4a24a';
  return (
    <>
      <rect width="64" height="64" fill={BG.blue} />
      <path d={BODY} fill={fur} {...S} />
      <path d="M17 27 L18 9 L30 19 Z" fill={fur} {...S} />
      <path d="M47 27 L46 9 L34 19 Z" fill={fur} {...S} />
      <path d="M19.8 21.5 L20.3 13.6 L26 18.4 Z" fill={CORAL} />
      <path d="M44.2 21.5 L43.7 13.6 L38 18.4 Z" fill={CORAL} />
      <ellipse cx="32" cy="33" rx="16" ry="14.5" fill={fur} {...S} />
      <path d="M28 19.6 L29 24 M32 18.6 V24 M36 19.6 L35 24" {...L} stroke-width="1.6" />
      {shiny(25.5, 38.5, 32, 2.8)}
      <path d="M30 37.4 H34 L32 39.6 Z" fill={CORAL} {...S} stroke-width="1.2" />
      <path d="M28 40.6 Q30 43.2 32 40.2 Q34 43.2 36 40.6" {...L} stroke-width="1.6" />
      <path d="M13.5 35.5 L21.5 37.2 M13.5 40 L21.5 39.4 M50.5 35.5 L42.5 37.2 M50.5 40 L42.5 39.4" {...L} stroke-width="1.3" />
    </>
  );
}

function Bear() {
  const fur = '#b5784c';
  const muzzle = '#f0d2b2';
  return (
    <>
      <rect width="64" height="64" fill={BG.sun} />
      <path d={BODY} fill={fur} {...S} />
      <circle cx="19" cy="20" r="6.5" fill={fur} {...S} />
      <circle cx="45" cy="20" r="6.5" fill={fur} {...S} />
      <circle cx="19" cy="20" r="3.2" fill={muzzle} />
      <circle cx="45" cy="20" r="3.2" fill={muzzle} />
      <ellipse cx="32" cy="34" rx="16" ry="15" fill={fur} {...S} />
      {shiny(25.5, 38.5, 31.5, 2.4)}
      <ellipse cx="32" cy="39.6" rx="7" ry="5.2" fill={muzzle} {...S} stroke-width="1.6" />
      <ellipse cx="32" cy="37.2" rx="2.8" ry="2" fill={INK} />
      <path d="M32 39 V41 M29 41.2 Q32 44 35 41.2" {...L} stroke-width="1.5" />
      {blush(39, 12)}
    </>
  );
}

function Panda() {
  return (
    <>
      <rect width="64" height="64" fill={BG.mint} />
      <path d={BODY} fill={INK} {...S} />
      <path d="M27 48 L32 53 L37 48" {...L} stroke={PAPER} stroke-width="1.4" opacity="0.6" />
      <circle cx="19" cy="20" r="6.5" fill={INK} {...S} />
      <circle cx="45" cy="20" r="6.5" fill={INK} {...S} />
      <ellipse cx="32" cy="34" rx="16" ry="15" fill={PAPER} {...S} />
      <ellipse cx="25" cy="33" rx="4.3" ry="5.6" transform="rotate(-28 25 33)" fill={INK} />
      <ellipse cx="39" cy="33" rx="4.3" ry="5.6" transform="rotate(28 39 33)" fill={INK} />
      <circle cx="25.6" cy="32.4" r="1.7" fill={PAPER} />
      <circle cx="38.4" cy="32.4" r="1.7" fill={PAPER} />
      <ellipse cx="32" cy="39" rx="2.6" ry="1.8" fill={INK} />
      <path d="M32 40.6 V42 M29.2 42.2 Q32 44.6 34.8 42.2" {...L} stroke-width="1.5" />
      {blush(40, 12)}
    </>
  );
}

function Frog() {
  const green = '#79c96a';
  const parts = (
    <>
      <circle cx="22" cy="23" r="7.5" />
      <circle cx="42" cy="23" r="7.5" />
      <ellipse cx="32" cy="38" rx="19.5" ry="13" />
    </>
  );
  return (
    <>
      <rect width="64" height="64" fill={BG.coral} />
      <path d={BODY} fill={green} {...S} />
      <g fill={INK} stroke={INK} stroke-width="4">
        {parts}
      </g>
      <g fill={green}>{parts}</g>
      <circle cx="22" cy="23" r="4.6" fill={PAPER} {...S} stroke-width="1.5" />
      <circle cx="42" cy="23" r="4.6" fill={PAPER} {...S} stroke-width="1.5" />
      <circle cx="22.8" cy="23.8" r="2.3" fill={INK} />
      <circle cx="42.8" cy="23.8" r="2.3" fill={INK} />
      <circle cx="29.5" cy="34" r="0.9" fill={INK} />
      <circle cx="34.5" cy="34" r="0.9" fill={INK} />
      <path d="M19.5 39 Q32 50 44.5 39" {...L} stroke-width="2.2" />
      {blush(42, 15)}
    </>
  );
}

function Rabbit() {
  const inner = '#ffb3a8';
  return (
    <>
      <rect width="64" height="64" fill={BG.blue} />
      <path d={BODY} fill={CORAL} {...S} />
      <ellipse cx="25" cy="14" rx="5" ry="12" transform="rotate(-10 25 14)" fill={PAPER} {...S} />
      <ellipse cx="39" cy="14" rx="5" ry="12" transform="rotate(10 39 14)" fill={PAPER} {...S} />
      <ellipse cx="25" cy="15" rx="2.2" ry="8" transform="rotate(-10 25 15)" fill={inner} />
      <ellipse cx="39" cy="15" rx="2.2" ry="8" transform="rotate(10 39 15)" fill={inner} />
      <ellipse cx="32" cy="35" rx="15" ry="14" fill={PAPER} {...S} />
      {shiny(26, 38, 33, 2.5)}
      <path d="M30.5 38 H33.5 L32 39.8 Z" fill={CORAL} {...S} stroke-width="1" />
      <rect x="30" y="41.6" width="4" height="3.4" rx="0.6" fill={PAPER} {...S} stroke-width="1.2" />
      <path d="M32 41.8 V45" {...L} stroke-width="1" />
      <path d="M32 39.8 V41.4 M28.6 41 Q30.3 43 32 41.4 Q33.7 43 35.4 41" {...L} stroke-width="1.4" />
      {blush(39.5, 10.5)}
    </>
  );
}

function Dog() {
  const fur = '#e9c08f';
  const ear = '#7a4a2c';
  return (
    <>
      <rect width="64" height="64" fill={BG.mint} />
      <path d={BODY} fill={BLUE} {...S} />
      <path d="M25 49 Q32 53 39 49" {...L} stroke={CORAL} stroke-width="3" />
      <ellipse cx="32" cy="33" rx="15" ry="15" fill={fur} {...S} />
      <ellipse cx="38.6" cy="30.8" rx="5" ry="5.6" fill={ear} />
      <path d="M18 21 C10 23 8.5 37 13.5 42 C18 40.5 20 32 21.5 25.5 Z" fill={ear} {...S} />
      <path d="M46 21 C54 23 55.5 37 50.5 42 C46 40.5 44 32 42.5 25.5 Z" fill={ear} {...S} />
      {shiny(25.5, 38.5, 31.5, 2.4)}
      <ellipse cx="32" cy="39" rx="6.6" ry="4.6" fill="#fff3e2" {...S} stroke-width="1.5" />
      <ellipse cx="32" cy="36.9" rx="3" ry="2.1" fill={INK} />
      <path d="M30.2 41.4 Q32 47 33.8 41.4 Z" fill={CORAL} {...S} stroke-width="1.1" />
      <path d="M28.5 40.4 Q30.25 42.4 32 40.4 Q33.75 42.4 35.5 40.4" {...L} stroke-width="1.5" />
    </>
  );
}

function Chick() {
  return (
    <>
      <rect width="64" height="64" fill={BG.coral} />
      <path d="M29 22 C26 14 31 11.5 32 17 C34 11 39.5 14 35 22 Z" fill={SUN} {...S} />
      <circle cx="32" cy="41" r="20" fill={SUN} {...S} />
      <path d="M14.5 45 Q11.5 50.5 17.5 53 M49.5 45 Q52.5 50.5 46.5 53" {...L} stroke-width="1.8" />
      {shiny(25, 39, 35, 2.8)}
      <path d="M28.4 40 Q32 37.6 35.6 40 L32 44.6 Z" fill="#ff8a2a" {...S} stroke-width="1.5" />
      <path d="M28.4 40 H35.6" {...L} stroke-width="1.2" />
      {blush(41, 13)}
    </>
  );
}

function Octopus() {
  const legs = ['M21 43 C17 51 11 51 9 60', 'M26.5 46 C25 54 21.5 57 20.5 64', 'M37.5 46 C39 54 42.5 57 43.5 64', 'M43 43 C47 51 53 51 55 60', 'M32 47 V64'];
  return (
    <>
      <rect width="64" height="64" fill={BG.sun} />
      <g fill="none" stroke-linecap="round">
        {legs.map((d) => (
          <path key={`o${d}`} d={d} stroke={INK} stroke-width="8.5" />
        ))}
        {legs.map((d) => (
          <path key={`f${d}`} d={d} stroke={CORAL} stroke-width="5" />
        ))}
      </g>
      <path d="M14 40 C12 20 22 9 32 9 C42 9 52 20 50 40 C46 46.5 18 46.5 14 40 Z" fill={CORAL} {...S} />
      <circle cx="22" cy="19.5" r="2.4" fill="#ff8f7f" />
      <circle cx="40.5" cy="16.5" r="1.7" fill="#ff8f7f" />
      <circle cx="44.5" cy="26.5" r="2.1" fill="#ff8f7f" />
      <circle cx="25" cy="31.5" r="5" fill={PAPER} {...S} stroke-width="1.7" />
      <circle cx="39" cy="31.5" r="5" fill={PAPER} {...S} stroke-width="1.7" />
      <circle cx="26" cy="32.4" r="2.4" fill={INK} />
      <circle cx="40" cy="32.4" r="2.4" fill={INK} />
      <path d="M29 39.6 Q32 42.2 35 39.6" {...L} stroke-width="1.8" />
    </>
  );
}

const ANIMALS = [Cat, Bear, Panda, Frog, Rabbit, Dog, Chick, Octopus];

/** 默认头像的总数（和服务器的 AVATAR_PRESETS 一致）。 */
export const PRESET_COUNT = PEOPLE.length + ANIMALS.length;

/** 第 n 个默认头像。 */
export function PresetArt({ n }: { n: number }) {
  const k = ((n % PRESET_COUNT) + PRESET_COUNT) % PRESET_COUNT;
  if (k < PEOPLE.length) return <PersonArt p={PEOPLE[k]} />;
  const A = ANIMALS[k - PEOPLE.length];
  return <A />;
}
