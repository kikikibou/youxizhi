/**
 * 大辩题库的后端（线上地址 dbtk-api.yxzzxy.com），前端在 src/dbtk/。
 *
 *   GET  /board            行情：所有已上市的辩题，累计票数、本月票数、今天和昨天的票数、多空人数
 *   GET  /me               这台设备的状态：本月看涨过哪些、买入卖出了哪些、自己的投稿
 *   POST /vote             看涨（给辩题投一票）   { code }        每台设备每月每只股一票
 *   POST /side             买入 / 卖出            { code, side }  side = pro（支持正方）/ con（支持反方）
 *   POST /submit           申请上市（投稿）       { title, who, token }  token 是 Turnstile 的结果
 *   GET  /months           往月榜（最近 12 个月）
 *   GET  /admin/queue      后台：待审和最近处理的投稿          （Authorization: Bearer ADMIN_TOKEN）
 *   POST /admin/decide     后台：上市 / 退回 / 下市            { id, action, reason?, pro?, con? }
 *   POST /admin/close      后台：手动收盘某个月                { month }
 *
 * 设备用请求头 X-Device 识别（浏览器第一次来时随机生成）。IP 只存加盐哈希，用来限速。
 * 月榜只算当月新增的票，行情显示累计票数；日期和月份按北京时间。
 * 每天北京时间 00:05 的定时任务：逢 1 日把上个月收盘存进往月榜；还有没审的投稿就发一封汇总邮件。
 * 新投稿进待审队列时给站主发提醒邮件（notify.ts）。
 */

import { notifyPending } from './notify.ts';
import { review } from './review.ts';
import { bjDay, bjMonth, checkDraft, deviceOf, ipHash, monthLength, normalize, prevMonth, stance } from './text.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Device, Authorization',
  'Access-Control-Max-Age': '86400',
};

const CODE = /^DB\d{4,6}$/;
const BOARD_CACHE_SECONDS = 10;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store', ...extra } });
}

const fail = (error: string, status = 400) => json({ error }, status);

async function readBody(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get('Content-Length') || 0) > 8192) return {};
  const body = await req.json().catch(() => ({}));
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/** 计数限速：同一个 key 在 windowSec 秒的时间窗里超过 max 次就返回 true。 */
async function overLimit(env: Env, key: string, max: number, windowSec: number): Promise<boolean> {
  const win = Math.floor(Date.now() / 1000 / windowSec) * windowSec;
  const row = await env.DB.prepare(
    'INSERT INTO hits (key, win, n) VALUES (?1, ?2, 1) ON CONFLICT (key, win) DO UPDATE SET n = n + 1 RETURNING n',
  )
    .bind(key, win)
    .first<{ n: number }>();
  return (row?.n ?? 0) > max;
}

async function human(env: Env, token: unknown, req: Request): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) {
    console.warn('没配 TURNSTILE_SECRET，跳过人机验证');
    return true;
  }
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  const ip = req.headers.get('CF-Connecting-IP');
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const out = (await res.json()) as { success?: boolean };
    return out.success === true;
  } catch (e) {
    console.warn('Turnstile 校验失败', e instanceof Error ? e.name : e);
    return false;
  }
}

const boardKey = (url: URL) => new Request(new URL('/board', url.origin).toString());

/* ---------------------------------------------------------------- 读 */

type BoardRow = {
  code: string; title: string; who: string; pro: string; con: string; listed_at: number;
  votes: number; long_n: number; short_n: number; month_votes: number; today: number; yesterday: number;
};

async function board(env: Env) {
  const now = Date.now();
  const day = bjDay(now);
  const month = bjMonth(now);
  const yesterday = bjDay(now - 86400e3);
  const { results } = await env.DB.prepare(
    `SELECT t.code, t.title, t.who, t.pro, t.con, t.listed_at, t.votes, t.long_n, t.short_n,
            COALESCE(m.n, 0) AS month_votes, COALESCE(d1.n, 0) AS today, COALESCE(d0.n, 0) AS yesterday
       FROM topics t
       LEFT JOIN monthly m ON m.topic_id = t.id AND m.month = ?1
       LEFT JOIN daily d1 ON d1.topic_id = t.id AND d1.day = ?2
       LEFT JOIN daily d0 ON d0.topic_id = t.id AND d0.day = ?3
      WHERE t.status = 'listed'
      ORDER BY t.listed_at DESC
      LIMIT 1000`,
  )
    .bind(month, day, yesterday)
    .all<BoardRow>();
  return {
    now,
    day,
    month,
    monthLength: monthLength(month),
    topics: results.map((r) => ({
      code: r.code, title: r.title, who: r.who, pro: r.pro, con: r.con, listedAt: r.listed_at,
      votes: r.votes, monthVotes: r.month_votes, today: r.today, yesterday: r.yesterday, long: r.long_n, short: r.short_n,
    })),
  };
}

async function me(env: Env, device: string) {
  const month = bjMonth(Date.now());
  const [voted, sides, mine] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare('SELECT t.code FROM votes v JOIN topics t ON t.id = v.topic_id WHERE v.device = ?1 AND v.month = ?2').bind(device, month),
    env.DB.prepare('SELECT t.code, s.side FROM sides s JOIN topics t ON t.id = s.topic_id WHERE s.device = ?1').bind(device),
    env.DB.prepare(
      'SELECT title, status, code, reason, decided_by, created_at FROM topics WHERE device = ?1 ORDER BY created_at DESC LIMIT 5',
    ).bind(device),
  ]);
  return {
    voted: voted.results.map((r) => r.code),
    sides: Object.fromEntries(sides.results.map((r) => [r.code, r.side])),
    mine: mine.results.map((r) => ({
      title: r.title,
      status: r.status,
      code: r.code,
      // 待审提示是写给站主的，不给投稿人看
      reason: r.status === 'rejected' ? r.reason : '',
      createdAt: r.created_at,
    })),
  };
}

async function months(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT month, rank, code, title, who, gain FROM months
      WHERE month IN (SELECT DISTINCT month FROM months ORDER BY month DESC LIMIT 12)
      ORDER BY month DESC, rank ASC`,
  ).all<{ month: string; rank: number; code: string; title: string; who: string; gain: number }>();
  const out: { month: string; top: Omit<(typeof results)[number], 'month'>[] }[] = [];
  for (const { month, ...row } of results) {
    if (out.at(-1)?.month !== month) out.push({ month, top: [] });
    out.at(-1)!.top.push(row);
  }
  return { months: out };
}

/* ---------------------------------------------------------------- 写 */

async function listedId(env: Env, code: unknown): Promise<number | null> {
  if (typeof code !== 'string' || !CODE.test(code)) return null;
  const row = await env.DB.prepare("SELECT id FROM topics WHERE code = ?1 AND status = 'listed'").bind(code).first<{ id: number }>();
  return row?.id ?? null;
}

async function vote(env: Env, device: string, ip: string, body: Record<string, unknown>): Promise<Response> {
  const id = await listedId(env, body.code);
  if (!id) return fail('没有这只股，可能已经下市了', 404);
  const now = Date.now();
  const day = bjDay(now);
  const month = bjMonth(now);
  const ins = await env.DB.prepare(
    'INSERT OR IGNORE INTO votes (topic_id, device, month, day, ip_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
  )
    .bind(id, device, month, day, ip, now)
    .run();
  if (!ins.meta.changes) return json({ error: '这个月已经看涨过这只了', voted: true }, 409);
  await env.DB.batch([
    env.DB.prepare('UPDATE topics SET votes = votes + 1 WHERE id = ?1').bind(id),
    env.DB.prepare('INSERT INTO daily (topic_id, day, n) VALUES (?1, ?2, 1) ON CONFLICT (topic_id, day) DO UPDATE SET n = n + 1').bind(id, day),
    env.DB.prepare('INSERT INTO monthly (topic_id, month, n) VALUES (?1, ?2, 1) ON CONFLICT (topic_id, month) DO UPDATE SET n = n + 1').bind(id, month),
  ]);
  return json({ ok: true });
}

async function side(env: Env, device: string, body: Record<string, unknown>): Promise<Response> {
  const s = body.side;
  if (s !== 'pro' && s !== 'con') return fail('只能买入或卖出');
  const id = await listedId(env, body.code);
  if (!id) return fail('没有这只股，可能已经下市了', 404);
  const prev = await env.DB.prepare('SELECT side FROM sides WHERE topic_id = ?1 AND device = ?2').bind(id, device).first<{ side: string }>();
  if (prev?.side === s) return json({ ok: true });
  const dLong = (s === 'pro' ? 1 : 0) - (prev?.side === 'pro' ? 1 : 0);
  const dShort = (s === 'con' ? 1 : 0) - (prev?.side === 'con' ? 1 : 0);
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO sides (topic_id, device, side, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (topic_id, device) DO UPDATE SET side = ?3, updated_at = ?4',
    ).bind(id, device, s, Date.now()),
    env.DB.prepare('UPDATE topics SET long_n = MAX(0, long_n + ?2), short_n = MAX(0, short_n + ?3) WHERE id = ?1').bind(id, dLong, dShort),
  ]);
  return json({ ok: true });
}

/** 新的上市编号：已经分配过的编号个数 + 1（下市的也算，编号不回收）。 */
const NEXT_CODE = "printf('DB%04d', (SELECT COUNT(code) + 1 FROM topics))";

async function submit(env: Env, ctx: ExecutionContext, req: Request, device: string, ip: string, body: Record<string, unknown>): Promise<Response> {
  if ((await overLimit(env, `submit:${ip}`, 6, 3600)) || (await overLimit(env, `submit:${device}`, 6, 3600))) {
    return fail('递交得太勤了，歇一会儿再来', 429);
  }
  const draft = checkDraft(body.title, body.who);
  if ('error' in draft) return fail(draft.error);
  if (!(await human(env, body.token, req))) return fail('人机验证没通过，刷新页面再试一次', 403);

  const norm = normalize(draft.title);
  const dup = await env.DB.prepare(
    "SELECT code, status FROM topics WHERE norm = ?1 AND status IN ('listed', 'pending') LIMIT 1",
  )
    .bind(norm)
    .first<{ code: string | null; status: string }>();
  if (dup?.status === 'listed') return fail(`这只已经上市了：${dup.code}`, 409);
  if (dup) return fail('这道题已经有人递交了，正在审核', 409);

  // AI 初筛：每天有上限，超出、没配 key 或出错时进人工审核
  const day = bjDay(Date.now());
  const cap = Number(env.AI_DAILY_CAP) || 100;
  let verdict = null;
  if (env.OPENROUTER_API_KEY) {
    const used = await env.DB.prepare(
      'INSERT INTO ai_usage (day, n) VALUES (?1, 1) ON CONFLICT (day) DO UPDATE SET n = n + 1 RETURNING n',
    )
      .bind(day)
      .first<{ n: number }>();
    if ((used?.n ?? 0) <= cap) verdict = await review(env, draft.title, draft.who);
  }

  const status = verdict?.verdict === 'pass' ? 'listed' : verdict?.verdict === 'reject' ? 'rejected' : 'pending';
  const who = verdict && !verdict.whoOk ? '匿名' : draft.who;
  const reason = verdict ? verdict.reason : '';
  const now = Date.now();
  const row = await env.DB.prepare(
    `INSERT INTO topics (code, title, norm, who, pro, con, status, reason, decided_by, device, ip_hash, created_at, listed_at)
     VALUES (CASE WHEN ?7 = 'listed' THEN ${NEXT_CODE} END, ?1, ?2, ?3, ?4, ?5, ?7, ?6, ?8, ?9, ?10, ?11,
             CASE WHEN ?7 = 'listed' THEN ?11 END)
     RETURNING id, code`,
  )
    .bind(draft.title, norm, who, verdict?.pro ?? '', verdict?.con ?? '', reason, status, verdict && status !== 'pending' ? 'ai' : '', device, ip, now)
    .first<{ id: number; code: string | null }>();

  if (status === 'listed') return json({ status, code: row?.code });
  if (status === 'rejected') return json({ status, reason });
  ctx.waitUntil(notifyPending(env)); // 进了待审队列：给站主发提醒邮件
  return json({ status });
}

/* ---------------------------------------------------------------- 后台 */

function isAdmin(env: Env, req: Request): boolean {
  if (!env.ADMIN_TOKEN) return false;
  const got = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const a = new TextEncoder().encode(got);
  const b = new TextEncoder().encode(env.ADMIN_TOKEN);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function queue(env: Env) {
  const cols = 'id, code, title, who, pro, con, status, reason, decided_by, created_at, listed_at, votes';
  const [pending, recent] = await env.DB.batch([
    env.DB.prepare(`SELECT ${cols} FROM topics WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`),
    env.DB.prepare(`SELECT ${cols} FROM topics WHERE status != 'pending' ORDER BY created_at DESC LIMIT 60`),
  ]);
  return { pending: pending.results, recent: recent.results };
}

async function decide(env: Env, body: Record<string, unknown>): Promise<Response> {
  const id = Number(body.id);
  if (!Number.isInteger(id)) return fail('缺少 id');
  const now = Date.now();
  if (body.action === 'list') {
    const pro = typeof body.pro === 'string' ? stance(body.pro) : null;
    const con = typeof body.con === 'string' ? stance(body.con) : null;
    const row = await env.DB.prepare(
      `UPDATE topics SET status = 'listed', decided_by = 'admin', reason = '',
              listed_at = COALESCE(listed_at, ?2), code = COALESCE(code, ${NEXT_CODE}),
              pro = COALESCE(?3, pro), con = COALESCE(?4, con)
        WHERE id = ?1 RETURNING code`,
    )
      .bind(id, now, pro, con)
      .first<{ code: string }>();
    return row ? json({ ok: true, code: row.code }) : fail('没有这条', 404);
  }
  if (body.action === 'reject' || body.action === 'delist') {
    const status = body.action === 'reject' ? 'rejected' : 'delisted';
    const reason = typeof body.reason === 'string' ? [...body.reason.trim()].slice(0, 40).join('') : '';
    const r = await env.DB.prepare("UPDATE topics SET status = ?2, reason = ?3, decided_by = 'admin' WHERE id = ?1")
      .bind(id, status, reason || (status === 'rejected' ? '站主没让上市' : '已下市'))
      .run();
    return r.meta.changes ? json({ ok: true }) : fail('没有这条', 404);
  }
  return fail('action 只能是 list / reject / delist');
}

/** 收盘：把某个月新增票数的前十名存进往月榜。重复运行不会重复写入。 */
export async function closeMonth(env: Env, month: string): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT m.topic_id, m.n, t.code, t.title, t.who
       FROM monthly m JOIN topics t ON t.id = m.topic_id
      WHERE m.month = ?1 AND t.status = 'listed' AND m.n > 0
      ORDER BY m.n DESC, t.listed_at ASC
      LIMIT 10`,
  )
    .bind(month)
    .all<{ topic_id: number; n: number; code: string; title: string; who: string }>();
  if (!results.length) return 0;
  await env.DB.batch(
    results.map((r, i) =>
      env.DB.prepare('INSERT OR IGNORE INTO months (month, rank, topic_id, code, title, who, gain) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(
        month, i + 1, r.topic_id, r.code, r.title, r.who, r.n,
      ),
    ),
  );
  return results.length;
}

/* ---------------------------------------------------------------- 入口 */

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (path === '/') return new Response('dbtk ok', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

    try {
      if (path === '/board' && method === 'GET') {
        // 行情在边缘缓存 10 秒；有人写入时清掉
        const key = boardKey(url);
        const hit = await caches.default.match(key);
        if (hit) return json(await hit.json());
        const data = await board(env);
        ctx.waitUntil(
          caches.default.put(key, Response.json(data, { headers: { 'Cache-Control': `public, max-age=${BOARD_CACHE_SECONDS}` } })),
        );
        return json(data);
      }
      if (path === '/months' && method === 'GET') return json(await months(env));

      if (path.startsWith('/admin/')) {
        if (!env.ADMIN_TOKEN) return fail('后台没开（没配 ADMIN_TOKEN）', 503);
        if (!isAdmin(env, request)) return fail('口令不对', 401);
        if (path === '/admin/queue' && method === 'GET') return json(await queue(env));
        const body = method === 'POST' ? await readBody(request) : {};
        let res: Response | null = null;
        if (path === '/admin/decide' && method === 'POST') res = await decide(env, body);
        if (path === '/admin/close' && method === 'POST') {
          const month = typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month) ? body.month : prevMonth(bjMonth(Date.now()));
          res = json({ ok: true, month, saved: await closeMonth(env, month) });
        }
        if (res) {
          ctx.waitUntil(caches.default.delete(boardKey(url)));
          return res;
        }
        return fail('not found', 404);
      }

      const device = deviceOf(request);
      if (path === '/me' && method === 'GET') {
        if (!device) return fail('缺少设备号');
        return json(await me(env, device));
      }

      if (method === 'POST' && (path === '/vote' || path === '/side' || path === '/submit')) {
        if (!device) return fail('缺少设备号');
        const ip = await ipHash(request, env.IP_SALT || 'dbtk-dev');
        if (path !== '/submit' && (await overLimit(env, `trade:${ip}`, 300, 3600))) return fail('点得太快了，歇一会儿再来', 429);
        const body = await readBody(request);
        const res =
          path === '/vote' ? await vote(env, device, ip, body) : path === '/side' ? await side(env, device, body) : await submit(env, ctx, request, device, ip, body);
        if (res.ok) ctx.waitUntil(caches.default.delete(boardKey(url)));
        return res;
      }
    } catch (e) {
      console.error('出错了', e instanceof Error ? e.stack : e);
      return fail('行情系统出了点问题，稍后再试', 500);
    }

    return fail('not found', 404);
  },

  async scheduled(_event, env, ctx) {
    const now = Date.now();
    // 北京时间每月 1 日：上个月收盘
    if (bjDay(now).endsWith('-01')) ctx.waitUntil(closeMonth(env, prevMonth(bjMonth(now))).then((n) => console.log('收盘', n)));
    // 还有没审的投稿：发一封汇总邮件
    ctx.waitUntil(notifyPending(env, true));
    // 限速记录只留两天
    ctx.waitUntil(env.DB.prepare('DELETE FROM hits WHERE win < ?1').bind(Math.floor(now / 1000) - 2 * 86400).run());
  },
} satisfies ExportedHandler<Env>;
