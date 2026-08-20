#!/usr/bin/env python3
"""Hand-drawn furniture & room surfaces for pixel-office.

All pieces are drawn at small integer grids with the shared palette, saved x4.
Design references: boss.jpeg (executive desk, bookshelf, window, rug),
desk.jpeg (worker desk + monitor), Stardew-ish warmth.
"""
import os

from PIL import Image

from pixel_art import Grid, C, OUT, autoline

LEATHER = (122, 58, 68); LEATHER_D = (94, 44, 52); LEATHER_L = (150, 76, 86)
BRASS = (217, 168, 33); BRASS_D = (150, 112, 22)


# ---------------------------------------------------------------- worker desk
def worker_desk():
    g = Grid(112, 70)
    # monitor
    g.rect(36, 2, 76, 26, C["grayD"])                 # bezel
    g.rect(38, 4, 74, 23, C["screenD"])               # screen glass
    g.rect(38, 4, 74, 12, C["sky"])                   # wallpaper: sky
    g.rect(40, 8, 50, 12, C["cloud"])                 # cloud
    g.rect(42, 7, 48, 8, C["cloud"])
    g.disc(52, 12, 6, C["mtn"], squash=0.7)           # hills
    g.disc(64, 12, 7, C["mtn"], squash=0.7)
    g.rect(38, 13, 74, 23, C["grass"])                # foreground grass
    g.hline(38, 74, 13, C["leafD"])
    g.set(70, 23, C["leaf"]); g.set(45, 20, C["leaf"])
    g.set(74, 22, C["leaf"])                          # power LED
    g.rect(50, 27, 62, 30, C["grayD"])                # stand
    g.rect(46, 31, 66, 33, C["gray"])                 # stand base
    # desktop slab
    g.rect(2, 34, 109, 41, C["deskTop"])
    g.hline(2, 109, 34, C["woodH"])
    g.hline(2, 109, 41, C["woodD"])
    # keyboard + mouse on the desk
    g.rect(30, 32, 62, 33, C["grayD"])                # (shadow line)
    g.rect(30, 31, 62, 32, C["gray"])
    for x in range(32, 61, 4):
        g.set(x, 31, C["grayD"])
    g.rect(80, 31, 84, 33, C["grayD"])                # mouse
    g.set(82, 31, C["grayL"])
    # body: two pedestals + modesty panel
    g.rect(2, 42, 109, 68, C["wood"])
    g.rect(34, 42, 78, 62, C["woodD"])                # modesty panel (recessed)
    g.rect(36, 44, 76, 60, C["wood"])
    g.hline(36, 76, 44, C["woodL"])
    for px in (4, 84):                                 # pedestals
        g.rect(px, 42, px + 24, 68, C["wood"])
        g.vline(px, 42, 68, C["woodD"]); g.vline(px + 24, 42, 68, C["woodD"])
        for i, y in enumerate((44, 52, 60)):
            g.rect(px + 2, y, px + 22, y + 6, C["woodD"])       # drawer inset
            g.rect(px + 3, y + 1, px + 21, y + 5, C["wood"])    # drawer face
            g.hline(px + 3, px + 21, y + 1, C["woodL"])
            g.rect(px + 9, y + 3, px + 15, y + 4, C["woodH"])   # handle
    g.rect(2, 66, 109, 68, C["woodD"])                 # kick base
    autoline(g)
    return g


def office_chair():
    """rolling chair, back view (worker sits in it at the desk)"""
    g = Grid(26, 36)
    g.rect(6, 2, 19, 18, C["chairB"])                  # backrest
    g.rect(7, 3, 18, 6, C["chairB"])
    g.vline(6, 3, 17, C["chairBD"]); g.vline(19, 3, 17, C["chairBD"])
    g.hline(7, 18, 4, C["chairBD"])                    # top shade
    g.rect(8, 8, 17, 16, C["chairBD"])                 # inset panel
    g.rect(9, 9, 16, 15, C["chairB"])
    g.rect(5, 19, 20, 23, C["chairB"])                 # seat
    g.hline(5, 20, 23, C["chairBD"])
    g.vline(12, 24, 30, C["grayD"])                    # gas lift
    g.hline(4, 21, 31, C["grayD"])                     # star base
    g.line(4, 31, 12, 29, C["grayD"]); g.line(21, 31, 13, 29, C["grayD"])
    g.set(3, 32, C["out"]); g.set(22, 32, C["out"])    # casters
    g.set(4, 32, C["gray"]); g.set(21, 32, C["gray"])
    autoline(g)
    return g


# ---------------------------------------------------------------- boss set
def boss():
    """seated boss, front view, upper body (30x42) — navy suit, mustache"""
    g = Grid(30, 42)
    # clasped hands on the desk line (drawn early, arms cover later)
    g.rect(11, 34, 18, 38, C["skin"])                  # clasped hands
    g.set(12, 35, C["skinS"]); g.set(14, 35, C["skinS"]); g.set(16, 35, C["skinS"])
    g.set(13, 36, C["skinS"]); g.set(15, 36, C["skinS"]); g.set(17, 36, C["skinS"])
    # suit torso (wide shoulders)
    g.rect(4, 22, 25, 38, C["navy"])
    g.rect(3, 24, 5, 33, C["navy"])                    # left arm
    g.rect(24, 24, 26, 33, C["navy"])                  # right arm
    g.vline(25, 23, 37, C["navyD"]); g.vline(4, 25, 33, C["navyD"])
    g.hline(4, 25, 38, C["navyD"])
    # shirt V + red tie
    g.line(11, 22, 14, 27, C["eyeW"]); g.line(18, 22, 15, 27, C["eyeW"])
    g.rect(13, 23, 16, 24, C["redD"])                  # knot
    g.vline(14, 25, 31, C["red"]); g.vline(15, 25, 30, C["red"])
    g.vline(15, 25, 30, C["redD"])
    # lapels
    g.line(9, 22, 13, 28, C["navyD"]); g.line(20, 22, 16, 28, C["navyD"])
    g.line(9, 22, 13, 28, C["navyL"]); g.line(20, 22, 16, 28, C["navyL"])
    g.set(10, 26, C["navyL"])
    # neck + jowly face
    g.rect(12, 19, 17, 21, C["skin"])
    g.vline(12, 19, 21, C["skinS"])
    g.rect(7, 8, 22, 15, C["skin"])                    # face plane (wide)
    g.rect(8, 16, 21, 18, C["skin"])                   # jowls
    g.rect(10, 19, 19, 20, C["skin"])
    g.vline(8, 16, 18, C["skinS"]); g.vline(21, 16, 18, C["skinS"])
    g.rect(5, 11, 7, 13, C["skin"])                    # ears
    g.rect(22, 11, 24, 13, C["skin"])
    g.set(6, 12, C["skinS"]); g.set(23, 12, C["skinS"])
    # heavy brows + small eyes (tired/experienced)
    g.hline(10, 13, 10, C["bossHairD"]); g.hline(16, 19, 10, C["bossHairD"])
    g.rect(11, 11, 12, 13, C["eyeW"]); g.rect(17, 11, 18, 13, C["eyeW"])
    g.rect(11, 11, 12, 13, C["eye"]); g.rect(17, 11, 18, 13, C["eye"])
    g.set(11, 12, C["eyeS"]); g.set(17, 12, C["eyeS"])
    g.hline(11, 12, 14, C["skinS"]); g.hline(17, 18, 14, C["skinS"])  # eye bags
    # big nose + mustache
    g.rect(14, 12, 15, 14, C["skinS"])
    g.rect(10, 15, 19, 16, C["bossHairD"])             # mustache bar
    g.rect(9, 15, 10, 15, C["bossHairD"])              # left curl
    g.rect(19, 15, 20, 15, C["bossHairD"])             # right curl
    g.set(9, 14, C["bossHairD"]); g.set(20, 14, C["bossHairD"])
    g.hline(13, 16, 17, C["bossHair"])                 # mustache highlight
    # wavy hair (receding, graying brown)
    g.disc(14, 5, 7, C["bossHair"], squash=0.75)
    g.rect(7, 2, 22, 8, C["bossHair"])
    g.rect(6, 7, 8, 12, C["bossHair"])                 # side panels
    g.rect(21, 7, 23, 12, C["bossHair"])
    g.hline(9, 13, 9, C["bossHairD"])                  # hairline waves
    g.hline(16, 20, 9, C["bossHairD"])
    g.set(10, 8, C["bossHair"]); g.set(19, 8, C["bossHair"])
    g.hline(8, 12, 3, C["bossHairD"]); g.hline(17, 21, 3, C["bossHairD"])
    g.hline(10, 13, 4, C["hairL"]); g.hline(16, 19, 4, C["hairL"])
    g.set(11, 2, C["hairH"]); g.set(17, 3, C["hairH"])
    g.vline(6, 8, 11, C["bossHairD"]); g.vline(23, 8, 11, C["bossHairD"])
    autoline(g)
    return g


def boss_chair():
    """executive high-back armchair (40x46)"""
    g = Grid(40, 46)
    # high back with rounded top
    g.disc(19, 9, 10, LEATHER, squash=0.85)
    g.rect(9, 9, 30, 38, LEATHER)
    g.rect(10, 10, 29, 36, LEATHER)
    # side wings
    g.rect(6, 14, 9, 34, LEATHER_D)
    g.rect(30, 14, 33, 34, LEATHER_D)
    g.vline(9, 15, 33, LEATHER_L); g.vline(30, 15, 33, LEATHER_D)
    # tufted buttons
    for by in (14, 21, 28):
        for bx in (14, 19, 24):
            g.set(bx, by, LEATHER_D)
            g.set(bx + 1, by, LEATHER_D)
    # top highlight + wooden trim base
    g.hline(12, 26, 4, LEATHER_L)
    g.rect(10, 39, 29, 42, C["woodD"])
    g.rect(12, 43, 15, 45, C["wood"]); g.rect(24, 43, 27, 45, C["wood"])
    autoline(g)
    return g


def text_pixels(g, text, x, y, color, size=9):
    """render CJK text as chunky pixels via system font downscale"""
    from PIL import Image, ImageFont, ImageDraw
    big = size * 8
    font = None
    for fp in ("/System/Library/Fonts/PingFang.ttc",
               "/System/Library/Fonts/STHeiti Light.ttc",
               "/System/Library/Fonts/Hiragino Sans GB.ttc"):
        try:
            font = ImageFont.truetype(fp, big)
            break
        except Exception:
            continue
    if font is None:
        return
    tmp = Image.new("L", (big * len(text), big), 0)
    d = ImageDraw.Draw(tmp)
    d.text((0, 0), text, fill=255, font=font)
    bbox = tmp.getbbox()
    if not bbox:
        return
    tmp = tmp.crop(bbox)
    w9 = max(1, round(tmp.width * size / tmp.height))
    small = tmp.resize((w9, size), Image.LANCZOS)
    for yy in range(size):
        for xx in range(w9):
            if small.getpixel((xx, yy)) > 110:
                g.set(x + xx, y + yy, color)


def boss_desk():
    """executive desk with nameplate, lamp, mug, papers (150x64)"""
    g = Grid(150, 64)
    # desktop
    g.rect(2, 14, 147, 22, C["deskTop"])
    g.hline(2, 147, 14, C["woodH"]); g.hline(2, 147, 22, C["woodD"])
    # body with three carved panels
    g.rect(4, 23, 145, 58, C["wood"])
    for px in (10, 58, 106):
        g.rect(px, 27, px + 34, 52, C["woodD"])        # recess
        g.rect(px + 2, 29, px + 32, 50, C["wood"])     # panel
        g.rect(px + 4, 31, px + 30, 48, C["woodD"])    # inner trim
        g.rect(px + 5, 32, px + 29, 47, C["wood"])
        g.hline(px + 5, px + 29, 32, C["woodL"])
    g.rect(2, 58, 147, 62, C["woodD"])                 # base
    g.hline(2, 147, 58, C["woodL"])
    # brass nameplate with 总经理
    g.rect(60, 24, 90, 34, BRASS)
    g.rect(60, 24, 90, 34, BRASS)
    g.rect(60, 24, 90, 25, C["gold"]); g.hline(60, 90, 34, BRASS_D)
    g.vline(60, 24, 34, BRASS_D); g.vline(90, 24, 34, BRASS_D)
    text_pixels(g, "总经理", 63, 26, (90, 60, 14), size=8)
    # banker's lamp (left)
    g.rect(18, 2, 34, 8, (46, 122, 62))                # green shade
    g.rect(17, 8, 35, 10, (36, 96, 50))
    g.vline(25, 10, 14, BRASS); g.rect(21, 14, 30, 15, BRASS_D)
    g.hline(19, 33, 4, (120, 196, 130))
    # paper stack (center-left)
    g.rect(48, 8, 66, 13, C["paper"])
    g.vline(48, 8, 13, C["paperD"])
    g.hline(50, 64, 9, C["gray"]); g.hline(50, 64, 11, C["gray"])
    g.hline(52, 64, 13, C["paperD"])
    # mug (right of center)
    g.rect(98, 7, 105, 13, C["paper"])
    g.vline(98, 7, 13, C["paperD"])
    g.set(106, 9, C["paper"]); g.set(106, 10, C["paper"])  # handle
    g.hline(99, 104, 7, C["potD"])                     # coffee top
    g.set(101, 5, C["grayL"]); g.set(102, 4, C["grayL"])   # steam
    # pen holder (right)
    g.rect(124, 6, 133, 13, C["grayD"])
    g.rect(125, 7, 132, 12, C["gray"])
    g.line(127, 6, 126, 2, C["red"]); g.line(130, 6, 131, 2, C["tie"])
    autoline(g)
    return g


# ---------------------------------------------------------------- bookshelf
def bookshelf():
    g = Grid(52, 100)
    g.rect(2, 2, 49, 97, C["wood"])                    # case
    g.vline(2, 2, 97, C["woodD"]); g.vline(49, 2, 97, C["woodD"])
    g.hline(2, 49, 2, C["woodL"]); g.hline(2, 49, 97, C["woodD"])
    shelf_ys = [6, 26, 46, 66]
    books_palette = [(168, 66, 60), (70, 120, 170), (90, 150, 90), (200, 150, 60),
                     (130, 90, 160), (180, 100, 90), (60, 140, 140), (190, 170, 80)]
    for si, sy in enumerate(shelf_ys):
        g.rect(4, sy + 14, 47, sy + 16, C["woodD"])    # shelf board
        x = 5
        bi = si * 2
        while x < 44:
            bw = 2 + ((x + si) % 3)
            bh = 10 + ((x * 7 + si * 3) % 4)
            col = books_palette[(bi + x) % len(books_palette)]
            g.rect(x, sy + 14 - bh, x + bw, sy + 13, col)
            g.hline(x, x + bw, sy + 14 - bh, tuple(min(255, c + 30) for c in col))
            x += bw + 1
        if si == 1:                                    # small plant on shelf 2
            x0 = 40
            g.rect(x0, sy + 8, x0 + 6, sy + 13, C["pot"])
            g.set(x0 + 1, sy + 6, C["leaf"]); g.set(x0 + 3, sy + 5, C["leaf"])
            g.set(x0 + 2, sy + 7, C["leafD"]); g.set(x0 + 5, sy + 6, C["leaf"])
    # trophy on the third shelf
    g.rect(36, 50, 42, 56, C["gold"])
    g.rect(37, 44, 41, 50, C["gold"])
    g.set(35, 46, C["gold"]); g.set(43, 46, C["gold"])  # handles
    g.set(38, 45, C["goldD"])
    g.hline(37, 41, 44, C["goldH"])
    # bottom drawer
    g.rect(4, 84, 47, 94, C["woodD"])
    g.rect(6, 86, 45, 92, C["wood"])
    g.rect(21, 88, 29, 90, C["woodH"])
    autoline(g)
    return g


# ---------------------------------------------------------------- window
def window():
    g = Grid(64, 54)
    g.rect(0, 0, 63, 53, C["wood"])                    # outer frame
    g.rect(3, 3, 60, 50, C["woodD"])
    g.rect(5, 5, 58, 48, C["sky"])                     # sky
    g.rect(5, 40, 58, 48, C["grass"])                  # hills
    g.disc(18, 40, 10, C["mtn"], squash=0.6)
    g.disc(44, 41, 12, C["mtn"], squash=0.6)
    g.hline(5, 58, 40, C["leafD"])
    # clouds
    g.rect(10, 10, 20, 13, C["cloud"]); g.rect(12, 9, 18, 10, C["cloud"])
    g.rect(38, 18, 50, 21, C["cloud"]); g.rect(40, 17, 48, 18, C["cloud"])
    # mullions
    g.rect(30, 5, 33, 48, C["wood"])
    g.rect(5, 25, 58, 28, C["wood"])
    g.hline(30, 33, 25, C["woodL"])
    # inner highlights
    g.hline(5, 58, 5, C["woodL"])
    g.rect(0, 51, 63, 53, C["woodD"])                  # sill
    g.hline(0, 63, 51, C["woodL"])
    autoline(g)
    return g


# ---------------------------------------------------------------- surfaces
def floor_tile():
    g = Grid(48, 48)
    tones = [C["woodL"], (190, 142, 92), (184, 134, 86), (196, 148, 98)]
    for row in range(4):
        y0 = row * 12
        t = tones[row % len(tones)]
        g.rect(0, y0, 47, y0 + 11, t)
        g.hline(0, 47, y0 + 11, C["woodD"])            # plank seam
        # grain
        for i in range(3):
            gx = (row * 17 + i * 13 + 5) % 44
            gy = y0 + 2 + (i * 3) % 8
            g.hline(gx, gx + 5, gy, tuple(max(0, c - 18) for c in t))
        # butt joint
        jx = (row * 23 + 14) % 48
        g.vline(jx, y0, y0 + 10, tuple(max(0, c - 30) for c in t))
    # knots
    for (kx, ky) in [(12, 8), (36, 30), (20, 42)]:
        g.set(kx, ky, C["woodD"]); g.set(kx + 1, ky, C["woodD"])
        g.set(kx, ky + 1, C["wood"]); g.set(kx + 1, ky + 1, C["woodD"])
    return g


def wall_tile():
    g = Grid(48, 48)
    g.rect(0, 0, 47, 47, (232, 211, 168))
    for x in range(0, 48, 12):
        g.vline(x, 0, 47, (222, 200, 156))             # stripe
        g.vline(x + 1, 0, 47, (238, 218, 176))
    for (sx, sy) in [(7, 9), (19, 22), (31, 35), (43, 12), (25, 44), (37, 5)]:
        g.set(sx, sy, (214, 192, 148))                 # speckles
    return g


def rug():
    g = Grid(150, 44)
    g.rect(0, 0, 149, 43, C["rugR"])
    g.rect(2, 2, 147, 41, C["rugRD"])
    g.rect(4, 4, 145, 39, C["rugR"])
    # gold border trim
    g.hline(4, 145, 6, C["rugG"]); g.hline(4, 145, 37, C["rugG"])
    g.vline(6, 6, 37, C["rugG"]); g.vline(143, 6, 37, C["rugG"])
    # diamond medallions
    for cx in (38, 75, 112):
        for r in range(8, 0, -2):
            g.hline(cx - r // 2, cx + r // 2, 22 - (8 - r), C["rugRD"] if r % 4 else C["rugG"])
            g.hline(cx - r // 2, cx + r // 2, 22 + (8 - r), C["rugRD"] if r % 4 else C["rugG"])
        g.set(cx, 22, C["rugG"])
    # speckle texture
    for i in range(90):
        x = (i * 37 + 11) % 146 + 2
        y = (i * 23 + 7) % 40 + 2
        g.set(x, y, C["rugRD"])
    autoline(g)
    return g


def certificate():
    g = Grid(22, 28)
    g.rect(0, 0, 21, 27, C["wood"])
    g.rect(2, 2, 19, 25, C["paper"])
    g.rect(2, 2, 19, 4, C["paperD"])
    for i, y in enumerate(range(7, 16, 2)):
        g.hline(5, 16 - (i % 2) * 3, y, C["gray"])
    g.rect(14, 19, 18, 23, C["red"])                   # seal
    g.set(15, 20, C["redD"]); g.set(16, 21, C["redD"]); g.set(17, 22, C["redD"])
    g.hline(4, 10, 21, C["gold"])                      # ribbon
    autoline(g)
    return g


def chart():
    g = Grid(34, 26)
    g.rect(0, 0, 33, 25, C["wood"])
    g.rect(2, 2, 31, 23, C["paper"])
    g.hline(5, 29, 20, C["grayD"])                     # x axis
    g.vline(5, 5, 20, C["grayD"])                      # y axis
    bars = [(8, 12), (13, 8), (18, 14), (23, 6), (28, 10)]
    for bx, bh in bars:
        g.rect(bx, 20 - bh, bx + 3, 19, C["tie"])
        g.hline(bx, bx + 3, 20 - bh, C["tieL"])
    autoline(g)
    return g


def trash():  # finer wire bin (replaces make_props version)
    g = Grid(18, 22)
    g.rect(3, 3, 14, 4, C["gray"])                     # rim
    g.hline(3, 14, 3, C["grayL"])
    for xx in (4, 7, 10, 13):
        g.line(xx, 5, xx - 1, 19, C["gray"])
    for yy in (8, 12, 16):
        g.line(3, yy, 14, yy, C["gray"])
    g.line(4, 19, 12, 19, C["grayD"])
    g.disc(8, 2, 2, C["paper"])                        # crumpled paper
    autoline(g)
    return g


PIECES = {
    "desk.png": worker_desk(),
    "chair_office.png": office_chair(),
    "boss.png": boss(),
    "boss_chair.png": boss_chair(),
    "boss_desk.png": boss_desk(),
    "bookshelf.png": bookshelf(),
    "window.png": window(),
    "floor_tile.png": floor_tile(),
    "wall_tile.png": wall_tile(),
    "rug.png": rug(),
    "certificate.png": certificate(),
    "chart.png": chart(),
    "trash.png": trash(),
}

# ---------------------------------------------------------------- generated room variants
# Existing PIECES are the original runtime sprites and are intentionally not
# written by this generator. The following assets use new names only.
WINDOW_NAMES = ("dawn", "morning", "noon", "afternoon", "dusk", "night")


WINDOW_PALETTES = (
    # sky, horizon, hill, grass, sun/moon, cloud, stars
    ((229, 157, 165), (247, 194, 156), (109, 105, 153), (94, 139, 105), (255, 212, 119), (255, 225, 207), None),
    ((128, 192, 231), (166, 214, 235), (73, 143, 98), (83, 164, 89), (255, 226, 127), C["cloud"], None),
    ((93, 179, 232), (142, 210, 239), (58, 126, 91), (74, 166, 82), (255, 237, 143), C["cloud"], None),
    ((219, 161, 104), (242, 192, 112), (112, 93, 83), (101, 137, 75), (255, 210, 110), (255, 229, 190), None),
    ((168, 105, 143), (229, 139, 113), (65, 69, 112), (66, 91, 87), (255, 183, 102), (240, 189, 196), None),
    ((35, 48, 91), (54, 72, 123), (38, 56, 88), (44, 77, 83), (241, 224, 164), None, (177, 202, 235)),
)


def _window_variant(index):
    sky, horizon, hill, grass, sun, cloud, stars = WINDOW_PALETTES[index]
    g = Grid(64, 54)
    # Interior is deliberately identical in geometry to window().
    g.rect(0, 0, 63, 53, C["wood"])
    g.rect(3, 3, 60, 50, C["woodD"])
    g.rect(5, 5, 58, 48, sky)
    if index == 0:  # dawn: two warm bands before the hills
        g.rect(5, 22, 58, 39, horizon)
        g.disc(18, 34, 5, sun, squash=0.8)
    elif index == 1:  # morning
        g.rect(5, 31, 58, 39, horizon)
        g.disc(48, 17, 4, sun, squash=0.8)
    elif index == 2:  # noon
        g.disc(17, 15, 5, sun, squash=0.8)
        g.hline(5, 58, 30, horizon)
    elif index == 3:  # afternoon
        g.rect(5, 18, 58, 39, horizon)
        g.disc(49, 31, 5, sun, squash=0.8)
    elif index == 4:  # dusk
        g.rect(5, 23, 58, 39, horizon)
        g.disc(18, 33, 5, sun, squash=0.8)
    else:  # night
        g.disc(46, 15, 5, sun, squash=0.8)
        g.disc(48, 13, 5, sky, squash=0.8)  # crescent cut-out
        for sx, sy in ((12, 12), (25, 9), (36, 16), (52, 27), (27, 31), (10, 28)):
            g.set(sx, sy, stars)

    # shared landscape silhouette and lower window pane
    g.rect(5, 40, 58, 48, grass)
    g.disc(18, 40, 10, hill, squash=0.6)
    g.disc(44, 41, 12, hill, squash=0.6)
    g.hline(5, 58, 40, tuple(max(0, c - 22) for c in grass))
    if index in (0, 3, 4):
        g.hline(5, 58, 42, tuple(min(255, c + 12) for c in grass))
    if index == 5:
        g.rect(5, 40, 58, 48, grass)
        g.disc(18, 40, 10, hill, squash=0.6)
        g.disc(44, 41, 12, hill, squash=0.6)
        for sx, sy in ((14, 44), (22, 46), (41, 44), (48, 46)):
            g.set(sx, sy, (221, 183, 91))

    if cloud is not None:
        cloud_sets = {
            0: ((10, 10, 20, 13), (12, 9, 18, 10), (39, 18, 49, 21), (41, 17, 47, 18)),
            1: ((10, 11, 20, 14), (12, 10, 18, 11), (39, 18, 51, 21), (41, 17, 49, 18)),
            2: ((9, 9, 18, 12), (11, 8, 16, 9), (40, 16, 52, 19), (43, 15, 49, 16)),
            3: ((11, 12, 21, 15), (13, 11, 19, 12), (37, 19, 48, 22), (39, 18, 45, 19)),
            4: ((9, 13, 18, 16), (11, 12, 16, 13), (39, 20, 49, 23), (41, 19, 47, 20)),
        }
        for x0, y0, x1, y1 in cloud_sets[index]:
            g.rect(x0, y0, x1, y1, cloud)

    # same frame/mullions/sill anchor as the original window asset
    g.rect(30, 5, 33, 48, C["wood"])
    g.rect(5, 25, 58, 28, C["wood"])
    g.hline(30, 33, 25, C["woodL"])
    g.hline(5, 58, 5, C["woodL"])
    g.rect(0, 51, 63, 53, C["woodD"])
    g.hline(0, 63, 51, C["woodL"])
    autoline(g)
    return g


DESK_SPECS = (
    {
        "semantic": "mountain wallpaper + mug + notebook",
        "body": (146, 96, 52), "body_dark": (110, 68, 36), "body_light": (178, 128, 76),
        "top": (169, 117, 66), "frame": C["grayD"], "screen": "mountain",
        "props": ("mug", "notebook"),
    },
    {
        "semantic": "terminal/code + sticky notes + pencil cup",
        "body": (107, 70, 47), "body_dark": (70, 43, 30), "body_light": (150, 97, 62),
        "top": (137, 89, 55), "frame": (72, 74, 82), "screen": "terminal_code",
        "props": ("sticky_notes", "pencil_cup"),
    },
    {
        "semantic": "data charts + calculator + report",
        "body": (190, 139, 84), "body_dark": (135, 92, 52), "body_light": (218, 167, 105),
        "top": (202, 150, 91), "frame": (142, 145, 150), "screen": "data_charts",
        "props": ("calculator", "report"),
    },
    {
        "semantic": "document editor + books + fountain pen",
        "body": (94, 67, 57), "body_dark": (58, 42, 39), "body_light": (132, 93, 72),
        "top": (119, 81, 62), "frame": (67, 71, 84), "screen": "document_editor",
        "props": ("books", "fountain_pen"),
    },
    {
        "semantic": "DNA/molecule screen + small plant + sample tubes",
        "body": (73, 115, 101), "body_dark": (46, 77, 70), "body_light": (113, 156, 128),
        "top": (93, 141, 116), "frame": (79, 92, 99), "screen": "dna_molecule",
        "props": ("small_plant", "sample_tubes"),
    },
    {
        "semantic": "email/calendar + phone + file tray",
        "body": (126, 62, 67), "body_dark": (80, 38, 47), "body_light": (167, 84, 82),
        "top": (147, 73, 72), "frame": (76, 67, 83), "screen": "email_calendar",
        "props": ("phone", "file_tray"),
    },
    {
        "semantic": "starfield + headphones + snack",
        "body": (70, 76, 82), "body_dark": (43, 46, 51), "body_light": (106, 112, 119),
        "top": (91, 96, 101), "frame": (58, 64, 71), "screen": "starfield",
        "props": ("headphones", "snack"),
    },
    {
        "semantic": "system monitoring panel + desk lamp + toolbox",
        "body": (169, 115, 58), "body_dark": (111, 70, 34), "body_light": (202, 147, 76),
        "top": (184, 126, 63), "frame": (118, 126, 135), "screen": "system_monitoring",
        "props": ("desk_lamp", "toolbox"),
    },
)


def _draw_desk_screen(g, name):
    if name == "mountain":
        g.rect(38, 4, 74, 12, C["sky"]); g.rect(38, 13, 74, 23, C["grass"])
        g.rect(40, 8, 50, 12, C["cloud"]); g.rect(42, 7, 48, 8, C["cloud"])
        g.disc(52, 12, 6, C["mtn"], squash=0.7); g.disc(64, 12, 7, C["mtn"], squash=0.7)
        g.hline(38, 74, 13, C["leafD"])
    elif name == "terminal_code":
        bg, ink, accent = (32, 44, 57), (106, 186, 113), (221, 174, 78)
        g.rect(38, 4, 74, 23, bg)
        for y, length in ((7, 18), (10, 26), (13, 13), (16, 30), (19, 22), (22, 15)):
            g.hline(40, 40 + length, y, ink if y % 2 else accent)
        g.set(43, 7, (202, 231, 181)); g.set(68, 16, (207, 127, 103))
    elif name == "data_charts":
        g.rect(38, 4, 74, 23, C["paper"])
        g.hline(41, 71, 20, C["grayD"]); g.vline(42, 7, 20, C["grayD"])
        for x, height, col in ((47, 7, C["tie"]), (54, 11, C["teal"]), (61, 5, C["red"]), (68, 14, C["gold"])):
            g.rect(x, 20 - height, x + 3, 19, col); g.hline(x, x + 3, 20 - height, C["grayL"])
    elif name == "document_editor":
        g.rect(38, 4, 74, 23, C["paper"])
        g.rect(38, 4, 74, 7, (84, 113, 158)); g.rect(42, 6, 49, 8, (170, 203, 220))
        for y, end, col in ((13, 67, C["gray"]), (16, 72, C["grayD"]), (19, 62, C["gray"]), (22, 69, C["tie"])):
            g.hline(42, end, y, col)
        g.vline(40, 13, 22, C["paperD"]); g.set(70, 22, C["red"])
    elif name == "dna_molecule":
        g.rect(38, 4, 74, 23, (29, 67, 78))
        for x, y in ((43, 7), (47, 11), (51, 15), (55, 19), (59, 23)):
            g.set(x, y, (236, 104, 94)); g.set(x + 8, y + 2, (106, 190, 202))
            g.line(x + 1, y, x + 7, y + 2, (236, 194, 102))
        g.line(44, 7, 60, 23, (240, 127, 102)); g.line(52, 7, 68, 23, (93, 185, 193))
        g.set(68, 8, (240, 194, 102)); g.set(70, 20, (240, 194, 102))
    elif name == "email_calendar":
        g.rect(38, 4, 55, 23, (226, 239, 232)); g.rect(57, 4, 74, 23, (191, 211, 220))
        g.rect(40, 7, 53, 10, (110, 158, 187)); g.hline(41, 52, 13, C["gray"]); g.hline(41, 50, 16, C["gray"])
        g.hline(41, 52, 19, C["grayD"]); g.hline(41, 49, 22, C["gray"])
        g.rect(59, 7, 72, 10, (91, 125, 161)); g.hline(59, 72, 12, C["paperD"])
        for x, y in ((60, 15), (65, 15), (70, 15), (60, 20), (65, 20), (70, 20)):
            g.rect(x, y, x + 2, y + 2, C["paper"] if (x + y) % 2 else C["red"])
    elif name == "starfield":
        g.rect(38, 4, 74, 23, (28, 40, 79))
        for x, y, col in ((42, 8, (229, 224, 157)), (49, 14, (174, 204, 235)), (55, 7, (229, 224, 157)),
                          (62, 17, (174, 204, 235)), (68, 10, (229, 224, 157)), (72, 21, (174, 204, 235))):
            g.set(x, y, col)
        g.disc(57, 14, 4, (82, 105, 163), squash=0.8); g.set(60, 12, (114, 143, 194))
    elif name == "system_monitoring":
        g.rect(38, 4, 74, 23, (29, 44, 39))
        g.rect(40, 6, 50, 12, (39, 70, 64)); g.rect(52, 6, 72, 12, (35, 61, 66))
        g.hline(42, 48, 8, (123, 202, 119)); g.hline(54, 67, 8, (224, 176, 76))
        g.hline(42, 47, 10, (224, 98, 88)); g.hline(54, 70, 10, (104, 180, 204))
        g.rect(40, 14, 72, 21, (38, 63, 56)); g.hline(42, 68, 16, (130, 193, 109)); g.hline(42, 58, 19, (224, 176, 76))
        g.set(70, 16, (224, 98, 88)); g.set(69, 19, (104, 180, 204))


def _draw_desk_prop(g, name):
    if name == "mug":
        g.rect(82, 27, 88, 32, C["paper"]); g.vline(82, 27, 32, C["paperD"])
        g.set(89, 28, C["paper"]); g.set(89, 29, C["paper"]); g.hline(83, 87, 27, C["potD"])
    elif name == "notebook":
        g.rect(8, 27, 23, 33, (74, 99, 145)); g.rect(10, 26, 21, 32, C["paper"])
        g.hline(11, 19, 28, C["paperD"]); g.hline(11, 18, 30, C["gray"]); g.vline(10, 27, 32, (177, 72, 73))
    elif name == "sticky_notes":
        g.rect(8, 27, 15, 34, (244, 206, 93)); g.hline(9, 14, 29, (212, 155, 54))
        g.rect(17, 29, 23, 34, (241, 151, 87)); g.hline(18, 21, 31, (198, 98, 66))
    elif name == "pencil_cup":
        g.rect(93, 27, 102, 34, (65, 117, 89)); g.hline(93, 102, 27, (119, 196, 130))
        g.line(95, 27, 94, 19, (205, 115, 91)); g.line(98, 27, 100, 18, C["gold"])
        g.line(100, 27, 103, 20, (75, 104, 175)); g.set(96, 19, (232, 179, 90))
    elif name == "calculator":
        g.rect(82, 26, 94, 34, C["grayD"]); g.rect(84, 27, 92, 30, C["screenD"])
        for x, y in ((85, 32), (88, 32), (91, 32), (85, 33), (88, 33), (91, 33)):
            g.set(x, y, C["grayL"])
    elif name == "report":
        g.rect(8, 27, 22, 33, C["paper"]); g.rect(10, 26, 21, 32, C["paper"])
        g.hline(11, 19, 28, C["gray"]); g.hline(11, 18, 30, C["grayD"])
        g.rect(17, 30, 19, 31, C["tie"]); g.rect(20, 28, 21, 31, C["teal"])
    elif name == "books":
        g.rect(8, 31, 24, 34, (149, 61, 68)); g.rect(9, 28, 24, 31, (66, 103, 153)); g.rect(11, 26, 24, 28, (183, 130, 55))
        g.hline(12, 22, 27, (245, 207, 99)); g.hline(10, 22, 29, (129, 167, 197))
    elif name == "fountain_pen":
        g.line(84, 32, 102, 27, (66, 82, 141)); g.line(84, 32, 99, 28, (52, 61, 111))
        g.set(102, 27, C["gold"]); g.set(103, 26, C["goldH"]); g.set(85, 32, C["red"])
    elif name == "small_plant":
        g.rect(87, 27, 94, 33, C["pot"]); g.hline(87, 94, 33, C["potD"])
        g.disc(90, 24, 4, C["leaf"], squash=0.75); g.set(88, 22, C["leafL"]); g.set(92, 21, C["leafD"])
    elif name == "sample_tubes":
        for x, col in ((9, C["red"]), (14, C["teal"]), (19, C["gold"])):
            g.rect(x, 27, x + 3, 34, C["grayD"]); g.rect(x + 1, 29, x + 2, 32, col); g.hline(x, x + 3, 27, C["grayL"])
    elif name == "phone":
        g.rect(84, 26, 92, 34, C["out"]); g.rect(85, 27, 91, 32, (89, 152, 179)); g.rect(86, 28, 90, 30, (187, 224, 210))
        g.set(88, 32, C["grayL"])
    elif name == "file_tray":
        g.rect(8, 30, 24, 34, C["grayD"]); g.rect(10, 27, 22, 31, C["paper"]); g.rect(12, 26, 21, 29, C["paper"])
        g.hline(13, 19, 28, C["red"]); g.hline(10, 22, 32, C["gray"])
    elif name == "headphones":
        g.line(80, 18, 80, 11, C["red"]); g.line(80, 11, 88, 8, C["red"]); g.line(88, 8, 92, 14, C["red"])
        g.rect(78, 17, 82, 22, C["grayD"]); g.rect(90, 17, 94, 22, C["grayD"])
        g.set(79, 18, C["red"]); g.set(91, 18, C["red"])
    elif name == "snack":
        g.rect(96, 27, 105, 34, (225, 148, 66)); g.hline(97, 104, 28, (255, 211, 103))
        g.rect(98, 30, 102, 32, C["paper"]); g.set(100, 31, C["red"])
    elif name == "desk_lamp":
        g.rect(91, 19, 103, 23, (65, 117, 89)); g.hline(93, 101, 20, (119, 196, 130))
        g.vline(97, 23, 31, C["gold"]); g.rect(93, 31, 101, 33, C["goldD"])
    elif name == "toolbox":
        g.rect(8, 28, 24, 34, (176, 62, 54)); g.rect(10, 26, 22, 29, C["redD"])
        g.rect(12, 27, 20, 29, C["red"]); g.rect(12, 31, 20, 32, C["gold"]); g.set(15, 31, C["goldD"])


def _desk_variant(index):
    spec = DESK_SPECS[index]
    body = spec["body"]
    body_dark = spec["body_dark"]
    body_light = spec["body_light"]
    top = spec["top"]
    frame = spec["frame"]
    g = Grid(112, 70)
    # monitor and its fixed position
    g.rect(36, 2, 76, 26, frame)
    g.rect(38, 4, 74, 23, C["screenD"])
    _draw_desk_screen(g, spec["screen"])
    g.rect(50, 27, 62, 30, C["grayD"])
    g.rect(46, 31, 66, 33, C["gray"])
    # shared desktop silhouette with variant finish
    g.rect(2, 34, 109, 41, top)
    g.hline(2, 109, 34, body_light)
    g.hline(2, 109, 41, body_dark)
    # keyboard, mouse, and one fixed desk-side prop
    g.rect(30, 32, 62, 33, C["grayD"]); g.rect(30, 31, 62, 32, C["gray"])
    for x in range(32, 61, 4):
        g.set(x, 31, C["grayD"])
    g.rect(80, 31, 84, 33, C["grayD"]); g.set(82, 31, C["grayL"])
    for prop_name in spec["props"]:
        _draw_desk_prop(g, prop_name)
    # body, inset modesty panel, and two drawer pedestals
    g.rect(2, 42, 109, 68, body)
    g.rect(34, 42, 78, 62, body_dark)
    g.rect(36, 44, 76, 60, body)
    g.hline(36, 76, 44, body_light)
    for px in (4, 84):
        g.rect(px, 42, px + 24, 68, body)
        g.vline(px, 42, 68, body_dark); g.vline(px + 24, 42, 68, body_dark)
        for i, y in enumerate((44, 52, 60)):
            g.rect(px + 2, y, px + 22, y + 6, body_dark)
            g.rect(px + 3, y + 1, px + 21, y + 5, body)
            g.hline(px + 3, px + 21, y + 1, body_light)
            handle = C["goldH"] if index in (1, 3, 6) else C["woodH"]
            g.rect(px + 9, y + 3, px + 15, y + 4, handle)
    g.rect(2, 66, 109, 68, body_dark)
    autoline(g)
    return g


def _save_exact_pantry_grid(g, name):
    """Save a 47x56 source grid as the exact 752x888 scene rectangle."""
    # The scene rectangle is 188x222 logical pixels and all project sprites
    # are stored at 4x. A 47x56 source cell therefore expands to 16 physical
    # pixels per source pixel before the final two-pixel height crop.
    image = g.img.resize((752, 896), Image.Resampling.NEAREST)
    image = image.crop((0, 0, 752, 888))
    path = os.path.join(OUT, name)
    image.save(path)
    print(f"  {name}: {image.size}")
    return image


def _pantry_back():
    g = Grid(47, 56)
    wall = (235, 211, 171)
    g.rect(0, 0, 46, 54, wall)
    for x in (5, 15, 25, 35, 45):
        g.vline(x, 1, 34, (222, 193, 148))
    g.rect(0, 0, 46, 2, C["woodD"]); g.rect(0, 0, 2, 54, C["woodD"])
    g.rect(44, 0, 46, 54, C["woodD"])
    # backsplash and the counter behind the occlusion layer
    g.rect(2, 34, 44, 39, C["woodD"])
    g.rect(2, 34, 44, 36, C["woodH"])
    # left tea cabinet
    g.rect(3, 7, 18, 34, C["wood"]); g.rect(4, 8, 17, 33, C["woodD"])
    g.rect(5, 10, 16, 32, C["wood"])
    for y in (16, 23, 30):
        g.rect(5, y, 16, y + 1, C["woodD"]); g.hline(6, 15, y, C["woodL"])
    # cup rack and hanging cups
    g.hline(6, 16, 12, C["goldD"]); g.hline(6, 16, 13, C["gold"])
    for x in (7, 10, 13, 16):
        g.rect(x, 14, x + 1, 17, C["paper"]); g.set(x + 2, 15, C["paperD"])
    # coffee machine
    g.rect(7, 25, 18, 35, C["grayD"]); g.rect(8, 24, 17, 27, C["gray"])
    g.rect(10, 27, 15, 32, C["tealD"]); g.rect(11, 28, 14, 30, C["teal"])
    g.set(9, 26, C["red"]); g.set(16, 26, C["gold"])
    g.rect(10, 33, 16, 35, C["paper"]); g.hline(11, 15, 33, C["potD"])
    g.set(9, 22, C["grayL"]); g.set(10, 20, C["grayL"])
    # kettle and tea tin
    g.rect(22, 29, 29, 35, C["goldD"]); g.disc(25, 30, 4, C["gold"], squash=0.75)
    g.hline(22, 24, 29, C["goldH"]); g.line(28, 31, 32, 29, C["goldD"])
    g.rect(23, 26, 27, 28, C["woodD"]); g.hline(24, 26, 26, C["gold"])
    # fridge with magnets and handle
    g.rect(31, 5, 43, 35, C["grayD"]); g.rect(32, 6, 42, 34, C["metal"])
    g.hline(32, 20, 20, C["metalD"]); g.vline(40, 9, 17, C["grayD"]); g.vline(40, 23, 30, C["grayD"])
    g.rect(34, 11, 36, 13, C["red"]); g.set(38, 9, C["teal"]); g.set(36, 26, C["gold"])
    # small tea sign and shelf
    g.rect(23, 8, 29, 15, C["wood"]); g.rect(24, 9, 28, 14, C["paper"])
    g.set(26, 10, C["leaf"]); g.set(25, 11, C["leafL"]); g.set(27, 12, C["leafD"])
    g.hline(22, 30, 18, C["woodD"]); g.hline(22, 30, 19, C["woodL"])
    # warm floor strip behind the bar
    g.rect(2, 39, 44, 54, C["wood"]); g.hline(2, 44, 39, C["woodL"])
    autoline(g)
    return g


def _pantry_front():
    g = Grid(47, 56)
    # Foreground counter deliberately occupies the lower scene band so a
    # worker drawn between back/front layers is correctly occluded.
    g.rect(0, 35, 46, 40, C["woodD"])
    g.rect(0, 35, 46, 37, C["woodH"])
    g.rect(1, 40, 45, 54, C["wood"])
    g.hline(1, 45, 40, C["woodL"]); g.hline(1, 45, 54, C["woodD"])
    g.rect(4, 43, 17, 51, C["woodD"]); g.rect(6, 44, 15, 50, C["wood"])
    g.rect(29, 43, 42, 51, C["woodD"]); g.rect(31, 44, 40, 50, C["wood"])
    g.rect(21, 47, 25, 49, C["goldD"]); g.hline(22, 24, 47, C["goldH"])
    # two foreground stools are intentionally below the bar lip
    for x in (23, 35):
        g.rect(x - 3, 50, x + 3, 52, C["tealD"])
        g.vline(x, 52, 54, C["woodD"])
        g.hline(x - 4, x + 4, 54, C["woodD"])
    autoline(g)
    return g


def generate_room_assets():
    print("time windows:")
    for index, name in enumerate(WINDOW_NAMES):
        g = _window_variant(index)
        image = g.img.resize((256, 216), Image.Resampling.NEAREST)
        image.save(os.path.join(OUT, f"window_{name}.png"))
        print(f"  window_{name}.png: {image.size}")

    print("desk variants:")
    for index in range(8):
        g = _desk_variant(index)
        image = g.img.resize((448, 280), Image.Resampling.NEAREST)
        image.save(os.path.join(OUT, f"desk_variant_{index}.png"))
        print(f"  desk_variant_{index}.png: {image.size}")

    print("tea room layers:")
    _save_exact_pantry_grid(_pantry_back(), "pantry_back.png")
    _save_exact_pantry_grid(_pantry_front(), "pantry_front.png")


if __name__ == "__main__":
    generate_room_assets()
