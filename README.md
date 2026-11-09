# YOUXIZHI · Territory of Reason

个人网站原型：辩论内容与工具、智力题、网页小游戏。视觉上是一个 3D 建筑广场，每个分页是一栋楼、一个机位，切换时镜头连续飞行过去；支持昼夜切换，云会流动。

## 运行

```bash
npm install
npm run dev
```

打开 http://localhost:5173 。构建静态文件：`npm run build`（输出在 `dist/`，可部署到任意静态托管）。

## 上线与口令门

推送到 `main` 分支后，GitHub Actions 会自动构建并发布到 GitHub Pages（见 `.github/workflows/deploy.yml`）。

目前站点前有一道口令门（`src/gate.js`），并设置了 `noindex` 不让搜索引擎收录。它只是"软门槛"：静态网站无法真正保密，懂行的人看源码就能绕过。正式公开时，把 `GATE_HASH` 设为 `''`，并删掉 `index.html` 里的 `robots` meta。

## 结构

| 文件 | 作用 |
| --- | --- |
| `src/pages.js` | **所有分页的内容与机位**：文案、卡片、底栏，以及每栋楼的镜头位置、路灯、3D 文字摆放 |
| `src/three/buildings.js` | 五栋建筑的几何（用盒子/圆柱拼装，按材质合并成少量网格） |
| `src/three/World.js` | 渲染器、灯光、昼夜过渡、镜头飞行、后期（泛光 + 颗粒 + 暗角） |
| `src/three/sky.js` | 天空着色器：渐变 + 两层流动云 + 夜间星星 |
| `src/three/props.js` | 路灯（白天是"夜色光柱"，夜晚是暖光）、树、飘带、地面 |
| `src/three/typography.js` | 3D 文字：落在光柱里是白色，光柱外是橙色 |
| `src/ui.js` / `src/style.css` | 海报风格的 HTML 叠层（导航、诗句块、笔刷标签、卡片、底栏、抽屉） |
| `src/tools/` | 具体工具：辩论计时器、每日一题 |

## 调机位

`src/pages.js` 里每页的 `scene.view` 用的是**该建筑的本地坐标**（+Z 朝向广场中心，y 是高度，单位米）：

- `pos` 相机位置，`target` 看向的点，`fov` 视角，`roll` 画面倾斜（弧度）
- `texts[].p / r` 3D 文字的位置与旋转；`c: 'cone'` 表示会被路灯光柱"反色"

## 新增一个工具

在 `src/tools/` 写一个 `mountXxx(el)`（渲染进抽屉，返回清理函数），在 `src/main.js` 的 `TOOLS` 里注册，然后在 `pages.js` 的卡片上写 `tool: 'xxx', ready: true`。
