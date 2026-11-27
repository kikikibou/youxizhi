/** wrangler types 生成不到的绑定：用 `npm run secret:*` 设置的密钥。本机开发时写在 .dev.vars 里。 */
interface Env {
  /** OpenRouter 的 API key。没有时投稿一律进人工审核队列。 */
  OPENROUTER_API_KEY?: string;
  /** Cloudflare Turnstile 的密钥。没有时不做人机验证（只该出现在本机开发）。 */
  TURNSTILE_SECRET?: string;
  /** 后台审核页的口令。没有时后台接口关闭。 */
  ADMIN_TOKEN?: string;
  /** 给 IP 做哈希用的盐。 */
  IP_SALT?: string;
  /** 审核提醒邮件的收件人（账号里验证过的目标地址）。没有时不发邮件。 */
  NOTIFY_TO?: string;
}
