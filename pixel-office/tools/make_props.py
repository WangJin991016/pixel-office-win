#!/usr/bin/env python3
"""Hand-drawn pixel props: plants, AC, copier, chaise lounge, trash bin, clock.

Drawn with hard-edged shapes at native art resolution (no AA) + per-pixel
dithering for texture, in a warm Stardew-ish palette with dark outlines.
"""
import os
import random
from PIL import Image, ImageDraw

TOOLS = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(TOOLS), "public", "assets")
random.seed(7)

OUTLINE = (43, 32, 26, 255)


def canvas(w, h):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def dither(img, cols, amt=10):
    """Add subtle per-pixel brightness noise inside opaque pixels."""
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) != OUTLINE[:3] and random.random() < 0.35:
                d = random.randint(-amt, amt)
                px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)),
                            max(0, min(255, b + d)), a)
    return img


def save(img, name, scale=3):
    img = dither(img, None)
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    img.save(os.path.join(OUT, name))
    print(f"  {name}: {img.size}")


# ---------------------------------------------------------------- bushy plant
def plant_bush():
    img, d = canvas(30, 38)
    pot = (176, 99, 47, 255); pot_d = (125, 63, 29, 255); pot_l = (209, 138, 84, 255)
    g1 = (60, 154, 70, 255); g2 = (37, 112, 47, 255); g3 = (111, 195, 106, 255)
    # leaves: cluster of ellipses, dark back layer first
    for cx, cy, rx, ry, c in [
        (15, 10, 11, 9, g2), (8, 14, 8, 8, g2), (22, 14, 8, 8, g2),
        (15, 15, 9, 8, g1), (10, 10, 6, 6, g1), (20, 9, 6, 6, g1),
        (7, 17, 5, 5, g1), (23, 17, 5, 5, g1),
        (13, 8, 4, 3, g3), (18, 12, 4, 3, g3), (10, 15, 3, 3, g3),
    ]:
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=c)
    # stem
    d.line([15, 20, 15, 24], fill=g2, width=2)
    # pot
    d.polygon([(9, 24), (21, 24), (19, 35), (11, 35)], fill=pot, outline=OUTLINE)
    d.rectangle([8, 22, 22, 26], fill=pot_l, outline=OUTLINE)
    d.line([11, 30, 19, 30], fill=pot_d)
    d.line([12, 33, 18, 33], fill=pot_d)
    return img


# ---------------------------------------------------------------- tall plant
def plant_tall():
    img, d = canvas(26, 46)
    pot = (74, 96, 160, 255); pot_d = (52, 68, 120, 255); pot_l = (102, 128, 196, 255)
    g1 = (60, 154, 70, 255); g2 = (37, 112, 47, 255); g3 = (111, 195, 106, 255)
    # tall blade leaves
    blades = [
        [(13, 38), (6, 14), (8, 2), (12, 14)],
        [(13, 38), (13, 10), (15, 0), (17, 12)],
        [(13, 38), (20, 12), (24, 4), (19, 16)],
        [(13, 38), (4, 20), (2, 10), (9, 20)],
        [(13, 38), (22, 22), (25, 14), (18, 24)],
    ]
    for i, b in enumerate(blades):
        d.polygon(b, fill=[g2, g1, g2, g1, g3][i])
    d.polygon([(13, 38), (13, 10), (15, 0), (16, 12)], outline=OUTLINE)
    # pot
    d.polygon([(7, 34), (19, 34), (17, 44), (9, 44)], fill=pot, outline=OUTLINE)
    d.rectangle([6, 32, 20, 36], fill=pot_l, outline=OUTLINE)
    d.line([9, 40, 17, 40], fill=pot_d)
    return img


# ---------------------------------------------------------------- wall AC unit
def ac_unit():
    img, d = canvas(46, 18)
    body = (232, 233, 236, 255); shade = (196, 199, 206, 255); vent = (120, 126, 138, 255)
    d.rounded_rectangle([1, 1, 44, 15], radius=3, fill=body, outline=OUTLINE, width=1)
    d.rectangle([3, 11, 42, 13], fill=shade)                 # bottom shadow band
    d.line([4, 8, 41, 8], fill=shade)                        # panel seam
    for i in range(5):                                        # vent slats
        d.line([6 + i * 3, 10, 6 + i * 3 + 1, 13], fill=vent)
    d.rectangle([36, 4, 40, 6], fill=(140, 220, 150, 255))   # LED display
    d.point([37, 5], fill=(30, 90, 40, 255))
    return img


# ---------------------------------------------------------------- photocopier
def copier():
    img, d = canvas(46, 40)
    body = (206, 209, 214, 255); dark = (156, 160, 168, 255)
    deep = (110, 114, 124, 255); glass = (70, 80, 96, 255)
    # main body
    d.rectangle([4, 14, 40, 37], fill=body, outline=OUTLINE)
    # top lid
    d.rectangle([3, 8, 41, 15], fill=dark, outline=OUTLINE)
    d.rectangle([6, 9, 38, 13], fill=glass)                  # scanner glass
    # output tray with paper sticking out
    d.rectangle([8, 18, 30, 24], fill=deep, outline=OUTLINE)
    d.rectangle([10, 15, 28, 21], fill=(245, 245, 240, 255), outline=OUTLINE)
    d.line([12, 17, 26, 17], fill=(150, 150, 150, 255))
    d.line([12, 19, 24, 19], fill=(150, 150, 150, 255))
    # control panel + green LED
    d.rectangle([32, 17, 38, 23], fill=deep, outline=OUTLINE)
    d.point([34, 19], fill=(90, 230, 110, 255))
    d.point([36, 19], fill=(230, 180, 60, 255))
    # paper drawer + wheels
    d.rectangle([6, 27, 38, 34], fill=dark, outline=OUTLINE)
    d.rectangle([15, 29, 29, 31], fill=deep)
    d.rectangle([7, 37, 11, 39], fill=OUTLINE)
    d.rectangle([33, 37, 37, 39], fill=OUTLINE)
    # side paper stack
    d.rectangle([41, 20, 45, 30], fill=(238, 238, 232, 255), outline=OUTLINE)
    for yy in range(21, 30, 2):
        d.line([42, yy, 44, yy], fill=(170, 170, 165, 255))
    return img


# ---------------------------------------------------------------- chaise lounge
def chaise():
    img, d = canvas(58, 26)
    fab = (62, 148, 134, 255); fab_d = (44, 112, 100, 255); fab_l = (92, 182, 166, 255)
    wood = (122, 79, 43, 255)
    # raised backrest (left)
    d.polygon([(4, 6), (13, 2), (17, 14), (8, 18)], fill=fab, outline=OUTLINE)
    d.line([6, 8, 14, 4], fill=fab_l)
    # seat
    d.rounded_rectangle([10, 12, 52, 19], radius=2, fill=fab, outline=OUTLINE)
    d.line([12, 13, 50, 13], fill=fab_l)
    d.line([12, 18, 50, 18], fill=fab_d)
    # cushion seam buttons
    for xx in (20, 30, 40):
        d.point([xx, 15], fill=fab_d)
    # armrest (right end)
    d.rounded_rectangle([50, 8, 56, 18], radius=2, fill=fab_d, outline=OUTLINE)
    d.line([51, 9, 55, 9], fill=fab_l)
    # wooden legs
    d.rectangle([12, 19, 15, 24], fill=wood, outline=OUTLINE)
    d.rectangle([47, 19, 50, 24], fill=wood, outline=OUTLINE)
    return img


# ---------------------------------------------------------------- trash bin
def trash_bin():
    img, d = canvas(18, 22)
    wire = (150, 154, 162, 255); wire_d = (108, 112, 122, 255)
    d.polygon([(3, 4), (15, 4), (13, 20), (5, 20)], fill=(0, 0, 0, 40), outline=wire_d)
    for xx in (6, 9, 12):
        d.line([xx, 5, xx - 1, 19], fill=wire)
    for yy in (8, 12, 16):
        d.line([4, yy, 14, yy], fill=wire)
    d.rectangle([2, 2, 16, 5], fill=wire, outline=OUTLINE)   # rim
    # crumpled paper inside
    d.ellipse([6, 0, 11, 4], fill=(240, 240, 235, 255), outline=OUTLINE)
    return img


# ---------------------------------------------------------------- wall clock
def clock():
    img, d = canvas(16, 16)
    wood = (122, 79, 43, 255); face = (244, 240, 226, 255)
    d.ellipse([1, 1, 14, 14], fill=wood, outline=OUTLINE)
    d.ellipse([3, 3, 12, 12], fill=face)
    d.line([8, 8, 8, 4], fill=OUTLINE)                        # hour hand
    d.line([8, 8, 11, 9], fill=OUTLINE)                       # minute hand
    d.point([8, 8], fill=(180, 40, 40, 255))
    return img


# ---------------------------------------------------------------- water cooler
def water_cooler():
    img, d = canvas(20, 34)
    body = (228, 229, 232, 255); shade = (190, 193, 200, 255)
    bottle = (150, 205, 235, 150); bottle_d = (110, 170, 210, 180)
    # bottle
    d.rounded_rectangle([5, 1, 15, 12], radius=3, fill=bottle, outline=OUTLINE)
    d.rectangle([7, 0, 13, 2], fill=bottle_d, outline=OUTLINE)
    d.line([7, 6, 13, 6], fill=bottle_d)
    d.line([6, 9, 14, 9], fill=bottle_d)
    # body
    d.rectangle([3, 12, 17, 31], fill=body, outline=OUTLINE)
    d.rectangle([5, 15, 15, 20], fill=shade, outline=OUTLINE)
    d.point([8, 17], fill=(70, 130, 220, 255))                # cold tap
    d.point([12, 17], fill=(220, 90, 80, 255))                # hot tap
    d.rectangle([6, 23, 14, 27], fill=shade)
    return img


print("props:")
save(plant_bush(), "prop_plant1.png")
save(plant_tall(), "prop_plant2.png")
save(ac_unit(), "prop_ac.png")
save(copier(), "prop_copier.png")
save(chaise(), "prop_chaise.png")
save(trash_bin(), "prop_trash.png")
save(clock(), "prop_clock.png")
save(water_cooler(), "prop_water.png")
print("done")
