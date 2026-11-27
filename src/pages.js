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
 *               first fold away behind a 展开 link (see fitPoems in ui.js).
 *               **words** are set in bold, *words* in italic serif
 * cards         keep each one line: title with its English, and desc (about
 *               22 Chinese characters fit)
 * cards[].spot  (optional) a close-up before a card's href: where the camera
 *               flies and the boarding pass shown there (see 攻错 below)
 * cards[].tag   (optional) the card's tag in place of ENTER / PLAY / VISIT
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
      {
        no: '01',
        title: '攻错',
        en: 'Touchstone',
        desc: '竞技辩论AI评委工具',
        href: 'https://debatestone.com',
        ready: true,
        // Before leaving, a close-up (see openSpot in app.js): the camera
        // cranes up to the helipad on this tower's roof (HELIPAD in
        // buildings.js, painted in 攻错's own black and gold) and a boarding
        // pass opens there; boarding dives into the pad and on to the site.
        // (view / portrait: in the building's frame like scene.view; dive: the pad's centre)
        spot: {
          view: { pos: [-13.5, 60, 3], target: [-17.2, 38.5, -9.6], fov: 44 },
          portrait: { pos: [-11.4, 55, -1.5], target: [-11.5, 35.2, -5.2], fov: 50 },
          dive: [-11.5, 39.25, -10.3],
          // Over the roof, the ground behind the tower as a poster: Touchstone,
          // the clown of As You Like It (V. iv), on the seven degrees of the
          // lie, all avoidable "with an If". Decoration: it may run off the
          // screen or behind the tower. (p: [x, z] on the ground, r: how it's
          // turned, scale: all of it larger; items at [across, away]
          // in metres; under: drawn beneath the others, a watermark; alpha:
          // how strongly printed, the dark ink kept light so it doesn't pull
          // the eye from the pass)
          ground: {
            // (its lines run with the roof's back edge, read from below and a
            // little to the left; high and large enough that the title runs
            // off the top, under the top bar, and the script off the right)
            p: [-25, -62],
            r: 0,
            scale: 1.15,
            portrait: { p: [-8.8, -57.9], r: 0.02, scale: 0.62 }, // (only the title, just under the nav: the rest would fall behind the roof)
            items: [
              { t: 'IF', f: 'display', s: 50, at: [-27, -19], c: { dayIn: 'light', dayOut: 'light', nightIn: 'ink', nightOut: 'ink' }, under: true, portrait: false },
              { t: 'MUCH VIRTUE IN IF.', f: 'display', s: 14, at: [-3, 2.2], c: 'orange', alpha: 0.85 },
              {
                t: 'I. THE RETORT COURTEOUS\nII. THE QUIP MODEST\nIII. THE REPLY CHURLISH\nIV. THE REPROOF VALIANT\nV. THE COUNTERCHECK QUARRELSOME\nVI. THE LIE WITH CIRCUMSTANCE\nVII. THE LIE DIRECT',
                f: 'caps',
                s: 2,
                at: [-44.5, -15.4],
                anchor: 'left',
                c: 'ink',
                alpha: 0.42,
                portrait: false,
              },
              {
                t: 'ALL THESE YOU MAY AVOID BUT THE LIE DIRECT;\nAND YOU MAY AVOID THAT TOO, WITH AN IF.',
                f: 'caps',
                s: 1.5,
                at: [-42, -28.4],
                anchor: 'left',
                c: 'orange',
                alpha: 0.75,
                portrait: false,
              },
              { t: 'We quarrel in print, by the book.', f: 'script', s: 4.9, at: [21, -6.4], c: { dayIn: 'accent', dayOut: 'ink', nightIn: 'accent', nightOut: 'cream' }, alpha: 0.6, portrait: false },
              { t: 'TOUCHSTONE · AS YOU LIKE IT · V. IV', f: 'caps', s: 1.4, at: [-38.5, -32.3], anchor: 'left', c: 'ink', alpha: 0.42, portrait: false },
            ],
          },
          pass: {
            flight: 'TS 001',
            text: '使用先进大语言模型，精心调试过的竞技辩论AI评委工具——针对模辩反馈、赛后复盘、娱乐比赛等不同需求，设计有8个判准、评判方式各异的AI评委。简单上传自己的比赛转录稿后，便可以获得来自AI评委的点评与建议。',
            fields: [['GATE', 'H'], ['SEAT', '正方 / 反方'], ['JUDGES', '8 位任选']],
            motto: 'Saxa loquuntur.', // (攻错's own motto: the stones speak)
          },
        },
      },
      // (大辩题库 hides 大便提裤: a dump of motions, and "motion" as in bowel motion)
      // A page of its own, /dbtk/ (src/dbtk/). Its close-up: the camera comes
      // down to a street bin in front of Tower B's lobby (BIN in buildings.js,
      // bin.js), low and from the left, its LED ticker running in the page's
      // own yellow; a trade slip (交割单) opens. 扔进去 flips the left lid
      // open and the camera dives into it; on the black inside, the page's
      // dot-matrix name lights up (takeoff 'led', ledveil.js).
      {
        no: '02',
        title: '大辩题库',
        en: 'Motion Dump',
        desc: '分享你推荐的大辩题，每月有精品推荐',
        href: 'dbtk/',
        ready: true,
        tag: 'TRADE →',
        spot: {
          view: { pos: [6.25, 0.82, 6.3], target: [9.8, 2.0, -1.6], fov: 42 }, // (low, looking up a little: the bin low on the right, clear of the pass; the lobby's curved glazing and canopy behind)
          portrait: { pos: [7.4, 1.0, 4.9], target: [10.25, 0.35, 0.6], fov: 30 }, // (the bin in the middle, above the pass)
          dive: [9.11, 0.84, 1.8], // (the left compartment's opening: BIN, less half a compartment)
          diveAt: [9.08, 1.32, 2.12], // (just over it, looking in)
          diveVia: [9.65, 2.29, 2.55], // (up and over the bin first, as if leaning over it: the bin stays in the middle of the screen as the camera turns down)
          bin: true, // (boarding opens the bin's lid, and the camera rises out of it again: World.lid)
          pass: {
            kind: 'led',
            takeoff: 'led',
            head: 'TRADE SLIP · 交割单',
            label: '交割单',
            flight: 'DB 0001',
            mark: '涨',
            board: '扔进去',
            text: '在这里，你可以自由分享交流你喜欢的大辩题：申请上市，看涨投票，站队看正还是看反；每月出一张涨幅榜。',
            fields: [['MARKET', '大辩题库'], ['SIDES', '看正 · 看反'], ['GAIN', '1~99 / 次']],
            motto: '只是请千万\u200b不要忘记题库。', // (\u200b: where the stub's two lines break, see .pass--led .pass-motto)
          },
        },
      },
      { no: '03', title: '抽卡赛制', en: 'Luck of the Draw', desc: '结合氪金（并没有）抽卡与卡组构筑的新型赛制', ready: false },
      { no: '04', title: '更酷炫的计时器', en: 'Shinier Timer', desc: '除了动效更多之外没有什么提升点的辩论计时器', ready: false },
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
      '纯粹的**知识竞答**对我来说有一个问题：它只考验**是否知道**。一旦我**不知道**，就只剩下了停滞的垃圾时间。',
      '相比之下，我更喜欢**智力竞答**——依然要求知识量，但也考验**能不能搞懂**。开动脑筋、驱使策略，一起享受这份活动大脑的乐趣吧。',
    ],
    cards: [
      // (a page of its own, /sgjm/: src/sgjm/)
      {
        no: '01',
        title: '解码与三国知识问答',
        en: 'Kingdoms, Decoded',
        desc: '连题目都要先破译的三国知识问答',
        href: 'sgjm/',
        ready: true,
        // Its close-up (see 攻错's): the camera rises over the hedge maze in
        // front of the cube, the door under the canopy behind it, whose sign
        // reads PEDO MELLON A MINNO ("say 'friend' and enter": the password
        // is in the riddle); a pass (过所) opens. 入关 draws the way through
        // the maze in vermilion like a campaign arrow (route: World.drawRoute),
        // the camera swoops down along it (diveVia: low over the maze's way
        // in; diveAt: in the maze, looking through its way out at the door),
        // and the page's map paper spreads
        // from the door like ink, its seal stamped on it (takeoff 'ink').
        // (view / portrait / dive / diveAt / diveVia: in the building's frame)
        spot: {
          view: { pos: [-15, 15, 15], target: [-6.5, 0, 1.1], fov: 44 }, // (the gates, the door and the route clear of the pass, the maze's far end, and its chest, in at the right)
          portrait: { pos: [-1.5, 14, 19], target: [-1, 0, 12.5], fov: 44 }, // (the maze and the door above the pass)
          dive: [-4.25, 1.6, -4.9], // (the lobby's glass, under the sign, straight on from the maze's way out)
          diveAt: [-4.25, 1.1, 5.9], // (over the maze, the back portal's frame round the door)
          diveVia: [-4.25, 2.6, 10],
          route: 'maze',
          // (a treasure chest in the maze's far dead end, there only at this
          // close-up: a click opens it, and the 问答 "Q"'s rainbow rises from
          // it; chest.js, mazeChest in details.js)
          chest: 'maze',
          keepTexts: true, // (the door's sign stays lit, see World.update)
          // On the plaza beside the cube, the ground as a poster (as at
          // 攻错's helipad), quiet: Legrand in Poe's The Gold-Bug, the first
          // cipher story, on why every cipher can be read. Its lines run along
          // the cube's left side, the letters' tops towards it, as if read by
          // someone coming from the left: a pale giant ENIGMA under the quote,
          // printed lightly over it, and RESOLVE. the one word in the accent.
          // Decoration: it may run off the screen. (p: [x, z] on the ground,
          // r: its turn, -90° so its lines run towards the plaza; scale; items
          // at [across, away] in metres, across along the lines; under:
          // beneath the others; alpha: how strongly printed)
          ground: {
            p: [-11.6, -15.5],
            r: -Math.PI / 2,
            scale: 1,
            portrait: { p: [-4.7, 9.4], r: 0, scale: 0.55 }, // (only RESOLVE. on its ENIGMA, between the maze and the pass)
            items: [
              { t: 'ENIGMA', f: 'display', s: 9, at: [-1.5, -4], anchor: 'left', c: { dayIn: 'light', dayOut: 'light', nightIn: 'ink', nightOut: 'ink' }, under: true, alpha: 0.5 },
              { t: 'EDGAR ALLAN POE · THE GOLD-BUG · 1843', f: 'caps', s: 0.5, at: [0.2, 0.9], anchor: 'left', c: 'ink', alpha: 0.42, portrait: false },
              {
                t: 'YET IT MAY WELL BE DOUBTED WHETHER HUMAN INGENUITY\nCAN CONSTRUCT AN ENIGMA OF THE KIND WHICH HUMAN\nINGENUITY MAY NOT, BY PROPER APPLICATION,',
                f: 'caps',
                s: 0.82,
                at: [0.2, -1.5],
                anchor: 'left',
                c: 'ink',
                alpha: 0.5,
                portrait: false,
              },
              { t: 'RESOLVE.', f: 'display', s: 4.4, at: [0, -6.4], anchor: 'left', c: 'orange', alpha: 0.82 },
            ],
          },
          pass: {
            kind: 'seal',
            takeoff: 'ink',
            head: '过所 · LAISSEZ-PASSER',
            label: '过所',
            flight: 'SGJM-01',
            mark: '密',
            seal: '密',
            board: '入关',
            text: '很早之前的旧作，100%基于个人兴趣的小品级谜题。一份用虚构「密语」写成的三国知识问答：可以一边试着答题一边推理这门语言的编码。',
            fields: [['SETS', '基础 · 进阶'], ['QUESTIONS', '24 题'], ['ANSWERS', '都是人物']],
            // (divide and rule: the realm split three ways, and the 密语's
            // words, which the player cuts into pieces)
            motto: 'Divide et impera.',
          },
        },
      },
      { no: '02', title: '三园警察', en: 'Mole Patrol', desc: '考验反应速度、知识量，与直觉的打地鼠小游戏', ready: false },
      { no: '03', title: '切半', en: 'Bisect', desc: '一个考验地理知识与常识的小游戏', ready: false },
      // (until the old ones move in, the stand-in puzzle from the first prototype)
      { no: '04', title: '每周睡前智力题', en: 'Weekly Bedtime Puzzle', desc: '新游戏更新不出来时，会在这里用旧作拖延时间', tool: 'daily', ready: false },
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
    intro: '这里是一些我自己设计的，需要**多人参与**的聚会小游戏。之后也会把一些自己设计的桌游所需要用到的桌游助手也放在这里，欢迎大家尝试。',
    cards: [
      // (href: a page of its own, opened in place of the drawer)
      {
        no: '01',
        title: '大国小国',
        en: 'Big & Small',
        desc: '基于微妙联系的猜词类身份推理游戏',
        href: 'dgxg/',
        ready: true,
        // Its close-up (see 攻错's): the camera flies to a cabin of the Ferris
        // wheel as it comes up on the right (ride.start: its angle on the
        // wheel, 0 at the top, turning anticlockwise) and rides along with it
        // (World.followRide), the cabin still on the screen, the park going
        // by behind; a ride ticket opens (kind 'atlas': its stub in 大国小国's
        // look). 上车 dives into the cabin's window, and out of it comes
        // 大国小国's folded map, unfolding over the screen (takeoff 'fold').
        // (view / portrait / dive: from the cabin's hanging point on the rim,
        // in the building's frame)
        spot: {
          // (from behind the wheel, looking out over the park: the drum's
          // floors slide down past the cabin, then its roof, then the sea)
          ride: { start: 4.6 },
          view: { pos: [-5.8, 2.0, -8.4], target: [3.6, -3.9, 0.6], fov: 44 },
          portrait: { pos: [-4.5, 1.5, -6.5], target: [1.4, -4.6, 1.6], fov: 44 },
          dive: [0, -1.165, 0.92],
          pass: {
            kind: 'atlas',
            takeoff: 'fold',
            head: 'ADMIT ONE · 乘车券',
            label: '乘车券',
            flight: 'CABIN 07',
            mark: '',
            board: '上车',
            text: '猜词+身份推理的聚会游戏。玩家分成三个阵营：大国和小国各拿到一个词，两个词之间有一层微妙的联系；白板什么词也没有。轮流说一个词，找出没有队友的白板，也别让对方国家听出你的词。',
            fields: [['CABIN', '07'], ['PLAYERS', '6–12 人'], ['SIDES', '大国 · 小国 · 白板']],
            motto: 'Mundus vult decipi.', // (the world wants to be deceived: and a world it is, its globe)
          },
        },
      },
      { no: '02', title: '对抗性问答猜人', en: 'Twenty Questions, Versus', desc: '用Yes/No锁定人物的经典游戏，加入对抗与策略', ready: false },
      // (纵横: a crossword's two directions)
      { no: '03', title: '纵横猜词', en: 'Across & Down', desc: '强调战略性的团队对抗猜词游戏', ready: false },
      { no: '04', title: '死亡游戏', en: 'No Continues', desc: '只能玩一次的合作闯关游戏，请凑齐队友再点开', ready: false },
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
