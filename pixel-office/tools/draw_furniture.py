#!/usr/bin/env python3
"""Hand-drawn furniture & room surfaces for pixel-office.

All pieces are drawn at small integer grids with the shared palette, saved x4.
Design references: boss.jpeg (executive desk, bookshelf, window, rug),
desk.jpeg (worker desk + monitor), Stardew-ish warmth.
"""
from pixel_art import Grid, C, autoline

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

if __name__ == "__main__":
    print("furniture:")
    for name, g in PIECES.items():
        g.save(name)
