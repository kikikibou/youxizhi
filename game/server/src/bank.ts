/**
 * 题库。只存在服务器上：打包进网页的话，看源码就能看到答案。
 *
 * 内容来自 game/server/bank/ 里的表格（格式见 game/题库模板.xlsx），由 `npm run bank` 生成
 * bank.generated.ts；两者都不提交到 git（仓库是公开的）。没有导入题库时，用规则文档里的 5 组示例词对。
 */

import { SAMPLE_PAIRS, type WordPair } from '../../engine/index.ts';
import { BANK_DATA } from './bank.generated.ts';

export const BANK: readonly WordPair[] = BANK_DATA.length ? BANK_DATA : SAMPLE_PAIRS;
export const BANK_IS_SAMPLE = BANK_DATA.length === 0;

function pool(difficulty: 1 | 2 | 3 | 'random', exclude: Set<string>): WordPair[] {
  return BANK.filter((p) => !exclude.has(p.id) && (difficulty === 'random' || p.difficulty === difficulty));
}

/** 按难度抽一条，排除房间里任何人见过的（§13-16）。没有可用的返回 null。 */
export function pickPair(difficulty: 1 | 2 | 3 | 'random', exclude: Set<string>, random: () => number): WordPair | null {
  const p = pool(difficulty, exclude);
  if (!p.length) return null;
  return p[Math.floor(random() * p.length)];
}

/** 当前难度下题库共几组、排除见过的之后还剩几组（大厅里显示）。 */
export function bankCounts(difficulty: 1 | 2 | 3 | 'random', exclude: Set<string>): { total: number; left: number } {
  return { total: pool(difficulty, new Set()).length, left: pool(difficulty, exclude).length };
}
