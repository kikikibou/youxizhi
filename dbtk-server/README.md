# 大辩题库后端（dbtk-server）

Cloudflare Worker 加 D1 数据库，线上地址 `dbtk-api.yxzzxy.com`。前端在 `src/dbtk/`，页面是 `/dbtk/` 和后台 `/dbtk/admin.html`。

## 它管什么

- **行情**：已上市的辩题，累计票数、本月票数、今天和昨天的票数、多空人数。
- **看涨**：给辩题投票，一次随机加 1~99 票（后端摇号，记在 votes.n）。每台设备每月每只股一次，下个月可以再投。行情显示累计票数，月榜只算本月新增。
- **站队**：看正 / 看反。每台设备每只股一个立场，可以改，不分月；另外按天记下每台设备当天最后选的那一边（side_days），K 线下面的红绿柱用它。
- **K 线**：`/history?code=` 给近 14 天每天新增的票数和当天看正 / 看反的设备数，边缘缓存 30 秒，有人看涨或站队就清掉。
- **申请上市**：投稿。先过 Turnstile 人机验证和限速，再查重，然后 AI 初筛：
  - 放行 → 直接上市，分配 DB 编号；但每天最多自动上市 30 只（`LIST_DAILY_CAP`），满了的进待审队列，站主点上市才上市（防灌水）；
  - 无意义或明显越过底线 → 退回，投稿人能看到原因；
  - 拿不准、点名攻击真实的人（公众人物也算）、取笑贬低某个人群这类可能让人不快的，以及 AI 当天额度用完、没配 AI key、AI 出错 → 进待审队列，等站主在后台处理。
- **收盘**：每天北京时间 00:05 的定时任务，逢 1 日把上个月本月新增票数的前十名存进往月榜。辩题本身不动，接着交易。
- **后台**：待审列表、上市 / 退回 / 下市，本月 AI 初筛的次数和花费（OpenRouter 返回的 usage.cost，记在 ai_usage.cost），用 `ADMIN_TOKEN` 口令。
- **测试邮件**：后台有个「发测试邮件」按钮（`POST /admin/test-email`），给收件邮箱发一封，确认提醒邮件能送到。
- **审核提醒邮件**：新投稿进待审队列时给站主发一封（30 分钟内最多一封）；每天 00:05 还有没审的就再发一封汇总。发件人 `dbtk@debatestone.com`（debatestone.com 已开通 Cloudflare Email Sending），收件人是密钥 `NOTIFY_TO`。免费套餐只能发给账号里验证过的目标地址（Email Routing 里验证过的 QQ 邮箱就是）。

设备用请求头 `X-Device` 识别（浏览器第一次来时随机生成，存在它自己的 localStorage）。IP 只存加盐哈希，用来限速：每个 IP 每小时最多看涨和买卖 300 次，每个 IP、每台设备每小时最多投稿 6 次。日期和月份一律按北京时间。

接口清单见 `src/index.ts` 开头的注释，表结构见 `migrations/0001_init.sql`，AI 初筛的提示词见 `src/review.ts`。

## 本机开发

```
cd dbtk-server
npm install
copy .dev.vars.example .dev.vars
npm run db:local          # 建表（本机的 D1）
npm run db:seed:local     # 可选：灌五条示例行情
npm run dev               # http://127.0.0.1:8789
```

前端 `npm run dev`（项目根目录）在开发模式下自动连 `127.0.0.1:8789`，Turnstile 用 Cloudflare 的测试密钥（永远通过）。后台口令是 `.dev.vars` 里的 `dev-admin-token`。

`.dev.vars` 里不填 `OPENROUTER_API_KEY` 时，投稿都进待审队列。

测试：根目录 `npx vitest run dbtk-server`；类型检查：先 `npm run types`（生成 worker-configuration.d.ts，不进仓库），再 `npm run check`。

## 部署（第一次）

这台电脑的 wrangler 要走 IPv4，`.npmrc` 已经配好；用 `npm run …` 跑就行。下面的命令都在 `dbtk-server` 目录里运行。

1. 登录：`npm run whoami`，没登录就 `npm run login`（把打印出来的网址在浏览器里打开）。
2. 建数据库：`npx wrangler d1 create dbtk`，把打印出的 `database_id` 填进 `wrangler.jsonc`。
3. 建表、放开盘的五条示例辩题：`npm run db:remote`，然后 `npm run db:seed:remote`。
4. 部署：`npm run deploy`。`dbtk-api.yxzzxy.com` 会自动建好域名记录。
5. Turnstile：在 Cloudflare 后台左侧找到 **Turnstile**，**Add widget**：
   - Widget name：`大辩题库`；
   - Region：**Rest of World**（选 China 要先找 Cloudflare 开通；建好不能改）；
   - Hostname：`yxzzxy.com`（会连同所有子域名一起生效）；
   - Widget mode：**Managed**；Pre-clearance：不开。
   - 建好后把 **Site Key** 填进 `src/dbtk/config.js` 的 `TURNSTILE_SITEKEY`；**Secret Key** 用 `npm run secret:turnstile` 存进 Worker。
6. 密钥（每条命令会提示 `Enter a secret value`，粘贴后回车；输入的内容不会显示）：
   - `npm run secret:ai`：OpenRouter 的 key（openrouter.ai → Keys → Create Key，建议设一个额度上限）；
   - `npm run secret:admin`：后台口令，用一串长的随机字符，自己保存好；
   - `npm run secret:notify`：审核提醒的收件邮箱（账号里验证过的那个）；
   - `npm run secret:salt`：IP 哈希的盐，随便一串随机字符，设好以后别改。
7. 前端：推送到 `main`，GitHub Pages 自动发布。

以后改了表结构，加一个新的 `migrations/000N_*.sql`，再跑 `npm run db:remote`。

## 模拟行情（宣传前）

网站 12 月才开始宣传，之前线上放了一份模拟行情，K 线和月榜不至于空着：`npm run db:mock:remote`（`mock.sql`）。

- 模拟的数字只进计数（每天和每月的票数、累计票数、多空人数），不进真实的看涨记录；站队用 `mock-` 开头的设备号。
- 开始宣传前运行一次 `npm run db:unmock:remote`（`unmock.sql`）：去掉 `mock-` 设备，按真实的看涨和站队记录把所有计数重算一遍，再删掉 12 月之前的往月榜（11 月是用模拟数据收的盘）。之后的数字就全是真的了。
- `mock.sql` 开头先做同样的重算，所以重复执行不会翻倍。生成它的脚本没进仓库，要改模拟数据直接改 `mock.sql` 也行。

## 费用

- Worker 和 D1 都在免费额度内：读行情时每只股只读几行计数（不数投票记录），行情在边缘缓存 10 秒。
- AI 初筛：默认 `anthropic/claude-haiku-5.5`（OpenRouter），每条投稿约 800 个输入 token、300 个输出 token，大约 0.002 元；每天最多 100 次（`AI_DAILY_CAP`），超出的进待审队列。换模型改 `wrangler.jsonc` 的 `AI_MODEL`。
