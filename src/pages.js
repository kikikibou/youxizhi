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
 * scene.cluster the poster-style title stack (laid out automatically around p;
 *               place lays out single blocks by hand, in the units of Claude
 *               Design's specs: see buildCluster in three/typography.js)
 * scene.texts   extra 3D lettering: t text, f font (display|caps|cn|script),
 *               s font size in metres, p position, r rotation,
 *               c colour role (cone = white inside the beam / orange outside)
 * scene.ribbon  a small flowing ribbon (only by the sea, on About; the other
 *               buildings have motions of their own: see buildings.js)
 * scene.plane   a paper plane gliding round a level loop (see PaperPlane in props.js)
 * scene.trees   [x, z, scale]
 *
 * glyph         the character in the polaroid icon at the top left (index.html)
 * label         the ticket above the content panel: title, optional sub(title),
 *               mark (a script watermark, decoration only), lines (run together
 *               on one line); the stub shows the page's no / en. sub and lines
 *               may be Chinese or English: ui.js tags them and the CSS sets each
 *               in its own type (English sub in italic serif, English lines in
 *               small caps, Chinese in the Chinese sans).
 * intro         a paragraph, or several: on a short screen the ones after the
 *               first fold away behind a 展开 link (see fitPoems in ui.js)
 * panelTop      (optional) the highest the content panel's top may stand, as a
 *               share of the window's height, for a title standing above it
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
    glyph: '游', // (the character in the top-left icon)
    en: 'HOME',
    building: 'home',
    scene: {
      view: { pos: [-6, 1.5, 28], target: [6, 15.5, 0], fov: 58, roll: 0.03 },
      lamp: { p: [6.5, 13], h: 20 },
      // The site's name: 游戏之致西柚 · Jeu de pamplemousse (layout 'name', see buildCluster).
      // (游·戏·之 | 致·西·柚 reads the same both ways, like the domain yxzzxy.com)
      // portrait: where it moves (and how much it shrinks) on a narrow, upright screen
      cluster: { p: [-1.8, 11.3, 11.4], portrait: { p: [0.4, 12.9, 11.4], scale: 0.74 }, r: [0.08, -0.06, 0], size: 3.4, layout: 'name', title: 'PAMPLEMOUSSE', cn: '游戏之致西柚', cnSize: 0.6, cnShift: 0.62, script: 'Jeu de', decor: 'Engage le jeu que je le gagne', caps: 'YXZZXY.COM', capsSize: 0.19, capsTracking: 0.14, capsTag: true },
      texts: [{ t: 'SI SEDES NON IS', f: 'display', s: 1.95, p: [-8.6, 7.0, -0.85], c: 'sign' }],
      // Round the lamp post and back, through its beam, in the sky between the
      // poem and the content panel (the far end of the loop is off the picture).
      plane: { c: [14.4, 15, 16.3], a: 6.7, b: 2.1, heading: 0.457, period: 16, size: 2.2 },
      trees: [[-21, 8, 1.05], [36, -2, 1.1], [-27, 14, 1.2]],
    },
    eyebrow: 'EPIGRAPH',
    poem: ['Born bare or born in a robe:', 'not born to bear,', 'nor born to bore.'],
    poemSmall: '裸着的，裹着的。不是都生下来了，不都是活下去吧 · YANJIE',
    label: {
      title: '自我介绍',
      sub: 'Dedicated to the me I love so deeply.',
      mark: 'Enchanté',
      lines: ['欢迎来到我的个人网站', '我叫游戏之', '很开心遇到你'],
    },
    // (an array: one paragraph each; *words* are set in italic)
    intro: [
      '这里放着那些我喜欢的、我制作的、同时也构成了我的东西。',
      '我相信在不远的将来，人们会拥有更强大的工具来寻找趣味相投的灵魂。于是，我决定抢先一步，把自己塞进这个漂流瓶、丢向互联网的大海。希望这支珊瑚色的冷饮也能让你喜欢。*Cheers.*',
    ],
    cards: [
      { no: '01', title: '辩论', en: 'Debate', desc: 'AI评委/备赛辅助系统、创意赛制等等', go: 'debate' },
      { no: '02', title: '问答', en: 'Quiz', desc: '睡前智力题系列、单机竞答小挑战什么的', go: 'puzzle' },
      { no: '03', title: '消遣', en: 'Games', desc: '多人参与的聚会游戏、或者其他小工具', go: 'games' },
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
    glyph: '辩',
    en: 'DEBATE',
    building: 'debate',
    scene: {
      view: { pos: [-9, 1.6, 30], target: [-3.5, 20.5, -6], fov: 60, roll: 0.02 },
      // The split line pivots in the gap between the two bridge arms
      // (FORUM.gap in buildings.js); the right-hand side shows the other time.
      device: { type: 'split', p: [1, 23.05, -3], side: 1 },
      // (place, after Claude Design: two arrow rows of one width beside a big BA
      // about as tall as 题眼; the caps line spaced out to half the title's
      // width; the script along the title's top edge)
      cluster: {
        p: [-1.01, 22.99, 6.02], r: [0.14, 0.05, 0], size: 5.28,
        title: 'MOTION', cn: '题眼', of: '↑↑↓↓\n←→←→\nBA', caps: 'PRO ET CONTRA', script: 'Do geese see God?',
        // (the script runs along the tops of the letters and across the
        // split: ink on the daylight half, the accent on the night half, so
        // it reads on both the coral and the white letters; cream at night)
        scriptColor: { dayOut: 'ink', dayIn: 'accent', nightOut: 'cream', nightIn: 'accent' },
        place: {
          caps: { left: 87, base: -146, scale: 0.16, rotate: 4.58, tracking: 0.2 },
          of: [
            { right: 474, base: -52, scale: 0.3, tracking: 0.394 },
            { right: 474, base: -6, scale: 0.3, tracking: 0.05 },
            { right: 596, base: 3, scale: 0.56, tracking: 0.02 },
          ],
          script: { left: 236, base: 26, scale: 0.33, rotate: 8.59 },
        },
      },
      texts: [{ t: 'CAVE CANEM', f: 'display', s: 0.6, p: [-13, 4.9, -1.33], c: 'sign' }],
      trees: [[-24, 7, 1.1], [26, 8, 1.0]],
    },
    eyebrow: 'POI',
    poem: ['Silence is a golden hammer.', 'Speech is a silver bullet.', 'Tell the nails from the werewolves.'],
    poemSmall: '沉默是马斯洛的金槌，雄辩是欧立希的银弹',
    label: {
      title: '辩论',
      // (the lines call debate an adversarial TRPG: "roll for initiative")
      sub: 'Roll for rebuttal.',
      // (the watermarks speak French, like home's Enchanté: here a bout's opening call)
      mark: 'En garde',
      lines: ['开放世界', '角色扮演', '对抗性TRPG', '文恨'],
    },
    intro: [
      '我之所以喜欢辩论，是因为它有一个独一无二的好处：辩论是大学校园里唯一一种不需要特殊道具、不需要专门场地的团队竞技。',
      '——如果你看到上面这句话之后、本能的第一反应就是在脑海里搜寻反例，那么或许你也会喜欢这项活动。',
    ],
    cards: [
      // (a site of its own: opens in a new tab, see app.js)
      { no: '01', title: '攻错', en: 'Touchstone', desc: '竞技辩论AI评委工具', href: 'https://debatestone.com', ready: true },
      // (大辩题库 hides 大便提裤: a dump of motions, and "motion" as in bowel motion)
      { no: '02', title: '大辩题库', en: 'Motion Dump', desc: '分享你推荐的大辩题，每月有精品推荐', ready: false },
      { no: '03', title: '抽卡赛制', en: 'Luck of the Draw', desc: '结合氪金（并没有）抽卡与卡组构筑元素的新型赛制', ready: false },
      { no: '04', title: '更酷炫的计时器', en: 'Shinier Timer', desc: '除了包含更多动效之外没有什么提升点的辩论计时器', ready: false },
    ],
    footer: {
      left: { title: 'INGREDIENTS', stars: 4, items: [['Straw', '0 g'], ['Steel', '100%'], ['Red Herring', 'trace']] },
      center: { script: 'Au contraire', lines: ['Positions may shift during cross-examination.', 'This is not a defect.'] },
      right: { title: 'ADJUDICATION', badge: 'THE PODIUM', items: [['BURDEN OF PROOF', 'theirs'], ['SIDE', 'drawn by lot'], ['BEST BEFORE', 'rebuttal']] },
    },
  },
  {
    id: 'puzzle',
    side: 'left', // which side the content panel sits on (away from the beam)
    panelTop: 0.36, // (AREPO stands above the panel: its top stays below this, × the window's height)
    no: '02',
    nav: '问答',
    glyph: '问',
    en: 'QUIZ',
    building: 'puzzle',
    scene: {
      view: { pos: [18, 1.6, 30], target: [-6, 20.5, -6], fov: 60, roll: -0.02 },
      // Four sliding tiles on the cube's module grid (CUBE in buildings.js),
      // roaming its upper half and the sky above it.
      // Four sliding tiles on a 7 m grid 5 m in front of the cube, straddling
      // its left edge (half building, half sky) below the title.
      device: { type: 'slide', origin: [-20, 0, 5], cell: 8, region: [0, 3, 0, 2], start: [[0, 1], [1, 1], [1, 2], [2, 1]], aim: [1.3, 1.2], frame: false },
      // (place, after Claude Design: the script hangs from the title's lower
      // right, leaving AREPO clear; the caps line ends where the title does)
      cluster: {
        p: [-10, 26.5, 8], r: [0.12, 0.8, 0], size: 6.2,
        title: 'AREPO', cn: '谜面', of: '(SIC)', caps: 'SATOR · TENET · OPERA · ROTAS', script: 'Why is a raven\nlike a writing-desk?',
        // (the script hangs below the title over open sky, the building and
        // the sliding tiles: ink against daylight, the accent on the tiles'
        // night by day; at night cream, ink on the tiles' daylight)
        scriptColor: { dayOut: 'ink', dayIn: 'accent', nightOut: 'cream', nightIn: 'ink' },
        place: {
          caps: { left: 60, base: -148, scale: 0.16, rotate: 4.58, tracking: 0.03 },
          script: [
            { left: 158, base: 210, scale: 0.32, rotate: 10 },
            { left: 216, base: 283, scale: 0.32, rotate: 10 },
          ],
        },
      },
      texts: [{ t: 'PEDO MELLON A MINNO', f: 'display', s: 0.78, p: [-4.4, 3.2, 1.86], c: 'sign' }],
      trees: [[-22, 7, 1.1], [44, 6, 1.0]],
    },
    // (eyebrow and poem together hold each of the 26 letters exactly twice:
    // not a letter of them may change; the small line reads the same backwards)
    // The eyebrow is a blank to fill in: the one letter the poem holds only
    // once (see blankHtml in ui.js).
    eyebrow: { blank: 'Q' },
    poem: ['Sphinx vs. DJ Jack', 'Q: Why fix my dumb black TV?', 'Wrong puzzle. Forget.'],
    poemSmall: '数字算盘，盘算字数',
    label: {
      title: '问答',
      // (before sleep, instead of it, in it: "sleep on it" is to think it over)
      sub: 'Sleep on it. Or don’t.',
      mark: 'Bonne nuit',
      lines: ['睡前智力题', '睡不着智力题', '睡梦中智力题'],
    },
    intro: [
      '纯粹的「知识竞答」对我来说有一个问题：它只考验「是否知道」，所以只要我「不知道」，就只剩下无所适从的垃圾时间了。',
      '相比之下，我更喜欢「智力竞答」——在知识量能提供帮助的前提下，也留出了考验「能不能搞懂」的空间。开动脑筋、驱使策略、让不同知识储备的人都能享受到乐趣，或许这样获得的胜利也别有一番风味。',
    ],
    cards: [
      { no: '01', title: '人造语言的三国知识问答', en: 'Conlang Kingdoms', desc: '很久以前出的一套题，其实是在这个板块建设起来之前占位的…', ready: false },
      { no: '02', title: '三园警察', en: 'Mole Patrol', desc: '一个考验反应速度、知识量，与直觉的打地鼠小游戏', ready: false },
      { no: '03', title: '切半', en: 'Bisect', desc: '一个考验地理知识与常识的小游戏', ready: false },
      // (until the old ones move in, the stand-in puzzle from the first prototype)
      { no: '04', title: '每周睡前智力题', en: 'Weekly Bedtime Puzzle', desc: '如果占位的新游戏暂时更新不出来，会在这里用旧作拖延时间', tool: 'daily', ready: true },
    ],
    footer: {
      left: { title: 'INGREDIENTS', stars: 5, items: [['Drunk Bird', '34%'], ['Goats', '⅔'], ['Camels', '17 + 1'], ['Pigeons', 'n + 1']] },
      center: { script: 'Esprit d’escalier', lines: ['Answers tend to arrive on the stairs,', 'shortly after you close the tab.'] },
      right: { title: 'PEER REVIEW', badge: 'THE LABORATORY', items: [['INSPECTED BY', 'a Cretan'], ['CLASSIFICATION', 'Berry, capital B'], ['SHIPPED', 'halfway, then halfway again']] },
    },
  },
  {
    id: 'games',
    side: 'right', // which side the content panel sits on (away from the beam)
    no: '03',
    nav: '消遣',
    glyph: '玩',
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
      // (caps: Für Elise in numbered notation, an ideographic space after the key)
      // (U+0323 puts the low-octave dot under 7 and 6, see DOT_BELOW in typography.js)
      // (place, after Claude Design: the group 40 lower, the notation clear of
      // the header and in line with the title's left end; the script along
      // the title's top edge)
      cluster: {
        p: [-13, 25.81, 5.88], r: [0.12, -0.05, 0], size: 5.0,
        title: 'BAGATELLE', cn: '玩心', of: 'バカタレ', caps: '1=C\u30003 #2 3 #2 3 7\u0323 2 1 6\u0323', script: 'Draw, O coward!!',
        // (the script lies on the tops of the letters, over a mid-blue sky:
        // white by day, cream at night, the accent where the ribbons show the
        // other time and the letters go white / dark)
        scriptColor: { dayOut: 'light', dayIn: 'accent', nightOut: 'cream', nightIn: 'accent' },
        place: {
          caps: { shift: [-47, 6] },
          // (the Chinese face at its heaviest, a little narrower: as tall as
          // the Anton subtitles in this place on the other pages, a shade
          // lighter than them; Dela Gothic One was heavier still)
          of: { right: 820, base: -3, scale: 0.42, font: 'cn', weight: 900, squeeze: 0.85, tracking: 0.02 },
          script: { left: 300, base: 48, scale: 0.344, rotate: 4.58 },
        },
      },
      // On the drum's first-floor band, bent round it (p = drum axis, r = facing angle).
      texts: [{ t: 'FAY CE QUE VOULDRAS', f: 'display', s: 0.75, p: [0, 4.6, -14], r: [0, -0.2, 0], bend: 13.06, c: 'sign' }],
      ribbon: null,
      trees: [[-44, 6, 1.1], [32, 8, 1.0]],
    },
    // (an autogram: the sentence counts its own strokes, 93 characters and
    // 611 strokes in all; no character may change, only where the lines break.
    // Chinese poems are set in their own type, see .poem-lines[lang='zh'])
    eyebrow: 'AUTOGRAM',
    poem: [
      '叶小古说，此记录应包含：',
      '一百七十五横、一百零八竖、一百零一撇、九十二点，',
      '二十八捺、二十六横折、十七竖钩、',
      '十六提、十一横折钩、十横撇，',
      '六个竖弯钩、六个撇折、六个竖提，',
      '三个竖折折钩、三个横钩、',
      '两个横折提、一个横折弯钩和零个竖弯。',
    ],
    poemSmall: 'Anticlockwise.',
    label: {
      title: '消遣',
      // (party games: an assembly of people, and the line on a flat-pack box)
      sub: 'Some assembly required.',
      // (come to the table: dinner's ready, and the table games are laid out)
      mark: 'À table',
      lines: ['聚会游戏', '独立游戏开发'],
    },
    intro: '这里是一些我自己设计的，需要「多人参与」的聚会小游戏。之后也会把一些自己设计的桌游所需要用到的桌游助手也放在这里，欢迎大家尝试。',
    cards: [
      // (href: a page of its own, opened in place of the drawer)
      { no: '01', title: '大国小国', en: 'Big & Small', desc: '基于微妙联系的猜词类身份推理游戏', href: 'dgxg/', ready: true },
      { no: '02', title: '对抗性问答猜人', en: 'Twenty Questions, Versus', desc: '用Yes/No问题来锁定人物的那个经典小游戏，加入了对抗性与策略要素', ready: false },
      // (纵横: a crossword's two directions)
      { no: '03', title: '纵横猜词', en: 'Across & Down', desc: '强调战略性的团队对抗猜词游戏', ready: false },
      { no: '04', title: '死亡游戏', en: 'No Continues', desc: '只能玩一次的合作类闯关游戏，请凑齐队友都在场时再点开', ready: false },
    ],
    footer: {
      left: { title: 'INGREDIENTS', stars: 4, items: [['Agôn', '1 v 1'], ['Alea', '2d6'], ['Mimicry', 'Lv. 1'], ['Ilinx', '720°']] },
      center: { script: 'Encore une partie', lines: ['Serving size: one more turn.', 'Servings per night: not yet determined.'] },
      right: { title: 'MAY CONTAIN', badge: 'THE ARCADE', items: [['Cake', 'a lie'], ['Mushrooms', '1UP'], ['Elixirs', '99, unused']] },
    },
  },
  {
    id: 'about',
    side: 'right', // which side the content panel sits on (away from the beam)
    no: '04',
    nav: '其他',
    glyph: '?', // (a mark: set in Anton, see .is-mark in style.css)
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
      // (place, after Claude Design: the caps line spaced out to half the
      // title's width; the script starts in the gap between 注脚 and SEE ALSO
      // and runs flatter along the title's top edge)
      cluster: {
        p: [-8.8, 17, -52], portrait: { p: [-8.8, 17, -52], scale: 0.92 }, r: [0.12, -0.25, 0], size: 4.0,
        title: 'COLOPHON', cn: '注脚', of: 'SEE ALSO', caps: 'CF. JUDGES 16:17', script: 'Madam, I’m not Adam.',
        // (a colophon's signature: in ink by day, cream at night, the accent
        // where the lighthouse's beam crosses it)
        scriptColor: { dayOut: 'ink', dayIn: 'accent', nightOut: 'cream', nightIn: 'accent' },
        place: {
          caps: { left: 87, base: -146, scale: 0.16, rotate: 4.58, tracking: 0.28 },
          script: { left: 288, base: 30, scale: 0.33, rotate: 8 },
        },
      },
      texts: [{ t: 'ΓΝΩΘΙ ΣΕΑΥΤΟΝ', f: 'display', s: 0.8, p: [-28.65, 7.15, -59.52], c: 'sign' }],
      ribbon: { p: [-40, 15, -58], r: [0, 0.5, 0.15], length: 22, width: 1.1, seed: 8.8, tip: 0.07 },
      trees: [],
    },
    eyebrow: 'STRENGTH: WEAK',
    // (short last lines: lower down, the title's SEE ALSO and its script reach this far right)
    poem: ['Sorry, Master:', 'your safe word needs 12+ characters,', 'upper and lower case, a number,', 'and a special symbol.'],
    poemSmall: '甜的 · 从强者出来',
    label: {
      title: '其他',
      // (whatever you guess about the hobby at the far end, it will be denied)
      sub: 'Any resemblance is purely coincidental.',
      // (the last page: home's Enchanté answered)
      mark: 'Au revoir',
      lines: ['除了上面三个大类之外', '另一个同样构成了我的爱好'],
    },
    intro: [
      '这个码头通向另一个未知的建筑。基于理所应当的理由，我把剩下的一个爱好放在了那里。就当是自我意识过剩吧，我留下了这个路标，来证明自己的兴趣比这里还要更广泛一点点。',
      '即使你找到了那边的作品集，也请不要来找我确认。无论你猜得对或是不对，反正我都会无条件地否认的。*Salut.*',
    ],
    cards: [
      { no: '01', title: '关于我', en: 'Profile', desc: '一些简单的自我展示欲', ready: false },
      { no: '02', title: '联系方式', en: 'Contact', desc: '更多简单的自我展示欲', ready: false },
      { no: '03', title: '更新日记', en: 'Dev Diary', desc: '已经实现的自我展示欲', ready: false },
    ],
    footer: {
      left: { title: 'INGREDIENTS', stars: 5, items: [['Honey', '1 lion'], ['Wine', '0%'], ['Locks', '7'], ['Rope', 'new']] },
      center: { script: 'Mon cœur s’ouvre', lines: ['Keep away from razors.', 'Strength sold separately.'] },
      right: { title: 'SECURITY CHECK', badge: 'THE SELF PORTRAIT', items: [['INSPECTED BY', 'someone in Sorek'], ['CLASSIFICATION', '████'], ['SHIPPED', 'under another name']] },
    },
  },
];
