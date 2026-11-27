/**
 * 有投稿等站主审核时发邮件提醒（Cloudflare Email Service 的 send_email 绑定）。
 *
 * - 发件人 NOTIFY_FROM（wrangler.jsonc）：必须是账号里开通了 Email Sending 的域名下的地址。
 *   现在用的是 debatestone.com（攻错的客服邮箱已经开通过）。
 * - 收件人 NOTIFY_TO（密钥，npm run secret:notify）：免费套餐只能发给账号里验证过的目标地址，
 *   也就是 Email Routing 里验证过的那个 QQ 邮箱。
 * - 新投稿进待审队列时发一封，30 分钟内最多一封；每天北京时间 00:05 如果还有没审的，再发一封汇总。
 * - 没配 NOTIFY_TO 或发送失败：只记日志，不影响投稿。
 */

const WINDOW = 1800; // 30 分钟

type Pending = { title: string; who: string; reason: string; created_at: number };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function when(ms: number): string {
  const d = new Date(ms + 8 * 3600e3);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** 写邮件正文（纯函数，方便测试）。 */
export function compose(total: number, items: Pending[], adminUrl: string, daily: boolean) {
  const subject = daily ? `【大辩题库】还有 ${total} 条投稿没审` : `【大辩题库】有 ${total} 条投稿等你审核`;
  const lines = items.map((t) => `· ${t.title}（题库人 ${t.who}，${when(t.created_at)}）${t.reason ? `\n  AI：${t.reason}` : ''}`);
  const more = total > items.length ? `\n……还有 ${total - items.length} 条` : '';
  const text = `${daily ? '今天还有这些投稿没审：' : '有新投稿等你审核：'}\n\n${lines.join('\n')}${more}\n\n去审核：${adminUrl}\n`;
  const html = `<p>${daily ? '今天还有这些投稿没审：' : '有新投稿等你审核：'}</p><ul>${items
    .map(
      (t) =>
        `<li><b>${esc(t.title)}</b><br><small>题库人 ${esc(t.who)}，${when(t.created_at)}${t.reason ? `<br>AI：${esc(t.reason)}` : ''}</small></li>`,
    )
    .join('')}</ul>${more ? `<p>${esc(more.trim())}</p>` : ''}<p><a href="${esc(adminUrl)}">去审核</a></p>`;
  return { subject, text, html };
}

/** daily：每天的汇总，不受 30 分钟限制。 */
export async function notifyPending(env: Env, daily = false): Promise<void> {
  if (!env.NOTIFY_TO || !env.NOTIFY_FROM) return;
  try {
    if (!daily) {
      // 30 分钟一个窗口，窗口里第一条新投稿才发
      const win = Math.floor(Date.now() / 1000 / WINDOW) * WINDOW;
      const row = await env.DB.prepare(
        "INSERT INTO hits (key, win, n) VALUES ('notify', ?1, 1) ON CONFLICT (key, win) DO UPDATE SET n = n + 1 RETURNING n",
      )
        .bind(win)
        .first<{ n: number }>();
      if ((row?.n ?? 0) > 1) return;
    }
    const [count, list] = await env.DB.batch<Record<string, unknown>>([
      env.DB.prepare("SELECT COUNT(*) AS n FROM topics WHERE status = 'pending'"),
      env.DB.prepare("SELECT title, who, reason, created_at FROM topics WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10"),
    ]);
    const total = Number(count.results[0]?.n ?? 0);
    if (!total) return;
    const mail = compose(total, list.results as Pending[], env.ADMIN_URL || 'https://yxzzxy.com/dbtk/admin.html', daily);
    await env.EMAIL.send({
      to: env.NOTIFY_TO,
      from: { email: env.NOTIFY_FROM, name: '大辩题库' },
      ...mail,
    });
  } catch (e) {
    console.warn('审核提醒邮件没发出去', e instanceof Error ? e.message : e);
  }
}
