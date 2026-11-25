/**
 * 题库导入：读 game/server/bank/ 里的 .xlsx / .csv，检查格式，生成 src/bank.generated.ts（打包进服务器）。
 *
 *   npm run bank        （在 game/server 里；npm run dev / deploy 之前会自动运行）
 *
 * 有错误时不生成、以非零状态退出，部署会停下来。bank/ 和生成的文件都不提交（仓库是公开的）。
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSheet } from 'read-excel-file/node';
import { cleanPairs, crossCheck, parseCsv, parseRows, type Cell, type Issue, type ParseResult } from './bank-lib.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const BANK_DIR = join(here, '..', 'bank');
const OUT = join(here, '..', 'src', 'bank.generated.ts');
const SHEET = '题库';

function write(pairs: ReturnType<typeof cleanPairs>) {
  const body = `// 由 npm run bank 从 game/server/bank/ 里的题库生成，不要手改，也不要提交（仓库是公开的）。
import type { WordPair } from '../../engine/words.ts';

export const BANK_DATA: WordPair[] = ${JSON.stringify(pairs, null, 2)};
`;
  writeFileSync(OUT, body, 'utf8');
}

async function readFile(path: string, name: string): Promise<Cell[][] | Issue> {
  if (name.toLowerCase().endsWith('.csv')) {
    const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
    if (text.includes('�')) {
      return { file: name, row: 0, level: 'error', message: '读出来有乱码：CSV 请存成「UTF-8」编码（或者直接用 .xlsx）' };
    }
    return parseCsv(text);
  }
  try {
    return (await readSheet(path, SHEET)) as Cell[][];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/sheet/i.test(msg)) return { file: name, row: 0, level: 'error', message: `找不到名为「${SHEET}」的工作表` };
    return { file: name, row: 0, level: 'error', message: `打不开这个文件：${msg}` };
  }
}

async function main() {
  const files = existsSync(BANK_DIR)
    ? readdirSync(BANK_DIR)
        .filter((f) => /\.(xlsx|csv)$/i.test(f) && !f.startsWith('~$') && !f.startsWith('.'))
        .sort()
    : [];
  if (!files.length) {
    write([]);
    console.log(`题库：没有在 ${BANK_DIR} 找到 .xlsx 或 .csv，先用规则文档里的 5 组示例词对。`);
    return;
  }

  const all: ParseResult['pairs'] = [];
  const issues: Issue[] = [];
  let disabled = 0;
  for (const f of files) {
    const rows = await readFile(join(BANK_DIR, f), f);
    if (!Array.isArray(rows)) {
      issues.push(rows);
      continue;
    }
    const r = parseRows(rows, f);
    all.push(...r.pairs);
    issues.push(...r.issues);
    disabled += r.disabled;
  }
  issues.push(...crossCheck(all));

  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');
  const where = (i: Issue) => (i.row ? `${i.file} 第 ${i.row} 行` : i.file);
  for (const i of errors) console.log(`✗ ${where(i)}：${i.message}`);
  for (const i of warns) console.log(`! ${where(i)}：${i.message}`);

  const byLevel = [1, 2, 3].map((d) => all.filter((p) => p.difficulty === d).length);
  const noSense = all.filter((p) => !p.senseA || !p.senseB).length;
  const noHints = all.filter((p) => !p.hints?.length).length;
  console.log(
    `\n题库：${files.join('、')}\n  可用 ${all.length} 组（简单 ${byLevel[0]} / 中等 ${byLevel[1]} / 困难 ${byLevel[2]}）${disabled ? `，停用 ${disabled} 组` : ''}`,
  );
  if (noSense) console.log(`  其中 ${noSense} 组没填全义项：裁判只能按最常见的意思理解，建议补上`);
  if (noHints) console.log(`  其中 ${noHints} 组只有联系、没有后续提示：抢答阶段公布完联系后，再过一个间隔就平局`);

  if (errors.length) {
    console.log(`\n有 ${errors.length} 处错误，改好后再运行 npm run bank。服务器里的题库没有更新。`);
    process.exit(1);
  }
  write(cleanPairs(all));
  console.log(`\n✓ 已生成 src/bank.generated.ts。运行 npm run deploy 上线。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
