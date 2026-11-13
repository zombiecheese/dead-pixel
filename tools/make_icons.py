"""Draws Dead Pixel's logo: a pixel zombie head with its skull cracked open and the brain showing.
Writes public/favicon.svg, public/favicon.ico (16/32/48), public/icons/*.png and public/icons/logo.svg.
Run: python3 tools/make_icons.py (needs Pillow)."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PAL = {
    'k': (29, 24, 36),     # outline
    'p': (240, 138, 168),  # brain
    'P': (181, 80, 111),   # brain folds
    'q': (255, 196, 214),  # brain highlight
    'g': (111, 174, 90),   # skin
    'G': (63, 122, 60),    # skin shade
    'l': (160, 210, 122),  # skin light
    'w': (242, 240, 216),  # eye white
    'r': (210, 59, 59),    # pupil
    't': (232, 226, 192),  # teeth
    'm': (58, 20, 36),     # mouth
    'b': (140, 30, 40),    # blood at the crack
}
ART = [
    "....kkkkkkkk....",
    "...kpqpPpqppk...",
    "..kpqpPppPpqpk..",
    "..kpPppPqpPppk..",
    ".kGkpPpbpPpbkGk.",
    ".kgGkbkkbkkkGgk.",
    ".kglgggGgggglgk.",
    ".kgwwwgggkgkggk.",
    ".kgwrwggggkgggk.",
    ".kgwwwgggkgkggk.",
    ".kGggggkggggGgk.",
    ".kGgggkkggggGgk.",
    "..kGmtmtmtmtGk..",
    "..kGgmmmmmmgGk..",
    "...kkGggggGkk...",
    ".....kkkkkk.....",
]
assert all(len(r) == 16 for r in ART), [len(r) for r in ART]

def image(scale):
    im = Image.new('RGBA', (16 * scale, 16 * scale), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(ART):
        for x, c in enumerate(row):
            if c == '.':
                continue
            for dy in range(scale):
                for dx in range(scale):
                    px[x * scale + dx, y * scale + dy] = PAL[c] + (255,)
    return im

def svg():
    rects = []
    for y, row in enumerate(ART):
        x = 0
        while x < 16:
            c = row[x]
            if c == '.':
                x += 1
                continue
            run = 1
            while x + run < 16 and row[x + run] == c:
                run += 1
            r, g, b = PAL[c]
            rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="#{r:02x}{g:02x}{b:02x}"/>')
            x += run
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">'
            '<title>Dead Pixel</title>' + ''.join(rects) + '</svg>\n')

pub = ROOT / 'public'
(pub / 'favicon.svg').write_text(svg())
(pub / 'icons' / 'logo.svg').write_text(svg())
image(1).save(pub / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=[image(2), image(3)])
for s in (16, 32, 64, 128, 256):
    image(s // 16).save(pub / 'icons' / f'logo-{s}.png')
big = Image.new('RGBA', (180, 180), PAL['k'] + (255,))
big.alpha_composite(image(10), (10, 10))
big.save(pub / 'icons' / 'apple-touch-icon.png')
print('icons written')
