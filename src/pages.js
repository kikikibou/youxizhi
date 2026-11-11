/**
 * Every page is one building on the plaza, seen from its own camera angle.
 *
 * scene.view    camera position / look-at target in the building's local frame
 *               (+Z faces the plaza), fov in degrees, roll in radians
 * scene.lamp    the "hero" street lamp. Inside its beam the scene is shown at
 *               the opposite time of day. Compose so the lamp stands in front of
 *               a LOW volume with open sky above it: the upper half of the beam
 *               then crosses the sky, the lower half the building (as in the
 *               poster). World.probeBeam() measures this in dev.
 * scene.cluster the poster-style title stack (laid out automatically around p)
 * scene.texts   extra 3D lettering: t text, f font (display|caps|cn|script),
 *               s font size in metres, p position, r rotation,
 *               c colour role (cone = white inside the beam / orange outside)
 * scene.ribbon  a small flowing ribbon (only by the sea, on About; the other
 *               buildings have motions of their own: see buildings.js)
 * scene.plane   a paper plane gliding round a level loop (see PaperPlane in props.js)
 * scene.trees   [x, z, scale]
 *
 * label         the ticket above the content panel: title, optional sub(title),
 *               mark (a script watermark, decoration only), lines (run together
 *               on one line); the stub shows the page's no / en. sub and lines
 *               may be Chinese or English: ui.js tags them and the CSS sets each
 *               in its own type (English sub in italic serif, English lines in
 *               small caps, Chinese in the Chinese sans).
 * footer        the strip along the bottom: left { title, stars, items },
 *               center { script (on the top edge), lines (two) },
 *               right { title, badge, items }; items are [label, value] pairs
 */
export const PAGES = [
  {
    id: 'home',
    side: 'right', // which side the content panel sits on (away from the beam)
    no: '00',
    nav: '首页',
    en: 'HOME',
    building: 'home',
    scene: {
      view: { pos: [-6, 1.5, 28], target: [6, 15.5, 0], fov: 58, roll: 0.03 },
      lamp: { p: [6.5, 13], h: 20 },
      // The site's name: 游戏之西柚 · Jeu de pamplemousse (layout 'name', see buildCluster).
      // portrait: where it moves (and how much it shrinks) on a narrow, upright screen
      cluster: { p: [-1.8, 11.3, 11.4], portrait: { p: [0.4, 12.9, 11.4], scale: 0.74 }, r: [0.08, -0.06, 0], size: 3.4, layout: 'name', title: 'PAMPLEMOUSSE', cn: '游戏之西柚', cnSize: 0.7, cnShift: 0.62, script: 'Jeu de', decor: 'Engage le jeu que je le gagne', caps: 'YXZXY.COM', capsSize: 0.19, capsTracking: 0.14, capsTag: true },
      texts: [{ t: 'SI SEDES NON IS', f: 'display', s: 1.95, p: [-8.6, 7.0, -0.85], c: 'sign' }],
      // Round the lamp post and back, through its beam, in the sky between the
      // poem and the content panel (the far end of the loop is off the picture).
      plane: { c: [14.4, 15, 16.3], a: 6.7, b: 2.1, heading: 0.457, period: 16, size: 2.2 },
      trees: [[-21, 8, 1.05], [36, -2, 1.1], [-27, 14, 1.2]],
    },
    eyebrow: 'EPIGRAPH',
    poem: ['Born bare or born in a robe:', 'not born to bear,', 'nor born to bore.'],
    poemSmall: '裸着的，裹着的。生下来了，不只是活下去吧 · YANJIE HUANG',
    label: {
      title: '自我介绍',
      sub: 'Dedicated to the me I love so deeply.',
      mark: 'Enchanté',
      lines: ['欢迎来到我的个人网站', '我叫游戏之', '很开心遇到你'],
    },
    // (an array: one paragraph each)
    intro: [
      '这里放着那些我喜欢的、我制作的、同时也构成了我的东西。',
      '我相信在不远的将来，人们会拥有更强大的工具来寻找趣味相投的灵魂。于是，我决定抢先一步，把自己塞进这个漂流瓶、丢向互联网的大海。希望这支珊瑚色的果汁也能让你喜欢。雀儿思~',
    ],
    cards: [
      { no: '01', title: '辩论', en: 'Debate', desc: 'AI评委/备赛辅助系统、创意赛制等等', go: 'debate' },
      { no: '02', title: '答题', en: 'Quiz', desc: '睡前智力题系列、单机竞答小挑战什么的', go: 'puzzle' },
      { no: '03', title: '玩乐', en: 'Games', desc: '多人参与的聚会游戏、或者其他小工具', go: 'games' },
    ],
    footer: {
      left: { title: 'INGREDIENTS', stars: 3, items: [['Radiation', '3.6 R'], ['Furanocoumarins', '85 mg'], ['Naringin', '100 IBU'], ['Taste', '≤0.6%']] },
      center: { script: 'Mode d’emploi', lines: ['Begin with any building and read in either direction.', 'Results may vary; the street will not.'] },
      right: { title: 'INSPECTION PANEL', badge: 'PASSED, LOOSELY', items: [['INSPECTED BY', '35,000,000 bananas'], ['CLASSIFICATION', 'berry'], ['SHIPPED', 'anyway']] },
    },
  },
  {
    id: 'debate',
    side: 'left', // which side the content panel sits on (away from the beam)
    poemTone: 'inverse', // the poem stands on the split's other-time side
    no: '01',
    nav: '辩论',
    en: 'DEBATE',
    building: 'debate',
    scene: {
      view: { pos: [-9, 1.6, 30], target: [-3.5, 20.5, -6], fov: 60, roll: 0.02 },
      // The split line pivots in the gap between the two bridge arms
      // (FORUM.gap in buildings.js); the right-hand side shows the other time.
      device: { type: 'split', p: [1, 23.05, -3], side: 1 },
      cluster: { p: [0, 23.2, 6], r: [0.14, 0.05, 0], size: 5.2, title: 'ARGUMENT', cn: '论场', of: 'OF CLASH', caps: 'MOTION · BURDEN · CLASH', script: 'The Art of Disagreement', scriptTilt: -0.15, scriptShift: [0.4, 0.1] },
      texts: [{ t: 'THE WEIGHT OF PROOF', f: 'display', s: 0.45, p: [-13, 4.9, -1.33], c: 'sign' }],
      trees: [[-24, 7, 1.1], [26, 8, 1.0]],
    },
    eyebrow: 'DEBATE',
    poem: ['Every motion is a door', 'left half open on purpose.', 'Walk through it twice.'],
    poemSmall: '立场是门 · 论证是钥匙',
    label: {
      title: '辩论工具箱',
      mark: 'Toolbox',
      lines: ['ARGUMENT · STRUCTURE · TIME', 'TOOLS FOR THE PODIUM'],
    },
    intro: '为备赛和比赛准备的小工具。先放上计时器，赛制速查、论点结构器和辩题库会陆续搬进这栋楼。',
    cards: [
      { no: '01', title: '辩论计时器', en: 'Debate Timer', desc: '单方计时 / 自由辩双计时', tool: 'timer', ready: true },
      { no: '02', title: '赛制速查', en: 'Formats', desc: '常见赛制的环节与时长', ready: false },
      { no: '03', title: '论点结构器', en: 'Argument Builder', desc: '定义 · 标准 · 论证 · 价值', ready: false },
      { no: '04', title: '辩题库', en: 'Motion Bank', desc: '按议题分类的辩题', ready: false },
    ],
    footer: {
      left: { title: 'STRUCTURE', stars: 4, items: [['Definition', '30%'], ['Burden of Proof', '30%'], ['Clash', '40%']] },
      center: { script: 'Rebuttal', lines: ['The strongest case is the one that survives', 'its most generous opponent'] },
      right: { title: 'INSPECTION PANEL', badge: 'THE PODIUM', items: [['CONSTRUCTIVE', '3:30'], ['CROSS-EXAMINATION', '1:30'], ['FREE DEBATE', '4:00']] },
    },
  },
  {
    id: 'puzzle',
    side: 'left', // which side the content panel sits on (away from the beam)
    no: '02',
    nav: '答题',
    en: 'QUIZ',
    building: 'puzzle',
    scene: {
      view: { pos: [18, 1.6, 30], target: [-6, 20.5, -6], fov: 60, roll: -0.02 },
      // Four sliding tiles on the cube's module grid (CUBE in buildings.js),
      // roaming its upper half and the sky above it.
      // Four sliding tiles on a 7 m grid 5 m in front of the cube, straddling
      // its left edge (half building, half sky) below the title.
      device: { type: 'slide', origin: [-20, 0, 5], cell: 8, region: [0, 3, 0, 2], start: [[0, 1], [1, 1], [1, 2], [2, 1]], aim: [1.3, 1.2], frame: false },
      cluster: { p: [-10, 26.5, 8], r: [0.12, 0.8, 0], size: 5.2, title: 'ENIGMA', cn: '谜宫', of: 'OF LOGIC', caps: 'ONE ANSWER · MANY DOORS', script: 'Logic is a Quiet Light', scriptTilt: -0.36, scriptShift: [-0.3, -0.16] },
      texts: [{ t: 'THE SHAPE OF AN ANSWER', f: 'display', s: 0.78, p: [-4.4, 3.2, 1.86], c: 'sign' }],
      trees: [[-22, 7, 1.1], [44, 6, 1.0]],
    },
    eyebrow: 'QUIZ',
    poem: ['A good puzzle is a locked room', 'whose key was in your pocket', 'the whole time.'],
    poemSmall: '答案只有一个 · 门有很多扇',
    label: {
      title: '谜题研究所',
      mark: 'Enigma',
      lines: ['LOGIC · NUMBERS · LATERAL', 'ONE A DAY KEEPS THE BOREDOM AWAY'],
    },
    intro: '逻辑推理、数学趣题与横向思维。答案默认折叠，想好了再点开。',
    cards: [
      { no: '01', title: '每日一题', en: 'Daily Puzzle', desc: '今天的题：三个贴错的箱子', tool: 'daily', ready: true },
      { no: '02', title: '逻辑推理', en: 'Logic', desc: '骑士与无赖、帽子问题……', ready: false },
      { no: '03', title: '数学趣题', en: 'Mathematics', desc: '不需要公式的数学', ready: false },
      { no: '04', title: '横向思维', en: 'Lateral', desc: '换个角度就有答案', ready: false },
    ],
    footer: {
      left: { title: 'DIFFICULTY', stars: 5, items: [['Obvious', '15%'], ['Satisfying', '60%'], ['Sleepless', '25%']] },
      center: { script: 'Insight', lines: ['Every locked room is only a question', 'asked in the wrong order'] },
      right: { title: 'INSPECTION PANEL', badge: 'THE LABORATORY', items: [['DEDUCTION', '30%'], ['ARITHMETIC', '25%'], ['LEAP OF FAITH', '20%']] },
    },
  },
  {
    id: 'games',
    side: 'right', // which side the content panel sits on (away from the beam)
    no: '03',
    nav: '玩乐',
    en: 'GAMES',
    building: 'games',
    scene: {
      view: { pos: [-10, 1.6, 30], target: [-14, 22, -10], fov: 60, roll: -0.02 },
      // Two wide ribbons of the other time of day flowing through the park:
      // one high across the sky, one crossing the drum and the wheel.
      device: {
        type: 'ribbons',
        edge: 0,
        ribbons: [
          { p: [-40, 29, -6], r: [0, 0.05, 0.08], length: 58, width: 6, seed: 1.2 },
          // the front one runs right across the picture
          { p: [-8, 12, 4], r: [0, -0.12, 0.16], length: 130, width: 5.5, seed: 3.7, amp: 0.8 },
        ],
      },
      cluster: { p: [-13, 26.8, 6], r: [0.12, -0.05, 0], size: 4.6, title: 'PLAYGROUND', cn: '游园', of: 'OF MINDS', caps: 'PRESS START TO THINK', script: 'Play is Serious Research', scriptTilt: -0.08, scriptShift: [0.55, -0.12] },
      // On the drum's first-floor band, bent round it (p = drum axis, r = facing angle).
      texts: [{ t: 'THE RULES OF PLAY', f: 'display', s: 0.75, p: [0, 4.6, -14], r: [0, -0.2, 0], bend: 13.06, c: 'sign' }],
      ribbon: null,
      trees: [[-44, 6, 1.1], [32, 8, 1.0]],
    },
    eyebrow: 'GAMES',
    poem: ['Play is the oldest laboratory.', 'Nobody told the children', 'they were doing research.'],
    poemSmall: '游戏是最古老的实验室',
    label: {
      title: '网页游乐场',
      mark: 'Arcade',
      lines: ['BROWSER · NO INSTALL', 'SMALL GAMES FOR SHARP MINDS'],
    },
    intro: '打开即玩、不用安装的智力小游戏。这一栋还在施工，先把门牌挂上。',
    cards: [
      { no: '01', title: '24 点', en: 'Make 24', desc: '四个数，加减乘除', ready: false },
      { no: '02', title: '数独', en: 'Sudoku', desc: '每日一盘，难度可选', ready: false },
      { no: '03', title: '记忆迷宫', en: 'Memory Maze', desc: '看一眼，然后走出去', ready: false },
      { no: '04', title: '更多', en: 'More', desc: '欢迎来提建议', ready: false },
    ],
    footer: {
      left: { title: 'GAMEPLAY', stars: 4, items: [['Thinking', '50%'], ['Trying Again', '30%'], ['One More Round', '20%']] },
      center: { script: 'Playtime', lines: ['A game is a problem that decided', 'to be kind to you'] },
      right: { title: 'INSPECTION PANEL', badge: 'THE ARCADE', items: [['SOCIAL WARMTH', '30%'], ['ESSENTIAL COOLNESS', '25%'], ['DIAGNOSTIC RECTANGLE', '20%']] },
    },
  },
  {
    id: 'about',
    side: 'right', // which side the content panel sits on (away from the beam)
    no: '04',
    nav: '其他',
    en: 'ABOUT',
    building: 'about',
    scene: {
      // Out on the pier, looking up at the lighthouse.
      view: { pos: [-17.8, 2.6, -30], target: [-11, 18, -66], fov: 58, roll: -0.02 },
      // Reveal: the lighthouse beam sweeping round (see devices.js).
      // Upper half of the lantern glass: seen from the pier the gallery deck
      // hides the lower half, and a beam from there seemed to come out of the deck.
      device: { type: 'beacon', p: [-21, 30.4, -66], source: 0.7 },
      sea: true,
      cluster: { p: [-9, 17, -52], r: [0.12, -0.25, 0], size: 5.2, title: 'SIGNAL', cn: '关于', of: 'ON AIR', caps: 'WHO BUILT THIS STREET', script: 'Notes from the Street Corner', scriptTilt: -0.3, scriptShift: [-0.15, 0.2] },
      texts: [{ t: 'NOTES FROM THE CORNER', f: 'display', s: 0.62, p: [-28.65, 7.15, -59.52], c: 'sign' }],
      ribbon: { p: [-40, 15, -58], r: [0, 0.5, 0.15], length: 22, width: 1.1, seed: 8.8, tip: 0.07 },
      trees: [],
    },
    eyebrow: 'ABOUT',
    poem: ['I build small rooms for thinking', 'and leave the lights on', 'for whoever walks by.'],
    poemSmall: '欢迎路过 · 欢迎留下',
    label: {
      title: '关于这条街',
      mark: 'Signal',
      lines: ['WHO · WHY · HOW TO REACH', 'NOTES FROM THE STREET CORNER'],
    },
    intro: '这里写你的自我介绍：你是谁、为什么喜欢辩论和答题、怎样联系你。（占位文字，等你来替换）',
    cards: [
      { no: '01', title: '关于我', en: 'Profile', desc: '辩手 / 出题人 / 写代码的人', ready: false },
      { no: '02', title: '联系方式', en: 'Contact', desc: '邮箱与社交账号', ready: false },
      { no: '03', title: '更新日志', en: 'Changelog', desc: '这条街每一次扩建', ready: false },
    ],
    footer: {
      left: { title: 'INGREDIENTS', stars: 5, items: [['Harmonious Conflict', '15%'], ['Suspended Existence', '10%'], ['Late Nights', '75%']] },
      center: { script: 'Signature', lines: ['Built slowly, one building at a time,', 'under a single street lamp'] },
      right: { title: 'INSPECTION PANEL', badge: 'THE SELF PORTRAIT', items: [['SOCIAL WARMTH', '30%'], ['ESSENTIAL COOLNESS', '25%'], ['DIAGNOSTIC RECTANGLE', '20%']] },
    },
  },
];
