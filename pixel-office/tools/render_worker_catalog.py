#!/usr/bin/env python3
"""Render deterministic QA contact sheets for the V3 worker-part atlases."""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

from worker_parts import CELL_H, POSE_ORDER, SCALE, W


CELL = (W * SCALE, CELL_H * SCALE)
BACKGROUND = (247, 240, 220, 255)
GRID = (194, 164, 119, 255)
TEXT = (67, 49, 36, 255)


def load_atlases(asset_dir):
    atlases = {
        part: Image.open(asset_dir / f"worker_part_{part}.png").convert("RGBA")
        for part in ("lower", "upper", "head")
    }
    expected = (CELL[0] * 9, CELL[1] * len(POSE_ORDER))
    for part, image in atlases.items():
        if image.size != expected:
            raise ValueError(f"{part} atlas is {image.size}, expected {expected}")
    return atlases


def compose(atlases, pose, head, upper, lower):
    row = POSE_ORDER.index(pose)
    image = Image.new("RGBA", CELL)
    for part, index in (("lower", lower), ("upper", upper), ("head", head)):
        box = (
            index * CELL[0], row * CELL[1],
            (index + 1) * CELL[0], (row + 1) * CELL[1],
        )
        image.alpha_composite(atlases[part].crop(box))
    return image


def render_pose_catalog(atlases, destination):
    thumb = (W * 2, CELL_H * 2)
    label_w, header_h, gap = 104, 22, 4
    width = label_w + 9 * (thumb[0] + gap) + gap
    height = header_h + len(POSE_ORDER) * (thumb[1] + gap) + gap
    sheet = Image.new("RGBA", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for index in range(9):
        draw.text((label_w + index * (thumb[0] + gap) + 20, 6), str(index), fill=TEXT)
    for row, pose in enumerate(POSE_ORDER):
        y = header_h + row * (thumb[1] + gap)
        draw.text((4, y + 40), pose, fill=TEXT)
        for index in range(9):
            worker = compose(atlases, pose, index, index, index)
            worker = worker.resize(thumb, Image.Resampling.NEAREST)
            x = label_w + index * (thumb[0] + gap)
            sheet.alpha_composite(worker, (x, y))
            draw.rectangle((x, y, x + thumb[0] - 1, y + thumb[1] - 1), outline=GRID)
    sheet.save(destination)


def render_all_combinations(atlases, destination):
    # A 27×27 matrix: each 3×3 block holds the nine upper outfits for one
    # head/lower pair.  This includes every one of the 729 front-facing calls.
    width, height = 27 * W, 27 * CELL_H
    sheet = Image.new("RGBA", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    for head in range(9):
        for upper in range(9):
            for lower in range(9):
                x = (lower * 3 + upper % 3) * W
                y = (head * 3 + upper // 3) * CELL_H
                worker = compose(atlases, "stand_front", head, upper, lower)
                worker = worker.resize((W, CELL_H), Image.Resampling.NEAREST)
                sheet.alpha_composite(worker, (x, y))
    for block in range(1, 9):
        draw.line((block * 3 * W, 0, block * 3 * W, height), fill=GRID)
        draw.line((0, block * 3 * CELL_H, width, block * 3 * CELL_H), fill=GRID)
    sheet.save(destination)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    parser.add_argument(
        "--asset-dir", type=Path,
        default=Path(__file__).resolve().parents[1] / "public" / "assets",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    atlases = load_atlases(args.asset_dir)
    pose_path = args.output_dir / "pixel-office-v3-pose-catalog.png"
    all_path = args.output_dir / "pixel-office-v3-729-stand-front.png"
    render_pose_catalog(atlases, pose_path)
    render_all_combinations(atlases, all_path)
    print(pose_path)
    print(all_path)


if __name__ == "__main__":
    main()
