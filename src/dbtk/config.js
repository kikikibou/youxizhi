/**
 * 大辩题库前端连哪个后端（dbtk-server/）。
 * - 地址栏加 ?api=… 可以临时指定；
 * - 本机开发连 wrangler dev（127.0.0.1:8789，见 .claude/launch.json 的 dbtk-server）；
 * - 线上连 dbtk-api.yxzzxy.com。
 */
const q = new URLSearchParams(location.search);
export const API = q.get('api') || (import.meta.env.DEV ? 'http://127.0.0.1:8789' : 'https://dbtk-api.yxzzxy.com');

/**
 * Cloudflare Turnstile 的站点密钥（公开的，不是密码）。
 * 开发时用 Cloudflare 官方的「永远通过」测试密钥，后端 .dev.vars 里配的是对应的测试 secret。
 * 线上用 Cloudflare 里的「大辩题库」Turnstile 组件（地区 Rest of World，域名 yxzzxy.com，Managed）。
 * 对应的 secret 存在 Worker 的 TURNSTILE_SECRET 里。
 */
export const TURNSTILE_SITEKEY = import.meta.env.DEV ? '1x00000000000000000000AA' : '0x4AAAAAAGVqLzT7BnoffeNo';
