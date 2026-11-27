/** 时间（北京时间）和投稿文字的处理。都是纯函数，方便测试。 */

const BJ = 8 * 3600e3; // 北京时间 UTC+8，没有夏令时

/** 北京时间的日期 YYYY-MM-DD。 */
export function bjDay(ms: number): string {
  return new Date(ms + BJ).toISOString().slice(0, 10);
}

/** 北京时间的月份 YYYY-MM。 */
export function bjMonth(ms: number): string {
  return bjDay(ms).slice(0, 7);
}

/** 这个月有几天。 */
export function monthLength(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 到今天为止最近 n 天（北京时间），从早到晚。 */
export function recentDays(ms: number, n: number): string[] {
  return Array.from({ length: n }, (_, i) => bjDay(ms - (n - 1 - i) * 86400e3));
}

export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** 空白（含换行）压成一个空格，再去掉控制字符和零宽字符，去掉首尾空白。 */
export function clean(s: unknown): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '')
    .trim();
}

/** 查重用：去掉所有空白、标点和符号，英文转小写。 */
export function normalize(s: string): string {
  return s.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
}

export const len = (s: string) => [...s].length;

export const TITLE_MIN = 4;
export const TITLE_MAX = 60;
export const WHO_MAX = 12;
export const STANCE_MAX = 8;

export type Draft = { title: string; who: string };

/** 检查投稿，返回整理好的辩题和题库人，或者一句给投稿人看的错误。 */
export function checkDraft(title: unknown, who: unknown): Draft | { error: string } {
  const t = clean(title);
  const w = clean(who);
  if (len(t) < TITLE_MIN) return { error: `辩题至少写 ${TITLE_MIN} 个字` };
  if (len(t) > TITLE_MAX) return { error: `辩题最多 ${TITLE_MAX} 个字，现在是 ${len(t)} 个` };
  if (len(normalize(t)) < 2) return { error: '辩题得有点正经的字' };
  if (len(w) > WHO_MAX) return { error: `题库人最多 ${WHO_MAX} 个字` };
  return { title: t, who: w || '匿名' };
}

/** AI 给的正反方立场：去掉多余的字，太长的截断。 */
export function stance(s: unknown): string {
  const t = clean(s).replace(/^(正方|反方)[:：]?/, '');
  return [...t].slice(0, STANCE_MAX).join('');
}

/** 设备号：浏览器第一次来时随机生成的一串字，存在它自己的 localStorage 里。 */
export function deviceOf(req: Request): string | null {
  const d = req.headers.get('X-Device') || '';
  return /^[A-Za-z0-9_-]{16,64}$/.test(d) ? d : null;
}

/** IP 只存加盐哈希，不存原始地址。 */
export async function ipHash(req: Request, salt: string): Promise<string> {
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}
