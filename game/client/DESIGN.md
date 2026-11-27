---
name: 大国小国 · 地图朋克
description: 一局聚会游戏是一本地图集，每一步换一种地图；平面印刷，强调色只给「你」、能点的和正在发生的。
colors:
  accent: "#df4a1f"
  accent-text: "#b5371a"
  big-country: "#efc965"
  small-country: "#a9cf8f"
  paper: "#f4ecda"
  page: "#fbf6ea"
  ink: "#1e1b17"
  ink-2: "#3b362f"
  muted: "#5d564c"
  faint: "#8b8273"
  sea: "#d4e3e1"
  atlas: "#d8e3df"
  waterline: "#5f8f93"
  mat: "#1f3d38"
  night: "#132033"
  night-sea: "#0e2a3c"
  night-ink: "#e8ecf3"
  night-line: "#7fa6c8"
  night-accent: "#ff6a3d"
typography:
  title:
    fontFamily: "Noto Serif SC Variable, Noto Serif SC, Songti SC, serif"
    fontWeight: 900
  button:
    fontFamily: "Noto Serif SC Variable, Noto Serif SC, Songti SC, serif"
    fontSize: "17px"
    fontWeight: 900
    letterSpacing: "0.25em"
  write:
    fontFamily: "Noto Serif SC Variable, Noto Serif SC, Songti SC, serif"
    fontSize: "22px"
    fontWeight: 900
  body:
    fontFamily: "Noto Sans SC Variable, Noto Sans SC, PingFang SC, sans-serif"
  label:
    fontFamily: "Oswald, Arial Narrow, sans-serif"
    fontWeight: 500
  mono:
    fontFamily: "Space Mono, ui-monospace, monospace"
rounded:
  none: "0px"
  chip: "18px"
  chip-plain: "15px"
  round: "50%"
spacing:
  board-edge: "26px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    height: "50px"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "50px"
  button-night:
    backgroundColor: "{colors.night-accent}"
    textColor: "{colors.night}"
    rounded: "{rounded.none}"
    height: "50px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    height: "36px"
    padding: "0 14px 0 4px"
  title-cartouche:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "9px 16px 10px"
---

# Design System: 大国小国 · 地图朋克

## Overview

**Creative North Star: "一本地图集"**

**取材来源：** 地图与测绘 · 地图集、海图、地铁线路图、测量手簿

整局游戏是一本地图集，每一步换一种地图：首页是转动的地球，扫码进房是航路图，大厅是圆桌岛地形图，夜晚是夜航海图，白天发言是地铁线路图，投票是选区图，第二阶段是还没定的国界和界碑，结算是历史疆域图。档案是一本测量手簿，按住看词是一张竖着对折的身份图，主持人台是总控图。

它是《游戏之致西柚》小镇里的一扇门。门后的世界和小镇无关：不用西柚红，不用 Anton 和 Oswald 的海报排印，也不用票根组件。这份文件管 `game/client/` 下的全部画面。

**Key Characteristics:**
- 每个画面是一张 390 × 844 的设计画板，按屏幕等比缩放后居中（`board.tsx` 的 `Stage`）。画板外面是同一张海图的底纹和图框，窄屏、短屏时只是两边或上下多露出一点海。
- 平面印刷：细墨线、平涂、纸面颗粒，最多一层错位的印刷阴影。
- 背景永远带地图纹理：十字网格、水线、经纬网、纸纹、暗角、图名框。
- 宋体 900 做标题和按钮，黑体做正文。

**The Accent Means You Rule.** 强调色（#df4a1f，夜里是 #ff6a3d）只给三样东西：「你」、能点的东西、正在发生的事。

**B Is Not A Rule.** 当前是 B 版。A 版（「图纸」风格，git 标签 `dgxg-vA`）只用来核对每个画面上该有哪些信息和操作，不照搬它的任何组件和画法。

## Colors

纸、墨和海水为底，两个国家各占一种淡色，一个朱橙色强调。

### Primary
- **朱橙** (#df4a1f)：主按钮，「你」，正在发生的事，档案里的新记录点。小字要用 **朱橙字** (#b5371a)，因为它的对比度更够。

### Secondary
- **大国黄** (#efc965) 和 **小国绿** (#a9cf8f)：两个阵营的领土色，只用来表示阵营。

### Neutral
- **地图纸** (#f4ecda) 和 **页纸** (#fbf6ea)：画板和物件的纸面。
- **墨** (#1e1b17)，以及次墨、灰墨、淡墨三档（#3b362f / #5d564c / #8b8273）：线条和文字。
- **海** (#d4e3e1)、**图集底** (#d8e3df)、**水线** (#5f8f93)：海面和水线纹理。
- **夜航** (#132033 / #0e2a3c，线条 #7fa6c8，墨 #e8ecf3)：夜晚的海图。
- **墨绿垫** (#1f3d38)：画板外的垫底。

## Typography

**Display Font:** Noto Serif SC Variable 900
**Body Font:** Noto Sans SC Variable
**Label/Mono Font:** Oswald（窄体数字和标签）、Space Mono（编号）

**Character:** 地图上的注记用粗宋，说明文字用黑体，经纬和编号用等宽字和窄体。

### Hierarchy
- **Title**（宋体 900）：画板左上的图名框。
- **Button**（宋体 900，17px，字距 0.25em）：主按钮。
- **Write**（宋体 900，22px）：手写栏里玩家输入的词，上面配一行 11.5px 的灰墨小字标题。
- **Body**（黑体）：说明和规则正文。

## Layout

画板固定为 390 × 844，缩放系数是 `u = min(vw/390, max(vh,480)/844)`（滚动模式下是 `vw/390`），舞台最宽 440px。画板四周留 26px：图名框贴左上，筹码栏贴右上，竖排右对齐。

## Elevation & Depth

整体是平的。深度只来自印刷式的错位阴影：筹码 `2px 2px 0`，按钮 `0 3px 0`（按下时下沉 2px，阴影缩到 1px），图名框 `2px 3px 0` 加上 0.12 透明度。不用模糊阴影。

**The Flat Print Rule.** 物件画成平面印刷品：线稿、平涂，最多一道错位阴影。立体的拟物物件和平面的地图元素放在一起会打架，曾经做过的立体投票箱就因此被否掉了。

## Shapes

按钮和图名框是直角；筹码是药丸（高 36px，圆角 18px；简版高 30px，圆角 15px）；图标底和提示点是正圆。图框是 1.4px 墨线加 6px 黑白相间的经纬刻度，里面再加一圈 0.6px 细线。图名框是双线框，由内阴影画出两道细线。

## Components

### Buttons
- **Primary:** 50px 高、整宽的朱橙直角条。里面有一圈 3px 内衬和一条白色细线，下面是 `0 3px 0` 的印刷阴影；按下时下沉 2px。
- **Ghost:** 纸底墨字，1.2px 墨线，14px，字距 0.1em。
- **Night:** 夜里换成 #ff6a3d 底、夜航深蓝字。
- **Disabled:** 灰纸色 #c9bfab，没有阴影。

### Chips
- 纸底，1.5px 墨线，13.5px 粗体，左侧一个 26px 的圆形图标底。选中时反成墨底纸字，「按住」这类动作的图标底用朱橙。档案有新记录时，右上角亮一个 11px 的朱橙点。

### Inputs / Fields
- **手写栏：** 只有下划线，上面一行小字标题，中间是宋体 900、22px 的输入，旁边显示字数。

### 图名框 Title Cartouche
画板左上角的地图图名框：纸底，1px 墨线加一道内衬细线（双线框），最宽 250px。

### 每个画面一个主题物件
面板必须是和这一步主题有关、画了细节的物件。做成功过的例子：首页的行李牌和车票，夜晚的海图卡，发言时的站牌，投票时投票箱上的选票、「正」字计票簿、钉起来的告示和选项卡片。

## Do's and Don'ts

### Do:
- **Do** 每个画面先想它是哪一种地图，再决定面板是什么物件。
- **Do** 背景加上地图纹理：十字网格、水线、经纬网、纸纹、暗角、图名框。
- **Do** 朱橙只给「你」、能点的、正在发生的。
- **Do** 在 `preview.html` 里把所有画面放在几种手机尺寸下一起检查，再交给站主看。

### Don't:
- **Don't** 用素白方框或纯色平底当面板，看起来很简陋。一个物件如果除了标签什么都没加，就把它缩成按钮上的一个小图标。
- **Don't** 把立体拟物物件放进平面地图里。
- **Don't** 照搬 A 版的组件和画法。
- **Don't** 手改 `art.ts` 和 `globe.svg`，这些地图底图和几何数据是从设计稿生成的。
- **Don't** 用头像，玩家只用名字标识。
