/** 词对数据结构（§9）和猜词的精确匹配（§8.3）。 */

export interface WordPair {
  id: string;
  wordA: string;
  wordB: string;
  /** 义项说明，供裁判按此回答。例：「鱿鱼：海洋动物、食材」 */
  senseA?: string;
  senseB?: string;
  /** 猜词时同样判对的别名。 */
  aliasesA?: string[];
  aliasesB?: string[];
  /** 联系的一句话表述，作为第一条提示公布。 */
  link: string;
  /** 联系之后的分级提示，越往后越直白。 */
  hints?: string[];
  /** 难度 1–3，是唯一可以展示给玩家的标注。 */
  difficulty?: 1 | 2 | 3;
  /** 联系类型的内部标签，不展示给玩家。 */
  linkType?: string;
  notes?: string;
}

/** 一局里某一国的词，带上裁判需要的义项和别名。 */
export interface WordEntry {
  word: string;
  sense: string;
  aliases: string[];
}

/**
 * 猜词比对前的规范化：去掉首尾和中间的空白、常见标点和引号，全角转半角，拉丁字母转小写。
 * 只用于「是不是同一个写法」的判断；同一事物的别的叫法交给裁判。
 */
export function normalizeWord(s: string): string {
  return s
    .normalize('NFKC') // 全角字母数字转半角
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[「」『』“”‘’"'《》〈〉()（）\[\]【】.,，。、!！?？:：;；~～·…—\-_]/g, '');
}

/** 猜测是否和目标词或别名表完全一致（规范化之后）。 */
export function exactMatch(guess: string, entry: WordEntry): boolean {
  const g = normalizeWord(guess);
  if (!g) return false;
  return [entry.word, ...entry.aliases].some((w) => normalizeWord(w) === g);
}

/**
 * 已经线下试过的词对（§9），当测试数据用。词和联系来自规则文档；
 * 义项、别名、提示和难度是为了测试先填的占位，正式题库另行整理。
 */
export const SAMPLE_PAIRS: readonly WordPair[] = [
  {
    id: 'sample-squid-stock',
    wordA: '鱿鱼',
    wordB: '股票',
    senseA: '鱿鱼：海洋动物、食材',
    senseB: '股票：证券、金融产品',
    link: '都是可以「炒」的东西',
    hints: ['都和一个动词有关', '这个动词在厨房里也用得上'],
    difficulty: 1,
    linkType: '动词搭配',
    notes: '适合第一局',
  },
  {
    id: 'sample-qingyise-tangsancai',
    wordA: '清一色',
    wordB: '唐三彩',
    senseA: '清一色：麻将牌型',
    senseB: '唐三彩：唐代的低温釉陶器',
    link: '无情对：清↔唐、一↔三、色↔彩',
    hints: [],
    difficulty: 3,
    linkType: '无情对',
    notes: '适合第二局',
  },
  {
    id: 'sample-radar-archer',
    wordA: '雷达',
    wordB: '射手',
    senseA: '雷达：用无线电探测目标的装置',
    senseB: '射手：射箭或射击的人',
    link: '都是蚊香的品牌',
    hints: [],
    difficulty: 2,
    linkType: '品牌',
    notes: '用于规则说明',
  },
  {
    id: 'sample-god-dog',
    wordA: '神',
    wordB: '狗',
    senseA: '神：神明',
    senseB: '狗：动物',
    aliasesB: ['犬', '狗狗'],
    link: '英文拼写互相颠倒（god / dog）',
    hints: [],
    difficulty: 2,
    linkType: '外语',
  },
  {
    id: 'sample-mi-wan',
    wordA: '米',
    wordB: '万',
    senseA: '米：粮食、长度单位都算',
    senseB: '万：数字',
    link: '都是「X 字旗」',
    hints: [],
    difficulty: 3,
    linkType: '字形',
  },
];
