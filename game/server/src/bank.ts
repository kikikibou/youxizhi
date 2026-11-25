/**
 * 题库。只存在服务器上：打包进网页的话，看源码就能看到答案。
 *
 * 内容来自 game/server/bank/ 里的表格（格式见 game/题库模板.xlsx），由 `npm run bank` 生成
 * bank.generated.ts；两者都不提交到 git（仓库是公开的）。没有导入题库时，用规则文档里的 5 组示例词对。
 *
 * 一个表格文件就是一个题库（名字是文件名）；表格里填了「题库」列的行归到那个题库。房主可以勾选用哪几个。
 */

import { SAMPLE_PAIRS, type WordPair } from '../../engine/index.ts';
import { BANK_DATA } from './bank.generated.ts';

export const BANK_IS_SAMPLE = BANK_DATA.length === 0;
export const BANK: readonly WordPair[] = BANK_IS_SAMPLE ? SAMPLE_PAIRS.map((p) => ({ ...p, bank: '示例' })) : BANK_DATA;

/** 所有题库的名字，按第一次出现的顺序。 */
export const BANK_NAMES: readonly string[] = [...new Set(BANK.map((p) => p.bank ?? '题库'))];

function pool(banks: readonly string[] | null, exclude: Set<string>): WordPair[] {
  return BANK.filter((p) => !exclude.has(p.id) && (!banks || banks.includes(p.bank ?? '题库')));
}

/** 从勾选的题库里抽一条，排除房间里任何人见过的（§13-16）。没有可用的返回 null。 */
export function pickPair(banks: readonly string[] | null, exclude: Set<string>, random: () => number): WordPair | null {
  const p = pool(banks, exclude);
  if (!p.length) return null;
  return p[Math.floor(random() * p.length)];
}

/** 大厅里显示：每个题库几组、还剩几组；勾选的加起来几组、还剩几组。 */
export function bankInfo(banks: readonly string[] | null, exclude: Set<string>) {
  return {
    total: pool(banks, new Set()).length,
    left: pool(banks, exclude).length,
    banks: BANK_NAMES.map((name) => ({ name, total: pool([name], new Set()).length, left: pool([name], exclude).length })),
  };
}
