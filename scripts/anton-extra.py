"""
Builds src/fonts/anton-extra.woff2: the characters Anton doesn't have, drawn
from Anton's own outlines so they sit with its letters (3D lettering only,
see FONTS.display in src/three/typography.js and the FontFace in main.js).

  Greek capitals   the ones shaped like Latin letters use those letters
                   (with Anton's kerning); Γ Δ Θ Λ Ξ Π Σ Ω are built from
                   Anton's F, A, O, U and its stem and bar weights.
                   (Φ and Ψ aren't there yet.)
  ← →              Anton's ↑ turned on its side.

Anton is under the SIL Open Font License 1.1 (no reserved names), and so is
this font; the licence is in src/fonts/OFL.txt.

Run from the project root (needs fonttools, brotli, skia-pathops):
  python scripts/anton-extra.py
"""
import math
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps
from fontTools.subset import Subsetter, Options
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.reverseContourPen import ReverseContourPen
from fontTools.ttLib.tables._c_m_a_p import cmap_format_4

SRC = 'node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2'
OUT = 'src/fonts/anton-extra.woff2'

# Greek capitals that are Latin letters in Anton.
LOOKALIKE = {
    0x0391: 'A', 0x0392: 'B', 0x0395: 'E', 0x0396: 'Z', 0x0397: 'H', 0x0399: 'I', 0x039A: 'K',
    0x039C: 'M', 0x039D: 'N', 0x039F: 'O', 0x03A1: 'P', 0x03A4: 'T', 0x03A5: 'Y', 0x03A7: 'X',
}

font = TTFont(SRC)
opts = Options()
opts.layout_features = ['kern']
opts.hinting = False
opts.notdef_outline = True
opts.name_IDs = ['*']
sub = Subsetter(opts)
sub.populate(glyphs=sorted(set(LOOKALIKE.values()) | {'O', 'U', 'arrowup'}))
sub.subset(font)
glyphs = font.getGlyphSet()


def polys(*contours):
    """Glyph from polygons (TrueType: outer contours clockwise, holes anticlockwise)."""
    pen = TTGlyphPen(None)
    for pts in contours:
        pen.moveTo(pts[0])
        for p in pts[1:]:
            pen.lineTo(p)
        pen.closePath()
    return pen


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x0, y1), (x1, y1), (x1, y0)]


def draw(pen, name, matrix=(1, 0, 0, 1, 0, 0)):
    """Draw glyph `name` into pen through an affine matrix (kept clockwise)."""
    a, b, c, d = matrix[:4]
    target = TransformPen(pen, matrix)
    if a * d - b * c < 0:
        target = ReverseContourPen(target)
    glyphs[name].draw(target)


new = {}  # name: (pen, advance, unicode)

# Γ: Anton's F without its middle arm.
new['Gamma'] = (polys([(78, 0), (78, 1760), (782, 1760), (782, 1417), (432, 1417), (432, 0)]), 817, 0x0393)

# Λ and Δ: Anton's A (flat top, narrow counter) without its crossbar / with
# the counter closed by a bar along the baseline. (A's inner edges, carried down.)
A_OUT = [(30, 0), (200, 1760), (797, 1760), (964, 0)]
new['Lambda'] = (polys(A_OUT + [(631, 0), (502, 1460), (486, 1460), (372, 0)]), 994, 0x039B)
new['Delta'] = (polys(A_OUT, [(399, 300), (602, 300), (502, 1460), (486, 1460)]), 994, 0x0394)

# Θ: Anton's O with a bar across its counter.
pen = TTGlyphPen(None)
draw(pen, 'O')
for pts in [rect(400, 752, 596, 1008)]:
    pen.moveTo(pts[0])
    for p in pts[1:]:
        pen.lineTo(p)
    pen.closePath()
new['Theta'] = (pen, 996, 0x0398)

# Ξ: three bars, the outer two as heavy as E's, the middle one shorter.
new['Xi'] = (polys(rect(50, 1420, 790, 1760), rect(130, 746, 710, 1077), rect(40, 0, 800, 343)), 840, 0x039E)

# Π: H's stems under a top bar as heavy as F's.
new['Pi'] = (polys([(78, 0), (78, 1760), (944, 1760), (944, 0), (592, 0), (592, 1417), (432, 1417), (432, 0)]), 1022, 0x03A0)

# Σ: top and bottom bars as E's; between them two diagonals as heavy as a
# stem (measured square to the stroke), meeting in a point at mid-height.
TIP, W, R = 560, 380, 300  # the point, the diagonals' width across, where they leave the bars
dx = TIP - R
yk = 880 + 540 * (TIP - W - 40) / dx  # where the upper diagonal's left edge meets the left side
new['Sigma'] = (
    polys([(40, 0), (40, 1760 - yk), (TIP - W, 880), (40, yk), (40, 1760), (790, 1760), (790, 1420),
           (R, 1420), (TIP, 880), (R, 343), (805, 343), (805, 0)]),
    843, 0x03A3,
)

# Ω: Anton's U upside down, standing on two feet. (The feet reach well out:
# with Anton's slit of a counter, short ones read as a Λ on a small sign.)
FOOT, SHIFT, FOOT_H = 210, 210, 250
pen = TTGlyphPen(None)
draw(pen, 'U', (-1, 0, 0, -1, 970 + SHIFT, 1760))
for pts in [rect(57, 0, 57 + FOOT + 190, FOOT_H), rect(913 + SHIFT - 190, 0, 913 + 2 * SHIFT, FOOT_H)]:
    pen.moveTo(pts[0])
    for p in pts[1:]:
        pen.lineTo(p)
    pen.closePath()
new['Omega'] = (pen, 913 + 2 * SHIFT + 57, 0x03A9)

# → and ←: Anton's ↑ (672 wide, 1516 tall, its shaft centred on x = 396)
# turned on its side, its shaft shortened by CUT (set across a line the full
# length ran long beside the condensed letters), on the same centre line as
# ↑ and ↓ (y = 758).
CUT = 316
L = 1516 - CUT
adv = L + 2 * 60
mid = (CUT + 1516) / 2


class Shorten:
    """Pen filter: the shaft's foot (y = 0) moves up to CUT."""

    def __init__(self, pen):
        self.pen = pen

    def __getattr__(self, k):
        f = getattr(self.pen, k)
        return lambda *pts: f(*[(x, max(y, CUT)) for x, y in pts])


for name, flip, u in [('arrowright', 1, 0x2192), ('arrowleft', -1, 0x2190)]:
    pen = TTGlyphPen(None)
    # (x, y) -> (flip * (y - mid) + adv / 2, 758 - (x - 396))
    target = TransformPen(pen, (0, -1, flip, 0, adv / 2 - flip * mid, 758 + 396))
    if flip < 0:
        target = ReverseContourPen(target)
    glyphs['arrowup'].draw(Shorten(target))
    new[name] = (pen, adv, u)

order = list(font.getGlyphOrder()) + list(new)
glyf = font['glyf']
for name, (pen, advance, _) in new.items():
    glyf.glyphs[name] = pen.glyph()
glyf.glyphOrder = order
font.setGlyphOrder(order)
for name, (pen, advance, _) in new.items():
    g = font['glyf'][name]
    g.recalcBounds(font['glyf'])
    font['hmtx'][name] = (advance, g.xMin)
removeOverlaps(font, list(new))
for name in new:
    g = font['glyf'][name]
    g.recalcBounds(font['glyf'])
    font['hmtx'][name] = (new[name][1], g.xMin)

# cmap: only the new code points (Anton itself keeps the Latin ones).
mapping = {u: n for u, n in LOOKALIKE.items()}
mapping.update({u: n for n, (_, _, u) in new.items()})
table = cmap_format_4(4)
table.platformID, table.platEncID, table.language = 3, 1, 0
table.cmap = mapping
font['cmap'].tables = [table]
font['post'].formatType = 3.0

name = font['name']
for rec in list(name.names):
    if rec.nameID in (1, 3, 4, 6, 16, 17, 21, 22):
        name.removeNames(nameID=rec.nameID)
name.setName('Anton Extra', 1, 3, 1, 0x409)
name.setName('Anton Extra Regular', 4, 3, 1, 0x409)
name.setName('AntonExtra-Regular', 6, 3, 1, 0x409)
name.setName('Anton Extra: Greek capitals and side arrows drawn from Anton (youxizhi)', 3, 3, 1, 0x409)

font.flavor = 'woff2'
font.save(OUT)
print('wrote', OUT, len(new), 'new glyphs,', len(mapping), 'code points')
