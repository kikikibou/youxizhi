"""
Builds src/fonts/loader/*.woff2: the faces the loading screen cycles through
while the street loads (see loaderFaces in src/main.js). Each keeps only the
letters of PAMPLEMOUSSE, so the lot weighs a few kilobytes.

The faces are ones the site doesn't otherwise use, each in a different
spirit: a fat-face didone, blackletter, neon inline, a monospace, Roman
capitals with flourishes, a rounded sans, and shaded signage. All are under
the SIL Open Font License 1.1 (Google Fonts, via Fontsource); the licence
text is in src/fonts/OFL.txt. A subset is a Modified Version under that
licence, and some of these have Reserved Font Names (Abril, Cinzel,
UnifrakturMaguntia), so every subset is renamed "Loader …" (their copyright
and licence entries are kept).

Run from the project root, pointing at a folder holding the Fontsource
packages unpacked (npm pack @fontsource/<name>, then untar each into
<folder>/fontsource-<name>/):
  python scripts/loader-faces.py <folder>
"""
import os
import sys
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

TEXT = 'PAMPLEMOUSSE'
OUT = 'src/fonts/loader'

# out name: (package, file, the subset's own family name)
FACES = {
    'fatface': ('abril-fatface', 'abril-fatface-latin-400-normal.woff2', 'Loader Fatface'),
    'blackletter': ('unifrakturmaguntia', 'unifrakturmaguntia-latin-400-normal.woff2', 'Loader Blackletter'),
    'neon': ('monoton', 'monoton-latin-400-normal.woff2', 'Loader Neon'),
    'mono': ('space-mono', 'space-mono-latin-700-normal.woff2', 'Loader Mono'),
    'inscription': ('cinzel-decorative', 'cinzel-decorative-latin-700-normal.woff2', 'Loader Inscription'),
    'rounded': ('fredoka', 'fredoka-latin-600-normal.woff2', 'Loader Rounded'),
    'shade': ('bungee-shade', 'bungee-shade-latin-400-normal.woff2', 'Loader Shade'),
}


def rename(font, family):
    """The font's names set to `family` (Regular); copyright and licence kept."""
    names = font['name']
    keep = {0, 7, 8, 9, 10, 11, 12, 13, 14}
    names.names = [n for n in names.names if n.nameID in keep]
    for nid, value in {1: family, 2: 'Regular', 3: f'{family};subset', 4: family, 5: 'Version 1.000', 6: family.replace(' ', '-')}.items():
        names.setName(value, nid, 3, 1, 0x409)
        names.setName(value, nid, 1, 0, 0)


def main(src):
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        if old.endswith('.woff2'):
            os.remove(os.path.join(OUT, old))
    for name, (pkg, file, family) in FACES.items():
        path = os.path.join(src, f'fontsource-{pkg}', 'package', 'files', file)
        font = TTFont(path)
        opts = Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['kern', 'liga']
        opts.name_IDs = ['*']  # (keeps the copyright and licence names)
        sub = Subsetter(opts)
        sub.populate(text=TEXT)
        sub.subset(font)
        rename(font, family)
        out = os.path.join(OUT, f'{name}.woff2')
        font.flavor = 'woff2'
        font.save(out)
        print(f'{out}: {os.path.getsize(out)} bytes')


if __name__ == '__main__':
    main(sys.argv[1])
