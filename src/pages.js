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
 * scene.ribbon  the flowing orange ribbon
 * scene.trees   [x, z, scale]
 */
export const PAGES = [
  {
    id: 'home',
    side: 'right', // which side the content panel sits on (away from the beam)
    no: '01',
    nav: '首页',
    en: 'HOME',
    building: 'home',
    scene: {
      view: { pos: [-6, 1.5, 28], target: [6, 15.5, 0], fov: 58, roll: 0.03 },
      lamp: { p: [6.5, 13], h: 20 },
      cluster: { p: [3.2, 11.8, 11.4], r: [0.08, -0.06, 0], size: 5.6, title: 'TERRITORY', cn: '思域', of: 'OF REASON', caps: 'CLEFT IN THE DAY', script: 'The Territory of Thought' },
      texts: [{ t: 'THE TRACE OF REASON', f: 'display', s: 2.3, p: [-12.5, 7.0, -0.85], c: 'orange' }],
      ribbon: { p: [-13, 12.5, 8.5], r: [0, 0.05, 0.12], length: 30, width: 1.3, seed: 0.4 },
      trees: [[-21, 8, 1.05], [36, -2, 1.1], [-27, 14, 1.2]],
    },
    eyebrow: 'MANIFESTO',
    poem: ['This corner exists to prove', 'that an argument can be a gift,', 'not an inevitable war.'],
    poemSmall: '思考是一种选择 · FEEL THE WEIGHT OF THAT BEAM',
    label: {
      title: '《思辨街区',
      script: 'Observation',
      title2: '一座为思考而建的街区》',
      lines: ['DEBATE · PUZZLES · GAMES', 'A STREET CORNER OF REASON'],
    },
    intro:
      '这里收着我的辩论笔记与工具、几道让人睡不着的智力题，以及一些可以直接在网页上玩的小游戏。每一栋建筑是一个分区——沿着广场走走看。',
    cards: [
      { no: 'A', title: '辩论', en: 'Debate', desc: '工具、赛制与辩题', go: 'debate' },
      { no: 'B', title: '谜题', en: 'Puzzles', desc: '逻辑与数学的小陷阱', go: 'puzzle' },
      { no: 'C', title: '游戏', en: 'Games', desc: '网页即玩的智力游戏', go: 'games' },
    ],
    footer: {
      left: { title: 'Panel', stars: 5, sub: 'Composition', lines: ['40% Argument', '35% Puzzle', '25% Play'] },
      center: { script: 'Material', lines: ['The most perfect argument', 'contains within it', 'an unignorable, beautiful fault line'] },
      right: { title: 'Inspection Panel', sub: 'THE SELF PORTRAIT', lines: ['30% Curiosity', '25% Essential Doubt', '20% Diagnostic Rectangle'] },
    },
  },
  {
    id: 'debate',
    side: 'left', // which side the content panel sits on (away from the beam)
    no: '02',
    nav: '辩论',
    en: 'DEBATE',
    building: 'debate',
    scene: {
      view: { pos: [-9, 1.6, 30], target: [-3.5, 20.5, -6], fov: 60, roll: 0.02 },
      // The split line pivots in the gap between the two bridge arms
      // (FORUM.gap in buildings.js); the right-hand side shows the other time.
      device: { type: 'split', p: [1, 23.05, -3], side: 1 },
      cluster: { p: [0, 23.2, 6], r: [0.14, 0.05, 0], size: 5.2, title: 'ARGUMENT', cn: '论场', of: 'OF CLASH', caps: 'MOTION · BURDEN · CLASH', script: 'The Art of Disagreement' },
      texts: [{ t: 'THE WEIGHT OF PROOF', f: 'display', s: 0.45, p: [-13, 4.9, -1.33], c: 'orange' }],
      ribbon: { p: [1, 15.5, 1], r: [0, 0, 0.08], length: 24, width: 1.1, seed: 2.1 },
      trees: [[-24, 7, 1.1], [26, 8, 1.0]],
    },
    eyebrow: 'DEBATE',
    poem: ['Every motion is a door', 'left half open on purpose.', 'Walk through it twice.'],
    poemSmall: '立场是门 · 论证是钥匙',
    label: {
      title: '《辩论',
      script: 'Toolbox',
      title2: '工具箱》',
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
      left: { title: 'Panel', stars: 4, sub: 'Structure', lines: ['30% Definition', '30% Burden of Proof', '40% Clash'] },
      center: { script: 'Rebuttal', lines: ['The strongest case', 'is the one that survives', 'its most generous opponent'] },
      right: { title: 'Inspection Panel', sub: 'THE PODIUM', lines: ['3:30 Constructive', '1:30 Cross-Examination', '4:00 Free Debate'] },
    },
  },
  {
    id: 'puzzle',
    side: 'left', // which side the content panel sits on (away from the beam)
    no: '03',
    nav: '谜题',
    en: 'PUZZLES',
    building: 'puzzle',
    scene: {
      view: { pos: [18, 1.6, 30], target: [-6, 20.5, -6], fov: 60, roll: -0.02 },
      // Four sliding tiles on the cube's module grid (CUBE in buildings.js),
      // roaming its upper half and the sky above it.
      // Four sliding tiles on a 7 m grid 5 m in front of the cube, straddling
      // its left edge (half building, half sky) below the title.
      device: { type: 'slide', origin: [-20, 0, 5], cell: 8, region: [0, 3, 0, 2], start: [[0, 1], [1, 1], [1, 2], [2, 1]], aim: [1.3, 1.2], frame: false },
      cluster: { p: [-10, 26.5, 8], r: [0.12, 0.8, 0], size: 5.2, title: 'ENIGMA', cn: '谜宫', of: 'OF LOGIC', caps: 'ONE ANSWER · MANY DOORS', script: 'Logic is a Quiet Light' },
      texts: [{ t: 'THE SHAPE OF AN ANSWER', f: 'display', s: 0.5, p: [27, 3.8, -4.74], c: 'orange' }],
      ribbon: { p: [-14, 20, 2], r: [0, -0.2, 0.15], length: 24, width: 1.1, seed: 4.3 },
      trees: [[-22, 7, 1.1], [44, 6, 1.0]],
    },
    eyebrow: 'PUZZLES',
    poem: ['A good puzzle is a locked room', 'whose key was in your pocket', 'the whole time.'],
    poemSmall: '答案只有一个 · 门有很多扇',
    label: {
      title: '《谜题',
      script: 'Enigma',
      title2: '研究所》',
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
      left: { title: 'Panel', stars: 5, sub: 'Difficulty', lines: ['15% Obvious', '60% Satisfying', '25% Sleepless'] },
      center: { script: 'Insight', lines: ['Every locked room', 'is only a question', 'asked in the wrong order'] },
      right: { title: 'Inspection Panel', sub: 'THE LABORATORY', lines: ['30% Deduction', '25% Arithmetic', '20% Leap of Faith'] },
    },
  },
  {
    id: 'games',
    side: 'right', // which side the content panel sits on (away from the beam)
    no: '04',
    nav: '游戏',
    en: 'GAMES',
    building: 'games',
    scene: {
      view: { pos: [-8, 1.6, 30], target: [-11, 22, -10], fov: 60, roll: -0.02 },
      // Two wide ribbons of the other time of day flowing through the park:
      // one high across the sky, one crossing the drum and the wheel.
      device: {
        type: 'ribbons',
        ribbons: [
          { p: [-36, 29, -6], r: [0, 0.05, 0.08], length: 58, width: 6, seed: 1.2 },
          { p: [-21, 10.5, 4], r: [0, -0.15, 0.34], length: 46, width: 5, seed: 3.7, amp: 0.8 },
        ],
      },
      cluster: { p: [-13, 26.8, 6], r: [0.12, -0.05, 0], size: 4.6, title: 'PLAYGROUND', cn: '游园', of: 'OF MINDS', caps: 'PRESS START TO THINK', script: 'Play is Serious Research' },
      texts: [],
      ribbon: null,
      trees: [[-44, 6, 1.1], [32, 8, 1.0]],
    },
    eyebrow: 'GAMES',
    poem: ['Play is the oldest laboratory.', 'Nobody told the children', 'they were doing research.'],
    poemSmall: '游戏是最古老的实验室',
    label: {
      title: '《网页',
      script: 'Arcade',
      title2: '游乐场》',
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
      left: { title: 'Panel', stars: 4, sub: 'Gameplay', lines: ['50% Thinking', '30% Trying Again', '20% One More Round'] },
      center: { script: 'Playtime', lines: ['A game is a problem', 'that decided', 'to be kind to you'] },
      right: { title: 'Inspection Panel', sub: 'THE ARCADE', lines: ['30% Social Warmth', '25% Essential Coolness', '20% Diagnostic Rectangle'] },
    },
  },
  {
    id: 'about',
    side: 'right', // which side the content panel sits on (away from the beam)
    no: '05',
    nav: '关于',
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
      cluster: { p: [-4, 17, -52], r: [0.12, -0.25, 0], size: 5.2, title: 'SIGNAL', cn: '关于', of: 'ON AIR', caps: 'WHO BUILT THIS STREET', script: 'Notes from the Street Corner' },
      texts: [{ t: 'NOTES FROM THE CORNER', f: 'display', s: 0.62, p: [-28.65, 7.15, -59.52], c: 'orange' }],
      ribbon: { p: [-40, 15, -58], r: [0, 0.5, 0.15], length: 22, width: 1.1, seed: 8.8 },
      trees: [],
    },
    eyebrow: 'ABOUT',
    poem: ['I build small rooms for thinking', 'and leave the lights on', 'for whoever walks by.'],
    poemSmall: '欢迎路过 · 欢迎留下',
    label: {
      title: '《关于',
      script: 'Signal',
      title2: '这条街》',
      lines: ['WHO · WHY · HOW TO REACH', 'NOTES FROM THE STREET CORNER'],
    },
    intro: '这里写你的自我介绍：你是谁、为什么喜欢辩论和谜题、怎样联系你。（占位文字，等你来替换）',
    cards: [
      { no: '01', title: '关于我', en: 'Profile', desc: '辩手 / 出题人 / 写代码的人', ready: false },
      { no: '02', title: '联系方式', en: 'Contact', desc: '邮箱与社交账号', ready: false },
      { no: '03', title: '更新日志', en: 'Changelog', desc: '这条街每一次扩建', ready: false },
    ],
    footer: {
      left: { title: 'Panel', stars: 5, sub: 'Ingredients', lines: ['15% Harmonious Conflict', '10% Suspended Existence', '75% Late Nights'] },
      center: { script: 'Signature', lines: ['Built slowly,', 'one building at a time,', 'under a single street lamp'] },
      right: { title: 'Inspection Panel', sub: 'THE SELF PORTRAIT', lines: ['30% Social Warmth', '25% Essential Coolness', '20% Diagnostic Rectangle'] },
    },
  },
];
