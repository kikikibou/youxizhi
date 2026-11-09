/** Daily puzzle: one question, answer folded until you ask for it. */
export function mountDaily(el) {
  el.innerHTML = `
    <div class="tool-head">
      <div class="tool-kicker">PUZZLE · DAILY</div>
      <h2 class="tool-title">THREE BOXES<small>三个贴错的箱子</small></h2>
    </div>
    <div class="pz">
      <p>桌上有三个不透明的箱子，标签分别是 <b>「苹果」</b>、<b>「橘子」</b>、<b>「苹果和橘子」</b>。</p>
      <p>已知：<b>每一个标签都贴错了</b>。</p>
      <p>你可以选一个箱子，伸手进去摸出 <b>一个</b> 水果看一眼（看不到箱子里的其他东西）。</p>
      <p class="pz-q">只摸一次，怎样确定三个箱子里分别装的是什么？</p>
      <details class="pz-hint">
        <summary>提示</summary>
        <p>哪一个箱子的内容"最单纯"？想想"标签全错"对贴着「苹果和橘子」的箱子意味着什么。</p>
      </details>
      <details class="pz-answer">
        <summary>查看答案</summary>
        <p>从贴着 <b>「苹果和橘子」</b> 的箱子里摸。因为标签是错的，它里面只可能是单一水果。</p>
        <p>假设摸出苹果：它就是苹果箱。贴「橘子」的箱子不可能装橘子（标签错），也不可能装苹果（已被占用），所以是混合箱；剩下贴「苹果」的就是橘子箱。摸出橘子时同理。</p>
      </details>
    </div>
  `;
}
