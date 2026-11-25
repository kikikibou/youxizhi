/**
 * 题库。只存在服务器上：打包进网页的话，看源码就能看到答案。
 * 正式题库另行整理（§9），现在先用规则文档里的 5 组测试词对。
 */

import { SAMPLE_PAIRS, type WordPair } from '../../engine/index.ts';

export const BANK: readonly WordPair[] = SAMPLE_PAIRS;

/** 按难度抽一条，排除房间里任何人见过的（§13-16）。没有可用的返回 null。 */
export function pickPair(difficulty: 1 | 2 | 3 | 'random', exclude: Set<string>, random: () => number): WordPair | null {
  const pool = BANK.filter((p) => !exclude.has(p.id) && (difficulty === 'random' || p.difficulty === difficulty));
  if (!pool.length) return null;
  return pool[Math.floor(random() * pool.length)];
}
