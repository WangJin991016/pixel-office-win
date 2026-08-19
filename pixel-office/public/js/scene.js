/* static background: floor, wall, wall decor, rug, edge props.
   Everything floor-standing is bottom-anchored ON the floor; wall decor sits
   fully inside the wall band — nothing gets clipped by the wall/floor seam. */
"use strict";

class Scene {
  constructor() {
    this.layer = document.createElement("canvas");
    this.layer.width = LAYOUT.W;
    this.layer.height = LAYOUT.H;
    this.built = false;
  }

  build() {
    const ctx = this.layer.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const { W, H, wallBottom } = LAYOUT;

    // floor: 96px wood tiles with slight tone variation
    const ft = SPRITES.get("floor_tile");
    if (ft) {
      for (let y = wallBottom, row = 0; y < H; y += ft.h, row++) {
        for (let x = 0, col = 0; x < W; x += ft.w, col++) {
          ctx.save();
          if ((row + col) % 3 === 1) ctx.globalAlpha = 0.94;
          else if ((row + col) % 3 === 2) ctx.globalAlpha = 0.97;
          ctx.drawImage(ft.img, x, y, ft.w, ft.h);
          ctx.restore();
        }
      }
    } else {
      ctx.fillStyle = "#c88a4e";
      ctx.fillRect(0, wallBottom, W, H);
    }

    // wall
    const wt = SPRITES.get("wall_tile");
    if (wt) {
      for (let x = 0; x < W; x += wt.w) {
        ctx.drawImage(wt.img, x, 0, wt.w, wallBottom - 12);
      }
    } else {
      ctx.fillStyle = "#e8d3a8";
      ctx.fillRect(0, 0, W, wallBottom - 12);
    }
    // baseboard
    ctx.fillStyle = "#6d4526";
    ctx.fillRect(0, wallBottom - 12, W, 12);
    ctx.fillStyle = "#8a5a33";
    ctx.fillRect(0, wallBottom - 12, W, 3);

    // wall decor — all fully inside the wall band
    SPRITES.draw(ctx, "window", 250, 138);       // bottom y=138 < 150
    SPRITES.draw(ctx, "certificate", 66, 128);
    SPRITES.draw(ctx, "chart", 452, 122);
    SPRITES.draw(ctx, "clock", 560, 92);
    SPRITES.draw(ctx, "ac", 996, 70);

    // floor-standing furniture, bottom-anchored
    SPRITES.draw(ctx, "bookshelf", 1162, 396);   // right wall, stands on floor
    SPRITES.draw(ctx, "plant2", 1046, 318);
    SPRITES.draw(ctx, "plant1", 66, 214);
    SPRITES.draw(ctx, "copier", 74, 600);
    SPRITES.draw(ctx, "water", 70, 376);
    SPRITES.draw(ctx, "plant1", 1006, 706);

    // rug under the boss zone
    SPRITES.draw(ctx, "rug", LAYOUT.boss.x, LAYOUT.boss.deskBottom + 30);

    this.built = true;
  }

  draw(ctx) {
    if (!this.built) this.build();
    ctx.drawImage(this.layer, 0, 0);
  }
}
