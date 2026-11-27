/**
 * 解码与三国知识问答: the questions as players see them. Every run of Latin
 * letters in a question is a 密语 word (main.js turns each into a clickable
 * word); everything else is shown as written.
 *
 * Each question has one answer slot, or more when it asks more than one thing
 * (slots[].label then tells them apart). The accepted answers and the notes
 * shown once a slot is solved are not here: they live in a private sheet and
 * are sealed into answers.generated.js by scripts/build-sgjm.mjs.
 */
export const INTRO = {
  title: '解码与三国知识问答',
  en: 'Kingdoms, Decoded',
  lead: '这是一份用虚构「密语」写成的三国知识问答。请试着反向解码「密语」，并回答每一个问题。',
  rules: [
    '每题的答案都是一个人物。',
    '三国知识可能来自正史、演义等出处；正史和演义对某件事的当事人描述不同时，两者均算正确。',
    '每道题答错的次数都会被记录。',
    '可以使用搜索引擎。',
  ],
};

const one = (id) => [{ id }];

export const ROUNDS = [
  {
    id: 'a',
    name: '基础版',
    short: '基础',
    en: 'Part I',
    seal: '壹',
    blurb: '适合刚刚开始接触这套题的玩家，难度适中。',
    questions: [
      { no: '0', slots: one('a0'), text: '「Poujsi: Oxi Hlew」中，唯一没有在街机游戏「天地 Ez」里作为可操作角色登场的是？' },
      { no: '1', slots: one('a1'), text: 'Dasi te 在大呼「Dasi Yik 敢 Vocox！Dasi Yik 敢 Vocox！Dasi Yik 敢 Vocox！」后 Uocox 的蜀国 Poujsi？' },
      { no: '2', slots: one('a2'), text: '建安 Wtiwt-Oxi 年，「Poujsi: 江表 Wtiwt-Eci Hlew」之一的陈武在「Pouj: 逍遥津」中 Uocox。Dasi te 在这场战斗中仅以 Wtiox-Oxiwt 的兵力向敌阵大军突击的 Poujsi？' },
      { no: '3', slots: one('a3'), text: '因为共通的 Elu 而被称为「Wtiec 达」的兄弟中，Dasi te 以「Nmk: Rjewlyt」而闻名的人？' },
      { no: '4', slots: one('a4'), text: 'Dasi te 被曹操所歌颂的，因为 Soez 而得到世人认可的人？' },
      { no: '5', slots: one('a5'), text: '因为 Eci Lyt 的恩义出仕的蜀臣、Nmk 长而被嘲笑的吴臣、Dott 了淮南 Eci\'-Somuq 的魏臣，以上三人中 Dasi te 当时被世人称为「Hlew」的人物？' },
      { no: '6', slots: one('a6'), text: 'Dasi te 在传说中 Socox、并在宴会上让孙刘之间的 Vosomuqsi Uocox 的人？' },
      { no: '7', slots: one('a7'), text: '为主君献上「Bolb: Hlew Rjew Voez」的 Bolbsi，被他的主君称为「Yikih Dasi」？' },
      { no: '8', slots: one('a8'), text: 'Dasi te 因为「Wtiwt-Eciwt Bolb」中「Oxi-Rgi\'-Bolb」而 Uosomuq 的 Fyeo？' },
      {
        no: '9',
        slots: [{ id: 'a9a', label: '前一问' }, { id: 'a9b', label: '后一问' }],
        text: 'Dasi「Muq: Wti-Eciwt Fyeo」Vomuqsi te？Dasi「Muq: Wti-Eciwt Fyeo」Dottsi te？',
      },
      { no: '10', slots: one('a10'), text: 'Dasiih Elu「Wti\'-Bolb」te？' },
    ],
  },
  {
    id: 'b',
    name: '进阶版',
    short: '进阶',
    en: 'Part II',
    seal: '贰',
    blurb: '需要完成基础版才有可能破解，包含了更多误导性与冷门知识。',
    questions: [
      { no: '1', slots: one('b1'), text: 'Dasi te 有着漂亮的长 Hwx、因为 Mea 而改换姓名、在对抗 Kvrmis 的军队时通过制造敌军的 Zohye 而获胜的人物？' },
      { no: '2', slots: one('b2'), text: 'Dasi te「功臣: Klrdtn Ybi」之一的 Gor、在诸葛亮之前唯一 cas「Roa 庙 Uotx」wf「Poa 庙 Uotx」、并曾用 Unfqi 的比喻来说服其他 Poujsi 继续 Hye 东吴的人物？' },
      { no: '3', slots: one('b3'), text: 'Dasi te 著名 Rozsi 之子、在蒋济看到其 Ely 时就认定此人是 Pyeelp、最终接受了「Pyeklr」的 Zodaz，跟他一起兵败身死的人物？' },
      { no: '4', slots: one('b4'), text: 'Dasi te 被时人称为 Elp、与 IKongih Gor 结交为友、并通过 Vodaz 张虎而建立势力的 Fyeo？' },
      { no: '5', slots: one('b5'), text: '把自己的 Crrmis 交给部下 Sohye 进 Tu 中而获救的 Fyeo，其长子被称为「Pyedasi」？' },
      { no: '6', slots: one('b6'), text: 'Dasi te 在演义中，通过自己 Zocox 来 Vohye 曹军，从而获胜的人物？' },
      { no: '7', slots: one('b7'), text: 'Dasi te 在演义中，比另外两个只 Roz 了「火」的人多说了 Rgi Ra，但还是跟他们达成了共识的 Bolbsi？' },
      { no: '8', slots: one('b8'), text: '在自己的诗作中把 Elp 比作 Upel、在谕令中把管仲视作 Elp 代表的人物，在给 Dasi 的 Txrozz 中把对方比作了 IKong？' },
      { no: '9', slots: one('b9'), text: 'Dasi te 在其友人的诗作中、被视为「Eciwt Ra」诗体创始人的 Gor，并在现代被认为可能是「Crrdtn Mea」Rozzsi 的人物？' },
      { no: '10', slots: one('b10'), text: 'Dasi 出身自于 Kvrpoa Oxi 年与东吴通商的势力、并主办了其首都建城 Wtiec-Oxiec 年的庆典 vyf 自己去世的前一年（即 Crrupel Ybi 年）？' },
      { no: '11', slots: one('b11'), text: 'Dasi「Elp: Unftu Rgi」cas「Elp: Wtiec」wf？' },
      { no: '12', slots: one('b12'), text: 'Dasi Sohye vyf Hwxqi？' },
      { no: '13', slots: one('b13'), text: 'Dasi「Pyesocrrely」te？' },
    ],
  },
];

/** Every answer slot, in order (the dictionary's key is made from all of them in this order). */
export const SLOT_IDS = ROUNDS.flatMap((r) => r.questions.flatMap((q) => q.slots.map((s) => s.id)));
