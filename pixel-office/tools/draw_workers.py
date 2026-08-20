#!/usr/bin/env python3
"""Worker character poses — hand-drawn chibi pixel art (26x42 base grid).

Reference design (worker.jpeg): fluffy brown hair, white shirt, blue tie,
ID badge on lanyard, gray slacks, brown shoes.

Geometry contract (front view):
  hair rows 1-9 (bangs at 8-9), sideburns to 12
  face rows 8-17, eyes rows 11-14, brows row 10
  neck 17-18, collar 18-19, shirt 19-30, pants 31-38, shoes 39-41
"""
import os

from PIL import Image

from pixel_art import Grid, C, OUT, autoline

W, H = 26, 42


def tri(g, x, y, w, c):
    """upright triangle, apex at (x, y), base width w"""
    for i in range(w):
        g.hline(x - i, x + i, y + i, c)


# ---------------------------------------------------------------- shared
def hair_front(g):
    # back mass (does NOT cross the bang line y=9)
    g.disc(13, 6, 7, C["hair"], squash=0.8)
    g.rect(6, 3, 20, 9, C["hair"])
    # spikes
    tri(g, 6, 2, 3, C["hair"]); tri(g, 10, 0, 3, C["hair"]); tri(g, 14, 0, 3, C["hair"])
    tri(g, 18, 1, 3, C["hair"]); tri(g, 21, 2, 2, C["hair"])
    # crown strands
    g.line(9, 3, 8, 6, C["hairD"]); g.line(13, 2, 13, 6, C["hairD"]); g.line(17, 3, 18, 6, C["hairD"])
    # sideburns beside ears
    g.rect(4, 7, 6, 12, C["hair"]); g.rect(19, 7, 21, 12, C["hair"])
    g.vline(4, 8, 11, C["hairD"]); g.vline(21, 8, 11, C["hairD"])
    # texture
    g.hline(7, 12, 3, C["hairL"]); g.hline(14, 18, 3, C["hairL"])
    g.set(10, 2, C["hairH"]); g.set(15, 2, C["hairH"]); g.set(8, 5, C["hairL"])
    g.set(19, 5, C["hairL"]); g.set(12, 4, C["hairH"])
    g.hline(5, 8, 12, C["hairD"]); g.hline(17, 20, 12, C["hairD"])
    # bangs: zigzag fringe, bottom edge at y=9-10
    for i, x in enumerate(range(6, 20)):
        g.set(x, 8 + (i % 2), C["hair"])
        g.set(x, 9 + (i % 2) - (1 if i % 2 else 0), C["hair"])
    g.set(8, 10, C["hair"]); g.set(12, 10, C["hair"]); g.set(16, 10, C["hair"])


def face_front(g):
    g.rect(7, 8, 18, 14, C["skin"])          # face plane
    g.rect(8, 15, 17, 16, C["skin"])         # jaw
    g.rect(10, 17, 15, 17, C["skin"])        # chin
    g.rect(5, 10, 6, 12, C["skin"])          # ears
    g.rect(19, 10, 20, 12, C["skin"])
    g.set(6, 11, C["skinS"]); g.set(19, 11, C["skinS"])
    # brows just under the bangs
    g.hline(8, 10, 10, C["hairD"]); g.hline(15, 17, 10, C["hairD"])
    # eyes rows 11-15 (tall anime)
    for ex in (9, 16):
        g.rect(ex - 1, 11, ex + 1, 15, C["eyeW"])
        g.rect(ex, 11, ex + 1, 14, C["eye"])
        g.set(ex - 1, 11, C["eye"])          # lash corner
        g.set(ex - 1, 12, C["eye"])
        g.set(ex, 12, C["eyeS"])             # sparkle
        g.hline(ex - 1, ex + 1, 11, C["eye"])
    g.set(13, 14, C["skinS"])                # nose
    g.hline(12, 13, 15, C["skinS"])          # mouth
    g.set(12, 15, C["skinS"])                # smile corner hint


def neck_front(g):
    g.rect(11, 17, 14, 18, C["skin"])
    g.vline(11, 17, 18, C["skinS"])
    g.hline(11, 14, 18, C["skinS"])          # jaw shadow on neck


def shirt_front(g, arms_down=True):
    g.rect(5, 19, 20, 30, C["shirt"])
    g.rect(4, 19, 5, 27, C["shirt"])
    g.rect(20, 19, 21, 27, C["shirt"])
    g.vline(20, 20, 29, C["shirtS"]); g.hline(5, 20, 30, C["shirtS"])
    g.vline(5, 20, 27, C["shirtS"]); g.vline(19, 28, 30, C["shirtS"])
    # collar flaps
    g.line(10, 18, 12, 21, C["shirtS"]); g.line(15, 18, 13, 21, C["shirtS"])
    g.line(10, 18, 12, 21, C["shirt"]); g.line(15, 18, 13, 21, C["shirt"])
    g.set(11, 18, C["shirt"]); g.set(14, 18, C["shirt"])
    # tie
    g.rect(11, 19, 13, 20, C["tieD"])
    g.vline(12, 21, 27, C["tie"]); g.vline(11, 21, 25, C["tie"]); g.vline(13, 21, 25, C["tie"])
    g.set(12, 28, C["tie"])
    g.vline(11, 21, 25, C["tieD"])
    g.set(12, 22, C["tieL"]); g.set(12, 25, C["tieL"])
    # lanyard + badge
    g.line(11, 19, 7, 24, C["tieL"])
    g.rect(5, 25, 8, 29, C["paper"])
    g.hline(5, 8, 25, C["tie"])
    g.hline(6, 7, 27, C["grayD"]); g.hline(6, 7, 28, C["gray"])
    if arms_down:
        g.rect(4, 28, 5, 30, C["skin"])
        g.rect(20, 28, 21, 30, C["skin"])


def legs_front(g, walk=0):
    if walk == 0:
        g.rect(7, 31, 11, 38, C["pants"])
        g.rect(14, 31, 18, 38, C["pants"])
        g.vline(12, 32, 37, C["pantsD"]); g.vline(13, 32, 37, C["pantsD"])
        g.vline(18, 32, 37, C["pantsD"])
        g.rect(6, 39, 11, 41, C["shoe"])
        g.rect(14, 39, 19, 41, C["shoe"])
        g.hline(6, 11, 41, C["shoeD"]); g.hline(14, 19, 41, C["shoeD"])
        g.set(7, 39, C["shoeD"]); g.set(15, 39, C["shoeD"])
    elif walk == 1:
        g.rect(6, 31, 10, 39, C["pants"])
        g.rect(5, 39, 10, 41, C["shoe"]); g.hline(5, 10, 41, C["shoeD"])
        g.rect(15, 31, 18, 36, C["pantsD"])
        g.rect(15, 37, 20, 38, C["shoe"]); g.hline(15, 20, 38, C["shoeD"])
        g.set(19, 37, C["shoeD"]); g.set(10, 31, C["pantsD"])
    else:
        g.rect(15, 31, 19, 39, C["pants"])
        g.rect(15, 39, 20, 41, C["shoe"]); g.hline(15, 20, 41, C["shoeD"])
        g.rect(7, 31, 10, 36, C["pantsD"])
        g.rect(5, 37, 10, 38, C["shoe"]); g.hline(5, 10, 38, C["shoeD"])
        g.set(6, 37, C["shoeD"]); g.set(15, 31, C["pantsD"])


# ---------------------------------------------------------------- poses
def worker_front(walk=0):
    g = Grid(W, H)
    legs_front(g, walk)
    shirt_front(g)
    neck_front(g)
    face_front(g)
    hair_front(g)
    autoline(g)
    return g


def worker_back(walk=0):
    g = Grid(W, H)
    legs_front(g, walk)
    g.rect(5, 19, 20, 30, C["shirt"])
    g.rect(4, 19, 5, 27, C["shirt"]); g.rect(20, 19, 21, 27, C["shirt"])
    g.vline(20, 20, 29, C["shirtS"]); g.hline(5, 20, 30, C["shirtS"])
    g.vline(5, 20, 27, C["shirtS"])
    g.hline(10, 15, 18, C["shirtS"])         # back collar
    g.vline(12, 19, 30, C["shirtS"])         # seam
    g.rect(4, 28, 5, 30, C["skin"]); g.rect(20, 28, 21, 30, C["skin"])
    g.rect(11, 17, 14, 18, C["skinS"])       # neck
    # hair from behind: covers everything down to the collar
    g.disc(13, 6, 7, C["hair"], squash=0.8)
    g.rect(6, 3, 20, 14, C["hair"])
    tri(g, 6, 2, 3, C["hair"]); tri(g, 10, 0, 3, C["hair"]); tri(g, 14, 0, 3, C["hair"])
    tri(g, 18, 1, 3, C["hair"]); tri(g, 21, 2, 2, C["hair"])
    g.line(9, 3, 8, 6, C["hairD"]); g.line(13, 2, 13, 6, C["hairD"]); g.line(17, 3, 18, 6, C["hairD"])
    g.rect(4, 7, 6, 12, C["hair"]); g.rect(19, 7, 21, 12, C["hair"])
    g.hline(6, 20, 14, C["hairD"]); g.hline(7, 19, 15, C["hairD"])
    g.hline(8, 12, 4, C["hairL"]); g.hline(14, 18, 5, C["hairL"])
    g.set(10, 3, C["hairH"]); g.set(15, 2, C["hairH"])
    g.set(7, 12, C["hairD"]); g.set(18, 13, C["hairD"])
    autoline(g)
    return g


def side_head(g):
    """side-profile head facing LEFT; occupies rows 1-18, cols 4-21"""
    g.rect(10, 17, 13, 18, C["skin"])        # neck
    g.vline(10, 17, 18, C["skinS"])
    g.rect(6, 8, 14, 14, C["skin"])          # face plane
    g.rect(7, 15, 12, 16, C["skin"])         # jaw
    g.set(5, 12, C["skin"])                  # nose
    g.set(5, 13, C["skinS"])
    g.set(6, 14, C["skinS"])                 # mouth hint
    g.rect(13, 10, 14, 12, C["skin"])        # ear
    g.set(13, 11, C["skinS"])
    # hair mass (back of head to the right)
    g.disc(14, 6, 7, C["hair"], squash=0.8)
    g.rect(10, 3, 21, 9, C["hair"])
    tri(g, 9, 2, 3, C["hair"]); tri(g, 13, 0, 3, C["hair"]); tri(g, 17, 0, 3, C["hair"])
    tri(g, 21, 2, 2, C["hair"])
    g.line(12, 3, 11, 6, C["hairD"]); g.line(16, 2, 16, 6, C["hairD"])
    g.rect(20, 9, 21, 14, C["hair"])         # back tail
    g.hline(20, 21, 14, C["hairD"])
    # fringe over forehead (left), stopping above the eye
    g.rect(7, 7, 10, 9, C["hair"])
    g.set(8, 10, C["hair"]); g.set(11, 8, C["hair"])
    g.hline(11, 20, 5, C["hairL"]); g.set(14, 2, C["hairH"]); g.set(18, 3, C["hairL"])
    g.hline(15, 21, 12, C["hairD"])
    # eye (drawn after hair so fringe never covers it)
    g.rect(8, 10, 9, 13, C["eyeW"])
    g.rect(8, 10, 9, 12, C["eye"]); g.set(9, 13, C["eye"])
    g.set(8, 11, C["eyeS"])
    g.hline(8, 9, 9, C["hairD"])             # brow


def worker_side(walk=0):
    g = Grid(W, H)
    if walk == 0:
        g.rect(9, 31, 15, 38, C["pants"])
        g.vline(14, 32, 37, C["pantsD"])
        g.rect(7, 39, 15, 41, C["shoe"]); g.hline(7, 15, 41, C["shoeD"])
        g.set(7, 39, C["shoeD"]); g.set(8, 40, C["shoeD"])
    elif walk == 1:
        g.rect(8, 31, 13, 38, C["pants"])
        g.rect(5, 39, 13, 41, C["shoe"]); g.hline(5, 13, 41, C["shoeD"])
        g.rect(14, 31, 18, 35, C["pantsD"])
        g.rect(15, 36, 21, 37, C["shoe"]); g.set(20, 36, C["shoeD"])
    else:
        g.rect(12, 31, 17, 38, C["pants"])
        g.rect(11, 39, 18, 41, C["shoe"]); g.hline(11, 18, 41, C["shoeD"])
        g.rect(7, 31, 11, 35, C["pantsD"])
        g.rect(4, 36, 10, 37, C["shoe"]); g.set(5, 36, C["shoeD"])
    # torso
    g.rect(7, 19, 17, 30, C["shirt"])
    g.vline(17, 20, 29, C["shirtS"]); g.hline(7, 17, 30, C["shirtS"])
    g.vline(7, 21, 27, C["shirtS"])
    g.line(10, 18, 12, 21, C["shirtS"])      # collar
    g.rect(8, 19, 9, 20, C["tieD"])          # tie against the chest
    g.vline(8, 21, 27, C["tie"]); g.vline(7, 21, 25, C["tie"])
    g.set(9, 22, C["tieL"])
    g.line(11, 19, 8, 24, C["tieL"])         # lanyard
    g.rect(5, 25, 8, 29, C["paper"])
    g.hline(5, 8, 25, C["tie"]); g.hline(6, 7, 27, C["grayD"])
    # near arm hanging
    g.rect(13, 19, 15, 26, C["shirt"])
    g.vline(15, 20, 26, C["shirtS"])
    g.rect(13, 27, 15, 30, C["skin"])
    side_head(g)
    autoline(g)
    return g


def worker_documents():
    g = Grid(W, H)
    legs_front(g)
    shirt_front(g, arms_down=False)
    neck_front(g)
    face_front(g)
    hair_front(g)
    g.rect(4, 22, 6, 27, C["shirt"])
    g.rect(19, 22, 21, 27, C["shirt"])
    g.line(6, 27, 9, 28, C["skin"])
    g.line(19, 27, 16, 28, C["skin"])
    g.rect(8, 22, 17, 29, C["paper"])
    g.rect(9, 21, 16, 22, C["paper"])
    g.hline(9, 16, 24, C["paperD"]); g.hline(9, 16, 26, C["paperD"])
    g.hline(9, 16, 28, C["paperD"])
    g.vline(8, 22, 29, C["paperD"]); g.vline(17, 22, 29, C["paperD"])
    g.set(9, 29, C["skin"]); g.set(16, 29, C["skin"])
    autoline(g)
    return g


def worker_coffee():
    g = Grid(W, H)
    legs_front(g)
    shirt_front(g, arms_down=False)
    neck_front(g)
    face_front(g)
    hair_front(g)
    g.rect(4, 28, 5, 30, C["skin"])          # left arm down
    g.rect(20, 19, 21, 26, C["shirt"])       # right upper arm
    g.line(20, 27, 22, 29, C["skin"])        # forearm out to the side
    # mug held out at the side
    g.rect(22, 26, 25, 30, C["paper"])
    g.vline(22, 26, 30, C["paperD"])
    g.set(26, 27, C["paper"]); g.set(26, 28, C["paper"])  # handle
    g.hline(22, 25, 26, C["potD"])           # coffee
    g.set(23, 24, C["grayL"]); g.set(24, 23, C["grayL"]); g.set(23, 22, C["grayL"])  # steam
    autoline(g)
    return g


def worker_briefcase():
    g = worker_side(walk=0)
    g.rect(15, 31, 21, 37, C["wood"])
    g.rect(15, 31, 21, 32, C["woodD"])
    g.hline(15, 21, 37, C["woodD"])
    g.vline(21, 31, 37, C["woodD"])
    g.rect(17, 29, 19, 31, C["woodD"])       # handle
    g.set(18, 30, C["woodH"])
    g.set(18, 34, C["gold"])                 # clasp
    autoline(g)
    return g


def worker_sit():
    """side view facing LEFT, seated (chaise / cushions)"""
    g = Grid(W, H)
    g.rect(7, 28, 17, 31, C["pants"])        # thighs (horizontal)
    g.rect(15, 32, 18, 39, C["pants"])       # calves
    g.vline(17, 32, 38, C["pantsD"]); g.hline(7, 17, 31, C["pantsD"])
    g.rect(13, 39, 18, 41, C["shoe"]); g.hline(13, 18, 41, C["shoeD"])
    g.set(13, 39, C["shoeD"])
    g.rect(7, 19, 17, 28, C["shirt"])        # torso
    g.vline(17, 20, 27, C["shirtS"]); g.vline(7, 21, 27, C["shirtS"])
    g.line(10, 18, 12, 21, C["shirtS"])
    g.rect(8, 19, 9, 20, C["tieD"]); g.vline(8, 21, 26, C["tie"]); g.vline(7, 21, 24, C["tie"])
    g.line(11, 19, 8, 24, C["tieL"])
    g.rect(5, 25, 8, 28, C["paper"]); g.hline(5, 8, 25, C["tie"])
    # arms forward resting (phone in hands)
    g.rect(10, 22, 15, 24, C["shirt"])
    g.rect(12, 25, 16, 27, C["skin"])
    g.rect(11, 24, 14, 26, C["grayD"])       # phone
    g.set(12, 25, C["screen"])
    side_head(g)
    autoline(g)
    return g


def worker_upper_back():
    """seated at desk typing, back view, upper body (32 tall)"""
    g = Grid(W, 32)
    g.rect(4, 17, 21, 31, C["shirt"])
    g.vline(21, 18, 30, C["shirtS"]); g.vline(4, 18, 30, C["shirtS"])
    g.hline(9, 16, 16, C["shirtS"])          # collar
    g.vline(12, 17, 31, C["shirtS"])         # seam
    # arms angled forward (elbows winged out)
    g.rect(2, 18, 4, 25, C["shirt"])
    g.rect(21, 18, 23, 25, C["shirt"])
    g.vline(2, 19, 25, C["shirtS"]); g.vline(23, 19, 25, C["shirtS"])
    g.rect(3, 26, 5, 28, C["skin"])
    g.rect(20, 26, 22, 28, C["skin"])
    g.rect(11, 14, 14, 16, C["skinS"])       # neck
    g.disc(13, 6, 7, C["hair"], squash=0.8)
    g.rect(6, 3, 20, 14, C["hair"])
    tri(g, 6, 1, 2, C["hair"]); tri(g, 10, 0, 2, C["hair"]); tri(g, 14, 0, 2, C["hair"])
    tri(g, 18, 1, 2, C["hair"]); tri(g, 21, 2, 1, C["hair"])
    g.rect(4, 7, 6, 12, C["hair"]); g.rect(19, 7, 21, 12, C["hair"])
    g.hline(6, 19, 13, C["hairD"]); g.hline(7, 18, 14, C["hairD"])
    g.hline(8, 12, 4, C["hairL"]); g.hline(14, 18, 5, C["hairL"])
    g.set(10, 3, C["hairH"]); g.set(15, 2, C["hairH"])
    autoline(g)
    return g


def worker_upper_front():
    """front upper body (32 tall) — also base for the slumped pose"""
    g = Grid(W, 32)
    g.rect(5, 16, 20, 31, C["shirt"])
    g.rect(4, 16, 5, 24, C["shirt"]); g.rect(20, 16, 21, 24, C["shirt"])
    g.vline(20, 17, 30, C["shirtS"]); g.vline(5, 17, 24, C["shirtS"])
    g.rect(11, 16, 13, 17, C["tieD"]); g.vline(12, 18, 27, C["tie"])
    g.vline(11, 18, 25, C["tie"]); g.vline(13, 18, 25, C["tie"]); g.vline(11, 18, 25, C["tieD"])
    g.set(12, 20, C["tieL"])
    g.line(11, 16, 7, 21, C["tieL"])
    g.rect(5, 22, 8, 26, C["paper"]); g.hline(5, 8, 22, C["tie"])
    g.hline(6, 7, 24, C["grayD"])
    g.rect(11, 14, 14, 15, C["skin"]); g.vline(11, 14, 15, C["skinS"])
    # face: same geometry as front view, shifted up by -3
    g.rect(7, 5, 18, 11, C["skin"])
    g.rect(8, 12, 17, 13, C["skin"]); g.rect(10, 14, 15, 14, C["skin"])
    g.rect(5, 7, 6, 9, C["skin"]); g.rect(19, 7, 20, 9, C["skin"])
    g.set(6, 8, C["skinS"]); g.set(19, 8, C["skinS"])
    g.hline(8, 7, 10, C["hairD"]); g.hline(15, 17, 7, C["hairD"])
    for ex in (9, 16):
        g.rect(ex - 1, 8, ex + 1, 11, C["eyeW"])
        g.rect(ex, 8, ex + 1, 10, C["eye"]); g.set(ex - 1, 8, C["eye"])
        g.set(ex, 9, C["eyeS"])
    g.set(13, 11, C["skinS"]); g.hline(12, 13, 12, C["skinS"])
    # hair, shifted up by -3
    g.disc(13, 3, 7, C["hair"], squash=0.8)
    g.rect(6, 0, 20, 6, C["hair"])
    tri(g, 10, 0, 2, C["hair"]); tri(g, 14, 0, 2, C["hair"]); tri(g, 18, 1, 1, C["hair"])
    g.rect(4, 4, 6, 9, C["hair"]); g.rect(19, 4, 21, 9, C["hair"])
    for i, x in enumerate(range(6, 20)):
        g.set(x, 5 + (i % 2), C["hair"])
    g.set(8, 7, C["hair"]); g.set(12, 7, C["hair"]); g.set(16, 7, C["hair"])
    g.hline(7, 12, 2, C["hairL"]); g.hline(14, 18, 2, C["hairL"])
    g.hline(5, 8, 9, C["hairD"]); g.hline(17, 20, 9, C["hairD"])
    autoline(g)
    return g


POSES = {
    "worker_stand_front.png": worker_front(0),
    "worker_walk_front.png": worker_front(1),
    "worker_stand_back.png": worker_back(0),
    "worker_walk_back.png": worker_back(1),
    "worker_stand_side.png": worker_side(0),
    "worker_walk_side_a.png": worker_side(1),
    "worker_walk_side_b.png": worker_side(2),
    "worker_documents.png": worker_documents(),
    "worker_coffee.png": worker_coffee(),
    "worker_briefcase.png": worker_briefcase(),
    "worker_sit.png": worker_sit(),
    "worker_sit_naked.png": worker_sit(),
    "worker_upper_back.png": worker_upper_back(),
    "worker_upper_front.png": worker_upper_front(),
}


# ---------------------------------------------------------------- layered worker atlases
#
# The existing standalone sprites stay deliberately untouched. These atlases
# are a second, normalized source for the randomized worker renderer: every
# cell is 26x48 source pixels (104x192 output pixels), and every variable
# component shares the same feet/head anchor as the current sprites.
CELL_H = 48
POSE_ORDER = (
    "stand_front", "stand_side", "stand_back", "walk_front", "walk_front_b",
    "walk_side_a", "walk_side_b", "walk_back", "walk_back_b", "documents",
    "coffee", "briefcase", "sit", "upper_front", "upper_back",
)
POSE_SOURCES = {
    "stand_front": POSES["worker_stand_front.png"],
    "stand_side": POSES["worker_stand_side.png"],
    "stand_back": POSES["worker_stand_back.png"],
    "walk_front": POSES["worker_walk_front.png"],
    "walk_front_b": worker_front(-1),
    "walk_side_a": POSES["worker_walk_side_a.png"],
    "walk_side_b": POSES["worker_walk_side_b.png"],
    "walk_back": POSES["worker_walk_back.png"],
    "walk_back_b": worker_back(-1),
    "documents": POSES["worker_documents.png"],
    "coffee": POSES["worker_coffee.png"],
    "briefcase": POSES["worker_briefcase.png"],
    "sit": POSES["worker_sit.png"],
    "upper_front": POSES["worker_upper_front.png"],
    "upper_back": POSES["worker_upper_back.png"],
}

VARIANT_NAMES = {
    "skin": ("light", "fair", "warm", "honey", "umber", "deep"),
    "shirt": ("white uniform", "sky blue", "charcoal", "sand", "sage", "burgundy"),
    "pants": ("navy", "charcoal", "khaki", "jeans", "olive cargo", "burgundy"),
    "shoes": ("brown oxford", "black loafer", "white sneaker", "red sneaker", "dark boot", "blue flat"),
    "hairstyle": ("tousled short", "side part", "bob", "high ponytail", "curls", "crew cut"),
    "hat": ("none", "blue cap", "beanie", "beret", "newsboy", "yellow hardhat"),
    "face": ("none", "moustache", "goatee", "freckles", "bandage", "mask"),
    "glasses": ("none", "black rectangle", "gold round", "red thin", "blue half-rim", "sunglasses"),
}

SKIN_PALETTES = (
    ((250, 224, 196), (235, 190, 153)),
    ((246, 208, 171), (224, 174, 130)),
    ((236, 188, 143), (202, 142, 101)),
    ((217, 164, 112), (176, 108, 71)),
    ((184, 127, 83), (143, 83, 57)),
    ((145, 91, 66), (106, 59, 49)),
)

SHIRT_PALETTES = (
    (C["shirt"], C["shirtS"]),
    ((169, 207, 228), (104, 151, 180)),
    ((96, 102, 113), (57, 61, 70)),
    ((207, 181, 137), (151, 119, 78)),
    ((133, 157, 120), (82, 105, 75)),
    ((151, 72, 84), (96, 43, 55)),
)

PANTS_PALETTES = (
    ((57, 74, 116), (39, 51, 85)),
    ((75, 78, 87), (52, 54, 63)),
    ((166, 143, 93), (113, 95, 60)),
    ((65, 104, 145), (42, 70, 103)),
    ((83, 101, 72), (55, 68, 48)),
    ((119, 61, 72), (80, 40, 51)),
)

SHOE_PALETTES = (
    ((110, 68, 38), (78, 45, 24)),
    ((54, 52, 55), (31, 30, 34)),
    ((235, 237, 230), (178, 181, 176)),
    ((190, 60, 63), (125, 37, 43)),
    ((71, 72, 78), (42, 43, 49)),
    ((73, 106, 157), (45, 68, 111)),
)

HAIR_PALETTES = (
    (C["hair"], C["hairD"], C["hairL"], C["hairH"]),
    ((125, 80, 50), (80, 48, 30), (164, 105, 62), (194, 137, 79)),
    ((154, 77, 53), (94, 45, 37), (190, 111, 69), (222, 151, 94)),
    ((78, 57, 48), (47, 35, 31), (110, 82, 63), (145, 114, 82)),
    ((176, 102, 53), (108, 56, 29), (209, 139, 70), (235, 177, 103)),
    ((63, 49, 42), (37, 31, 29), (96, 75, 60), (128, 103, 82)),
)

SKIN_RGB = {C["skin"], C["skinS"]}
SHIRT_RGB = {C["shirt"], C["shirtS"]}
PANTS_RGB = {C["pants"], C["pantsD"]}
SHOE_RGB = {C["shoe"], C["shoeD"]}
HAIR_RGB = {C["hair"], C["hairD"], C["hairL"], C["hairH"]}


def _normalize_pose(g):
    cell = Grid(W, CELL_H)
    cell.paste(g, 0, max(0, CELL_H - g.h))
    return cell


def _pose_offset(key):
    return max(0, CELL_H - POSE_SOURCES[key].h)


def _is_prop_pixel(key, x, y, rgb):
    """Return whether a source pixel belongs to an action prop.

    The badge remains in the invariant base layer. Coordinate gates keep its
    paper/gray colors out of the documents and phone props.
    """
    if key == "documents":
        return 8 <= x <= 17 and 21 <= y <= 29 and rgb in {C["paper"], C["paperD"]}
    if key == "coffee":
        return x >= 22 and y >= 22 and rgb in {
            C["paper"], C["paperD"], C["potD"], C["grayL"]
        }
    if key == "briefcase":
        return x >= 15 and 29 <= y <= 37 and rgb in {
            C["wood"], C["woodD"], C["woodH"], C["gold"]
        }
    if key == "sit":
        return 10 <= x <= 16 and 23 <= y <= 27 and rgb in {
            C["grayD"], C["screen"]
        }
    return False


def _has_hair_neighbor(source, x, y):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nx, ny = x + dx, y + dy
        if 0 <= nx < source.w and 0 <= ny < source.h:
            p = source.px[nx, ny]
            if p[3] and p[:3] in HAIR_RGB:
                return True
    return False


def _split_pose(key, source):
    """Split one current sprite into aligned transparent component layers."""
    source = _normalize_pose(source)
    y_offset = _pose_offset(key)
    layers = {name: Grid(W, CELL_H) for name in (
        "base", "skin", "shirt", "pants", "shoes", "hair", "props"
    )}
    for y in range(CELL_H):
        for x in range(W):
            p = source.px[x, y]
            if not p[3]:
                continue
            rgb = p[:3]
            if rgb in SKIN_RGB:
                kind = "skin"
            elif rgb in SHIRT_RGB:
                kind = "shirt"
            elif rgb in PANTS_RGB:
                kind = "pants"
            elif rgb in SHOE_RGB:
                kind = "shoes"
            elif rgb in HAIR_RGB:
                kind = "hair"
            elif _is_prop_pixel(key, x, y - y_offset, rgb):
                kind = "props"
            elif rgb == C["out"] and _has_hair_neighbor(source, x, y):
                # The outline belongs with hair so changing silhouette does
                # not leave a stale black halo in the invariant base layer.
                kind = "hair"
            else:
                kind = "base"
            layers[kind].set(x, y, rgb)
    return layers


def _skin_variant(key, source, palette):
    """Recolor skin and provide a real scalp beneath rear-facing hair.

    The legacy rear poses painted the whole skull as hair. Replacing that
    mass with crew-cut hair therefore exposed transparent pixels. A skin
    silhouette below the hairstyle keeps every rear head complete while the
    longer hairstyles continue to cover it naturally.
    """
    main, shadow = palette
    overlay = Grid(W, CELL_H)
    if _back_pose(key):
        overlay.disc(13, 7, 7, C["out"], squash=0.9)
        overlay.disc(13, 7, 6, main, squash=0.9)
        overlay.rect(8, 9, 18, 13, main)
        overlay.hline(9, 17, 14, shadow)
        overlay.hline(10, 16, 15, shadow)
        overlay.rect(11, 14, 15, 18, main)
        overlay.hline(11, 15, 18, shadow)
    elif _side_pose(key):
        # The legacy side sprite painted its large hair mass over most of the
        # skull. Short hairstyles therefore need a complete profile beneath
        # them instead of a one-pixel bridge to the nose.
        overlay.rect(7, 8, 16, 14, main)
        overlay.rect(8, 15, 13, 16, main)
        overlay.rect(10, 17, 13, 18, main)
        overlay.hline(8, 13, 16, shadow)
        overlay.vline(10, 17, 18, shadow)
    elif key == "upper_front":
        overlay.rect(7, 5, 18, 11, main)
        overlay.rect(8, 12, 17, 13, main)
        overlay.rect(10, 14, 15, 15, main)
        overlay.hline(10, 15, 15, shadow)
    else:
        overlay.rect(7, 8, 18, 14, main)
        overlay.rect(8, 15, 17, 16, main)
        overlay.rect(10, 17, 15, 18, main)
        overlay.hline(10, 15, 18, shadow)
    out = overlay.shift(0, _pose_offset(key))
    recolored = _recolor(source, {C["skin"]: main, C["skinS"]: shadow})
    out.img.alpha_composite(recolored.img)
    return out


def _recolor(source, mapping):
    out = Grid(W, CELL_H)
    for y in range(CELL_H):
        for x in range(W):
            p = source.px[x, y]
            if p[3]:
                out.set(x, y, mapping.get(p[:3], p[:3]))
    return out


def _hair_recolor(source, palette):
    main, dark, light, highlight = palette
    return _recolor(source, {
        C["hair"]: main, C["hairD"]: dark, C["hairL"]: light,
        C["hairH"]: highlight,
    })


def _side_pose(key):
    return key in {"stand_side", "walk_side_a", "walk_side_b", "briefcase", "sit"}


def _back_pose(key):
    return key in {"stand_back", "walk_back", "walk_back_b", "upper_back"}


def _upper_pose(key):
    return key in {"upper_front", "upper_back"}


def _face_shift(key):
    return -3 if key == "upper_front" else 0


def _hairstyle_variant(key, source, index):
    palette = HAIR_PALETTES[index]
    main, dark, light, highlight = palette
    base = _hair_recolor(source, palette) if index not in {3, 5} else Grid(W, CELL_H)
    g = Grid(W, CELL_H)

    side = _side_pose(key)
    upper = _upper_pose(key)
    if upper:
        top, side_y = 0, 7
    else:
        top, side_y = 0, 10

    if index == 1:  # side part: a clean, offset crown highlight
        if side:
            g.line(16, 1, 13, 6, dark)
            g.line(18, 2, 19, 6, light)
        else:
            g.line(14, top + 1, 11, top + 6, dark)
            g.line(16, top + 2, 18, top + 6, light)
    elif index == 2:  # bob: longer cheek-level side locks
        if side:
            g.rect(19, side_y, 22, side_y + (5 if not upper else 3), dark)
            g.rect(20, side_y, 21, side_y + (4 if not upper else 2), main)
            g.rect(6, side_y - 1, 8, side_y + 3, dark)
            g.set(7, side_y, main)
        else:
            end = 13 if not upper else 11
            g.rect(4, side_y, 7, end, dark)
            g.rect(5, side_y, 6, end - 1, main)
            g.rect(19, side_y, 21, end, dark)
            g.rect(19, side_y, 20, end - 1, main)
    elif index == 3:  # high ponytail: fitted crown plus a compact tied tail
        if side:
            g.disc(20, 8, 3, dark, squash=0.85)
            g.disc(20, 8, 2, main, squash=0.9)
            g.hline(19, 21, 6, highlight)
            g.hline(13, 18, 1, main)
            g.hline(11, 20, 2, main)
            g.rect(10, 3, 20, 9, main)
            g.hline(9, 19, 10, main)
            g.hline(10, 18, 11, dark)
            g.vline(20, 4, 9, dark)
            g.hline(13, 18, 3, light)
        elif _back_pose(key):
            g.disc(21, 7, 3, dark, squash=0.85)
            g.disc(21, 7, 2, main, squash=0.9)
            g.hline(20, 22, 5, highlight)
            g.hline(10, 16, 1, main)
            g.hline(8, 18, 2, main)
            g.rect(7, 3, 19, 10, main)
            g.hline(8, 18, 11, dark)
            g.hline(10, 16, 3, light)
        else:
            g.disc(21, 7, 3, dark, squash=0.85)
            g.disc(21, 7, 2, main, squash=0.9)
            g.hline(20, 22, 5, highlight)
            g.hline(10, 16, 1, main)
            g.hline(8, 18, 2, main)
            g.rect(7, 3, 19, 8, main)
            g.hline(8, 18, 9, dark)
            g.hline(10, 16, 3, light)
        autoline(g)
    elif index == 4:  # curls: bead-like clustered ends
        centers = ((5, side_y + 1), (6, side_y + 5), (21, side_y + 1), (20, side_y + 5))
        if side:
            centers = ((20, side_y + 2), (21, side_y + 6), (7, side_y + 1))
        if upper:
            centers = tuple((x, max(5, y - 3)) for x, y in centers)
        for cx, cy in centers:
            g.disc(cx, cy, 2, dark, squash=0.85)
            g.set(cx, cy, main)
            g.set(cx - 1, cy - 1, light)
    elif index == 5:  # crew cut: rounded, outlined, and joined to the scalp
        if side:
            g.hline(13, 18, 1, main)
            g.hline(11, 20, 2, main)
            g.rect(10, 3, 20, 8, main)
            g.hline(10, 19, 9, main)
            g.hline(11, 18, 10, dark)
            g.vline(20, 4, 8, dark)
            g.hline(13, 18, 3, light)
        elif _back_pose(key):
            g.hline(10, 16, 1, main)
            g.hline(8, 18, 2, main)
            g.rect(7, 3, 19, 9, main)
            g.hline(8, 18, 10, main)
            g.hline(9, 17, 11, dark)
            g.hline(10, 16, 3, light)
        else:
            g.hline(10, 16, 1, main)
            g.hline(8, 18, 2, main)
            g.rect(7, 3, 19, 7, main)
            g.hline(8, 18, 8, main)
            g.hline(9, 17, 9, dark)
            g.hline(10, 16, 3, light)
        autoline(g)

    style_shift = _pose_offset(key) - (3 if upper and index in {3, 5} else 0)
    addition = g.shift(0, max(0, style_shift))
    base.img.alpha_composite(addition.img)
    return base


HAT_PALETTES = (
    ((57, 104, 194), (35, 67, 139), (115, 157, 231)),  # blue cap
    ((65, 133, 126), (39, 89, 84), (112, 184, 165)),   # beanie
    ((178, 62, 67), (113, 39, 48), (221, 106, 93)),     # beret
    ((177, 119, 57), (110, 72, 35), (224, 170, 81)),    # newsboy
    ((238, 190, 44), (168, 120, 22), (255, 224, 102)),  # hardhat
)


def _hat_variant(key, index):
    g = Grid(W, CELL_H)
    if index == 0:
        return g
    dark, main, light = HAT_PALETTES[index - 1]
    side = _side_pose(key)
    if side:
        # Side-view hats need a directional profile: the face points left, so
        # brims project toward x=5 while the crown remains over the rear skull.
        if index == 1:  # blue cap
            g.rect(11, 1, 19, 5, dark)
            g.rect(12, 0, 18, 4, main)
            g.hline(13, 17, 2, light)
            g.rect(9, 5, 20, 7, dark)
            g.hline(10, 18, 6, main)
            g.rect(5, 7, 11, 8, dark)
            g.hline(6, 10, 7, main)
        elif index == 2:  # beanie
            g.disc(14, 4, 6, dark, squash=0.95)
            g.rect(10, 2, 19, 6, main)
            g.hline(12, 17, 2, light)
            g.rect(8, 6, 21, 8, dark)
            g.hline(10, 19, 7, main)
        elif index == 3:  # beret
            g.hline(13, 18, 0, main)
            g.rect(11, 1, 20, 5, dark)
            g.rect(13, 1, 19, 4, main)
            g.hline(14, 18, 2, light)
            g.rect(8, 5, 20, 8, dark)
            g.hline(10, 18, 6, main)
        elif index == 4:  # newsboy cap
            g.hline(13, 18, 0, main)
            g.hline(11, 20, 1, dark)
            g.rect(10, 2, 20, 6, dark)
            g.rect(12, 2, 19, 5, main)
            g.set(14, 2, light)
            g.rect(8, 6, 20, 8, dark)
            g.hline(10, 18, 7, light)
            g.rect(5, 8, 11, 9, dark)
        elif index == 5:  # yellow hardhat
            g.rect(11, 2, 20, 6, main)
            g.rect(13, 1, 18, 5, main)
            g.rect(15, 0, 16, 3, light)
            g.hline(12, 19, 2, light)
            g.rect(8, 6, 21, 8, dark)
            g.hline(10, 19, 7, light)
            g.hline(5, 22, 8, dark)
        return g.shift(0, max(0, _pose_offset(key) - 6))

    x0, x1 = (9, 21) if side else (6, 20)
    if index == 1:  # blue cap
        g.rect(x0 + 2, 1, x1 - 1, 5, dark)
        g.rect(x0 + 4, 0, x1 - 3, 4, main)
        g.hline(x0 + 3, x1 - 3, 2, light)
        g.rect(x0, 5, x1, 6, dark)
        g.hline(x0 + 1, x1 - 3, 5, main)
    elif index == 2:  # beanie
        g.disc((x0 + x1) // 2, 4, 7 if not side else 6, dark, squash=0.8)
        g.rect(x0 + 2, 2, x1 - 1, 6, main)
        g.hline(x0 + 4, x1 - 4, 1, light)
        g.hline(x0 + 1, x1, 7, dark)
    elif index == 3:  # beret
        g.rect(x0 + 2, 2, x1 - 1, 6, dark)
        g.rect(x0 + 4, 1, x1 - 3, 5, main)
        g.rect(x0 + 1, 5, x1 - 2, 7, dark)
        g.hline(x0 + 3, x1 - 3, 5, light)
        g.set(x1 - 2, 1, dark)
    elif index == 4:  # newsboy cap
        g.rect(x0 + 3, 1, x1 - 2, 6, dark)
        g.rect(x0 + 5, 0, x1 - 4, 4, main)
        g.set(x0 + 6, 1, light)
        g.rect(x0, 5, x1 - 2, 7, dark)
        g.hline(x0 + 2, x1 - 4, 5, light)
    elif index == 5:  # yellow hardhat
        g.rect(x0, 4, x1 + 1, 8, dark)
        g.rect(x0 + 2, 1, x1 - 1, 6, main)
        g.rect(x0 + 5, 0, x1 - 4, 4, main)
        g.hline(x0 + 5, x1 - 5, 1, light)
        g.hline(x0 - 1, x1 + 2, 8, dark)
        g.hline(x0 + 1, x1, 7, light)
    return g.shift(0, max(0, _pose_offset(key) - 6))


def _face_accessory_variant(key, index):
    g = Grid(W, CELL_H)
    if index == 0 or _back_pose(key):
        return g.shift(0, _pose_offset(key))
    side = _side_pose(key)
    shift = _face_shift(key)
    dark = C["hairD"]
    if side:
        if index == 1:  # moustache
            g.hline(7, 10, 14 + shift, dark)
            g.set(7, 13 + shift, dark)
        elif index == 2:  # goatee
            g.hline(8, 10, 15 + shift, dark)
            g.set(9, 16 + shift, dark)
        elif index == 3:  # freckles
            g.set(8, 13 + shift, C["cheek"])
            g.set(10, 14 + shift, C["cheek"])
        elif index == 4:  # bandage
            g.rect(7, 10 + shift, 10, 11 + shift, C["paper"])
            g.set(8, 10 + shift, C["paperD"])
        elif index == 5:  # mask
            g.rect(6, 13 + shift, 13, 17 + shift, dark)
            g.rect(7, 14 + shift, 12, 16 + shift, C["teal"])
            g.hline(8, 11, 15 + shift, C["tealL"])
    else:
        if index == 1:  # moustache
            g.hline(10, 12, 15 + shift, dark); g.hline(14, 16, 15 + shift, dark)
            g.set(11, 16 + shift, dark); g.set(15, 16 + shift, dark)
        elif index == 2:  # goatee
            g.hline(11, 15, 16 + shift, dark)
            g.hline(12, 14, 17 + shift, dark); g.set(13, 18 + shift, dark)
        elif index == 3:  # freckles
            for x, y in ((8, 13), (10, 14), (16, 14), (18, 13)):
                g.set(x, y + shift, C["cheek"])
        elif index == 4:  # bandage
            g.rect(15, 11 + shift, 18, 12 + shift, C["paper"])
            g.set(16, 11 + shift, C["paperD"]); g.set(17, 12 + shift, C["paperD"])
        elif index == 5:  # mask
            g.rect(8, 14 + shift, 18, 18 + shift, dark)
            g.rect(9, 15 + shift, 17, 17 + shift, C["teal"])
            g.hline(10, 16, 16 + shift, C["tealL"])
    return g.shift(0, _pose_offset(key))


def _glasses_variant(key, index):
    g = Grid(W, CELL_H)
    if index == 0 or _back_pose(key):
        return g.shift(0, _pose_offset(key))
    shift = _face_shift(key)
    if _side_pose(key):
        x0, x1 = 7, 11
        y0, y1 = 9 + shift, 14 + shift
        if index == 1:
            col = C["out"]
            g.rect(x0, y0, x1, y1, col); g.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, C["eyeW"])
        elif index == 2:
            col = C["gold"]
            g.hline(x0 + 1, x1 - 1, y0, col); g.vline(x0, y0 + 1, y1 - 1, col)
            g.hline(x0 + 1, x1 - 1, y1, col)
        elif index == 3:
            g.hline(x0, x1, y0, C["red"]); g.hline(x0, x1, y1, C["red"])
            g.vline(x0, y0, y1, C["red"])
        elif index == 4:
            g.hline(x0, x1, y1, C["tie"]); g.set(x0, y1 - 1, C["tieL"])
        elif index == 5:
            g.rect(x0, y0 + 1, x1, y1 - 1, C["navyD"])
            g.hline(x0, x1, y0, C["out"]); g.hline(x0, x1, y1, C["out"])
        return g.shift(0, _pose_offset(key))

    y0, y1 = 10 + shift, 14 + shift
    if index == 1:  # black rectangle
        col = C["out"]
        for x0, x1 in ((7, 11), (14, 18)):
            g.hline(x0, x1, y0, col); g.hline(x0, x1, y1, col)
            g.vline(x0, y0, y1, col); g.vline(x1, y0, y1, col)
        g.hline(12, 13, y0 + 1, col)
    elif index == 2:  # gold round
        col = C["gold"]
        for x0, x1 in ((7, 11), (14, 18)):
            g.hline(x0 + 1, x1 - 1, y0, col); g.hline(x0 + 1, x1 - 1, y1, col)
            g.set(x0, y0 + 1, col); g.set(x1, y0 + 1, col)
            g.set(x0, y1 - 1, col); g.set(x1, y1 - 1, col)
        g.hline(12, 13, y0 + 1, col)
    elif index == 3:  # red thin
        col = C["red"]
        g.hline(7, 11, y0, col); g.hline(14, 18, y0, col)
        g.hline(7, 11, y1, col); g.hline(14, 18, y1, col)
        g.hline(12, 13, y0, col)
    elif index == 4:  # blue half-rim
        col = C["tie"]
        g.hline(7, 11, y1, col); g.hline(14, 18, y1, col)
        g.hline(11, 13, y0 + 1, C["tieL"])
        g.set(7, y1 - 1, C["tieL"]); g.set(18, y1 - 1, C["tieL"])
    elif index == 5:  # sunglasses
        g.rect(7, y0 + 1, 11, y1 - 1, C["navyD"])
        g.rect(14, y0 + 1, 18, y1 - 1, C["navyD"])
        g.hline(7, 11, y0, C["out"]); g.hline(14, 18, y0, C["out"])
        g.hline(12, 13, y0, C["out"])
        g.set(8, y0 + 1, C["grayL"]); g.set(15, y0 + 1, C["grayL"])
    return g.shift(0, _pose_offset(key))


def _save_atlas(name, cells, columns):
    """Save a row-major or column-major list of source cells as a 4x atlas."""
    rows = len(POSE_ORDER)
    small = Image.new("RGBA", (W * columns, CELL_H * rows), (0, 0, 0, 0))
    if columns == 1:
        cells = [cells]
    for col in range(columns):
        for row, cell in enumerate(cells[col]):
            small.alpha_composite(cell.img, (col * W, row * CELL_H))
    image = small.resize((small.width * 4, small.height * 4), Image.Resampling.NEAREST)
    path = os.path.join(OUT, name)
    image.save(path)
    print(f"  {name}: {image.size}")
    return image


def _compose_worker(row, layers, skin_index=1, shirt_index=0, pants_index=0, shoes_index=0,
                    hair_index=0, hat_index=0, face_index=0, glasses_index=0):
    out = Grid(W, CELL_H)
    for layer in (
        layers["skin"][skin_index][row], layers["shirt"][shirt_index][row],
        layers["pants"][pants_index][row], layers["shoes"][shoes_index][row],
        layers["base"][row],
        layers["hair"][hair_index][row], layers["hat"][hat_index][row],
        layers["face"][face_index][row], layers["glasses"][glasses_index][row],
        layers["props"][row],
    ):
        out.img.alpha_composite(layer.img)
    return out


def generate_layered_workers():
    split = [_split_pose(key, POSE_SOURCES[key]) for key in POSE_ORDER]
    layers = {"base": [entry["base"] for entry in split],
              "props": [entry["props"] for entry in split]}
    layers["skin"] = [[_skin_variant(POSE_ORDER[row], entry["skin"], palette)
                       for row, entry in enumerate(split)] for palette in SKIN_PALETTES]
    layers["shirt"] = [[_recolor(entry["shirt"], {
        C["shirt"]: palette[0], C["shirtS"]: palette[1],
    }) for entry in split] for palette in SHIRT_PALETTES]
    layers["pants"] = [[_recolor(entry["pants"], {C["pants"]: palette[0], C["pantsD"]: palette[1]})
                        for entry in split] for palette in PANTS_PALETTES]
    layers["shoes"] = [[_recolor(entry["shoes"], {C["shoe"]: palette[0], C["shoeD"]: palette[1]})
                         for entry in split] for palette in SHOE_PALETTES]
    layers["hair"] = [[_hairstyle_variant(key, split[row]["hair"], index)
                        for row, key in enumerate(POSE_ORDER)] for index in range(6)]
    layers["hat"] = [[_hat_variant(key, index) for key in POSE_ORDER] for index in range(6)]
    layers["face"] = [[_face_accessory_variant(key, index) for key in POSE_ORDER] for index in range(6)]
    layers["glasses"] = [[_glasses_variant(key, index) for key in POSE_ORDER] for index in range(6)]

    _save_atlas("worker_layer_base.png", layers["base"], 1)
    _save_atlas("worker_layer_skin.png", layers["skin"], 6)
    _save_atlas("worker_layer_shirt.png", layers["shirt"], 6)
    _save_atlas("worker_layer_pants.png", layers["pants"], 6)
    _save_atlas("worker_layer_shoes.png", layers["shoes"], 6)
    _save_atlas("worker_layer_hairstyle.png", layers["hair"], 6)
    _save_atlas("worker_layer_hat.png", layers["hat"], 6)
    _save_atlas("worker_layer_face_accessory.png", layers["face"], 6)
    _save_atlas("worker_layer_glasses.png", layers["glasses"], 6)
    _save_atlas("worker_layer_props.png", layers["props"], 1)
    return layers


# V3 uses a direct shared rig instead of the legacy RGB splitter above.  The
# old helpers remain available only to reproduce the retained V2 assets.
from worker_parts import (  # noqa: E402
    CELL_H as V3_CELL_H,
    POSE_ORDER as V3_POSE_ORDER,
    VARIANT_NAMES as V3_VARIANT_NAMES,
    generate_worker_parts,
)

CELL_H = V3_CELL_H
POSE_ORDER = V3_POSE_ORDER
VARIANT_NAMES = V3_VARIANT_NAMES
generate_layered_workers = generate_worker_parts


if __name__ == "__main__":
    print("v3 three-part worker atlases:")
    generate_worker_parts()
