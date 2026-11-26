/**
 * 题库导入的校验和整理（纯函数，测试见 bank-lib.test.ts）。
 * 输入：表格的行（第一行是列名）；输出：词对和问题清单（第几行、错误还是提醒）。
 * 列名、各列的意思见 game/题目采集表.xlsx 的「说明」工作表。
 * 提示列：新模板是 提示1–4，旧表格是 提示2–5；两种都认，按编号从小到大就是抢答时公布的顺序（联系永远排在最后）。
 */

import { normalizeWord, type WordPair } from '../../engine/words.ts';

export type Cell = string | number | boolean | Date | null | undefined;

export interface Issue {
  file: string;
  /** 表格里的行号（从 1 开始，第 1 行是列名）；0 表示整个文件。 */
  row: number;
  level: 'error' | 'warn';
  message: string;
}

/** 列名 → 字段。列名里的 ★、空格、括号里的说明都会被忽略。 */
const HEADERS: Record<string, string> = {
  编号: 'id',
  所属题库: 'bank',
  题库: 'bank',
  启用: 'enabled',
  难度: 'difficulty',
  词A: 'wordA',
  词B: 'wordB',
  大国词: 'bigWord',
  联系: 'link',
  提示1: 'hint1',
  提示2: 'hint2',
  提示3: 'hint3',
  提示4: 'hint4',
  提示5: 'hint5',
  词A义项: 'senseA',
  词B义项: 'senseB',
  词A别名: 'aliasesA',
  词B别名: 'aliasesB',
  裁判须知: 'judgeNote',
  联系类型: 'linkType',
  备注: 'notes',
};
/** 难度现在可以不填（房间里已经不按难度抽题了），填了就检查。 */
const REQUIRED = ['wordA', 'wordB', 'link'];

export function headerKey(h: Cell): string | null {
  if (h === null || h === undefined) return null;
  const t = String(h)
    .replace(/[★*\s]/g, '')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[a]/g, 'A')
    .replace(/[b]/g, 'B');
  return HEADERS[t] ?? null;
}

const str = (v: Cell): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, ' ').trim();
};
const len = (s: string) => Array.from(s).length;
const splitList = (s: string) =>
  s
    .split(/[、,，;；/\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** 没填编号时，按两个词生成一个稳定的编号（词不变，编号就不变；和词的先后无关）。 */
export function autoId(a: string, b: string): string {
  const key = [normalizeWord(a), normalizeWord(b)].sort().join('|');
  // FNV-1a，两个不同的初值拼成 16 位十六进制
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (const ch of key) {
      h ^= ch.codePointAt(0)!;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return `p_${fnv(0x811c9dc5)}${fnv(0x01234567)}`;
}

export interface ParseResult {
  pairs: (WordPair & { _row: number; _file: string })[];
  issues: Issue[];
  /** 「启用」填了「否」的行数。 */
  disabled: number;
}

/** 文件名去掉扩展名，作为这个文件里没填「题库」列的行所属的题库名。 */
export function bankNameOf(file: string): string {
  return file.replace(/\.[^.]+$/, '').trim() || '题库';
}

/** 解析一个工作表（或 CSV）的所有行。 */
export function parseRows(rows: Cell[][], file: string): ParseResult {
  const issues: Issue[] = [];
  const pairs: ParseResult['pairs'] = [];
  let disabled = 0;
  const err = (row: number, message: string) => issues.push({ file, row, level: 'error', message });
  const warn = (row: number, message: string) => issues.push({ file, row, level: 'warn', message });

  const header = rows[0] ?? [];
  const col: Record<string, number> = {};
  header.forEach((h, i) => {
    const k = headerKey(h);
    if (k && col[k] === undefined) col[k] = i;
  });
  const missing = REQUIRED.filter((k) => col[k] === undefined);
  if (missing.length) {
    const names = Object.entries(HEADERS)
      .filter(([, v]) => missing.includes(v))
      .map(([k]) => k);
    err(1, `第 1 行缺少必填的列：${names.join('、')}（列名要和模板一致）`);
    return { pairs, issues, disabled };
  }

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const row = rows[r] ?? [];
    if (row.every((c) => str(c) === '')) continue;
    const get = (k: string) => (col[k] === undefined ? '' : str(row[col[k]]));
    const before = issues.filter((i) => i.level === 'error').length;

    // 启用
    const en = get('enabled').toLowerCase();
    let enabled = true;
    if (['否', 'n', 'no', 'false', '0', '停用'].includes(en)) enabled = false;
    else if (!['', '是', 'y', 'yes', 'true', '1', '启用'].includes(en)) err(line, `「启用」只能填「是」或「否」（现在是「${get('enabled')}」）`);

    const wordA = get('wordA');
    const wordB = get('wordB');
    const link = get('link');
    if (!wordA) err(line, '词A 必填');
    if (!wordB) err(line, '词B 必填');
    if (wordA && len(wordA) > 20) err(line, `词A 最多 20 字（现在 ${len(wordA)} 字）`);
    if (wordB && len(wordB) > 20) err(line, `词B 最多 20 字（现在 ${len(wordB)} 字）`);
    if (wordA && wordB && normalizeWord(wordA) === normalizeWord(wordB)) err(line, '词A 和词B 不能一样');
    if (!link) err(line, '联系必填（抢答时提示放完最后才公布，结算时揭晓）');
    else if (len(link) > 80) err(line, `联系最多 80 字（现在 ${len(link)} 字）`);

    // 大国词：默认是词A；填词B本身（或 B）就让词B当大国的词；填「随机」每局随机
    const bigRaw = get('bigWord');
    let bigWord: 'A' | 'B' | undefined = 'A';
    if (bigRaw) {
      const n = normalizeWord(bigRaw);
      if (wordA && n === normalizeWord(wordA)) bigWord = 'A';
      else if (wordB && n === normalizeWord(wordB)) bigWord = 'B';
      else if (['a', '词a'].includes(n)) bigWord = 'A';
      else if (['b', '词b'].includes(n)) bigWord = 'B';
      else if (['随机', '每局随机'].includes(n)) bigWord = undefined;
      else err(line, `「大国词」要填这一行的词A、词B，或者「随机」（现在是「${bigRaw}」）`);
    }

    const dRaw = get('difficulty');
    const d = Number(dRaw);
    if (dRaw && ![1, 2, 3].includes(d)) err(line, `难度只能是 1、2、3（现在是「${dRaw}」）`);
    const bank = get('bank') || bankNameOf(file);
    if (len(bank) > 20) err(line, `题库名最多 20 字（现在 ${len(bank)} 字）`);

    const hints: string[] = [];
    for (const k of ['hint1', 'hint2', 'hint3', 'hint4', 'hint5']) {
      const h = get(k);
      if (!h) continue;
      if (len(h) > 80) err(line, `${k.replace('hint', '提示')} 最多 80 字`);
      hints.push(h);
    }

    const senseA = get('senseA');
    const senseB = get('senseB');
    if (len(senseA) > 40) err(line, '词A义项 最多 40 字');
    if (len(senseB) > 40) err(line, '词B义项 最多 40 字');

    const aliasesA = splitList(get('aliasesA'));
    const aliasesB = splitList(get('aliasesB'));
    for (const [name, list, other] of [
      ['词A别名', aliasesA, wordB],
      ['词B别名', aliasesB, wordA],
    ] as const) {
      if (list.length > 6) err(line, `${name}最多 6 个`);
      for (const a of list) {
        if (len(a) > 20) err(line, `${name}「${a}」太长（最多 20 字）`);
        if (other && normalizeWord(a) === normalizeWord(other)) err(line, `${name}「${a}」和另一个词一样：猜另一个词也会被判对`);
      }
    }

    const judgeNote = get('judgeNote');
    if (len(judgeNote) > 200) err(line, `裁判须知最多 200 字（现在 ${len(judgeNote)} 字）`);
    const linkType = get('linkType');
    const notes = get('notes');

    let id = get('id');
    if (id && !/^[A-Za-z0-9_-]{1,40}$/.test(id)) err(line, `编号只能用字母、数字、- 和 _（现在是「${id}」）`);
    if (!id && wordA && wordB) id = autoId(wordA, wordB);

    if (issues.filter((i) => i.level === 'error').length > before) continue;
    if (!enabled) {
      disabled += 1;
      continue;
    }
    const pair: ParseResult['pairs'][number] = { id, wordA, wordB, link, bank, _row: line, _file: file };
    if (dRaw) pair.difficulty = d as 1 | 2 | 3;
    if (bigWord) pair.bigWord = bigWord;
    if (hints.length) pair.hints = hints;
    if (senseA) pair.senseA = senseA;
    if (senseB) pair.senseB = senseB;
    if (aliasesA.length) pair.aliasesA = aliasesA;
    if (aliasesB.length) pair.aliasesB = aliasesB;
    if (judgeNote) pair.judgeNote = judgeNote;
    if (linkType) pair.linkType = linkType;
    if (notes) pair.notes = notes;
    pairs.push(pair);
  }
  return { pairs, issues, disabled };
}

/** 跨文件检查：重复的词对、重复的编号；同一个词出现在多组里给提醒。 */
export function crossCheck(pairs: ParseResult['pairs']): Issue[] {
  const issues: Issue[] = [];
  const byKey = new Map<string, ParseResult['pairs'][number]>();
  const byId = new Map<string, ParseResult['pairs'][number]>();
  const byWord = new Map<string, ParseResult['pairs'][number][]>();
  const at = (p: ParseResult['pairs'][number]) => `${p._file} 第 ${p._row} 行`;
  for (const p of pairs) {
    const key = [normalizeWord(p.wordA), normalizeWord(p.wordB)].sort().join('|');
    const dup = byKey.get(key);
    if (dup) issues.push({ file: p._file, row: p._row, level: 'error', message: `和 ${at(dup)} 是同一组词对（${p.wordA} / ${p.wordB}）` });
    else byKey.set(key, p);
    const dupId = byId.get(p.id);
    if (dupId && dupId !== dup) issues.push({ file: p._file, row: p._row, level: 'error', message: `编号「${p.id}」和 ${at(dupId)} 重复` });
    else byId.set(p.id, p);
    for (const w of [p.wordA, p.wordB]) byWord.set(normalizeWord(w), [...(byWord.get(normalizeWord(w)) ?? []), p]);
  }
  for (const [, list] of byWord) {
    if (list.length < 2) continue;
    const word = normalizeWord(list[0].wordA) === normalizeWord(list[1].wordA) ? list[0].wordA : list[0].wordB;
    issues.push({
      file: list[1]._file,
      row: list[1]._row,
      level: 'warn',
      message: `「${word}」出现在 ${list.length} 组词对里（${list.map(at).join('、')}）：玩过一组的人可能会联想到另一组`,
    });
  }
  return issues;
}

/** 去掉内部字段，按导入顺序输出。 */
export function cleanPairs(pairs: ParseResult['pairs']): WordPair[] {
  return pairs.map(({ _row, _file, ...p }) => p);
}

/** 简单的 CSV 解析（支持引号、引号里的逗号和换行）。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
