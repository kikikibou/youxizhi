# 游戏之致西柚 · Jeu de pamplemousse

个人网站原型：辩论内容与工具、智力题、网页小游戏。视觉上是一个 3D 建筑广场，每个分页是一栋楼、一个机位，切换时镜头连续飞行过去；支持昼夜切换，云会流动。

## 运行

```bash
npm install
npm run dev
```

打开 http://localhost:5173 。构建静态文件：`npm run build`（输出在 `dist/`，可部署到任意静态托管）。

## 上线与口令门

推送到 `main` 分支后，GitHub Actions 会自动构建并发布到 GitHub Pages（见 `.github/workflows/deploy.yml`），网址是 https://yxzzxy.com 。

域名在 Cloudflare 注册，DNS 也在 Cloudflare：根域名的四条 A 记录指向 GitHub Pages（185.199.108–111.153），`www` 是指向 `kikikibou.github.io` 的 CNAME，都设为「DNS only」（灰色云朵），GitHub 才能自己签发 HTTPS 证书。自定义域名填在仓库的 Settings → Pages 里（构建用相对路径 `base: './'`，所以不需要 CNAME 文件，也不用改代码）。旧地址 kikikibou.github.io/youxizhi/ 会跳转过来。

目前站点前有一道口令门（`src/gate.js`），并设置了 `noindex` 不让搜索引擎收录。它只是"软门槛"：静态网站无法真正保密，懂行的人看源码就能绕过。正式公开时，把 `GATE_HASH` 设为 `''`，并删掉 `index.html` 里的 `robots` meta。

## 结构

| 文件 | 作用 |
| --- | --- |
| `src/pages.js` | **所有分页的内容与机位**：文案、卡片、底栏，以及每栋楼的镜头位置、路灯、3D 文字摆放 |
| `src/three/buildings.js` | 五栋建筑的几何（用盒子/圆柱拼装，按材质合并成少量网格） |
| `src/three/World.js` | 渲染器、灯光、昼夜过渡、镜头飞行、后期（一个合并的最终 pass：反差合成 + 泛光 + 色调映射 + 颗粒 + 暗角）、自适应分辨率 |
| `src/three/devices.js` | 每页的“反差装置”（路灯光锥、灯塔光束……）：遮罩形状决定哪里显示另一个时间 |
| `src/three/perf.js` | GPU 计时器与画质开关的默认值 |
| `src/debug.js` | 调试面板（见下） |
| `src/three/sky.js` | 天空着色器：渐变 + 两层流动云 + 夜间星星 |
| `src/three/props.js` | 路灯（白天是"夜色光柱"，夜晚是暖光）、树、飘带、地面 |
| `src/three/typography.js` | 3D 文字：落在光柱里是白色，光柱外是橙色 |
| `src/ui.js` / `src/style.css` | 海报风格的 HTML 叠层（导航、诗句块、笔刷标签、卡片、底栏、抽屉） |
| `src/tools/` | 具体工具：辩论计时器、每日一题 |

## 调机位

`src/pages.js` 里每页的 `scene.view` 用的是**该建筑的本地坐标**（+Z 朝向广场中心，y 是高度，单位米）：

- `pos` 相机位置，`target` 看向的点，`fov` 视角，`roll` 画面倾斜（弧度）
- 构图规则：把主路灯放在**矮楼**前面、上方是开阔天空，这样光柱上半段叠在天空上，下半段压在建筑上（参考海报）。光柱里显示的是“另一个时间”的整片场景（白天里是夜晚，夜晚里是白天）
- 开发模式下，在浏览器控制台运行 `__world.probeMask()` 可以量出当前页面光柱里有多少是天空；`__world.recompose(页序号, { view, lamp, cluster })` 可以实时调机位
- `texts[].p / r` 3D 文字的位置与旋转；`c: 'cone'` 表示会被路灯光柱"反色"

## 调试面板（帧率 / 分辨率 / 画质开关）

在网址后面加 `?debug`（例如 `https://yxzzxy.com/?debug#/about`）就会在左下角出现调试面板，这台设备会记住，之后不用再加；`?debug=0` 关掉。按 `` ` `` 或点面板标题可以收起。

- 显示：帧率、每帧耗时（含最慢一帧）、GPU 实际耗时（浏览器支持时）、显示器刷新率、当前分辨率占屏幕原生分辨率的百分比、绘制次数
- 分辨率：`自动`（默认，按 GPU 耗时升降，桌面端不低于每个 CSS 像素 1 个像素）或固定 100% / 85% / 70% / 50%
- 帧率上限：不限 / 60 / 30
- 效果开关：阴影、飘带、飘带影子、夜间光晕、抗锯齿、反差效果、颗粒/暗角
- 自动分辨率每次变化都会记在面板底部；“复制数据”可以把当前数据复制下来发给别人

## 配色方案（对比用）

`src/palettes.js` 里定义了几套配色（目前默认「西柚」，见 `DEFAULT_PALETTE`）：每套都包含场景（建筑材质、天空、云、海、灯光、3D 文字、反差装置）和页面 UI 的颜色，白天和夜晚各一份。「海报」是参考图的原版配色。

访客只会看到默认的「西柚」。打开调试模式（网址后加 `?debug`）后，右上角昼夜开关下面会出现切换按钮（也可以按 `P` 键轮换）；`?palette=<id>` 也能直接指定，这台设备会记住选择。

## 昼夜

默认跟随访客自己的时间：06:00–19:00 为白天，其余为夜晚，页面开着时到点会自动切换。手动点昼夜开关只管到下一个切换时刻（下一个 06:00 或 19:00），之后又回到跟随时间。

## 《大国小国》（`game/`）

「消遣」页的第一个多人游戏，规则以《大国小国》线上版规则与开发说明为准。手机页面在 https://yxzzxy.com/dgxg/ ，房间服务器在 https://api.yxzzxy.com （Cloudflare Worker + Durable Object，部署在拥有 yxzzxy.com 的账号下）。

- **裁判**：默认 AI 裁判，通过 OpenRouter 调用 Claude Opus 5.5（`game/server/src/judge.ts`，模型名在 `wrangler.jsonc` 的 `JUDGE_MODEL`）。key 是 Worker 密钥，在 `game/server` 里运行 `npm run secret:judge` 设置；没设置时猜词只认完全一致的写法，提问答「无法判断」。
- **主持人**：房主可以把一名成员设为主持人（不参与游戏）。主持人能自己出题（词对来源选「自带词」），或者手动判定（裁判方式选「主持人判定」），开局后在主持人台上看到两个词、所有人的身份和整局记录。
- **题库**：格式见 `game/题库模板.xlsx`（「说明」工作表写了每一列的意思）。真正的题库放在 `game/server/bank/`（.xlsx 或 UTF-8 的 .csv，可以多个文件），**这个文件夹不提交**——仓库是公开的，提交了答案就公开了。在 `game/server` 里运行 `npm run bank` 检查并生成 `src/bank.generated.ts`（同样不提交）；`npm run dev` / `npm run deploy` 前会自动运行，有错误就停下。没有题库文件时用规则文档里的 5 组示例词对。
- **页面预览**：https://yxzzxy.com/dgxg/preview.html 把每个画面（首页、大厅、各个游戏步骤、按住看身份、结算、主持人台）放进手机大小的框里并排看。数据是用真的规则引擎走一局 7 人游戏得到的（`game/client/preview-data.ts`），不连服务器；加场景就在 `SCENES` 里加一项。
- **视觉**：「图纸」风格，变量在 `game/client/style.css` 开头——白天珊瑚红为主、电光蓝为辅，夜晚（`html:has(.is-night)`）换成靛蓝底、蓝色为主；背景地图、转场标题卡、档案、结算揭晓等在 `style-layers.css`。面板是暖白的纸（`--card`）加一层很淡的纸纹（`--grain`，SVG 噪点）和右下角一小片网点；标题用粗宋体（`--serif`，Noto Serif SC）。标志在 `game/client/logo.tsx`：粗壮的「大」「小」两块（各是一整块，只留最少的缺口分出笔画）站在同一条地平线上，用透视让「大」在前、「小」在后，中间一刀斜劈开，上宽下窄的缝是国界。结算页把两个词直接摆在劈开的两块地上，联系是长按之后盖在缝脚上的一枚章。背景地图 `game/client/map.svg` 由 `python scripts/dgxg-map.py` 生成（可无缝平铺）。
- **头像**：大厅里手绘、挑一个或随机（24 个卡通默认头像：16 个人物 + 8 只小动物，`game/client/avatar-art.tsx`）；服务器单独发 `avatars` 消息，不放在每次的状态里。
- **题库**：一个表格文件就是一个题库（名字是文件名），也可以填「题库」列把一行归到别的题库；房主在大厅里勾选用哪几个。题目不再分难度（「难度」列可以不填）。
- **部署**：网页随 `main` 推送自动发布；服务器在 `game/server` 里手动 `npm run deploy`（会先检查题库）。这台电脑访问 Cloudflare 要走 IPv4，`game/server/.npmrc` 已经设好；重新登录用 `npm run login`。

| 文件 | 作用 |
| --- | --- |
| `game/engine/rules.ts` | 人数预设、房间自选项、各环节计时，以及规则文档第 13 节所有「默认」处理（注释里标着 §13-编号），改规则先看这里 |
| `game/engine/engine.ts` | 状态机：`createGame` 开局，`act` 玩家动作，`judge` 裁判判定，`advance` / `nextWake` 计时 |
| `game/engine/view.ts` | `viewFor(state, 玩家)`：每个玩家能看到的内容。发给手机的只能是它的结果 |
| `game/engine/words.ts` | 词对数据结构和猜词的精确匹配；`SAMPLE_PAIRS` 是规则文档里的 5 组测试词对 |
| `game/engine/test/` | 逐条规则的测试，和 252 局随机机器人对局（每一步检查有没有泄密） |

| `game/client/` | 手机页面（Preact）：`app.tsx` 首页和房间外壳，`lobby.tsx` 大厅，`game.tsx` 对局，`judge.tsx` 主持人台，`ui.tsx` 圆桌、护照等共用部件 |
| `game/shared/protocol.ts` | 手机和服务器之间的消息格式 |
| `game/server/` | 房间服务器：Cloudflare Worker + Durable Object（一个房间一个），有自己的 `package.json` |
| `game/server/src/room.ts` | 房间：成员、密码、房主、设置、累计得分；跑引擎，按人推送视图，用一个 alarm 驱动所有计时 |
| `game/server/src/bank.ts` | 题库，只在服务器上（打包进网页就能看到答案） |

```bash
# 联机测试新功能（头像、不限时 + 跳过等待、题库勾选、提前获胜阈值）：先开本机服务器
node --dns-result-order=ipv4first game/server/test/features.ts http://127.0.0.1:8788
npm test            # 跑引擎测试
npm run typecheck   # 类型检查（先在 game/server 里 npm install 和 npm run types）

# 本机跑房间服务器（也可以用 .claude/launch.json 里的 dgxg-server）
cd game/server && npm install && npm run dev -- --ip 127.0.0.1 --port 8788
# 另开一个终端，用 7 台模拟手机打几局
node game/server/test/smoke.ts http://127.0.0.1:8788 3
# 主持人 / 自带词 / 人工裁判 / AI 裁判的端到端测试
node game/server/test/moderator.ts http://127.0.0.1:8788 human
# AI 裁判的小测验（真实调用 OpenRouter，约 0.15 美元）
node --dns-result-order=ipv4first game/server/test/judge-eval.ts
```

房间号是 4 位数字，密码可选；第一个进房间的人是房主，房主掉线一分钟后自动交给最早加入的在线成员。手机凭 token 重连，回到原来的位置。房间闲置 24 小时后清除。

同桌模式（默认开）：夜晚所有存活玩家都在同样的面板上选人和方向，只有白板阵营的选择生效，免得「谁在夜里低头操作」暴露身份。

## 新增一个工具

在 `src/tools/` 写一个 `mountXxx(el)`（渲染进抽屉，返回清理函数），在 `src/main.js` 的 `TOOLS` 里注册，然后在 `pages.js` 的卡片上写 `tool: 'xxx', ready: true`。
