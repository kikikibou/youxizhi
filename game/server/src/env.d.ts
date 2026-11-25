/** wrangler types 生成不到的绑定：用 `npm run secret:judge` 设置的密钥。 */
interface Env {
  /** OpenRouter 的 API key（Worker 密钥）。没有时裁判用兜底判定。 */
  OPENROUTER_API_KEY?: string;
}
