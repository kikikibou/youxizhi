/**
 * 裁判。引擎自己先做精确匹配，命中的猜词不会走到这里；剩下的猜词和所有提问由这里判定。
 *
 * 现在（M2）只有兜底：猜词判错、提问答「无法判断」，和 §8.3 里 LLM 调用失败时的处理一样。
 * M4 在这里接上 LLM 裁判。人类裁判模式下房间不调用这里，等裁判手动判定。
 */

import type { GameState, GuessVerdict, JudgeRequest, QuestionVerdict } from '../../engine/index.ts';

export async function decide(_env: Env, req: JudgeRequest, _game: GameState): Promise<GuessVerdict | QuestionVerdict> {
  return fallbackVerdict(req);
}

export function fallbackVerdict(req: JudgeRequest): GuessVerdict | QuestionVerdict {
  return req.kind === 'guess' ? 'wrong' : 'unknown';
}
