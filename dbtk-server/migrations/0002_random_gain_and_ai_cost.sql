-- 看涨一次加的票数改成 1~99 的随机数：每条看涨记录记下这一次加了多少。
-- 之前的记录都是一次一票。
ALTER TABLE votes ADD COLUMN n INTEGER NOT NULL DEFAULT 1;

-- AI 初筛每天花了多少钱（美元，来自 OpenRouter 返回的 usage.cost）。
ALTER TABLE ai_usage ADD COLUMN cost REAL NOT NULL DEFAULT 0;
