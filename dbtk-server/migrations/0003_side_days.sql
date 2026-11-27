-- 按天记站队：K 线下面的红绿柱是「当天看正 / 看反的有几台设备」。
-- 每台设备每只股每天一行，记它当天最后选的那一边（当天改主意只算最后一次）。
CREATE TABLE side_days (
  topic_id INTEGER NOT NULL,
  device TEXT NOT NULL,
  day TEXT NOT NULL,                    -- 北京时间 YYYY-MM-DD
  side TEXT NOT NULL,                   -- pro 看正 / con 看反
  PRIMARY KEY (topic_id, device, day)
);
CREATE INDEX side_days_topic ON side_days (topic_id, day);
