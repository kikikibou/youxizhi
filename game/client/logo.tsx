/**
 * 标志：粗壮的「大」「小」两块，站在同一条地平线上、用透视往右后方退——「大」在前面更大，「小」在后面更小。
 * - 两个字几乎是实心的块，只留最少的缺口来分出笔画。「大」：头两侧、左臂下面、两腿之间，右边整条被斜线切齐；
 *   「小」：竖的头高出两肩，两道 V 形缺口从地面往上，分出往外撇的两点；左边那道顺着斜线倾斜，竖的脚往左撇出去就是钩。
 * - 两国之间一刀斜劈：「大」的右边和「小」的左点被同一条斜线切齐，中间的缝上宽下窄，像被劈开；
 *   上下各露出一小段细线，是刀走过的痕迹。缝上的一点是两个词之间的「联系」（只在首页动画和结算揭晓里出现）。
 * 坐标系是 160 × 100。形状由 scratchpad 的 blocks4.py / export4.py 生成（墙面上平着设计，再用针孔相机投影）。
 */

export const LOGO_W = 160;
export const LOGO_H = 100;

/** 「大」：实心的一块，右边被斜线切齐。 */
export const BIG =
  '27,46.8 15.6,62 15.6,92.3 49.7,92.3 55.9,71.4 61.9,92.3 74.5,92.3 100.6,35.4 69,28.9 69,8.9 41.7,1.5 41.7,23.3 15.6,17.9 15.6,45.3';
/** 「小」：一整块，左点的外边被斜线切齐。 */
export const SMALL =
  '96.6,49.8 75.1,92.3 96.7,92.3 110.2,57.6 102,92.3 128.2,92.3 126.9,61.1 132.1,92.3 144.4,92.3 139,57.4 127.4,51.7 127.4,39.5 109.7,35.8 109.7,48.8';
/** 劈开的痕迹：缝的上方和下方各一小段细线。 */
export const BORDER = 'M107.8 23.7 L103.4 32.9 M74.6 92.8 L71.8 98.5';
/** 图标尺寸用：一整条粗一点的斜线（缝太窄，缩小后看不见）。 */
export const BORDER_FULL = 'M107.8 23.7 L71.8 98.5';
export const NODE = { cx: 92.6, cy: 55.3 };

/** 标志的各个部分。icon：图标尺寸，斜线画成一整条加粗的线，不画联系点。 */
export function LogoShapes({ icon = false }: { icon?: boolean }) {
  return (
    <>
      <polygon points={BIG} class="mark-big" />
      <polygon points={SMALL} class="mark-small" />
      {icon ? <path d={BORDER_FULL} class="mark-border mark-border--icon" /> : <path d={BORDER} class="mark-border" />}
      {icon ? null : <circle cx={NODE.cx} cy={NODE.cy} r={2.4} class="mark-node" />}
    </>
  );
}
