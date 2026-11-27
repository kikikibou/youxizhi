-- 只给本机开发用的示例行情（npm run db:seed:local）。不要用在线上。
DELETE FROM topics; DELETE FROM daily; DELETE FROM monthly; DELETE FROM months; DELETE FROM votes; DELETE FROM sides; DELETE FROM hits; DELETE FROM ai_usage; DELETE FROM sqlite_sequence WHERE name = 'topics';
INSERT INTO topics (id, code, title, norm, who, pro, con, status, decided_by, device, ip_hash, created_at, listed_at, votes, long_n, short_n) VALUES (1, 'DB0001', '手机掉进马桶，应该先捞手机还是先提裤子', '手机掉进马桶应该先捞手机还是先提裤子', '匿名二辩', '先捞手机', '先提裤子', 'listed', 'ai', 'seed-device-0000000', 'seed', 1791604800000, 1791604800000, 1284, 412, 298);
INSERT INTO daily (topic_id, day, n) VALUES (1, '2026-11-27', 143), (1, '2026-11-26', 127);
INSERT INTO monthly (topic_id, month, n) VALUES (1, '2026-11', 520);
INSERT INTO topics (id, code, title, norm, who, pro, con, status, decided_by, device, ip_hash, created_at, listed_at, votes, long_n, short_n) VALUES (2, 'DB0002', '孙悟空打妖怪的开销，能不能找唐僧报销', '孙悟空打妖怪的开销能不能找唐僧报销', '西天财务部', '能报销', '不能报销', 'listed', 'ai', 'seed-device-0000000', 'seed', 1792468800000, 1792468800000, 731, 224, 126);
INSERT INTO daily (topic_id, day, n) VALUES (2, '2026-11-27', 25), (2, '2026-11-26', 24);
INSERT INTO monthly (topic_id, month, n) VALUES (2, '2026-11', 380);
INSERT INTO topics (id, code, title, norm, who, pro, con, status, decided_by, device, ip_hash, created_at, listed_at, votes, long_n, short_n) VALUES (3, 'DB0003', '周一应当被开除出一周', '周一应当被开除出一周', '不想上班的一辩', '该开除', '不该开除', 'listed', 'ai', 'seed-device-0000000', 'seed', 1794024000000, 1794024000000, 963, 355, 145);
INSERT INTO daily (topic_id, day, n) VALUES (3, '2026-11-27', 88), (3, '2026-11-26', 80);
INSERT INTO monthly (topic_id, month, n) VALUES (3, '2026-11', 963);
INSERT INTO topics (id, code, title, norm, who, pro, con, status, decided_by, device, ip_hash, created_at, listed_at, votes, long_n, short_n) VALUES (4, 'DB0004', '外星人降落地球，应该先见联合国秘书长还是先见小区保安', '外星人降落地球应该先见联合国秘书长还是先见小区保安', '小区保安老李', '先见秘书长', '先见保安', 'listed', 'ai', 'seed-device-0000000', 'seed', 1794974400000, 1794974400000, 402, 46, 154);
INSERT INTO daily (topic_id, day, n) VALUES (4, '2026-11-27', 54), (4, '2026-11-26', 55);
INSERT INTO monthly (topic_id, month, n) VALUES (4, '2026-11', 402);
INSERT INTO topics (id, code, title, norm, who, pro, con, status, decided_by, device, ip_hash, created_at, listed_at, votes, long_n, short_n) VALUES (5, 'DB0005', '半夜想到绝妙论点，该不该打电话叫醒队友', '半夜想到绝妙论点该不该打电话叫醒队友', '凌晨三点的四辩', '该叫醒', '不该叫醒', 'listed', 'ai', 'seed-device-0000000', 'seed', 1795579200000, 1795579200000, 188, 49, 51);
INSERT INTO daily (topic_id, day, n) VALUES (5, '2026-11-27', 94), (5, '2026-11-26', 50);
INSERT INTO monthly (topic_id, month, n) VALUES (5, '2026-11', 188);
INSERT INTO monthly (topic_id, month, n) VALUES (1, '2026-10', 764), (2, '2026-10', 351);
INSERT INTO months (month, rank, topic_id, code, title, who, gain) VALUES ('2026-10', 1, 1, 'DB0001', '手机掉进马桶，应该先捞手机还是先提裤子', '匿名二辩', 764), ('2026-10', 2, 2, 'DB0002', '孙悟空打妖怪的开销，能不能找唐僧报销', '西天财务部', 351);
