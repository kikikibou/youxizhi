---
name: 解码与三国知识问答 · 水墨舆图
description: 一张铺在缓缓漂移的三国舆图上的解码工作纸：挂轴、封缄的信、版刻框里的题、钉在字上的纸条、朱红印章。
colors:
  zhu: "#b5321f"
  frame: "rgba(161,54,33,0.72)"
  pen: "#1f2f5c"
  silk: "#3c5753"
  wood: "#4f301f"
  map: "#ece2c8"
  paper: "#fbf6ea"
  paper-2: "#f3ead4"
  kraft: "#e6d4a6"
  ink: "#2b2622"
  ink-soft: "#625a51"
  slip: "#f2d98a"
  slip-edge: "#bf9634"
  slip-2: "#dde7ee"
  slip-2-edge: "#7f99ad"
  marker: "rgba(255,193,7,0.45)"
typography:
  display:
    fontFamily: "Noto Serif SC Variable, Noto Serif SC, Songti SC, SimSun, serif"
    fontWeight: 900
  body:
    fontFamily: "Noto Serif SC Variable, Noto Serif SC, Songti SC, SimSun, serif"
  mono:
    fontFamily: "Space Mono, Courier New, Consolas, monospace"
    fontWeight: 700
---

# Design System: 解码与三国知识问答 · 水墨舆图

## Overview

**Creative North Star: "舆图上的解码工作纸"**

**取材来源：** 古籍与书画 · 水墨舆图、刻本版框、挂轴、封缄信札、朱印

背景是一张水墨画的三国舆图（`map.js`），沿着利萨如曲线缓缓平移，上面飘着几道雾带，四周压一圈暗角。标题是一幅挂轴；两套题是两封封缄的信，封条横贯信封，打开时撕开；题目印在纸上，外面是双线版刻框；玩家的解读写成纸条，钉在字的上方；解出来的格子盖朱红印章。

它是《游戏之致西柚》小镇里的一扇门，和小镇无关：不用西柚红，不用海报排印，也不用票根组件。这份文件管 `src/sgjm/` 和 `sgjm/index.html`。小镇登机牌的「印章」存根和「晕墨」起飞转场借用了这里的颜色，那是门口的桥，不是反过来。

**Key Characteristics:**
- 宣纸、牛皮纸、版刻框、朱砂印，都是纸和墨的物件。
- 全部用宋体（Noto Serif SC），标题用 900；编号、按钮和小标签用 Space Mono。
- 玩家自己写的字用靛蓝「笔」色 (#1f2f5c)，和印刷的墨色分开。
- 阴影是暖棕色，透明度 0.26–0.3，像纸放在纸上。

## Colors

旧纸、墨和朱砂，加上挂轴的青绿绫和木轴。

### Primary
- **朱砂** (#b5321f)：印章、已解的格子、关键标记。版刻框用半透明的朱框色。

### Secondary
- **笔靛** (#1f2f5c)：玩家写下的字，以及下划线输入框里的字。

### Tertiary
- **青绫** (#3c5753) 和 **木轴** (#4f301f)：挂轴的绫子和轴头。
- **纸条黄** (#f2d98a) 和 **纸条蓝** (#dde7ee)，各带一条深色边：钉在字上方的两种纸条。荧光笔扫过用半透明黄。

### Neutral
- **舆图底** (#ece2c8)、**纸** (#fbf6ea / #f3ead4)、**牛皮纸** (#e6d4a6)：底和各种纸面。
- **墨** (#2b2622) 和 **淡墨** (#625a51)：印刷的字和线。
- 舆图上的三国用色（魏蓝、蜀绿、吴赭）只出现在地图画布里。

## Typography

**Display Font:** Noto Serif SC Variable 900
**Body Font:** Noto Serif SC Variable
**Label/Mono Font:** Space Mono 400 / 700

**Character:** 像刻本一样的宋体，配打字机等宽字做编号和按钮，读起来是古籍上叠了一层现代的解码笔记。

## Elevation & Depth

纸叠在纸上。只用暖棕色的柔和投影（rgba(70,48,22,0.26–0.3)），没有冷灰阴影，也没有毛玻璃。题纸打开时从 `rotateX(-14deg)` 翻下来。

## Shapes

纸是直角。题纸外面是双线版刻框（2.5px 加 1px，朱框色）。印章是 3px 的双线章，歪着盖（−4° 到 −8°），边缘用 `--holes` 噪点蒙版做出磨损。挂轴两端是带铜头的木轴。

## Components

### 挂轴 Hanging Scroll
标题用一幅挂轴：青绿绫上下各一根木轴，轴头是铜色。

### 封缄的信 Sealed Letter
每套题装在一封牛皮纸信里，一条纸封条横贯信封，打开时撕开。

### 题纸 Question Sheet
纸面加双线版刻框，打开时翻下来。

### 纸条与印章 Slips & Seals
玩家的解读写成黄色或蓝色的纸条，钉在字的上方；荧光笔会扫过关键字；解出来的格子盖一枚歪着的朱红印章。

### Inputs / Fields
只有一条下划线，字用笔靛色。

## Do's and Don'ts

### Do:
- **Do** 新加的界面也做成纸和墨的物件（信、纸条、印章、版框），用宋体。
- **Do** 玩家写的内容用笔靛色，印刷的内容用墨色。
- **Do** 阴影用暖棕色。

### Don't:
- **Don't** 用素白方框当面板。
- **Don't** 引入小镇的西柚红、Anton、Oswald 或票根组件。
- **Don't** 加冷灰色的阴影或毛玻璃。
- **Don't** 把答案写进仓库：答案稿在 `文案/`，那里不提交。
