#!/usr/bin/env python3
"""Pixel Office v3 worker-part generator.

Every selectable module is drawn directly from one shared 26x48 pose rig.
Nothing in this file splits or recolors a precomposed worker.  The public
contract is three independent indices (head, upper, lower), each with nine
variants and the same fifteen pose rows.
"""

import os

from PIL import Image

from pixel_art import C, OUT, Grid, autoline


W = 26
CELL_H = 48
SCALE = 4

POSE_ORDER = (
    "stand_front", "stand_side", "stand_back", "walk_front", "walk_front_b",
    "walk_side_a", "walk_side_b", "walk_back", "walk_back_b", "documents",
    "coffee", "briefcase", "sit", "upper_front", "upper_back",
)

POSE_SPECS = {
    "stand_front": ("front", 0, "stand", False),
    "stand_side": ("side", 0, "stand", False),
    "stand_back": ("back", 0, "stand", False),
    "walk_front": ("front", 1, "stand", False),
    "walk_front_b": ("front", -1, "stand", False),
    "walk_side_a": ("side", 1, "stand", False),
    "walk_side_b": ("side", -1, "stand", False),
    "walk_back": ("back", 1, "stand", False),
    "walk_back_b": ("back", -1, "stand", False),
    "documents": ("front", 0, "documents", False),
    "coffee": ("front", 0, "coffee", False),
    "briefcase": ("side", 0, "briefcase", False),
    "sit": ("side", 0, "sit", False),
    "upper_front": ("front", 0, "upper", True),
    "upper_back": ("back", 0, "upper", True),
}

VARIANT_NAMES = {
    "head": (
        "tousled brown", "black side part + square glasses",
        "dark bob + freckles", "high ponytail + blue headband",
        "short curls + gold rounds", "crew cut + sunglasses",
        "short hair + blue cap", "waves + burgundy beret",
        "short hair + yellow hardhat",
    ),
    "upper": (
        "white shirt + blue tie", "sky polo + lanyard",
        "charcoal blazer + narrow tie", "sand cardigan", "sage overshirt",
        "burgundy knit", "denim jacket", "white lab coat",
        "orange safety vest",
    ),
    "lower": (
        "navy slacks + brown oxfords", "charcoal slacks + black loafers",
        "khaki chinos + white sneakers", "blue jeans + red sneakers",
        "olive cargo + dark boots", "burgundy trousers + blue flats",
        "gray trousers + ankle boots", "tan work trousers + high tops",
        "black pinstripes + white trainers",
    ),
}

SKIN_PALETTES = (
    ((250, 224, 196), (235, 190, 153)),
    ((246, 208, 171), (224, 174, 130)),
    ((236, 188, 143), (202, 142, 101)),
    ((217, 164, 112), (176, 108, 71)),
    ((184, 127, 83), (143, 83, 57)),
    ((145, 91, 66), (106, 59, 49)),
)

HAIR_PALETTES = (
    ((107, 69, 48), (74, 46, 28), (151, 105, 67)),
    ((53, 43, 38), (31, 28, 26), (91, 72, 58)),
    ((83, 49, 38), (50, 31, 28), (126, 76, 55)),
    ((119, 57, 42), (72, 36, 31), (169, 90, 60)),
    ((49, 39, 35), (29, 25, 24), (91, 70, 56)),
    ((58, 45, 38), (34, 29, 27), (95, 73, 59)),
    ((64, 48, 39), (37, 30, 27), (104, 78, 58)),
    ((116, 67, 48), (69, 40, 33), (164, 99, 65)),
    ((54, 42, 36), (31, 27, 25), (89, 68, 55)),
)

# skin index, hairstyle id, accessory id
HEAD_SPECS = (
    (0, "tousled", "none"),
    (1, "side_part", "square_glasses"),
    (2, "bob", "freckles"),
    (3, "ponytail", "headband"),
    (4, "curls", "round_glasses"),
    (5, "crew", "sunglasses"),
    (1, "short", "blue_cap"),
    (2, "waves", "beret"),
    (4, "short", "hardhat"),
)

# main, shadow, highlight, accent, accent-dark, style
UPPER_SPECS = (
    ((246, 244, 238), (205, 204, 198), (255, 255, 252), (47, 95, 184), (31, 67, 133), "shirt"),
    ((157, 205, 230), (94, 147, 178), (201, 230, 241), (45, 112, 157), (31, 76, 111), "polo"),
    ((78, 83, 94), (48, 51, 59), (118, 123, 133), (174, 57, 66), (115, 37, 45), "blazer"),
    ((205, 178, 133), (150, 115, 75), (232, 210, 169), (88, 68, 53), (59, 45, 37), "cardigan"),
    ((126, 154, 116), (76, 103, 70), (166, 188, 151), (224, 202, 118), (153, 126, 58), "overshirt"),
    ((151, 57, 72), (96, 37, 48), (190, 88, 99), (228, 181, 126), (153, 103, 64), "knit"),
    ((73, 111, 153), (43, 71, 106), (112, 151, 190), (211, 156, 79), (137, 92, 45), "denim"),
    ((238, 239, 235), (188, 194, 192), (255, 255, 252), (49, 151, 151), (32, 99, 101), "lab"),
    ((220, 119, 45), (151, 72, 31), (244, 159, 72), (243, 210, 68), (169, 132, 33), "safety"),
)

# pants, shadow, highlight, shoe, shoe-shadow, style
LOWER_SPECS = (
    ((52, 64, 102), (34, 43, 72), (78, 91, 132), (111, 68, 39), (75, 45, 27), "plain"),
    ((70, 73, 82), (43, 45, 52), (104, 107, 116), (42, 37, 35), (25, 23, 22), "plain"),
    ((188, 157, 105), (132, 103, 65), (221, 195, 148), (231, 229, 220), (166, 166, 162), "chino"),
    ((61, 101, 151), (37, 65, 105), (93, 137, 184), (181, 55, 61), (118, 37, 43), "jeans"),
    ((92, 108, 68), (57, 70, 43), (126, 142, 94), (77, 52, 39), (49, 34, 29), "cargo"),
    ((126, 48, 67), (80, 31, 46), (166, 76, 91), (68, 101, 153), (42, 65, 103), "cuff"),
    ((112, 118, 127), (71, 76, 84), (148, 153, 162), (79, 58, 49), (51, 39, 34), "pleat"),
    ((159, 119, 75), (105, 75, 45), (194, 153, 101), (71, 78, 92), (43, 48, 58), "work"),
    ((45, 46, 54), (27, 28, 34), (85, 86, 96), (232, 230, 221), (166, 166, 162), "pinstripe"),
)


def _pose(key):
    view, walk, action, upper = POSE_SPECS[key]
    return {
        "key": key, "view": view, "walk": walk, "action": action,
        "upper": upper, "body_shift": 16 if upper else 6,
        "head_shift": 13 if upper else 6,
    }


def _tri(g, cx, y, radius, color):
    for row in range(radius):
        g.hline(cx - row, cx + row, y + row, color)


def _detail_lower(g, spec, index):
    shift = spec["body_shift"]
    _, _, highlight, _, _, style = LOWER_SPECS[index]
    view = spec["view"]
    if style == "cargo":
        if view == "side":
            g.rect(13, 33 + shift, 16, 35 + shift, highlight)
        else:
            g.rect(7, 33 + shift, 9, 35 + shift, highlight)
            g.rect(16, 33 + shift, 18, 35 + shift, highlight)
    elif style == "jeans":
        g.vline(12 if view != "side" else 14, 32 + shift, 38 + shift, highlight)
    elif style == "pinstripe":
        for x in ((9, 16) if view != "side" else (11, 15)):
            g.vline(x, 32 + shift, 38 + shift, highlight)
    elif style == "work":
        if spec["action"] == "sit":
            # The seated left thigh ends above this row; keep the work-pant
            # seam on the connected right leg instead of leaving it floating.
            g.hline(14, 17, 35 + shift, highlight)
        else:
            g.hline(8, 11, 35 + shift, highlight)
            if view != "side":
                g.hline(14, 18, 35 + shift, highlight)
    elif style in {"chino", "pleat"}:
        g.set(10, 32 + shift, highlight)
        g.set(15, 32 + shift, highlight)
    elif style == "cuff":
        g.hline(7, 11, 38 + shift, highlight)
        g.hline(14, 18, 38 + shift, highlight)


def draw_lower(key, index):
    spec = _pose(key)
    g = Grid(W, CELL_H)
    if spec["upper"]:
        return g
    pants, shadow, _, shoe, shoe_shadow, _ = LOWER_SPECS[index]
    s = spec["body_shift"]
    walk = spec["walk"]
    if spec["action"] == "sit":
        g.rect(7, 28 + s, 17, 31 + s, pants)
        g.rect(15, 32 + s, 18, 39 + s, pants)
        g.vline(17, 32 + s, 38 + s, shadow)
        g.hline(7, 17, 31 + s, shadow)
        g.rect(13, 39 + s, 18, 41 + s, shoe)
        g.hline(13, 18, 41 + s, shoe_shadow)
    elif spec["view"] == "side":
        if walk == 0:
            g.rect(9, 31 + s, 15, 38 + s, pants)
            g.vline(14, 32 + s, 37 + s, shadow)
            g.rect(7, 39 + s, 15, 41 + s, shoe)
            g.hline(7, 15, 41 + s, shoe_shadow)
        elif walk == 1:
            g.rect(8, 31 + s, 13, 38 + s, pants)
            g.rect(5, 39 + s, 13, 41 + s, shoe)
            g.hline(5, 13, 41 + s, shoe_shadow)
            g.rect(14, 31 + s, 18, 35 + s, shadow)
            g.rect(15, 36 + s, 21, 37 + s, shoe)
            g.set(20, 36 + s, shoe_shadow)
        else:
            g.rect(12, 31 + s, 17, 38 + s, pants)
            g.rect(11, 39 + s, 18, 41 + s, shoe)
            g.hline(11, 18, 41 + s, shoe_shadow)
            g.rect(7, 31 + s, 11, 35 + s, shadow)
            g.rect(4, 36 + s, 10, 37 + s, shoe)
            g.set(5, 36 + s, shoe_shadow)
    elif walk == 0:
        g.rect(7, 31 + s, 11, 38 + s, pants)
        g.rect(14, 31 + s, 18, 38 + s, pants)
        g.vline(12, 32 + s, 37 + s, shadow)
        g.vline(13, 32 + s, 37 + s, shadow)
        g.rect(6, 39 + s, 11, 41 + s, shoe)
        g.rect(14, 39 + s, 19, 41 + s, shoe)
        g.hline(6, 11, 41 + s, shoe_shadow)
        g.hline(14, 19, 41 + s, shoe_shadow)
    elif walk == 1:
        g.rect(6, 31 + s, 10, 39 + s, pants)
        g.rect(5, 39 + s, 10, 41 + s, shoe)
        g.hline(5, 10, 41 + s, shoe_shadow)
        g.rect(15, 31 + s, 18, 36 + s, shadow)
        g.rect(15, 37 + s, 20, 38 + s, shoe)
        g.hline(15, 20, 38 + s, shoe_shadow)
    else:
        g.rect(15, 31 + s, 19, 39 + s, pants)
        g.rect(15, 39 + s, 20, 41 + s, shoe)
        g.hline(15, 20, 41 + s, shoe_shadow)
        g.rect(7, 31 + s, 10, 36 + s, shadow)
        g.rect(5, 37 + s, 10, 38 + s, shoe)
        g.hline(5, 10, 38 + s, shoe_shadow)
    _detail_lower(g, spec, index)
    autoline(g)
    return g


def _draw_upper_details(g, spec, index):
    main, shadow, highlight, accent, accent_dark, style = UPPER_SPECS[index]
    s = spec["body_shift"]
    front = spec["view"] == "front"
    back = spec["view"] == "back"
    upper = spec["upper"]
    y0 = (16 if upper else 19) + s
    y1 = (31 if upper else (28 if spec["action"] == "sit" else 30)) + s
    if back:
        g.vline(12, y0 + 1, y1 - 1, shadow)
        if style in {"safety", "lab", "denim"}:
            g.hline(7, 18, y0 + 5, highlight)
        return
    if style in {"shirt", "blazer"}:
        if front:
            g.line(10, y0, 12, y0 + 3, highlight)
            g.line(15, y0, 13, y0 + 3, highlight)
            g.vline(12, y0 + 3, min(y1 - 2, y0 + 9), accent)
            g.set(12, y0 + 4, accent_dark)
        else:
            g.line(10, y0, 8, y0 + 4, highlight)
            g.vline(8, y0 + 3, min(y1 - 1, y0 + 8), accent)
    elif style == "polo":
        g.hline(10 if front else 8, 15 if front else 12, y0 + 1, highlight)
        g.vline(12 if front else 9, y0 + 2, y0 + 5, accent_dark)
    elif style == "cardigan":
        g.vline(12 if front else 10, y0 + 1, y1 - 1, accent_dark)
        for y in range(y0 + 3, y1, 3):
            g.set(13 if front else 11, y, accent)
    elif style == "overshirt":
        g.vline(12 if front else 10, y0 + 1, y1 - 1, shadow)
        g.rect(7 if front else 8, y0 + 5, 10 if front else 11, y0 + 7, highlight)
        if front:
            g.rect(15, y0 + 5, 18, y0 + 7, highlight)
    elif style == "knit":
        g.hline(7 if front else 8, 18 if front else 15, y0 + 2, highlight)
        g.hline(7 if front else 8, 18 if front else 15, y1 - 1, shadow)
    elif style == "denim":
        g.vline(12 if front else 10, y0 + 1, y1 - 1, highlight)
        g.hline(7 if front else 8, 18 if front else 14, y0 + 4, shadow)
    elif style == "lab":
        g.vline(12 if front else 10, y0 + 1, y1 - 1, shadow)
        g.rect(7 if front else 8, y1 - 4, 10 if front else 11, y1 - 2, accent)
        if front:
            g.rect(15, y1 - 4, 18, y1 - 2, accent)
    elif style == "safety":
        g.vline(8 if front else 9, y0 + 1, y1 - 1, accent)
        g.vline(17 if front else 14, y0 + 1, y1 - 1, accent)
        g.hline(7 if front else 8, 18 if front else 15, y0 + 6, accent)


def _draw_action_prop(g, spec):
    s = spec["body_shift"]
    action = spec["action"]
    if action == "documents":
        g.rect(8, 21 + s, 17, 29 + s, C["paper"])
        g.rect(9, 20 + s, 16, 21 + s, C["paper"])
        g.hline(9, 16, 24 + s, C["paperD"])
        g.hline(9, 16, 27 + s, C["paperD"])
        g.vline(8, 21 + s, 29 + s, C["paperD"])
        g.vline(17, 21 + s, 29 + s, C["paperD"])
    elif action == "coffee":
        g.rect(21, 26 + s, 23, 30 + s, C["paper"])
        g.vline(21, 26 + s, 30 + s, C["paperD"])
        g.set(23, 27 + s, C["paperD"])
        g.set(23, 28 + s, C["paperD"])
        g.hline(21, 23, 26 + s, C["woodD"])
        g.set(22, 24 + s, C["grayL"])
        g.set(23, 23 + s, C["grayL"])
    elif action == "briefcase":
        g.rect(15, 31 + s, 21, 37 + s, C["wood"])
        g.rect(15, 31 + s, 21, 32 + s, C["woodD"])
        g.hline(15, 21, 37 + s, C["woodD"])
        g.vline(21, 31 + s, 37 + s, C["woodD"])
        g.rect(17, 29 + s, 19, 31 + s, C["woodD"])
        g.set(18, 34 + s, C["gold"])
    elif action == "sit":
        g.rect(11, 24 + s, 14, 26 + s, C["grayD"])
        g.set(12, 25 + s, C["screen"])


def draw_upper(key, index):
    spec = _pose(key)
    g = Grid(W, CELL_H)
    main, shadow, _, _, _, _ = UPPER_SPECS[index]
    s = spec["body_shift"]
    action = spec["action"]
    if spec["upper"]:
        g.rect(5 if spec["view"] == "front" else 4, 16 + s,
               20 if spec["view"] == "front" else 21, 31 + s, main)
        g.rect(2, 18 + s, 5, 25 + s, main)
        g.rect(20, 18 + s, 23, 25 + s, main)
        g.vline(5, 18 + s, 30 + s, shadow)
        g.vline(20, 18 + s, 30 + s, shadow)
    elif action == "sit":
        g.rect(7, 19 + s, 17, 28 + s, main)
        g.vline(17, 20 + s, 27 + s, shadow)
        g.rect(10, 22 + s, 15, 24 + s, main)
    elif spec["view"] == "side":
        g.rect(7, 19 + s, 17, 30 + s, main)
        g.vline(17, 20 + s, 29 + s, shadow)
        g.rect(13, 19 + s, 15, 27 + s, main)
    else:
        g.rect(5, 19 + s, 20, 30 + s, main)
        if action == "documents":
            g.rect(4, 22 + s, 6, 27 + s, main)
            g.rect(19, 22 + s, 21, 27 + s, main)
        else:
            g.rect(4, 19 + s, 5, 27 + s, main)
            g.rect(20, 19 + s, 21, 27 + s, main)
        g.vline(5, 20 + s, 29 + s, shadow)
        g.vline(20, 20 + s, 29 + s, shadow)
    _draw_upper_details(g, spec, index)
    _draw_action_prop(g, spec)
    autoline(g)
    return g


def _draw_hands(g, spec, skin, shadow):
    s = spec["body_shift"]
    action = spec["action"]
    if spec["upper"]:
        g.rect(3, 26 + s, 5, 28 + s, skin)
        g.rect(20, 26 + s, 22, 28 + s, skin)
        g.set(3, 28 + s, shadow)
        g.set(22, 28 + s, shadow)
    elif action == "documents":
        g.line(6, 27 + s, 9, 28 + s, skin)
        g.line(19, 27 + s, 16, 28 + s, skin)
        g.set(9, 29 + s, shadow)
        g.set(16, 29 + s, shadow)
    elif action == "coffee":
        g.rect(4, 28 + s, 5, 30 + s, skin)
        g.line(20, 27 + s, 22, 29 + s, skin)
        g.set(22, 29 + s, shadow)
    elif action == "briefcase":
        g.rect(17, 28 + s, 19, 30 + s, skin)
        g.hline(17, 19, 30 + s, shadow)
    elif action == "sit":
        g.rect(12, 25 + s, 16, 27 + s, skin)
        g.hline(12, 16, 27 + s, shadow)
    elif spec["view"] == "side":
        g.rect(13, 27 + s, 15, 30 + s, skin)
        g.hline(13, 15, 30 + s, shadow)
    else:
        g.rect(4, 28 + s, 5, 30 + s, skin)
        g.rect(20, 28 + s, 21, 30 + s, skin)
        g.set(4, 30 + s, shadow)
        g.set(21, 30 + s, shadow)


def _draw_face(g, spec, skin, shadow):
    s = spec["head_shift"]
    view = spec["view"]
    if view == "back":
        # A complete rear skull lives in the head preset.  Hairstyles and hats
        # cover it as needed, but short cuts can never expose a transparent gap.
        g.rect(7, 8 + s, 18, 15 + s, skin)
        g.rect(9, 16 + s, 16, 17 + s, skin)
        g.rect(11, 17 + s, 14, 18 + s, shadow)
        return
    if view == "side":
        g.rect(6, 8 + s, 14, 14 + s, skin)
        g.rect(7, 15 + s, 12, 16 + s, skin)
        g.set(5, 12 + s, skin)
        g.set(5, 13 + s, shadow)
        g.rect(13, 10 + s, 14, 12 + s, skin)
        g.set(13, 11 + s, shadow)
        g.rect(10, 17 + s, 13, 18 + s, skin)
        g.vline(10, 17 + s, 18 + s, shadow)
        return
    g.rect(7, 8 + s, 18, 14 + s, skin)
    g.rect(8, 15 + s, 17, 16 + s, skin)
    g.rect(10, 17 + s, 15, 17 + s, skin)
    g.rect(5, 10 + s, 6, 12 + s, skin)
    g.rect(19, 10 + s, 20, 12 + s, skin)
    g.set(6, 11 + s, shadow)
    g.set(19, 11 + s, shadow)
    g.rect(11, 17 + s, 14, 18 + s, skin)
    g.hline(11, 14, 18 + s, shadow)


def _draw_hair(g, spec, index, style):
    main, dark, light = HAIR_PALETTES[index]
    s = spec["head_shift"]
    view = spec["view"]
    if view == "side":
        if style == "crew":
            g.rect(10, 3 + s, 19, 8 + s, main)
            g.hline(12, 18, 3 + s, light)
            g.vline(19, 4 + s, 8 + s, dark)
        else:
            g.disc(14, 6 + s, 7, main, squash=0.82)
            g.rect(10, 3 + s, 20, 9 + s, main)
            g.rect(19, 8 + s, 21, 13 + s, dark if style in {"bob", "waves"} else main)
            g.hline(11, 19, 4 + s, light)
            g.rect(7, 7 + s, 10, 9 + s, main)
        if style == "ponytail":
            g.disc(21, 8 + s, 2, dark)
            g.set(22, 8 + s, main)
        elif style == "curls":
            for x, y in ((19, 8), (21, 10), (19, 13)):
                g.disc(x, y + s, 1, light)
        elif style == "waves":
            g.rect(19, 10 + s, 22, 14 + s, main)
            g.set(21, 12 + s, light)
        g.hline(15, 20, 12 + s, dark)
        return
    if view == "back":
        if style == "crew":
            g.rect(8, 3 + s, 18, 10 + s, main)
            g.hline(9, 17, 10 + s, dark)
        else:
            g.disc(13, 6 + s, 7, main, squash=0.82)
            g.rect(6, 3 + s, 20, 13 + s, main)
            g.hline(7, 19, 13 + s, dark)
            g.hline(9, 17, 4 + s, light)
        if style == "ponytail":
            g.disc(20, 9 + s, 2, dark)
        elif style in {"bob", "waves"}:
            g.rect(5, 9 + s, 7, 14 + s, dark)
            g.rect(19, 9 + s, 21, 14 + s, dark)
        elif style == "curls":
            for x in (6, 9, 17, 20):
                g.disc(x, 12 + s, 1, light)
        return
    if style == "crew":
        g.rect(8, 3 + s, 18, 8 + s, main)
        g.hline(9, 17, 3 + s, light)
        g.hline(9, 17, 8 + s, dark)
    else:
        g.disc(13, 6 + s, 7, main, squash=0.82)
        g.rect(6, 3 + s, 20, 9 + s, main)
        g.hline(8, 17, 3 + s, light)
        g.hline(6, 19, 9 + s, dark)
        if style == "tousled":
            _tri(g, 9, 1 + s, 3, main)
            _tri(g, 15, 1 + s, 3, main)
            g.set(19, 2 + s, light)
        elif style == "side_part":
            g.line(14, 2 + s, 11, 7 + s, dark)
            g.line(15, 3 + s, 18, 7 + s, light)
        elif style == "bob":
            g.rect(5, 8 + s, 7, 14 + s, dark)
            g.rect(19, 8 + s, 21, 14 + s, dark)
        elif style == "ponytail":
            g.disc(21, 8 + s, 2, dark)
            g.set(22, 8 + s, main)
        elif style == "curls":
            for x, y in ((6, 8), (5, 11), (20, 8), (21, 11)):
                g.disc(x, y + s, 1, light)
        elif style == "waves":
            g.rect(5, 9 + s, 7, 14 + s, dark)
            g.rect(19, 9 + s, 21, 14 + s, dark)
            g.set(6, 11 + s, light)
            g.set(20, 12 + s, light)


def _draw_hat(g, spec, accessory):
    s = spec["head_shift"]
    side = spec["view"] == "side"
    if accessory == "blue_cap":
        dark, main, light = (32, 62, 126), (56, 103, 190), (111, 154, 226)
        if side:
            g.rect(10, 2 + s, 19, 6 + s, dark)
            g.rect(11, 2 + s, 18, 5 + s, main)
            g.hline(5, 11, 7 + s, dark)
            g.hline(6, 10, 7 + s, main)
        else:
            g.rect(7, 2 + s, 19, 6 + s, dark)
            g.rect(9, 1 + s, 18, 5 + s, main)
            g.hline(10, 16, 2 + s, light)
            if spec["view"] == "front":
                g.hline(5, 12, 7 + s, dark)
    elif accessory == "beret":
        dark, main, light = (103, 32, 45), (168, 55, 68), (215, 98, 96)
        x0, x1 = ((9, 21) if side else (6, 20))
        g.rect(x0 + 2, 2 + s, x1 - 1, 6 + s, dark)
        g.rect(x0 + 4, 1 + s, x1 - 2, 5 + s, main)
        g.hline(x0 + 4, x1 - 3, 3 + s, light)
        g.set(x1 - 2, 1 + s, dark)
    elif accessory == "hardhat":
        dark, main, light = (158, 109, 18), (235, 184, 36), (255, 222, 94)
        x0, x1 = ((8, 21) if side else (6, 20))
        g.rect(x0 + 2, 3 + s, x1 - 1, 7 + s, main)
        g.rect(x0 + 5, 1 + s, x1 - 4, 5 + s, main)
        g.hline(x0 + 1, x1 + 1, 8 + s, dark)
        g.hline(x0 + 3, x1 - 1, 7 + s, light)


def _draw_face_features(g, spec, accessory, skin_shadow):
    s = spec["head_shift"]
    if accessory == "headband":
        # The headband is a head preset, not a front-only face detail. Draw a
        # direction-specific strip over the hair before the early returns.
        if spec["view"] == "back":
            g.hline(6, 20, 7 + s, (55, 104, 191))
            g.set(19, 8 + s, (113, 158, 226))
        elif spec["view"] == "side":
            g.hline(9, 20, 7 + s, (55, 104, 191))
            g.set(19, 8 + s, (113, 158, 226))
    if spec["view"] == "back":
        return
    if spec["view"] == "side":
        if accessory == "sunglasses":
            g.rect(7, 10 + s, 10, 13 + s, (31, 39, 58))
            g.hline(7, 11, 9 + s, C["out"])
        else:
            g.rect(8, 10 + s, 9, 13 + s, C["eye"])
            g.set(8, 11 + s, C["eyeS"])
        g.set(6, 14 + s, skin_shadow)
        if accessory in {"square_glasses", "round_glasses"}:
            color = C["out"] if accessory == "square_glasses" else C["gold"]
            g.hline(6, 11, 9 + s, color)
            g.hline(6, 11, 13 + s, color)
            g.vline(6, 9 + s, 13 + s, color)
            g.vline(11, 9 + s, 13 + s, color)
        elif accessory == "freckles":
            g.set(7, 13 + s, C["cheek"])
            g.set(9, 14 + s, C["cheek"])
        return
    if accessory == "sunglasses":
        g.rect(7, 10 + s, 11, 13 + s, (31, 39, 58))
        g.rect(14, 10 + s, 18, 13 + s, (31, 39, 58))
        g.hline(7, 18, 10 + s, C["out"])
        g.hline(12, 13, 11 + s, C["out"])
    else:
        for ex in (9, 16):
            g.rect(ex - 1, 11 + s, ex + 1, 14 + s, C["eyeW"])
            g.rect(ex, 11 + s, ex + 1, 13 + s, C["eye"])
            g.set(ex, 12 + s, C["eyeS"])
    g.set(13, 14 + s, skin_shadow)
    g.hline(12, 13, 15 + s, skin_shadow)
    if accessory == "square_glasses":
        for x0, x1 in ((7, 11), (14, 18)):
            g.hline(x0, x1, 10 + s, C["out"])
            g.hline(x0, x1, 14 + s, C["out"])
            g.vline(x0, 10 + s, 14 + s, C["out"])
            g.vline(x1, 10 + s, 14 + s, C["out"])
        g.hline(12, 13, 11 + s, C["out"])
    elif accessory == "round_glasses":
        for x0, x1 in ((7, 11), (14, 18)):
            g.hline(x0 + 1, x1 - 1, 10 + s, C["gold"])
            g.hline(x0 + 1, x1 - 1, 14 + s, C["gold"])
            g.set(x0, 12 + s, C["gold"])
            g.set(x1, 12 + s, C["gold"])
        g.hline(12, 13, 11 + s, C["gold"])
    elif accessory == "freckles":
        for x, y in ((8, 14), (10, 15), (16, 15), (18, 14)):
            g.set(x, y + s, C["cheek"])
    elif accessory == "headband":
        g.hline(6, 20, 7 + s, (55, 104, 191))
        g.set(19, 8 + s, (113, 158, 226))


def draw_head(key, index):
    spec = _pose(key)
    g = Grid(W, CELL_H)
    skin_index, style, accessory = HEAD_SPECS[index]
    skin, shadow = SKIN_PALETTES[skin_index]
    _draw_face(g, spec, skin, shadow)
    _draw_hands(g, spec, skin, shadow)
    _draw_hair(g, spec, index, style)
    _draw_hat(g, spec, accessory)
    _draw_face_features(g, spec, accessory, shadow)
    autoline(g)
    return g


def compose_parts(lower, upper, head):
    out = Grid(W, CELL_H)
    out.img.alpha_composite(lower.img)
    out.img.alpha_composite(upper.img)
    out.img.alpha_composite(head.img)
    return out


def _save_atlas(name, columns):
    small = Image.new("RGBA", (W * len(columns), CELL_H * len(POSE_ORDER)), (0, 0, 0, 0))
    for column, cells in enumerate(columns):
        for row, cell in enumerate(cells):
            small.alpha_composite(cell.img, (column * W, row * CELL_H))
    image = small.resize((small.width * SCALE, small.height * SCALE), Image.Resampling.NEAREST)
    image.save(os.path.join(OUT, name))
    print(f"  {name}: {image.size}")
    return image


def generate_worker_parts():
    heads = [[draw_head(key, index) for key in POSE_ORDER] for index in range(9)]
    uppers = [[draw_upper(key, index) for key in POSE_ORDER] for index in range(9)]
    lowers = [[draw_lower(key, index) for key in POSE_ORDER] for index in range(9)]
    _save_atlas("worker_part_head.png", heads)
    _save_atlas("worker_part_upper.png", uppers)
    _save_atlas("worker_part_lower.png", lowers)
    fallback = [[compose_parts(lowers[0][row], uppers[0][row], heads[0][row])
                 for row in range(len(POSE_ORDER))]]
    _save_atlas("worker_fallback.png", fallback)
    return {"head": heads, "upper": uppers, "lower": lowers, "fallback": fallback}


if __name__ == "__main__":
    print("v3 worker parts:")
    generate_worker_parts()
