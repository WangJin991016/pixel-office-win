#!/usr/bin/env python3
"""Hand-drawn pixel-art engine + all pixel-office sprites.

Replaces the jpeg cutouts with code-drawn pixel art, using the reference
images (worker/boss/desk .jpeg) as design references: white-shirt/blue-tie
worker with ID badge and fluffy brown hair; mustached boss in navy suit;
wooden office desks with CRT-era monitors; warm Stardew-ish palette.

Everything renders on small integer grids (no AA) and is saved scaled x4.
"""
import os
from PIL import Image

TOOLS = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(TOOLS), "public", "assets")
os.makedirs(OUT, exist_ok=True)
SCALE = 4

# ---------------------------------------------------------------- palette
C = dict(
    out=(38, 26, 18),        # outline: warm near-black
    hairD=(74, 46, 28), hair=(107, 69, 48), hairL=(138, 95, 61), hairH=(168, 123, 79),
    skin=(242, 201, 160), skinS=(221, 168, 124), cheek=(232, 154, 124),
    eyeW=(252, 250, 246), eye=(52, 38, 28), eyeS=(255, 255, 255),
    shirt=(246, 244, 238), shirtS=(217, 214, 204), shirtD=(188, 185, 176),
    tie=(47, 95, 184), tieD=(31, 67, 133), tieL=(90, 132, 214),
    pants=(75, 80, 88), pantsD=(56, 60, 68),
    shoe=(110, 68, 38), shoeD=(78, 45, 24),
    wood=(146, 96, 52), woodD=(110, 68, 36), woodL=(178, 128, 76), woodH=(199, 152, 99),
    deskTop=(169, 117, 66),
    navy=(46, 63, 110), navyD=(34, 46, 82), navyL=(66, 86, 140),
    red=(168, 50, 58), redD=(128, 36, 42),
    gray=(150, 154, 162), grayD=(108, 112, 122), grayL=(196, 199, 206),
    metal=(206, 209, 214), metalD=(156, 160, 168),
    screen=(88, 170, 220), screenD=(52, 120, 170), grass=(96, 170, 88), mtn=(70, 140, 96),
    sky=(120, 190, 235), cloud=(245, 248, 250),
    leaf=(60, 154, 70), leafD=(37, 112, 47), leafL=(111, 195, 106),
    pot=(176, 99, 47), potD=(125, 63, 29), potL=(209, 138, 84),
    potB=(74, 96, 160), potBD=(52, 68, 120),
    teal=(62, 148, 134), tealD=(44, 112, 100), tealL=(92, 182, 166),
    paper=(245, 242, 232), paperD=(200, 195, 180),
    gold=(217, 168, 33), goldD=(168, 126, 20), goldH=(240, 200, 90),
    rugR=(122, 54, 56), rugRD=(96, 40, 44), rugG=(188, 154, 90),
    chairB=(58, 84, 150), chairBD=(42, 62, 116),      # office chair blue
    bossHair=(96, 74, 52), bossHairD=(72, 54, 38),
)


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h and c:
            self.px[x, y] = tuple(c) + (255,)

    def get(self, x, y):
        return self.px[x, y]

    def rect(self, x0, y0, x1, y1, c):            # inclusive
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)

    def hline(self, x0, x1, y, c):
        for x in range(x0, x1 + 1):
            self.set(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(y0, y1 + 1):
            self.set(x, y, c)

    def disc(self, cx, cy, r, c, squash=1.0):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if dx * dx + (dy * squash) ** 2 <= r * r + 0.5:
                    self.set(cx + dx, cy + dy, c)

    def ring(self, cx, cy, r, c, squash=1.0):
        for dy in range(-r - 1, r + 2):
            for dx in range(-r - 1, r + 2):
                d2 = dx * dx + (dy * squash) ** 2
                if r * r - r <= d2 <= r * r + r:
                    self.set(cx + dx, cy + dy, c)

    def line(self, x0, y0, x1, y1, c):
        dx, dy = abs(x1 - x0), abs(y1 - y0)
        sx = 1 if x0 < x1 else -1
        sy = 1 if y0 < y1 else -1
        err = dx - dy
        x, y = x0, y0
        while True:
            self.set(x, y, c)
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 > -dy: err -= dy; x += sx
            if e2 < dx: err += dx; y += sy

    def paste(self, other, dx, dy):
        for y in range(other.h):
            for x in range(other.w):
                p = other.px[x, y]
                if p[3]:
                    self.set(dx + x, dy + y, p[:3])

    def flip(self):
        g = Grid(self.w, self.h)
        for y in range(self.h):
            for x in range(self.w):
                p = self.px[x, y]
                if p[3]:
                    g.set(self.w - 1 - x, y, p[:3])
        return g

    def shift(self, dx, dy):
        g = Grid(self.w, self.h)
        g.paste(self, dx, dy)
        return g

    def save(self, name, scale=SCALE):
        img = self.img.resize((self.w * scale, self.h * scale), Image.NEAREST)
        img.save(os.path.join(OUT, name))
        print(f"  {name}: {img.size}")


def autoline(g, color=None):
    col = tuple(color or C["out"]) + (255,)
    w, h = g.w, g.h
    alpha = [[g.px[x, y][3] > 0 for x in range(w)] for y in range(h)]
    add = []
    for y in range(h):
        for x in range(w):
            if not alpha[y][x]:
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and alpha[ny][nx]:
                        add.append((x, y))
                        break
    for x, y in add:
        g.px[x, y] = col
