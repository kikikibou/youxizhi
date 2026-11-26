import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readSheet } from 'read-excel-file/node';
import { autoId, cleanPairs, crossCheck, headerKey, parseCsv, parseRows, type Cell } from './bank-lib.ts';

const HEAD: Cell[] = ['编号', '启用', '★难度', '★词A', '★词B', '★联系', '提示2', '提示3', '提示4', '提示5', '词A义项', '词B义项', '词A别名', '词B别名', '裁判须知', '联系类型', '备注'];
/** 按列名填一行。 */
function row(v: Partial<Record<string, Cell>>): Cell[] {
  return HEAD.map((h) => v[String(h).replace('★', '')] ?? null);
}

describe('题库导入', () => {
  it('列名忽略 ★、空格和括号里的说明', () => {
    expect(headerKey('★词A')).toBe('wordA');
    expect(headerKey(' 联系（第一条提示） ')).toBe('link');
    expect(headerKey('词a别名')).toBe('aliasesA');
    expect(headerKey('随便什么')).toBeNull();
  });

  it('缺少必填的列时直接报错', () => {
    const r = parseRows([['词A', '词B']], 'x.xlsx');
    expect(r.issues[0]).toMatchObject({ level: 'error', row: 1 });
    expect(r.issues[0].message).toMatch(/联系/);
  });

  it('一行完整的词对：拆分别名和提示，跳过空行', () => {
    const r = parseRows(
      [
        HEAD,
        row({ 难度: 1, 词A: ' 鱿鱼 ', 词B: '股票', 联系: '都能炒', 提示2: '动词', 提示4: '厨房', 词A别名: '柔鱼、枪乌贼', 裁判须知: '问能不能炒答是', 联系类型: '动词搭配' }),
        row({}),
      ],
      'x.xlsx',
    );
    expect(r.issues).toEqual([]);
    expect(cleanPairs(r.pairs)).toEqual([
      {
        id: autoId('鱿鱼', '股票'),
        wordA: '鱿鱼',
        wordB: '股票',
        link: '都能炒',
        bank: 'x',
        difficulty: 1,
        hints: ['动词', '厨房'],
        aliasesA: ['柔鱼', '枪乌贼'],
        judgeNote: '问能不能炒答是',
        linkType: '动词搭配',
      },
    ]);
  });

  it('逐行报错：缺词、两个词一样、难度不对、启用填错、别名等于另一个词、太长', () => {
    const r = parseRows(
      [
        HEAD,
        row({ 难度: 2, 词A: '鱿鱼', 联系: '都能炒' }),
        row({ 难度: 2, 词A: '鱿鱼', 词B: ' 鱿鱼。', 联系: '都能炒' }),
        row({ 难度: 4, 词A: '神', 词B: '狗', 联系: 'god/dog' }),
        row({ 启用: '可能', 难度: 1, 词A: '神', 词B: '狗', 联系: 'god/dog' }),
        row({ 难度: 1, 词A: '神', 词B: '狗', 联系: 'god/dog', 词A别名: '狗' }),
        row({ 难度: 1, 词A: '一二三四五六七八九十一二三四五六七八九十一', 词B: '狗', 联系: 'x' }),
        row({ 难度: 1, 词A: '神', 词B: '狗', 联系: 'x', 编号: '有空格 的编号' }),
      ],
      'x.xlsx',
    );
    const byRow = (n: number) => r.issues.filter((i) => i.row === n).map((i) => i.message).join(' / ');
    expect(byRow(2)).toMatch(/词B 必填/);
    expect(byRow(3)).toMatch(/不能一样/);
    expect(byRow(4)).toMatch(/难度只能是/);
    expect(byRow(5)).toMatch(/启用/);
    expect(byRow(6)).toMatch(/猜另一个词也会被判对/);
    expect(byRow(7)).toMatch(/最多 20 字/);
    expect(byRow(8)).toMatch(/编号只能用/);
    expect(r.pairs).toEqual([]);
  });

  it('启用填「否」的行不导入，单独计数', () => {
    const r = parseRows([HEAD, row({ 启用: '否', 难度: 1, 词A: '神', 词B: '狗', 联系: 'x' })], 'x.xlsx');
    expect(r.pairs).toEqual([]);
    expect(r.disabled).toBe(1);
    expect(r.issues).toEqual([]);
  });

  it('自动编号和两个词的先后无关，也和全半角、空格无关', () => {
    expect(autoId('鱿鱼', '股票')).toBe(autoId('股票', ' 鱿鱼'));
    expect(autoId('ＡＢ', 'c')).toBe(autoId('ab', 'C'));
    expect(autoId('鱿鱼', '股票')).not.toBe(autoId('鱿鱼', '基金'));
    expect(autoId('鱿鱼', '股票')).toMatch(/^p_[0-9a-f]{16}$/);
  });

  it('跨文件：同一组词对（先后颠倒也算）和重复编号报错；同一个词出现在多组里提醒', () => {
    const a = parseRows([HEAD, row({ 难度: 1, 词A: '鱿鱼', 词B: '股票', 联系: 'x' }), row({ 难度: 1, 词A: '鱿鱼', 词B: '基金', 联系: 'y', 编号: 'same' })], 'a.xlsx');
    const b = parseRows([HEAD, row({ 难度: 2, 词A: '股票', 词B: '鱿鱼', 联系: 'z' }), row({ 难度: 2, 词A: '神', 词B: '狗', 联系: 'w', 编号: 'same' })], 'b.csv');
    const issues = crossCheck([...a.pairs, ...b.pairs]);
    expect(issues.filter((i) => i.level === 'error').map((i) => i.message)).toEqual([
      expect.stringMatching(/a\.xlsx 第 2 行 是同一组词对/),
      expect.stringMatching(/编号「same」和 a\.xlsx 第 3 行 重复/),
    ]);
    expect(issues.some((i) => i.level === 'warn' && /「鱿鱼」出现在/.test(i.message))).toBe(true);
  });

  it('CSV：引号、引号里的逗号和换行、两个引号转义', () => {
    expect(parseCsv('a,b\r\n"x,1","line1\nline2"\n"say ""hi""",\n')).toEqual([
      ['a', 'b'],
      ['x,1', 'line1\nline2'],
      ['say "hi"', ''],
    ]);
  });

  it('新列名：所属题库、提示1–4（提示按编号排，联系不在提示里）', () => {
    const head: Cell[] = ['所属题库', '启用', '★词A', '★词B', '★联系', '提示1（最含糊）', '提示2', '提示3', '提示4'];
    const r = parseRows([head, ['家常菜', '', '鱿鱼', '股票', '都能炒', '一个动词', '厨房里也用', '', '']], 'x.xlsx');
    expect(r.issues).toEqual([]);
    expect(r.pairs[0]).toMatchObject({ bank: '家常菜', link: '都能炒', hints: ['一个动词', '厨房里也用'] });
  });

  it('大国词：填词本身或 A / B，留空每局随机；填了别的词报错', () => {
    const head: Cell[] = ['★词A', '★词B', '大国词', '★联系'];
    const r = parseRows(
      [head, ['花旦', '天鹅', '天鹅', '都能接在「四小」后面'], ['鱿鱼', '股票', 'A', '都能炒'], ['神', '狗', '', '倒过来'], ['米', '万', '面', '旗']],
      'x.xlsx',
    );
    expect(r.pairs.map((p) => p.bigWord)).toEqual(['B', 'A', undefined]);
    expect(r.issues).toEqual([expect.objectContaining({ row: 5, level: 'error', message: expect.stringContaining('大国词') })]);
  });

  it('模板文件本身可以直接导入', async () => {
    const path = fileURLToPath(new URL('../../题目采集表.xlsx', import.meta.url));
    const rows = (await readSheet(path, '题库')) as Cell[][];
    const r = parseRows(rows, '题目采集表.xlsx');
    expect(r.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(r.pairs.map((p) => `${p.wordA}/${p.wordB}`)).toEqual(['鱿鱼/股票', '清一色/唐三彩', '雷达/射手', '神/狗', '米/万']);
    expect(r.pairs.find((p) => p.wordB === '狗')?.aliasesB).toEqual(['犬', '狗狗']);
  });
});
