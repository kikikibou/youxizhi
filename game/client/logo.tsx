/**
 * 标志：粗壮的「大」「小」两块，站在同一条地平线上、用透视往右后方退——「大」在前面更大，「小」在后面更小。
 * - 两个字几乎是实心的块，只留最少的缺口来分出笔画（「大」：头两侧、两臂下面、两腿之间；「小」：竖钩和两点之间的窄缝）。
 * - 两国之间是一刀斜切：「大」的右边和「小」的左点都被同一条直线切齐，中间一条细缝就是两国共用的国界，
 *   国界上的一点是两个词之间的「联系」。
 * 坐标系是 160 × 100。形状由 scratchpad 的 blocks2.py 生成（墙面上平着设计，再用针孔相机投影）。
 */

export const LOGO_W = 160;
export const LOGO_H = 100;

/** 「大」：实心的一块，只切出头两侧、两臂下面和两腿之间的缺口；右边被国界切齐。 */
export const BIG =
  '28.5,49.9 16.3,66.1 16.3,98.5 52.8,98.5 59.4,76.2 65.8,98.5 88.8,98.5 93.3,71.5 85.6,57.3 95.4,58.6 99.2,36 73.4,30.7 73.4,9.4 44.2,1.5 44.2,24.8 16.3,19.1 16.3,48.3';
/** 「小」的竖钩：底部向左勾。 */
export const SMALL_MAIN = '111.8,87.7 104,98.5 126.2,98.5 126.2,34.1 111.8,30.7';
/** 「小」左边的点：左边缘被国界切齐，和「大」的右臂隔着国界相对。 */
export const SMALL_LEFT = '103.7,81.8 109.2,46.5 100.2,45 94.2,81.3';
/** 「小」右边的点。 */
export const SMALL_RIGHT = '133.1,83.4 143.7,84 139.5,51.9 128.5,49.9';
/** 共用的国界：一条斜切的直线（比两块都长一点，像裁切线），和上面的联系点。 */
export const BORDER = 'M105.1 8 L89.9 100';
export const NODE = { cx: 98.1, cy: 49.9 };

/** 标志的各个部分。icon：图标尺寸时国界加粗、联系点放大，免得缩小后看不见。 */
export function LogoShapes({ icon = false }: { icon?: boolean }) {
  return (
    <>
      <polygon points={BIG} class="mark-big" />
      <polygon points={SMALL_MAIN} class="mark-small" />
      <polygon points={SMALL_LEFT} class="mark-small" />
      <polygon points={SMALL_RIGHT} class="mark-small" />
      <path d={BORDER} class={icon ? 'mark-border mark-border--icon' : 'mark-border'} />
      <circle cx={NODE.cx} cy={NODE.cy} r={icon ? 5 : 2.6} class="mark-node" />
    </>
  );
}
