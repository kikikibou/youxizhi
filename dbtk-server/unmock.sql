-- 去掉模拟数据，只留真实的：所有计数都按真实的看涨记录（votes）和站队记录（sides）重算。
-- 12 月开始宣传前跑一次：npm run db:unmock:remote
DELETE FROM side_days WHERE device LIKE 'mock-%';
DELETE FROM sides WHERE device LIKE 'mock-%';
DELETE FROM daily;
INSERT INTO daily (topic_id, day, n) SELECT topic_id, day, SUM(n) FROM votes GROUP BY topic_id, day;
DELETE FROM monthly;
INSERT INTO monthly (topic_id, month, n) SELECT topic_id, month, SUM(n) FROM votes GROUP BY topic_id, month;
UPDATE topics SET
  votes = COALESCE((SELECT SUM(n) FROM votes WHERE votes.topic_id = topics.id), 0),
  long_n = (SELECT COUNT(*) FROM sides WHERE sides.topic_id = topics.id AND side = 'pro'),
  short_n = (SELECT COUNT(*) FROM sides WHERE sides.topic_id = topics.id AND side = 'con');
-- 11 月的往月榜是用模拟数据收的盘，一起清掉
DELETE FROM months WHERE month < '2026-12';
