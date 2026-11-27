/** 大辩题库后端的纯函数：北京时间、投稿检查、AI 初筛输出的解析、提醒邮件正文。根目录 `npm test` 会跑到这里。 */
import { describe, expect, it } from 'vitest';
import { compose } from '../src/notify.ts';
import { parseReview, userPrompt } from '../src/review.ts';
import { bjDay, bjMonth, checkDraft, clean, monthLength, normalize, prevMonth, stance } from '../src/text.ts';

describe('北京时间', () => {
  it('UTC 16:00 已经是北京时间第二天', () => {
    expect(bjDay(Date.UTC(2026, 10, 30, 15, 59))).toBe('2026-11-30');
    expect(bjDay(Date.UTC(2026, 10, 30, 16, 0))).toBe('2026-12-01');
    expect(bjMonth(Date.UTC(2026, 10, 30, 16, 5))).toBe('2026-12');
  });
  it('月份长度和上个月', () => {
    expect(monthLength('2026-11')).toBe(30);
    expect(monthLength('2028-02')).toBe(29);
    expect(prevMonth('2027-01')).toBe('2026-12');
    expect(prevMonth('2026-11')).toBe('2026-10');
  });
});

describe('投稿检查', () => {
  it('去掉控制字符和零宽字符，压缩空白', () => {
    expect(clean('  周一\u200b应当\n\n被开除\u0007  ')).toBe('周一应当 被开除');
  });
  it('查重时忽略空白和标点', () => {
    expect(normalize('猫 该不该拥有自己的工位！')).toBe(normalize('猫该不该拥有自己的工位'));
    expect(normalize('A还是B?')).toBe('a还是b');
  });
  it('长度和题库人', () => {
    expect(checkDraft('啊', '')).toEqual({ error: '辩题至少写 4 个字' });
    expect(checkDraft('！！！？？？', '')).toEqual({ error: '辩题得有点正经的字' });
    expect(checkDraft('周一应当被开除出一周', '')).toEqual({ title: '周一应当被开除出一周', who: '匿名' });
    expect('error' in checkDraft('周一应当被开除出一周', '一二三四五六七八九十十一十二十三')).toBe(true);
    expect('error' in checkDraft('字'.repeat(61), '')).toBe(true);
  });
  it('立场去掉「正方：」并截到 8 个字', () => {
    expect(stance('正方：先捞手机')).toBe('先捞手机');
    expect(stance('一二三四五六七八九十')).toBe('一二三四五六七八');
  });
});

describe('AI 初筛输出', () => {
  it('放行', () => {
    expect(parseReview('{"verdict":"pass","reason":"","pro":"先捞手机","con":"先提裤子","who_ok":true}')).toEqual({
      verdict: 'pass', reason: '', pro: '先捞手机', con: '先提裤子', whoOk: true,
    });
  });
  it('退回时不留立场，没写原因就补一句', () => {
    expect(parseReview('{"verdict":"reject","reason":"","pro":"x","con":"y","who_ok":true}')).toEqual({
      verdict: 'reject', reason: '没能通过初筛', pro: '', con: '', whoOk: true,
    });
  });
  it('署名不行就标出来', () => {
    expect(parseReview('{"verdict":"unsure","reason":"涉及时事","pro":"","con":"","who_ok":false}')?.whoOk).toBe(false);
  });
  it('不合规的输出返回 null（投稿进人工审核）', () => {
    expect(parseReview('好的，这条可以通过')).toBeNull();
    expect(parseReview('{"verdict":"approve"}')).toBeNull();
    expect(parseReview('null')).toBeNull();
  });
  it('投稿放在标签里，没写题库人时注明', () => {
    expect(userPrompt('周一应当被开除出一周', '匿名')).toContain('<题库人>（没写）</题库人>');
  });
});

describe('审核提醒邮件', () => {
  const item = { title: '<b>猫</b>该不该有工位', who: '工位猫主', reason: '涉及时事', created_at: Date.UTC(2026, 10, 27, 12, 9) };
  it('标题写待审条数，正文带链接和 AI 提示', () => {
    const m = compose(3, [item], 'https://yxzzxy.com/dbtk/admin.html', false);
    expect(m.subject).toBe('【大辩题库】有 3 条投稿等你审核');
    expect(m.text).toContain('（题库人 工位猫主，11-27 20:09）');
    expect(m.text).toContain('AI：涉及时事');
    expect(m.text).toContain('还有 2 条');
    expect(m.text).toContain('https://yxzzxy.com/dbtk/admin.html');
  });
  it('HTML 里投稿内容要转义', () => {
    const m = compose(1, [item], 'https://yxzzxy.com/dbtk/admin.html', true);
    expect(m.subject).toBe('【大辩题库】还有 1 条投稿没审');
    expect(m.html).toContain('&lt;b&gt;猫&lt;/b&gt;');
    expect(m.html).not.toContain('<b>猫</b>');
  });
});
