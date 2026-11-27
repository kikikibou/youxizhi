---
name: 游戏之致西柚 · 小镇索引
description: 一个人的小镇。3D 建筑广场是全站的索引，每栋楼通往一个自成世界的子站。
colors:
  grapefruit: "#f2545b"
  grapefruit-deep: "#d93d47"
  grapefruit-ink: "#cc3642"
  plum-ink: "#3b1b2e"
  rind-cream: "#ffe9de"
  plum-night: "#2a1324"
  paper-day: "rgba(255,247,240,0.92)"
  paper-night: "rgba(34,14,30,0.88)"
  paper-line-day: "rgba(59,27,46,0.14)"
  paper-line-night: "rgba(255,160,150,0.2)"
  drawer-day: "#fdf3ec"
  chrome-white: "#ffffff"
  sky-day-top: "#3896de"
  sky-day-horizon: "#bfe2f6"
  sky-night-top: "#170b1e"
  sky-night-horizon: "#42203f"
  building-day: "#fbf2ea"
  window-glow-night: "#ffb39c"
typography:
  display:
    fontFamily: "Anton, Oswald, Impact, sans-serif"
    fontSize: "54px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "22px"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "0.04em"
  poem:
    fontFamily: "EB Garamond, Noto Serif SC, Georgia, serif"
    fontSize: "clamp(23px, 2.92vh, 28px)"
    fontWeight: 400
    lineHeight: 1.14
  title:
    fontFamily: "Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  body:
    fontFamily: "Noto Sans SC Variable, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
  eyebrow:
    fontFamily: "Oswald, Anton, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.34em"
  label:
    fontFamily: "Oswald, Anton, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.12em"
  script:
    fontFamily: "Great Vibes, cursive"
    fontSize: "50px"
    fontWeight: 400
    lineHeight: 0.8
rounded:
  none: "0px"
  print: "2px"
  menu: "6px"
  ticket-notch: "9px"
  pass-notch: "10px"
  pill: "20px"
  round: "50%"
spacing:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  top: "26px"
  panel-gap: "41px"
  mobile-inset: "12px"
  gutter: "clamp(18px, 4vw, 70px)"
components:
  button-primary:
    backgroundColor: "{colors.grapefruit}"
    textColor: "{colors.chrome-white}"
    rounded: "{rounded.none}"
    padding: "11px 20px"
  button-outline:
    backgroundColor: "transparent"
    rounded: "{rounded.none}"
    padding: "11px 20px"
  seg-on:
    backgroundColor: "{colors.grapefruit}"
    textColor: "{colors.chrome-white}"
    padding: "8px 16px"
  chip:
    rounded: "{rounded.none}"
    padding: "6px 12px"
  card-tag-ready:
    backgroundColor: "{colors.grapefruit-ink}"
    textColor: "{colors.chrome-white}"
    typography: "{typography.label}"
    padding: "3px 7px"
  ticket:
    backgroundColor: "{colors.grapefruit-ink}"
    textColor: "{colors.chrome-white}"
    rounded: "{rounded.ticket-notch}"
    padding: "9px 16px 10px"
  sheet:
    backgroundColor: "{colors.paper-day}"
    textColor: "{colors.plum-ink}"
    rounded: "{rounded.none}"
    padding: "16px 18px 8px"
  drawer-panel:
    backgroundColor: "{colors.drawer-day}"
    textColor: "{colors.plum-ink}"
    width: "min(560px, 100vw)"
    padding: "40px 36px 48px"
  gate-input:
    backgroundColor: "transparent"
    textColor: "{colors.chrome-white}"
    padding: "11px 14px"
---

# Design System: 游戏之致西柚 · 小镇索引

## Overview

**Creative North Star: "一个人的小镇"**

**取材来源：** 建筑海报 · 白色现代建筑的昼夜两张参考海报；票据 · 票根、登机牌、拍立得

主站是一座小镇的广场。站主的每种爱好是一栋白色的现代建筑（首页、01 辩论、02 问答、03 消遣、04 其他），镜头像一个散步的人，从一栋楼飞到下一栋。画面的主体是 3D 场景和天空，HTML 叠层不多。叠层不是网页上的面板，而是小镇里的物件：拍立得 logo、贴着胶带的照片、票根、登机牌。昼夜跟随访客的本地时间，每栋楼前都有一个反差装置（路灯光柱、灯塔光束等），装置里露出另一个时间的小镇。

**这份文件只管小镇本身**，也就是 `index.html`、`src/style.css`、`src/ui.js`、`src/three/` 和抽屉工具 `src/tools/`。小镇是全站的索引。走进任何一扇门（子站）之后就是另一个世界，那里的颜色、字体和组件都不从这里继承。各世界的规则写在各自的 DESIGN.md 里：

- 《大国小国》：清新的「地图朋克」，见 `game/client/DESIGN.md`；
- 《解码与三国知识问答》：水墨舆图上的解码工作纸，见 `src/sgjm/DESIGN.md`；
- 「攻错」（debatestone.com，外部姊妹站）：黑金配色的装饰朋克，小镇里只出现在它那张登机牌的存根上。

以后会有更多门，每一扇都应该是一个新世界。

**Key Characteristics:**
- 饱和的天空上浮着白色的界面，整站只有一种强调色（西柚红）。
- 排印是海报式的双语：Anton 写数字和大字，Oswald 写宽字距大写标签，EB Garamond 斜体写英文名和诗，Noto Sans SC 写中文，Great Vibes 只做花饰。
- 面板是平面的印刷小物件，方角为主，最多一道投影，没有毛玻璃。
- 昼夜两套颜色，切换时纸面用 1.2s 慢慢换色。
- 反差：落在光柱里的字会反色，诗句也跟着光柱变色。

**The Every Door Its Own World Rule.** 每个子站都是独立的视觉世界。小镇的西柚配色、字体组合和票根、登机牌组件只属于小镇，子站一律不沿用，子站之间也不要互相像。小镇和门之间只有一座桥：登机牌的存根用目的地的风格印刷。

## Colors

「西柚」配色：一种珊瑚红强调色，配李子色的墨和果皮奶油色，放在饱和的蓝天上；夜里是李子紫的天和暖粉色的灯。这套配色仍是「暂定」，唯一来源是 `src/palettes.js` 的 `grapefruit`。

### Primary
- **西柚红** (#f2545b)：小镇唯一的强调色。用在导航当前页的下划线、卡片编号、抽屉左边框、主按钮、选中的分段按钮和筹码、聚焦描边、计时条，以及白天太阳的光晕上。
- **深西柚** (#d93d47)：白天卡片悬停时的文字色，问答题干的加粗字。
- **西柚印色** (#cc3642)：承载白色小字的色块，用在票根、就绪标签、登机按钮、底栏徽记，以及纸面和登机牌顶边那条 3px 的线上。

### Secondary
- **李子墨** (#3b1b2e)：白天纸面和抽屉里的文字色，也是白天诗句的颜色。

### Tertiary
- **果皮奶油** (#ffe9de)：导航上的英文小字，夜里纸面和抽屉的文字色。

### Neutral
- **李子夜** (#2a1324)：加载页和页面底色，夜间抽屉的底色。
- **日纸 / 夜纸**（92% 透明度的暖白，88% 透明度的李子夜）：卡片清单、登机牌票面、菜单的底。
- **纸线**：纸面上卡片之间的分隔线。
- **白** (#ffffff)：所有直接浮在天空上的界面，包括品牌、导航、昼夜开关、底栏和口令门。
- **天空和建筑**（白天 #3896de → #bfe2f6，夜里 #170b1e → #42203f，建筑 #fbf2ea，夜窗 #ffb39c）：只存在于 3D 场景里，由 `palettes.js` 驱动。

**The One Accent Rule.** 小镇的 HTML 叠层只有西柚红这一种强调色，分亮、深、印色三档。其他饱和色只出现在 3D 场景里（天空、植物、夜灯）。唯一的例外是问答页答对时的彩虹庆祝字。

**The White On Sky Rule.** 直接压在 3D 天空上的字和线一律用白色，可读性靠 `--shadow` 的柔光来保证。颜色只留给纸面物件。

**The Palette Source Rule.** 新颜色先加进 `src/palettes.js` 的 palette（日夜各一份），再用 CSS 变量引用。`src/style.css` 的 `:root` 里是旧「海报」配色的值，运行时会被覆盖，所以不要照抄那里的值，也不要写死 rgba。

## Typography

**Display Font:** Anton（备用 Oswald、Impact）
**Body Font:** Noto Sans SC Variable（备用 PingFang SC、Microsoft YaHei）
**Label Font:** Oswald，大写加宽字距
**Secondary:** EB Garamond 斜体（英文名、诗句）、Great Vibes（只做装饰）

**Character:** 海报式的双语排印。粗而窄的 Anton 和中文粗黑体撑起标题，Oswald 大写像海报上的小字说明，Garamond 斜体给英文一层书卷气，Great Vibes 是落款一样的花饰。

### Hierarchy
- **Display**（Anton 400，抽屉标题 54px，计时器读数 clamp(96px, 22vw, 168px)，行高 1）：每页的大标题是 3D 字（Anton，中文用 Noto Sans SC 900），DOM 里的 display 只用在加载词、抽屉标题和计时器读数上。
- **Headline**（Noto Sans SC 900，22px，行高 1.15，字距 0.04em）：票根标题；登机牌目的地用 30px。
- **Poem**（EB Garamond 斜体，clamp(23px, 2.92vh, 28px)，行高 1.14，右对齐，每行不折行）：每页的诗。中文诗用 Noto Sans SC 500，clamp(14px, 1.67vh, 16px)，行高 1.6。开头的引号用 Garamond 108–132px，西柚红。
- **Title**（Noto Sans SC 700，15px）：卡片标题和导航主名，后面跟一个 EB Garamond 斜体的英文名，14px，70% 透明度。
- **Body**（13px，行高 1.7）：简介和登机牌正文。抽屉里的题目正文是 15.5px，行高 1.9。
- **Eyebrow**（Oswald 700，13px，字距 0.34em）：诗上方的小标，前面有一条 56px 的细线。
- **Label**（Oswald 600，9–12px，字距 0.1–0.3em，大写）：卡片标签、票根小字、昼夜开关、抽屉 kicker。
- **Script**（Great Vibes，底栏 50px，精简模式 34px，行高 0.8）：底栏标题、票根水印。

**The Bilingual Pair Rule.** 中文名旁边配一个英文名。中文用 Noto Sans SC 700 或 900，英文名用 EB Garamond 斜体，拉丁字母的标签一律用 Oswald 大写加宽字距，数字用 Anton。

**The Script Is Ornament Rule.** Great Vibes 只做装饰，不承载访客必须读懂的信息。

**The Unbroken Line Rule.** 诗和文字游戏按站主给的行排，不自动折行。排不下时，缩字号或换版式，不改字。

## Layout

- **两层结构：** 底层是全屏固定的 WebGL 画布，上层是叠在它上面的 `.ui`。叠层默认 `pointer-events: none`，只在链接、按钮和面板上打开。层级从下到上：画布、叠层（2）、抽屉（20）、加载页（50）、起飞转场（60）。
- **顶栏：** 三栏网格（1fr auto 1fr，间距 24px），上边距 26px。品牌在左，致谢在中，导航在右并给昼夜开关让出 128px。
- **每栋楼一个机位：** 主路灯放在矮楼前面，光柱上半段叠在天空上，下半段压在建筑上。诗和面板放在光柱的另一侧：辩论页和问答页放左边，其他页放右边。
- **诗和面板：** 诗离顶部 11vh，宽 clamp(306px, 38.75vh, 372px)；面板宽 min(400px, 92vw)，下沿离底栏 41px。两者在 `ui.js` 里自动避让（最小间距 23px）。
- **底栏：** 三栏「小字」排版。文字压在一条细线上，Great Vibes 标题骑在线的三分之一处。放不下时删掉条目，不折行。
- **抽屉：** 从右侧滑出，宽 min(560px, 100vw)，内边距 40px 36px 48px。
- **断点：** 只有 860px 一个。860px 以下隐藏诗、底栏、致谢和简介，导航变成整行横向滚动，面板四周留 12px，卡片清单最高 30vh 并可滚动。3D 镜头在宽高比小于 0.9 时换成竖屏构图。
- **间距节奏：** 外边距 clamp(18px, 4vw, 70px)，诗、面板、登机牌共用；内部间距用 6、10、14、18、24px 这几档。

**The Beam Side Rule.** 叠层不压住光柱。光柱里是另一个时间，它是每一页的主角。

## Elevation & Depth

深度来自 3D 场景，叠层本身像印刷品一样平。只有「被拿起来的纸」（票根、登机牌、照片）有一道投影，浮在天空上的白字只用一圈可读性柔光。

### Shadow Vocabulary
- **天空柔光** (`0 1px 14px rgba(5,15,35,0.35)`，即 `--shadow`)：顶栏、开关、拍立得这类白色元素压在天空上时用，作用是可读，不是抬高。
- **票根投影** (`filter: drop-shadow(0 6px 12px rgba(34,14,30,0.35))`)：卡片清单上方的票根。
- **登机牌投影** (`filter: drop-shadow(0 10px 22px rgba(34,14,30,0.4))`)：卡片打开后的登机牌。
- **照片投影** (`0 3px 12px rgba(5,15,35,0.32)`)：从拍立得里发出来的画质照片。
- **印刷内框** (`inset 0 0 0 3px <印色>, inset 0 0 0 4px rgba(255,233,222,0.5)`)：票根的细线内框，是印出来的，不是阴影。

**The One Lift Rule.** 一个纸物件最多一道投影，不叠多层柔和阴影。

**The No Blur Rule.** 不用 `backdrop-filter`，因为模糊 WebGL 画布每一帧都要重算。

## Shapes

以方角为主：卡片清单、卡片、按钮、分段按钮、筹码、标签、抽屉都是直角。圆角只用在少数地方：照片 2px，菜单 6px，开关和配色按钮做成 20px 的药丸，太阳和月亮的旋钮是正圆。票根和登机牌用不对称的缺角（4px 和 9px，登机牌是 10px），中间是 2px 的虚线撕口。线条只有三种：浮在天空上的白色或 currentColor 1.5px 描边、纸面顶边 3px 的印色线、抽屉左侧 4px 的西柚红边。小物件会稍微歪着放：照片在 −5° 到 6° 之间，胶带 −5°，印章 −6°，水印 −8°。

## Components

组件按页面主题来定。下面这些是小镇现在共用的物件，以后某一栋楼可以换成贴合自己主题的物件，只要守住下面的 Don'ts。

### Buttons
- **Shape:** 直角 (0px)，描边 1.5px currentColor。
- **Primary:** 西柚红底白字，内边距 11px 20px，粗体 15px。
- **Outline:** 透明底，描边和文字随所在的纸面变色。
- **Segmented / Chips:** 分段按钮选中后是西柚红底白字，未选中 60% 透明度；筹码选中后描边和文字变成西柚红。
- **Hover / Focus:** 目前抽屉按钮没有悬停和聚焦样式，新做的按钮要补上 `:focus-visible`（2px 西柚红描边，偏移 3px，和拍立得一致）。

### Cards / Containers（卡片清单）
- **Corner Style:** 直角。
- **Background:** 日纸或夜纸，顶边一条 3px 印色线，切换昼夜时用 1.2s 换色。
- **Shadow Strategy:** 没有阴影，靠上方的票根带出层次。
- **Internal Padding:** 16px 18px 8px。每张卡片是三栏：Anton 编号、中文标题加斜体英文名、右侧标签（SOON / OPEN / PLAY → / VISIT → / ENTER →）。悬停时整行右移 8px 并变成深西柚色。

### Inputs / Fields
- **口令门：** 白色 1.5px 描边的一整行，输入框透明，Oswald 宽字距；按钮是西柚红块。答错时这一行会摇一下。
- **问答空格：** 只有一条下划线的输入框，答对后弹成一个彩虹渐变的字，外面爆开一圈。

### Navigation
- 白字浮在天空上：英文小字（Oswald 600 10px，果皮奶油色）在上，中文名（700 15px）在下。默认 82% 透明度，悬停和当前页变成 100%。当前页的西柚红下划线从左向右画出来（0.6s）。860px 以下变成一整行横向滚动。

### 票根 Ticket
每页面板上方的标签：左边是带页码的存根，中间一道虚线撕口，右边是票面（标题、可选副标题、一行小字），背后是一个 Great Vibes 水印。整张票是印色底，用一道投影。

### 登机牌 Boarding Pass
卡片点开后的特写。票面用小镇的纸和墨，存根用目的地子站自己的风格印刷：攻错是黑金，《大国小国》是地图纸和十字网格，《解码》是水墨舆图和印章。点「登机」后，存根撕下，票面折起，然后进入目的地的起飞转场（黑幕、地球、晕墨、展开地图）。这是小镇通往其他世界的那座桥。

### 拍立得与画质照片
品牌是一张拍立得（2.5px 边框，下边 7px）。点开后会发出几张歪着放、贴了胶带的照片，用来选画质。

### 昼夜开关
54×26px 的白描边药丸，里面的旋钮滑动 28px：白天是带西柚红光晕的太阳，夜里是带阴影的月牙。

## Do's and Don'ts

### Do:
- **Do** 给每个新子站先选一个属于它自己的视觉世界，写进该子站目录下的 DESIGN.md，然后再动手。参照现有的几个世界，它们彼此毫不相像：攻错的黑金装饰朋克、《大国小国》的清新地图朋克、《解码》的水墨舆图。
- **Do** 从 `src/palettes.js` 取颜色并用 CSS 变量引用，日夜两套都给。
- **Do** 浮在天空上的字用白色加 `--shadow`。
- **Do** 动效用 `--ease`（cubic-bezier(0.22, 1, 0.36, 1)）。页面元素进场时上浮 24px，错开 90ms；昼夜换色用 1.2s。
- **Do** 每次改完都在桌面和 ≤860px 两种宽度下看一遍，昼夜各看一遍。

### Don't:
- **Don't** 让子站长得像小镇，也不要让子站之间互相像：子站不沿用西柚红、Anton 配 Oswald 的组合和票根组件。
- **Don't** 做成通用的 AI 网页：紫蓝渐变、毛玻璃卡片、圆角加柔和阴影的卡片、Inter 或 Roboto、居中大标题配三张特性卡。
- **Don't** 用素白方框当面板。白底方框里放几行字就算一个面板，看起来很简陋。一个物件如果除了标签什么都没加，就把它缩成按钮上的一个小图标。
- **Don't** 为了排版改站主的字句，只能改换行。
