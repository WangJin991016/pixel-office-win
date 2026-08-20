"""Pixel Office 0.3 generated-asset contract checks."""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

import draw_furniture  # noqa: E402
import draw_workers  # noqa: E402
import worker_parts  # noqa: E402


APPEARANCE_CATEGORIES = ("head", "upper", "lower")
WINDOW_PHASES = ("dawn", "morning", "noon", "afternoon", "dusk", "night")
EXPECTED_DESKS = (
    ("mountain", ("mug", "notebook")),
    ("terminal_code", ("sticky_notes", "pencil_cup")),
    ("data_charts", ("calculator", "report")),
    ("document_editor", ("books", "fountain_pen")),
    ("dna_molecule", ("small_plant", "sample_tubes")),
    ("email_calendar", ("phone", "file_tray")),
    ("starfield", ("headphones", "snack")),
    ("system_monitoring", ("desk_lamp", "toolbox")),
)
EXPECTED_BOSS_HASHES = {
    "boss.png": "2DC47C201AB95A28D8B561FB78CF427519DE1A91552DADA056BE3624B8A848A7",
    "boss_desk.png": "6C2E3E8BC866BBAEC4B198E9FB55E9974DBBE8D244E78B5B1F8D05D57701ACCB",
    "boss_chair.png": "6F286C2D1336FA059F7A745D02B018DEF7703BB0C585D5BFB44F7992704147F8",
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def open_rgba(name: str, expected_size: tuple[int, int]) -> Image.Image:
    image = Image.open(ASSETS / name)
    image.load()
    assert image.mode == "RGBA", (name, image.mode)
    assert image.size == expected_size, (name, image.size, expected_size)
    assert image.getbbox() is not None, name
    return image


def atlas_cell(name: str, row: int, column: int = 0) -> Image.Image:
    image = Image.open(ASSETS / name).convert("RGBA")
    left = column * 104
    top = row * 192
    return image.crop((left, top, left + 104, top + 192))


def atlas_cell_small(name: str, row: int, column: int = 0) -> Image.Image:
    return atlas_cell(name, row, column).resize((26, 48), Image.Resampling.NEAREST)


def alpha_points(image: Image.Image) -> set[tuple[int, int]]:
    alpha = image.getchannel("A")
    return {
        (x, y)
        for y in range(image.height)
        for x in range(image.width)
        if alpha.getpixel((x, y))
    }


def contact_count(first: Image.Image, second: Image.Image) -> int:
    second_points = alpha_points(second)
    return sum(
        any((x + dx, y + dy) in second_points
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)))
        for x, y in alpha_points(first)
    )


def occupied_row_widths(image: Image.Image) -> list[int]:
    points = alpha_points(image)
    return [
        max(xs) - min(xs) + 1
        for y in range(image.height)
        if (xs := [x for x, py in points if py == y])
    ]


def pixels(image: Image.Image):
    flattened = getattr(image, "get_flattened_data", None)
    return flattened() if flattened else image.getdata()


def composed_worker(row: int, head: int = 0, upper: int = 0, lower: int = 0) -> Image.Image:
    result = Image.new("RGBA", (104, 192), (0, 0, 0, 0))
    result.alpha_composite(atlas_cell("worker_part_lower.png", row, lower))
    result.alpha_composite(atlas_cell("worker_part_upper.png", row, upper))
    result.alpha_composite(atlas_cell("worker_part_head.png", row, head))
    return result


def assert_no_horizontal_gap(image: Image.Image, top: int, bottom: int, label: str) -> None:
    alpha = image.getchannel("A")
    occupied = [alpha.crop((0, y, image.width, y + 1)).getbbox() is not None
                for y in range(top, bottom)]
    assert all(occupied), (label, [top + i for i, value in enumerate(occupied) if not value])


def alpha_component_count(image: Image.Image) -> int:
    remaining = set(alpha_points(image))
    components = 0
    while remaining:
        components += 1
        stack = [remaining.pop()]
        while stack:
            x, y = stack.pop()
            for point in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if point in remaining:
                    remaining.remove(point)
                    stack.append(point)
    return components


def main() -> None:
    assert draw_workers.W == 26
    assert draw_workers.CELL_H == 48
    assert len(draw_workers.POSE_ORDER) == 15
    assert tuple(draw_workers.POSE_ORDER) == (
        "stand_front", "stand_side", "stand_back", "walk_front", "walk_front_b",
        "walk_side_a", "walk_side_b", "walk_back", "walk_back_b", "documents",
        "coffee", "briefcase", "sit", "upper_front", "upper_back",
    )
    assert tuple(draw_workers.VARIANT_NAMES) == APPEARANCE_CATEGORIES
    assert all(len(variants) == 9 for variants in draw_workers.VARIANT_NAMES.values())

    for category in APPEARANCE_CATEGORIES:
        image = open_rgba(f"worker_part_{category}.png", (936, 2880))
        columns = [image.crop((i * 104, 0, (i + 1) * 104, 2880)) for i in range(9)]
        assert len({column.tobytes() for column in columns}) == 9, category
    open_rgba("worker_fallback.png", (104, 2880))
    open_rgba("boss_pet.png", (768, 768))
    open_rgba("company_gate.png", (176, 40))

    # The complete fallback is exactly v3 appearance 0/0/0 for every pose.
    for row in range(15):
        assert atlas_cell("worker_fallback.png", row).tobytes() == composed_worker(row).tobytes()

    # Every directional head is a complete preset, and no head/hair/hat cell
    # touches the horizontal atlas boundary that caused the old clipping.
    for row in (0, 1, 2, 5, 6, 7, 8, 13, 14):
        for head in range(9):
            cell = atlas_cell_small("worker_part_head.png", row, head)
            assert cell.getbbox() is not None, (row, head)
            assert not any(x in {0, 25} for x, _ in alpha_points(cell)), (row, head)

    # The high-ponytail preset includes a blue headband from every direction.
    headband_colors = {(55, 104, 191), (113, 158, 226)}
    for row in (0, 1, 2, 5, 6, 7, 8, 13, 14):
        colors = {pixel[:3] for pixel in pixels(atlas_cell_small("worker_part_head.png", row, 3))
                  if pixel[3]}
        assert colors & headband_colors, row

    # Head owns all exposed skin. Upper/lower never bake a skin palette, so
    # face, neck and hands cannot disagree in an arbitrary combination.
    all_skin = {color for palette in worker_parts.SKIN_PALETTES for color in palette}
    for head, (skin_index, _, _) in enumerate(worker_parts.HEAD_SPECS):
        expected = set(worker_parts.SKIN_PALETTES[skin_index])
        for row in range(15):
            colors = {pixel[:3] for pixel in pixels(atlas_cell_small("worker_part_head.png", row, head))
                      if pixel[3] and pixel[:3] in all_skin}
            assert colors and colors <= expected, (head, row, colors, expected)
    for category in ("upper", "lower"):
        image = Image.open(ASSETS / f"worker_part_{category}.png").convert("RGBA")
        assert not ({pixel[:3] for pixel in pixels(image) if pixel[3]} & all_skin), category

    # Rows 13/14 are intentionally desk-cropped upper-body poses. Their lower
    # cells stay empty while the upper module supplies the shared bottom anchor.
    for lower in range(9):
        small_cell = atlas_cell_small("worker_part_lower.png", 13, lower)
        assert small_cell.getbbox() is None
        assert atlas_cell_small("worker_part_lower.png", 14, lower).getbbox() is None
    for upper in range(9):
        assert atlas_cell_small("worker_part_upper.png", 13, upper).getbbox()[3] == 48
        assert atlas_cell_small("worker_part_upper.png", 14, upper).getbbox()[3] == 48

    # A lower module may have two separated legs, but no third floating detail.
    for lower in range(9):
        for row in range(13):
            cell = atlas_cell_small("worker_part_lower.png", row, lower)
            assert 1 <= alpha_component_count(cell) <= 2, (lower, row, alpha_component_count(cell))

    # Exhaustively compose all 729 appearances over all 15 poses. Every result
    # is continuous from its topmost pixel to the shared bottom/feet anchor.
    small = {
        category: [[atlas_cell_small(f"worker_part_{category}.png", row, variant)
                    for row in range(15)] for variant in range(9)]
        for category in APPEARANCE_CATEGORIES
    }
    for head in range(9):
        for upper in range(9):
            for lower in range(9):
                for row in range(15):
                    worker = Image.new("RGBA", (26, 48), (0, 0, 0, 0))
                    worker.alpha_composite(small["lower"][lower][row])
                    worker.alpha_composite(small["upper"][upper][row])
                    worker.alpha_composite(small["head"][head][row])
                    bbox = worker.getbbox()
                    assert bbox is not None and bbox[3] == 48, (head, upper, lower, row, bbox)
                    assert_no_horizontal_gap(worker, bbox[1], bbox[3],
                                             f"{head}/{upper}/{lower} row {row}")

    # Both front and back walking directions have genuine A/B leg frames.
    for lower in range(9):
        assert small["lower"][lower][3].tobytes() != small["lower"][lower][4].tobytes()
        assert small["lower"][lower][7].tobytes() != small["lower"][lower][8].tobytes()

    for phase in WINDOW_PHASES:
        open_rgba(f"window_{phase}.png", (256, 216))
    assert len({digest(ASSETS / f"window_{phase}.png") for phase in WINDOW_PHASES}) == 6

    desk_contract = tuple((item["screen"], item["props"]) for item in draw_furniture.DESK_SPECS)
    assert desk_contract == EXPECTED_DESKS
    for index in range(8):
        open_rgba(f"desk_variant_{index}.png", (448, 280))
    assert len({digest(ASSETS / f"desk_variant_{index}.png") for index in range(8)}) == 8

    open_rgba("pantry_back.png", (752, 888))
    open_rgba("pantry_front.png", (752, 888))
    assert not list(ASSETS.glob("*montage*.png"))

    for name, expected in EXPECTED_BOSS_HASHES.items():
        assert digest(ASSETS / name) == expected, name

    print("assets-03: ok (3x9 modules, 729 combinations, 15 poses, pet boss and company gate)")


if __name__ == "__main__":
    main()
