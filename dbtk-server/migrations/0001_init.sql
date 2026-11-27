-- 大辩题库：辩题（股）、看涨记录、按天和按月的票数、站队、往月榜、限速、AI 用量。
-- 日期和月份一律按北京时间（UTC+8）切。

CREATE TABLE topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,                     -- DB0001 起，上市时才分配，下市后也不回收
  title TEXT NOT NULL,
  norm TEXT NOT NULL,                   -- 去掉空白和标点的辩题，用来查重
  who TEXT NOT NULL,                    -- 题库人
  pro TEXT NOT NULL DEFAULT '',         -- 正方立场（AI 提炼或站主填）
  con TEXT NOT NULL DEFAULT '',         -- 反方立场
  status TEXT NOT NULL,                 -- pending 审核中 / listed 已上市 / rejected 退回 / delisted 下市
  reason TEXT NOT NULL DEFAULT '',      -- 退回原因（给投稿人看）或待审提示（给站主看）
  decided_by TEXT NOT NULL DEFAULT '',  -- ai / admin；还没判的是空
  device TEXT NOT NULL,                 -- 投稿设备
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  listed_at INTEGER,
  votes INTEGER NOT NULL DEFAULT 0,     -- 累计看涨
  long_n INTEGER NOT NULL DEFAULT 0,    -- 买入（支持正方）的人数
  short_n INTEGER NOT NULL DEFAULT 0    -- 卖出（支持反方）的人数
);
CREATE INDEX topics_status ON topics (status, listed_at);
CREATE INDEX topics_norm ON topics (norm);
CREATE INDEX topics_device ON topics (device, created_at);

-- 每台设备每月每只股一票（主键保证）。累计和按天按月的数字另有计数表，读行情时不用数这张表。
CREATE TABLE votes (
  topic_id INTEGER NOT NULL,
  device TEXT NOT NULL,
  month TEXT NOT NULL,                  -- YYYY-MM
  day TEXT NOT NULL,                    -- YYYY-MM-DD
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (topic_id, device, month)
);
CREATE INDEX votes_device ON votes (device, month);

CREATE TABLE daily (topic_id INTEGER NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (topic_id, day));
CREATE INDEX daily_day ON daily (day);
CREATE TABLE monthly (topic_id INTEGER NOT NULL, month TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (topic_id, month));
CREATE INDEX monthly_month ON monthly (month, n);

-- 买入 / 卖出：每台设备每只股一个立场，可以改，不分月。
CREATE TABLE sides (
  topic_id INTEGER NOT NULL,
  device TEXT NOT NULL,
  side TEXT NOT NULL,                   -- pro / con
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (topic_id, device)
);
CREATE INDEX sides_device ON sides (device);

-- 往月榜：每月 1 日收盘时存下上个月新增票数的前十名。
CREATE TABLE months (
  month TEXT NOT NULL,
  rank INTEGER NOT NULL,
  topic_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  who TEXT NOT NULL,
  gain INTEGER NOT NULL,
  PRIMARY KEY (month, rank)
);

-- 限速：key 是「动作:IP 哈希」或「动作:设备」，win 是时间窗的起点（秒）。
CREATE TABLE hits (key TEXT NOT NULL, win INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (key, win));

-- AI 初筛每天调用了几次。
CREATE TABLE ai_usage (day TEXT PRIMARY KEY, n INTEGER NOT NULL);
