/** 预览器用：强制某些界面处于打开状态（真页面里都是 false / null）。 */
export const flags = {
  /** 身份图一直打开（不用按住）。 */
  hold: false,
  /** 档案打开在哪一页。 */
  dossier: null as null | 'clues' | 'votes' | 'secret' | 'all',
  /** 结算时联系已经揭晓。 */
  revealed: false,
  /** 不播放换页动画。 */
  still: false,
};
