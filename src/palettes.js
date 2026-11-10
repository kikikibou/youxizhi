/**
 * Colour schemes. Each one sets every colour of the scene (materials, sky,
 * clouds, sea, lights, lettering, reveal devices) and of the page UI, by day
 * and by night. Hex strings are sRGB; plain [r, g, b] arrays are linear
 * values used straight in shaders (clouds, sea, the light source's glow).
 *
 * "poster" is the original scheme, taken from the two reference posters.
 * The others are candidates to compare (see the switcher in app.js).
 */
export const PALETTES = [
  {
    id: 'poster',
    name: '海报',
    en: 'Poster',
    note: '原版：参考海报的蓝天、橙色与藏青',
    accent: '#ff7a12', accentGlow: '#ff6a00', accentDeep: '#f06a00',
    ink: '#0d1f3c', light: '#ffffff', cream: '#f4ecdf',
    building: '#f3f0ea', buildingShade: '#e2ded6', concrete: '#bdb7ad', metal: '#6f757c', groundTint: '#ffffff',
    glass: '#22303f', glassGlow: '#ffa95a', glassDark: '#1b2633', glassDarkGlow: '#6f8fc9',
    warm: '#d98a3e', warmGlow: '#ff8a2e', strip: '#ffd2a0', stripGlow: '#ffb46a', bulb: '#fff1d6', bulbGlow: '#ffe2b0',
    leaf: '#2e4630', trunk: '#3a2f28',
    sky: { dayTop: '#4a82ba', dayHor: '#a9c8e4', nightTop: '#050d24', nightHor: '#1a2c55' },
    clouds: { dayHi: [1.02, 1.02, 1.0], dayLo: [0.66, 0.73, 0.84], nightHi: [0.82, 0.85, 0.93], nightLo: [0.14, 0.18, 0.3] },
    sea: { day: [0.02, 0.1, 0.18], night: [0.004, 0.012, 0.035] },
    lights: { hemiDay: '#c4dcf2', hemiNight: '#24345e', groundDay: '#d9c6ae', groundNight: '#8a5a32', sun: '#fff8f0', moon: [0.55, 0.65, 1.0], spot: '#ffc580', lampGlow: '#ffc98c', halo: '#ffd9a0', sourceGlow: [1.0, 0.86, 0.62] },
    ui: { bg: '#0b1a38', shade: '8, 16, 34', paperNight: '8, 18, 40', lineNight: '255, 190, 120', drawer: '#f6f2ea', drawerNight: '#0b1834', moonShade: '#c9d4ec' },
  },
  {
    id: 'grapefruit',
    name: '西柚',
    en: 'Grapefruit',
    note: '果肉的珊瑚粉 · 天蓝色天空 · 白瓤般的楼 · 窗光是果肉的粉橘、灯带是果皮的柚黄 · 夜里是深李子色',
    accent: '#f2545b', accentGlow: '#ff4e5a', accentDeep: '#d93d47',
    ink: '#3b1b2e', light: '#fff7f0', cream: '#ffe9de',
    building: '#fbf2ea', buildingShade: '#f1e0d4', concrete: '#d2bdb0', metal: '#7b6f75', groundTint: '#fbece4',
    glass: '#2c2433', glassGlow: '#ffb39c', glassDark: '#251d2b', glassDarkGlow: '#c98fb5',
    // Two warm tones at night: interiors and windows in the flesh's pink-peach,
    // strip lights in the rind's pale yellow.
    warm: '#f4a28c', warmGlow: '#ff8a70', strip: '#fff1c4', stripGlow: '#ffe08a', bulb: '#fff1e6', bulbGlow: '#fff0c8',
    leaf: '#3c6e57', trunk: '#4a3530',
    sky: { dayTop: '#3896de', dayHor: '#bfe2f6', nightTop: '#170b1e', nightHor: '#42203f' },
    clouds: { dayHi: [1.03, 1.02, 1.01], dayLo: [0.78, 0.81, 0.91], nightHi: [0.86, 0.74, 0.84], nightLo: [0.2, 0.1, 0.2] },
    sea: { day: [0.02, 0.12, 0.22], night: [0.02, 0.005, 0.02] },
    lights: { hemiDay: '#cfe6f6', hemiNight: '#3a2140', groundDay: '#f0d2c4', groundNight: '#8a3f4a', sun: '#fff0e6', moon: [0.75, 0.6, 0.95], spot: '#ffb59a', lampGlow: '#ffb89a', halo: '#ffc9b0', sourceGlow: [1.0, 0.78, 0.7] },
    ui: { bg: '#2a1324', shade: '34, 14, 30', paperNight: '34, 14, 30', lineNight: '255, 160, 150', drawer: '#fdf3ec', drawerNight: '#2a1324', moonShade: '#e8c6dc' },
  },
  {
    id: 'matcha',
    name: '抹茶红豆',
    en: 'Matcha',
    note: '抹茶拿铁色的天空 · 米白的楼 · 红豆色点缀 · 夜里是深茶绿',
    accent: '#b83c3c', accentGlow: '#e04848', accentDeep: '#8e2c2e',
    ink: '#1e3122', light: '#faf8ef', cream: '#eef0dc',
    building: '#f3f0e3', buildingShade: '#e3e1cf', concrete: '#bdb9a4', metal: '#6c7366', groundTint: '#f0efe0',
    glass: '#20302a', glassGlow: '#ffd08a', glassDark: '#1a2620', glassDarkGlow: '#9fcb8f',
    warm: '#d9a55a', warmGlow: '#ffb347', strip: '#fff0c8', stripGlow: '#ffd98a', bulb: '#fff8e6', bulbGlow: '#ffeec0',
    leaf: '#4e7a3a', trunk: '#3e3428',
    sky: { dayTop: '#7fa36b', dayHor: '#e1ebcf', nightTop: '#06100a', nightHor: '#1d3324' },
    clouds: { dayHi: [1.02, 1.02, 0.97], dayLo: [0.72, 0.78, 0.66], nightHi: [0.78, 0.86, 0.78], nightLo: [0.1, 0.17, 0.12] },
    sea: { day: [0.03, 0.12, 0.08], night: [0.004, 0.015, 0.008] },
    lights: { hemiDay: '#dce8c9', hemiNight: '#1f3324', groundDay: '#e2d9bc', groundNight: '#6e5a32', sun: '#fff6e0', moon: [0.65, 0.85, 0.7], spot: '#ffd38a', lampGlow: '#ffd58a', halo: '#ffe3a8', sourceGlow: [1.0, 0.9, 0.65] },
    ui: { bg: '#0e1a12', shade: '12, 24, 16', paperNight: '14, 26, 18', lineNight: '230, 200, 120', drawer: '#f6f4ea', drawerNight: '#0f1d14', moonShade: '#cfe2c8' },
  },
  {
    id: 'wisteria',
    name: '紫藤',
    en: 'Wisteria',
    note: '薰衣草紫的天空 · 万寿菊黄点缀 · 深紫墨色 · 夜里是靛蓝',
    accent: '#f5a623', accentGlow: '#ffb52e', accentDeep: '#d98c0b',
    ink: '#2b1d52', light: '#fffdf8', cream: '#f3eeff',
    building: '#f7f4f2', buildingShade: '#e7e1ea', concrete: '#beb6c6', metal: '#6e6a80', groundTint: '#f1ecf3',
    glass: '#2a2440', glassGlow: '#ffc66b', glassDark: '#221d36', glassDarkGlow: '#9c8ce0',
    warm: '#e5a04b', warmGlow: '#ffa830', strip: '#ffe6b8', stripGlow: '#ffc870', bulb: '#fff6e0', bulbGlow: '#ffe8b8',
    leaf: '#4c6e5a', trunk: '#3e3240',
    sky: { dayTop: '#8c77cc', dayHor: '#e0d8f2', nightTop: '#0b0720', nightHor: '#2b1f5c' },
    clouds: { dayHi: [1.02, 1.0, 1.04], dayLo: [0.74, 0.7, 0.86], nightHi: [0.8, 0.76, 0.95], nightLo: [0.12, 0.08, 0.26] },
    sea: { day: [0.05, 0.05, 0.18], night: [0.01, 0.005, 0.04] },
    lights: { hemiDay: '#ddd4f2', hemiNight: '#2b2158', groundDay: '#e8dccf', groundNight: '#6a4a7a', sun: '#fff4e8', moon: [0.7, 0.65, 1.0], spot: '#ffc46e', lampGlow: '#ffcb7a', halo: '#ffe0a0', sourceGlow: [1.0, 0.86, 0.6] },
    ui: { bg: '#160f33', shade: '20, 13, 44', paperNight: '20, 13, 44', lineNight: '255, 200, 110', drawer: '#f8f5fb', drawerNight: '#1a1238', moonShade: '#d8cff4' },
  },
  {
    id: 'ink',
    name: '墨白',
    en: 'Ink & Red',
    note: '瑞士海报式的黑白灰 · 只留一点信号红',
    accent: '#e63322', accentGlow: '#ff3a28', accentDeep: '#c22414',
    ink: '#141414', light: '#ffffff', cream: '#f2f2f0',
    building: '#f2f2f0', buildingShade: '#dfdfdc', concrete: '#b8b8b4', metal: '#5a5a5a', groundTint: '#ececea',
    glass: '#1e1e20', glassGlow: '#ffe2b8', glassDark: '#18181a', glassDarkGlow: '#9aa0a8',
    warm: '#cfc7ba', warmGlow: '#ffe0b0', strip: '#fff4e2', stripGlow: '#ffe8c8', bulb: '#ffffff', bulbGlow: '#fff2e0',
    leaf: '#3b4a3e', trunk: '#2e2a28',
    sky: { dayTop: '#8e959c', dayHor: '#e4e6e8', nightTop: '#050505', nightHor: '#1e1f22' },
    clouds: { dayHi: [1.03, 1.03, 1.03], dayLo: [0.72, 0.74, 0.77], nightHi: [0.78, 0.79, 0.82], nightLo: [0.1, 0.1, 0.11] },
    sea: { day: [0.05, 0.06, 0.07], night: [0.005, 0.005, 0.006] },
    lights: { hemiDay: '#e2e4e6', hemiNight: '#26282c', groundDay: '#d8d6d2', groundNight: '#4a4642', sun: '#ffffff', moon: [0.8, 0.82, 0.88], spot: '#ffe2c0', lampGlow: '#ffe6c8', halo: '#fff0dc', sourceGlow: [1.0, 0.95, 0.88] },
    ui: { bg: '#111112', shade: '14, 14, 15', paperNight: '14, 14, 15', lineNight: '255, 120, 100', drawer: '#f4f4f2', drawerNight: '#141415', moonShade: '#d6d8dc' },
  },
];

/** The scheme used until another is chosen (西柚, chosen 2026-11-10). */
export const DEFAULT_PALETTE = 'grapefruit';

export const paletteById = (id) => PALETTES.find((p) => p.id === id) || PALETTES.find((p) => p.id === DEFAULT_PALETTE);

/** The scheme this device should start with (?palette=…, then the saved choice). */
export function initialPaletteId() {
  try {
    return new URLSearchParams(location.search).get('palette') || localStorage.getItem('youxizhi-palette') || DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

/** CSS custom properties for the page UI (day, and the night overrides). */
export function paletteCss(p) {
  const u = p.ui;
  return `
:root {
  --orange: ${p.accent};
  --orange-deep: ${p.accentDeep};
  --accent-rgb: ${rgb(p.accent)};
  --navy: ${p.ink};
  --ink: ${p.ink};
  --ink-soft: rgba(${rgb(p.ink)}, 0.72);
  --paper: rgba(${rgb(p.light)}, 0.92);
  --paper-ink: ${p.ink};
  --paper-line: rgba(${rgb(p.ink)}, 0.14);
  --cream: ${p.cream};
  --bg: ${u.bg};
  --shade-rgb: ${u.shade};
  --drawer: ${u.drawer};
  --drawer-night: ${u.drawerNight};
  --moon-shade: ${u.moonShade};
}
html[data-theme='night'] {
  --ink: ${p.cream};
  --ink-soft: rgba(${rgb(p.cream)}, 0.75);
  --paper: rgba(${u.paperNight}, 0.88);
  --paper-ink: ${p.cream};
  --paper-line: rgba(${u.lineNight}, 0.2);
}`;
}
