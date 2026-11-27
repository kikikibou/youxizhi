<!-- SEED: 由 /new-world 选定的世界；正式代码写好后运行 /impeccable document 刷新 -->
---
name: 大辩题库 · 营业厅行情屏
description: 大辩题的交易所：一块 2000s 证券营业厅的 LED 行情大屏，辩题按票数涨跌，看涨一次随机加 1~99 票。
colors:
  screen: "#070807"
  led-off: "#1b1f1c"
  seam: "#000000"
  led-red: "#ff3b30"
  led-red-hover: "#ff5a4f"
  led-green: "#33d17a"
  led-green-hover: "#4fe08d"
  led-yellow: "#ffcc33"
  led-white: "#f1eedf"
  dim: "#9a978a"
  who: "#d2cdbb"
  row-line: "#1f2320"
  rule: "#2a2d2a"
  frame: "#3a3d39"
  field: "#0c0e0c"
  bezel: "#3c3f42"
  hall: "#1c1d21"
  lcd-top: "#10213f"
  lcd-bottom: "#0a1730"
  lcd-frame: "#4a72b8"
  lcd-seam: "#050a14"
  lcd-ink: "#e8eefb"
  lcd-dim: "#9fb0d2"
  lcd-axis: "#8fa3c9"
typography:
  display:
    fontFamily: "DBTK Round, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.04em"
  button:
    fontFamily: "DBTK Round, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1
  label:
    fontFamily: "DBTK Round, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  number:
    fontFamily: "Doto, ui-monospace, monospace"
    fontSize: "19px"
    fontWeight: 900
    lineHeight: 1
  code:
    fontFamily: "Doto, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.02em"
  topic:
    fontFamily: "-apple-system, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
    fontSize: "14.5px"
    fontWeight: 700
    lineHeight: 1.42
  meta:
    fontFamily: "-apple-system, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  none: "0px"
spacing:
  edge: "10px"
  row: "7px"
  gap: "6px"
  panel: "10px"
  led-pitch: "4px"
  module-w: "97.5px"
  module-h: "105.5px"
components:
  tab-on:
    backgroundColor: "{colors.led-yellow}"
    textColor: "{colors.screen}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "5px 12px 4px"
  tab-off:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "5px 12px 4px"
  button-pro:
    backgroundColor: "{colors.led-red}"
    textColor: "{colors.screen}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    height: "50px"
  button-pro-hover:
    backgroundColor: "{colors.led-red-hover}"
  button-con:
    backgroundColor: "{colors.led-green}"
    textColor: "{colors.screen}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    height: "50px"
  button-con-hover:
    backgroundColor: "{colors.led-green-hover}"
  button-rate:
    backgroundColor: "rgba(255,204,51,0.08)"
    textColor: "{colors.led-yellow}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    width: "74px"
  button-submit:
    backgroundColor: "{colors.led-yellow}"
    textColor: "{colors.screen}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "42px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.led-white}"
    typography: "{typography.topic}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "42px"
  badge-limit:
    backgroundColor: "{colors.led-red}"
    textColor: "{colors.screen}"
    typography: "{typography.meta}"
    padding: "2px 4px"
---

# Design System: 大辩题库 · 营业厅行情屏

## Overview

**Creative North Star: "辩题交易所"**

**取材来源：** 证券营业厅 · 2000s 国内证券营业部墙上的 LED 行情大屏

整个子站是一块挂在营业厅墙上的 LED 行情大屏。每条辩题是一只「股票」：有代码（DB0001 起）、有票数、有今日涨幅和 K 线，冲到 +10% 就打「涨停」。和真行情屏不同的一点：票数的增长一律用黄色，红绿只留给站队（看正 / 看反）。访客的动作大多用营业厅的话说：给辩题投票叫「看涨」（一次随机加 1~99 票，随便得好笑），投稿叫「申请上市」，投稿人叫「题库人」（谐音「提裤人」，和站名「大辩题库 / 大便提裤」是一个梗），月榜叫「月度涨幅榜」，月底叫「收盘」，分享叫「搬给群友」。站队叫「看正」「看反」（不用买入卖出，会和「看涨」打架），一边占到九成以上叫「正停」「反停」。笑点来自一本正经：屏幕、字体、排版都按真实行情屏来，只有内容是离谱的。

它是《游戏之致西柚》小镇辩论楼里的一扇门，和小镇无关：不用西柚红，不用 Anton、Oswald 的海报排印，也不用票根组件。这份文件管 `src/dbtk/`、`dbtk/index.html` 和后台 `dbtk/admin.html`。后端在 `dbtk-server/`。

访客多半从群聊里点链接进来，用手机。按频率从高到低：刷辩题看乐子 > 投稿 > 投票 > 看月榜。

**从来源借来的三条特征：**
1. 实物上代码、名称、现价、涨跌幅一栏栏对齐，红涨绿跌，涨停打标 → 页面的辩题行情表：DB 编号、票数、涨幅、「涨停」标。
2. 实物上 LED 点阵字、没点亮的暗灯珠、模块之间的细缝 → 点阵数字（Doto）、点阵遮罩的标题、整屏暗灯珠底纹和模块缝。
3. 实物上屏幕顶部横向滚动的快讯条 → 页面顶部的红色快讯条。

**版式骨架：**
- 信息排法：主窗口加数据表。页面中间的主窗口一次放大展示一只（站队、看涨、换一只、搬给群友都在这里），下面的行情表每条辩题一行，栏目固定；点一行就把它放进主窗口。
- 主视觉占比：约 10%，只有快讯条和点阵标题，其余都是表。
- 网格：等宽数据栏，手机上是 `46px | 1fr | 48px | 56px`（代码 | 辩题 | 票数 | 涨幅），和 LED 模块的点阵格对齐。

**Key Characteristics:**
- 一整块黑屏，没有卡片、没有面板浮起来；层次只靠颜色、点阵和分隔线。
- 颜色就是 LED 的四种光：红、绿、黄、白。红绿只表示涨跌和正反方，黄只给「能点的」和标题。
- 辩题正文和题库人用系统字体（用户投稿，不在字体子集里）；个性字体只用在固定文字上。
- 全部直角。

## Colors

一块黑屏上的四色 LED，加没点亮的暗灯珠；页面中间嵌一块深蓝液晶分屏（主窗口）。

### Primary
- **LED 黄** (#ffcc33)：票数的增长，以及主操作。票数、今日涨幅、涨停标、K 线的蜡烛、看涨跳出的「+N」、本月 +N、快讯条的字；看涨按钮、递交按钮、选中的标签、输入框描边、焦点框；还有页头的「大辩题库」。

### Secondary
- **LED 红** (#ff3b30)：只表示看正。「看正」按钮、K 线下面的看正柱、「正停」标。悬停 #ff5a4f。
- **LED 绿** (#33d17a)：只表示看反。「看反」按钮、K 线下面的看反柱、「反停」标。悬停 #4fe08d。

### Tertiary（主窗口的液晶分屏）
- **液晶蓝** (#10213f → #0a1730 竖向渐变，加 3px 一道的淡扫描线)：主窗口的底。
- **液晶框** (#4a72b8)，框里一道 3px 黑缝 (#050a14) 和一道淡蓝细线。
- **液晶字** (#e8eefb)、**液晶灰** (#9fb0d2)、**刻度字** (#8fa3c9)、**网格线** (rgba(140,170,230,.2))。

### Neutral
- **屏黑** (#070807)：整块屏的底，也是红绿黄按钮上的字色。
- **暗灯珠** (#1b1f1c)：4px 间距的点阵底纹。
- **模块缝** (#000)：每 97.5 × 105.5px 一道的 LED 模块缝。
- **LED 白** (#f1eedf)：辩题正文、时钟。
- **灭灯灰** (#9a978a)：代码、说明小字；**题库人名** (#d2cdbb)。
- **行线** (#1f2320)、**栏线** (#2a2d2a)、**框线** (#3a3d39)：表格的分隔。
- 桌面版的屏幕外框 (#3c3f42) 和营业厅墙只在宽屏出现：墙是一面没点亮的 LED 模块墙（8px 间距的暗灯珠、每 192 × 216px 一道淡模块缝），顶上一片很淡的暖光。

**The Yellow Is Growth Rule.** 票数的增长一律用黄色，不用红绿。今天比昨天投得少，涨幅只是变暗（灭灯灰），不变绿。

**The Red And Green Are Sides Rule.** 红色只表示看正，绿色只表示看反（输入出错的红字提示除外）。不要拿红绿表示涨跌。

## Typography

**Display Font:** DBTK Round（寒蝉全圆体 F Bold 的子集，改名后托管）
**Number Font:** Doto（点阵字，900 / 700）
**Body Font:** 系统字体：-apple-system, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans CJK SC

**Character:** 圆头黑体做营业厅的招牌字和按钮，点阵字做行情数字，辩题本身用系统黑体，和真屏上「名称」一栏一样朴素。

### Hierarchy
- **Display**（DBTK Round，40px，字距 0.04em，LED 黄，加点阵遮罩）：只有页头的「大辩题库」。
- **Button**（DBTK Round，17–23px）：看正、看反（20px）、看涨（主窗口里 23px）、递交。
- **Label**（DBTK Round，15–18px）：标签页、「申请上市」「十一月 月度涨幅榜」这类固定栏名。
- **Number**（Doto 900，票数 19px、涨幅 16px、名次 24px）：所有行情数字。
- **Code**（Doto 700，12–13px）：DB 编号、时钟。
- **Topic**（系统字体 700，14.5px，行高 1.42）：辩题正文。
- **Meta**（系统字体 600，11.5px）：题库人、说明小字、栏目表头（表头用 700 12px）。

**The User Text Is System Text Rule.** 辩题正文、题库人名、输入框里打的字，都是运行时才有的字，不在子集里，一律直接用系统字体栈，不要先写个性字体再指望它落到后备字体。

**The LED Mask Rule.** 点阵遮罩（`mask-image: radial-gradient(...)`，3px 间距）只给 32px 以上的固定大字。小字加遮罩就认不出来了。

### 字体托管
正式页面不从任何 CDN 加载字体，按用字子集化后和站点一起托管：
1. 完整的字体源文件放在不进仓库的 `字体源/` 里：`字体源/chillround-v3.200/`（ChillRoundF v3.200，github.com/Warren2060/ChillRound，OFL-1.1，许可证副本在 `src/dbtk/fonts/OFL-ChillRoundF.txt`）。Doto 只有拉丁字母和数字，直接用项目依赖里的 `@fontsource/doto`（700、900 两个字重的 latin 文件），由 Vite 打包、和站点一起托管，不走子集脚本。
2. `src/dbtk/fonts.json` 写清楚要扫哪些文件（`main.js`、`style.css`、`dbtk/index.html`；示例数据 `data.js` 是用户内容，不扫）、输出到 `src/dbtk/fonts/`。
3. 运行 `python -I scripts/subset-fonts.py src/dbtk/fonts.json`，生成的 woff2 和 `fonts.lock.json` 都要提交。
4. CSS 里用 `@font-face` 引用这些文件，`font-display: swap`，后备字体栈见上。
5. 辩题、题库人和输入框是运行时的字，直接用系统字体栈（见上面的规则）。服务器以后下发的固定文案（比如快讯模板）写进 fonts.json 的 `extra`。
6. 这里没有答案类文本；以后如果有不能提前泄露的内容（比如月榜揭晓前的结果），不要扫进子集。
7. 改了文案后运行 `python -I scripts/subset-fonts.py src/dbtk/fonts.json --check`，有缺的字就重新生成。

寒蝉全圆体声明了保留字体名「ChillRoundF」，子集是修改版，所以 fonts.json 里给它配了 `rename`，生成的文件内部名字改成「DBTK Round」，CSS 也用这个名字。

## Layout

- **手机为主。** 整页就是一块 390 宽的屏，`100svh` 高，左右 10px 边。内容超过一屏时整页往下滚，快讯条和页头不固定。
- **从上到下：** 快讯条（32px）→ 页头（点阵标题 + 时钟 + 「十一月榜 N 天后收盘」）→ 概述（一句话）→ 主窗口 → 标签（最热 / 最新）→ 行情表 → 月度涨幅榜 → 申请上市 → 页脚（免责小字 + 搬给群友）。手机上主窗口落在第一屏的中间，眼睛先落在那一只上。
- **行情表：** 每行 `46px | 1fr | 48px | 56px`，列间距 6px，行上下 7px。正在主窗口里的那一行加一圈 1px 黄框（70% 不透明）、底色压一层 6% 黄，向两边出血 6px（不用单侧竖条）。行不展开。
- **桌面：** 屏幕宽 min(440px, 100vw) 居中，外面一圈 10px 的屏幕外框，再外面是营业厅的暗墙。不做宽屏专用排版。

## Elevation & Depth

整块屏是平的，没有任何东西浮起来。层次只来自三样：暗灯珠底纹、模块缝、行和栏的分隔线。桌面上屏幕外框有一道投影（`0 30px 60px rgba(0,0,0,.6)`），那是墙上的屏，不是界面元素。

**The Flat Screen Rule.** 不加阴影、不加光晕。LED 发光感靠颜色本身和点阵，不靠 text-shadow 或彩色 box-shadow。

## Shapes

全部直角：按钮、标签、输入框、涨停标、月榜格子。唯一的「圆」是点阵本身的灯珠。分隔线是 1px（行、栏）和 2px 黑线（表头上、月榜上）。

## Components

### 数字的意思
- **票数**（行情表、主窗口）：累计看涨票数，跨月一直累加。
- **本月 +N**（月榜、主窗口）：本月新增的票。月度涨幅榜只按它排。
- **今日涨幅**：今天的票数比昨天多多少；昨天没票的显示「新股」。
- 每台设备每月对每只股能看涨一次，一次随机加 1~99 票（后端摇号）；站正方 / 反方不分月，可以改。数据来自 `dbtk-server/`，见那里的 README。

### 概述 Lede
页头下面一句话，系统字 12.5px、题库人色：「在这里，你可以自由分享交流你喜欢的大辩题。我们授权所有人使用它们，只是请千万不要忘记题库。」

### 主窗口 Spot
页面中间嵌在黑色 LED 墙里的一块深蓝液晶分屏（见 Colors 的 Tertiary），向两边出血 4px。辩题是它的主体：整屏最大的字，四周留白；不再给辩题另加底块（框里套框会让眼睛不知道看哪层）。从上到下：
- 编号（Doto，白）、「题库人 某某」、「新上市」黄字、「正停 / 反停」标，右边今日涨幅（黄，带涨停标）；
- 辩题正文：系统字 28px 800，行高 1.36，白；
- K 线（`kline.js`）：近 14 天每天一根，开盘 = 当天零点的累计票数，收盘 = 当天结束（今天是现在）的累计票数，所以全是黄色阳线，烛身高度就是当天新增的票数；下面是当天看正（红）/ 看反（绿）的设备数，叠成一根柱。14 个位置靠右排，新股只有右边几根。右边 3 道刻度，最后一根上标「+N」。下面一行小字图例「近 14 天　黄 新增票数　红 看正　绿 看反」；
- 大号票数（Doto 900，52px，黄）加「票」，右边「本月 +N」；
- 两个站队按钮：红底「看正 58%」、绿底「看反 42%」（还没人站队时不写百分比），下面一行小字「先捞手机 一方有利」（没有立场时写「正方有利 / 反方有利」）；选中后加内框，右上角小字「你选的」；
- 看涨：整宽实心黄按钮，「看涨 推荐这个辩题，为它投票」。1~99 的随机不写出来，交给点了之后的动效。摇号时写「看涨中 正在摇号……」；投过后变成黄框淡底「已看涨 这个月给它加了 N 票」，再点只弹提示；
- 底行：「随机抽一只」（左）、「搬给群友」（右）。

**正停 / 反停**：照「涨停」的说法，至少 10 个人站队、一边占到九成以上时，在编号后面打一个小标（红底「正停」或绿底「反停」）。

数据来自后端 `/history?code=`（`dbtk-server/`），取过的留着；看涨后今天那根就地长高，站队后重新取。

主窗口放哪一只：链接带 #DB 编号的放那一只；第一次来放票数最多的（一样多时编号小的优先）；以后每次来随机换一只和上次不一样的（上次放的存在 localStorage 的 dbtk:last）。点行情表的行、月榜的格子、「随机抽一只」、刚上市的新投稿，都换进主窗口。

### 看涨动效 Gain Pop
看涨成功后，按钮上方跳出一个 LED 报价小框：黑底、1px 黄框，Doto 900 56px 黄字「+N」，后面白字一个词（1 票「就一票」、99 票「顶格」、≥90「暴涨」、≥50「大涨」、≥10「上涨」，其余「小涨」）。先放大弹出再往上飘走，1.5 秒。同时大号票数从旧值滚到新值（0.9 秒，滚动时一闪一闪），主窗口底色闪一下。`prefers-reduced-motion` 时小框原地停 2 秒，数字直接变。

### 快讯条 Ticker
顶部 32px，黄色系统字，前面白色「快讯」两个字。内容横向循环滚动（22s 一圈，`prefers-reduced-motion` 时不动），由数据生成：今日涨停的、刚上市的（带题库人）、本月领涨的、离收盘几天。不编造发言。加载中显示「开盘中」，连不上时显示「暂时休市」，都不滚动。

### 行情表 Quote Table
- 表头：代码 | 辩题 | 票数 | 今日涨幅，黄色 12px。
- 每行：DB 编号（上市 24 小时内下面加黄字「新上市」）；辩题正文；下一行「题库人 某某」；累计票数（黄；今天比昨天少时变暗）；涨幅（黄，+10% 以上下面加黄底「涨停」标）。
- 点一行把它放进主窗口，并把主窗口滚进视野。
- 加载中、连不上、没有辩题的说明都显示在主窗口里：灰字「开盘中，正在拉行情……」；红字说明加黄框「重新连接」按钮；「还没有辩题上市。写一条，当第一只股。」

### 搬给群友 Share Card
点「搬给群友」（主窗口和页脚都有）把主窗口里那一只画成一张 1080 × 1440 的分享图（`share.js`，点了才加载）：黑底暗灯珠和模块缝、顶上快讯条（白「快讯」、黄「群友推荐了一道大辩题，扫码来站队」）、点阵「大辩题库」、编号和网址、黄框里的辩题（系统字 66px 起，放不下就缩）、题库人、红「看正 / 先捞手机 一方有利」和绿「看反 / 先提裤子 一方有利」两块、黄色大票数、底部「扫码来站队」「推荐这个辩题，为它投票」「我们授权所有人使用这些辩题，只是请千万不要忘记题库。」和一个二维码（链接带 #DB 编号）。折行时标点和斜杠不放行首。
图画好后在一个黑底黄框的浮层里显示：「长按图片保存或转发；扫图上的码直接打开这一只」，按钮是「发给群友」（浏览器支持分享文件时才有）、「保存图片」、「复制链接」、「关闭」。点浮层外面或按 Esc 关闭。

### 月度涨幅榜 Monthly Board
三格并排，每格是 Doto 名次 + DB 编号 + 「+本月新增票数」，点一格跳到那一只。标题「十一月 月度涨幅榜」，说明「按本月新增票数，30 日收盘」。本月还没人投时写「这个月还没开张，看涨一只就上榜」。下面一个「看往月榜 ›」开关，展开后按月列出收盘时的前三名（年月、名次、编号、辩题一行截断、+当月票数）。

### 申请上市 Submit
框线面板，标题「申请上市」，右侧小字「AI 初筛，通过就上市」。第一行是辩题输入框；第二行左边是「题库人」前缀，中间是题库人输入框（不写就是匿名），右边是黄色「递交」按钮（递交中变暗、写「递交中」）。
- Turnstile 人机验证在输入框获得焦点时才加载，暗色、只在需要时出现（interaction-only），放在输入框下面。
- 输入框占位字「写下你推荐的大辩题」。
- 结果写在面板里：上市成功（黄字，新股放进主窗口，可以直接搬给群友）、已递交等审核、没能上市加原因（红字）、各种错误（红字）。
- 面板底部「我的申请」：这台设备最近 3 条投稿，前面一个状态字（审核中 / 退回 / 已上市 / 已下市），退回的带原因。

### 提示条 Toast
看涨失败、重复看涨、复制链接这类一句话的反馈：屏幕底部居中，黑底黄框黄字，3 秒后消失。

### 后台 Admin（/dbtk/admin.html）
同一块 LED 屏。先输口令（后端的 ADMIN_TOKEN）；进去后两段：「待审 N」每条有正反方立场两个小输入框、红色「上市」、退回原因输入框、绿色「退回」；「最近处理」每条标状态（已上市 红字 / 退回、已下市 绿字）、编号、谁判的（AI / 站主），已上市的可以「下市」，其余可以「改判上市」。

### 标签 Tabs
「最热」「最新」两个直角标签，选中的是黄底；右边「随机抽一只」。

### Inputs
黑底、1px 黄色描边，系统字体 15px 粗体，光标黄色；占位字灰色。

### 选区、焦点、滚动条
选区黄底黑字；焦点 2px 黄框、偏移 2px；滚动条用暗灯珠色的细条。

## Do's and Don'ts

### Do:
- **Do** 所有新功能先想「营业厅里这叫什么」，再起名字和画法（例如分享叫「搬给群友」，随机叫「随机抽一只」）。但别硬套：和别的说法打架时就换一个（站队不叫买入卖出，叫「看正」「看反」）。
- **Do** 票数增长用黄；红只给看正，绿只给看反。
- **Do** 数字一律用 Doto，固定的中文招牌和按钮用 DBTK Round，用户写的字用系统字体。
- **Do** 每个改动都在 390 × 844 下看一遍，再看桌面。
- **Do** 题库人和辩题一起出现：展示辩题的地方都带上「题库人 某某」。

### Don't:
- **Don't** 加卡片、圆角、阴影、光晕或毛玻璃。这是一块平的屏。
- **Don't** 用 emoji、吉祥物、贴纸、手绘涂鸦或综艺花字来「显得好笑」。好笑来自一本正经的行情口吻。
- **Don't** 给小字加点阵遮罩。
- **Don't** 沿用小镇和其他子站的配色、字体和组件：不用西柚红、Anton、Oswald、EB Garamond、Noto Serif SC、Space Mono，不用票根、登机牌、图名框、印章。
- **Don't** 把辩题正文写进个性字体的 font-family 里。
