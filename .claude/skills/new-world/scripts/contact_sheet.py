"""Lay the desktop screenshots of every direction out on one sheet.

Usage: python -I contact_sheet.py <shots-dir> <out.png>

<shots-dir> holds one folder per direction (e.g. 01-guotie-chepiao/), each with
1440x900.png (and 390x844.png, placed beside it). Folders are sorted by name and
labelled with that name.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DESK_W = 720          # desktop thumbnail width (1440x900 -> 720x450)
PHONE_H = 450         # phone thumbnail height, matched to the desktop one
GAP = 24
LABEL_H = 40
COLS = 2


def font(size):
    for name in ("msyh.ttc", "simhei.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main(shots_dir, out_path):
    dirs = sorted(p for p in Path(shots_dir).iterdir() if p.is_dir())
    if not dirs:
        sys.exit(f"no direction folders in {shots_dir}")
    tiles = []
    for d in dirs:
        desk = Image.open(d / "1440x900.png").convert("RGB")
        desk = desk.resize((DESK_W, round(desk.height * DESK_W / desk.width)))
        phone_path = d / "390x844.png"
        phone = None
        if phone_path.exists():
            phone = Image.open(phone_path).convert("RGB")
            phone = phone.resize((round(phone.width * PHONE_H / phone.height), PHONE_H))
        w = DESK_W + (GAP // 2 + phone.width if phone else 0)
        tile = Image.new("RGB", (w, LABEL_H + max(desk.height, PHONE_H)), "#f2f2f2")
        tile.paste(desk, (0, LABEL_H))
        if phone:
            tile.paste(phone, (DESK_W + GAP // 2, LABEL_H))
        ImageDraw.Draw(tile).text((4, 6), d.name, fill="#111", font=font(22))
        tiles.append(tile)
    tw = max(t.width for t in tiles)
    th = max(t.height for t in tiles)
    rows = (len(tiles) + COLS - 1) // COLS
    sheet = Image.new("RGB", (GAP + COLS * (tw + GAP), GAP + rows * (th + GAP)), "#f2f2f2")
    for i, t in enumerate(tiles):
        r, c = divmod(i, COLS)
        sheet.paste(t, (GAP + c * (tw + GAP), GAP + r * (th + GAP)))
    sheet.save(out_path)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # console may be cp932/cp936
    print(out_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
