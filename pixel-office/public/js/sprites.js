/* sprite loader + shared layout constants */
"use strict";

const SPRITES = (() => {
  // name -> [file, display width (px, logical)] — height follows aspect ratio
  const MANIFEST = {
    stand_front:   ["worker_stand_front.png", 54],
    stand_side:    ["worker_stand_side.png", 54],
    stand_back:    ["worker_stand_back.png", 54],
    walk_front:    ["worker_walk_front.png", 56],
    walk_side_a:   ["worker_walk_side_a.png", 56],
    walk_side_b:   ["worker_walk_side_b.png", 56],
    walk_back:     ["worker_walk_back.png", 55],
    documents:     ["worker_documents.png", 56],
    coffee:        ["worker_coffee.png", 60],
    briefcase:     ["worker_briefcase.png", 56],
    sit_naked:     ["worker_sit.png", 58],
    upper_front:   ["worker_upper_front.png", 58],
    upper_back:    ["worker_upper_back.png", 58],
    chair:         ["chair_office.png", 36],
    boss:          ["boss.png", 68],
    boss_chair:    ["boss_chair.png", 96],
    boss_desk:     ["boss_desk.png", 340],
    desk:          ["desk.png", 165],
    window:        ["window.png", 170],
    bookshelf:     ["bookshelf.png", 116],
    certificate:   ["certificate.png", 66],
    chart:         ["chart.png", 100],
    rug:           ["rug.png", 430],
    floor_tile:    ["floor_tile.png", 96],
    wall_tile:     ["wall_tile.png", 96],
    plant1:        ["prop_plant1.png", 58],
    plant2:        ["prop_plant2.png", 56],
    ac:            ["prop_ac.png", 122],
    copier:        ["prop_copier.png", 104],
    chaise:        ["prop_chaise.png", 150],
    trash:         ["trash.png", 34],
    clock:         ["prop_clock.png", 40],
    water:         ["prop_water.png", 46],
  };
  const images = {};
  let loaded = 0, total = Object.keys(MANIFEST).length;

  function load(onProgress) {
    const jobs = Object.entries(MANIFEST).map(([name, [file, dw]]) =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          images[name] = { img, w: dw, h: Math.round(img.height * dw / img.width) };
          loaded++; onProgress && onProgress(loaded, total);
          resolve();
        };
        img.onerror = () => { console.warn("missing sprite", file); loaded++; resolve(); };
        img.src = "/assets/" + file + "?v=2";
      }));
    return Promise.all(jobs);
  }

  function get(name) { return images[name]; }

  /** draw anchored at bottom-center (feet/base) */
  function draw(ctx, name, x, yBottom, opts = {}) {
    const s = images[name];
    if (!s) return;
    ctx.save();
    if (opts.flip) {
      ctx.translate(x, yBottom);
      ctx.scale(-1, 1);
      x = 0; yBottom = 0;
    }
    if (opts.rotate) {
      ctx.translate(x, yBottom - s.h / 2);
      ctx.rotate(opts.rotate);
      ctx.translate(-x, -(yBottom - s.h / 2));
    }
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    const dy = opts.dy || 0, dx = opts.dx || 0;
    ctx.drawImage(s.img, x - s.w / 2 + dx, yBottom - s.h + dy, s.w, s.h);
    ctx.restore();
  }

  return { load, get, draw };
})();

/* office layout (logical 1280x720) */
const LAYOUT = {
  W: 1280, H: 720,
  wallBottom: 150,
  boss: { x: 640, deskBottom: 352, chairBottom: 305, bossBottom: 256,
          headX: 640, headY: 180, frontY: 396 },
  queueSlots: [
    { x: 640, y: 396 }, { x: 640, y: 438 }, { x: 654, y: 480 },
    { x: 626, y: 522 }, { x: 654, y: 562 }, { x: 626, y: 602 },
    { x: 654, y: 640 }, { x: 626, y: 672 },
  ],
  door: { x: 640, y: 706 },
  aisleX: 640,
  chaise: { x: 1160, y: 712 },
  // rest corner: chaise, floor cushions, then coffee spots by the water cooler
  restSpots: [
    { x: 1160, y: 700, kind: "chaise" },
    { x: 1052, y: 706, kind: "cushion" },
    { x: 986,  y: 710, kind: "cushion" },
    { x: 100,  y: 340, kind: "coffee" },
    { x: 152,  y: 346, kind: "coffee" },
    { x: 916,  y: 712, kind: "cushion" },
    { x: 86,   y: 392, kind: "coffee" },
    { x: 130,  y: 370, kind: "coffee" },
  ],
  cushions: [ {x: 1052, y: 710}, {x: 986, y: 714}, {x: 916, y: 716} ],
  trashBins: [ {x: 838, y: 372}, {x: 520, y: 495}, {x: 760, y: 495} ],
  desks: [
    { x: 140,  y: 490 }, { x: 375,  y: 490 }, { x: 845,  y: 490 }, { x: 1080, y: 490 },
    { x: 140,  y: 645 }, { x: 375,  y: 645 }, { x: 845,  y: 645 }, { x: 1080, y: 645 },
  ],
};
