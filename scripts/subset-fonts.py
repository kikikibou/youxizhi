"""按用字给子站的字体做子集，输出 woff2，跟站点一起托管（正式页面不从 CDN 加载字体）。

在项目根目录运行：
  python -I scripts/subset-fonts.py src/<代号>/fonts.json          生成子集
  python -I scripts/subset-fonts.py src/<代号>/fonts.json --check  只检查文案里有没有子集缺的字（不需要字体源文件）

fonts.json 的写法：
  {
    "text": ["src/<代号>/**/*.js", "src/<代号>/**/*.css", "<代号>/index.html"],
    "extra": "",
    "out": "src/<代号>/fonts",
    "fonts": [
      {"file": "title.woff2", "src": "字体源/某字体-Bold.ttf",
       "from": "下载地址", "license": "OFL-1.1"}
    ]
  }
  - text：扫这些文件（glob，** 可跨目录），文件里出现的字都会带上。
  - extra：额外要带上的字，比如运行时才从服务器来的固定文案。
  - out：输出目录；生成的 woff2 和 fonts.lock.json 都要提交。
  - fonts：每个字体可以有自己的 "text" / "extra"，覆盖全局的（比如标题字体只扫标题文案）。
    字体声明了保留字体名时加 "rename": "新名字"，子集内部的名字会换成它，CSS 也用这个名字。
  - 总是带上：ASCII 可见字符、常用中文标点。
字体源文件放在不进仓库的 字体源/ 里。需要 fonttools 和 brotli（pip install fonttools brotli）。
"""
import glob
import json
import logging
import sys
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

logging.getLogger("fontTools").setLevel(logging.ERROR)  # e.g. "meta NOT subset; dropped"

ALWAYS = "".join(chr(c) for c in range(0x20, 0x7F)) + "，。、；：？！“”‘’（）《》〈〉【】「」『』—…·～　"


def collect(patterns, extra):
    files = []
    for pat in patterns:
        files += [Path(p) for p in glob.glob(pat, recursive=True) if Path(p).is_file()]
    chars = set(ALWAYS) | set(extra)
    for f in files:
        chars |= set(f.read_text(encoding="utf-8", errors="ignore"))
    chars = {c for c in chars if c.isprintable() or c == "　"}
    return chars, files


def rename(font, family):
    """子集是 OFL 说的「修改版」。字体声明了保留字体名（Reserved Font Name）时，
    修改版不能再用原名，所以把字体内部的名字换成 family。版权（0）、许可（13、14）不动。"""
    name = font["name"]
    ps = "".join(ch for ch in family if ch.isascii() and ch.isalnum()) or "Subset"
    for nid in (1, 2, 3, 4, 6, 16, 17, 18, 21, 22, 25):
        name.removeNames(nameID=nid)
    for nid, value in ((1, family), (2, "Regular"), (3, f"{ps}-Regular;subset"), (4, family), (6, f"{ps}-Regular")):
        name.setName(value, nid, 3, 1, 0x409)
        name.setName(value, nid, 1, 0, 0)


def fmt(chars, limit=60):
    s = "".join(sorted(chars))
    return s if len(s) <= limit else s[:limit] + f"…（共 {len(s)} 个）"


def main(config_path, check):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # console may be cp932/cp936
    cfg = json.loads(Path(config_path).read_text(encoding="utf-8"))
    out_dir = Path(cfg["out"])
    lock_path = out_dir / "fonts.lock.json"
    lock = json.loads(lock_path.read_text(encoding="utf-8")) if lock_path.exists() else {}
    problems = 0

    for spec in cfg["fonts"]:
        chars, files = collect(spec.get("text", cfg.get("text", [])), spec.get("extra", cfg.get("extra", "")))
        if not files:
            print(f"! {spec['file']}：text 的 glob 一个文件都没匹配到")
            problems += 1
        out = out_dir / spec["file"]

        if check:
            if not out.exists():
                print(f"! {spec['file']}：还没生成，先不加 --check 跑一次")
                problems += 1
                continue
            have = {chr(u) for u in TTFont(out).getBestCmap()}
            known_missing = set(lock.get(spec["file"], {}).get("missing_in_source", ""))
            new = {c for c in chars - have - known_missing if not c.isspace()}
            if new:
                print(f"! {spec['file']}：文案里多了子集没有的字，要重新生成：{fmt(new)}")
                problems += 1
            else:
                print(f"  {spec['file']}：齐全")
            continue

        font = TTFont(spec["src"])
        cmap = font.getBestCmap()
        have = {c for c in chars if ord(c) in cmap}
        missing = {c for c in chars - have if not c.isspace()}
        opts = Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        opts.hinting = False
        sub = Subsetter(opts)
        sub.populate(unicodes=[ord(c) for c in have])
        sub.subset(font)
        if spec.get("rename"):
            rename(font, spec["rename"])
        out_dir.mkdir(parents=True, exist_ok=True)
        font.flavor = "woff2"
        font.save(out)
        lock[spec["file"]] = {
            "src": spec["src"],
            "from": spec.get("from", ""),
            "license": spec.get("license", ""),
            "glyphs": len(have),
            "missing_in_source": "".join(sorted(missing)),
        }
        print(f"  {spec['file']}：{len(have)} 个字，{out.stat().st_size / 1024:.1f} KB")
        if missing:
            print(f"    字体本身没有、会落到后备字体的字：{fmt(missing)}")

    if not check:
        lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--check"]
    if len(args) != 1:
        sys.exit(__doc__)
    main(args[0], "--check" in sys.argv[1:])
