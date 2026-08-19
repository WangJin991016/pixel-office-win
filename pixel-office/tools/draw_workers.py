#!/usr/bin/env python3
"""Worker character poses — hand-drawn chibi pixel art (26x42 base grid).

Reference design (worker.jpeg): fluffy brown hair, white shirt, blue tie,
ID badge on lanyard, gray slacks, brown shoes.

Geometry contract (front view):
  hair rows 1-9 (bangs at 8-9), sideburns to 12
  face rows 8-17, eyes rows 11-14, brows row 10
  neck 17-18, collar 18-19, shirt 19-30, pants 31-38, shoes 39-41
"""
from pixel_art import Grid, C, autoline

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

if __name__ == "__main__":
    print("worker poses:")
    for name, g in POSES.items():
        g.save(name)
