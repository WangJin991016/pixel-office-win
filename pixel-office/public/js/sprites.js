/* sprite loader + shared layout constants */
"use strict";

const WORKER_APPEARANCE_CATEGORIES = Object.freeze([
  "head", "upper", "lower",
]);
const WORKER_POSE_ROWS = Object.freeze({
  stand_front: 0, stand_side: 1, stand_back: 2,
  walk_front: 3, walk_front_b: 4, walk_side_a: 5, walk_side_b: 6,
  walk_back: 7, walk_back_b: 8, documents: 9, coffee: 10,
  briefcase: 11, sit: 12, upper_front: 13, upper_back: 14,
});
const WORKER_POSE_LEGACY = Object.freeze({
  stand_front: "stand_front", stand_side: "stand_side", stand_back: "stand_back",
  walk_front: "walk_front", walk_front_b: "walk_front", walk_side_a: "walk_side_a",
  walk_side_b: "walk_side_b", walk_back: "walk_back", walk_back_b: "walk_back",
  documents: "documents", coffee: "coffee",
  briefcase: "briefcase", sit: "sit_naked", upper_front: "upper_front",
  upper_back: "upper_back",
});
const WORKER_POSES = Object.freeze(Object.keys(WORKER_POSE_ROWS));
const WORKER_POSE_MAPPING = Object.freeze(Object.fromEntries(
  WORKER_POSES.map((pose) => [pose, Object.freeze({
    row: WORKER_POSE_ROWS[pose], legacy: WORKER_POSE_LEGACY[pose],
  })]),
));
const WORKER_POSE_MAP = WORKER_POSE_ROWS;
const WORKER_POSE_TO_ROW = WORKER_POSE_ROWS;
const POSE_ROWS = WORKER_POSE_ROWS;
const POSE_MAPPING = WORKER_POSE_MAPPING;
const WINDOW_PHASES = Object.freeze([
  "dawn", "morning", "noon", "afternoon", "dusk", "night",
]);
const DESK_VARIANTS = Object.freeze(
  Array.from({ length: 8 }, (_, index) => "desk_variant_" + index),
);
const WORKER_ATLAS_CELL = Object.freeze({ w: 104, h: 192 });
const WORKER_ATLAS_LAYER_ORDER = Object.freeze([
  "worker_part_lower",
  "worker_part_upper",
  "worker_part_head",
]);
const WORKER_POSE_DISPLAY_WIDTHS = Object.freeze({
  stand_front: 54, stand_side: 54, stand_back: 54,
  walk_front: 56, walk_front_b: 56, walk_side_a: 56, walk_side_b: 56,
  walk_back: 55, walk_back_b: 55,
  documents: 56, coffee: 60, briefcase: 56, sit: 58,
  upper_front: 58, upper_back: 58,
});

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
    boss_pet:      ["boss_pet.png", 96, 768, 768],
    boss:          ["boss.png", 68],
    boss_chair:    ["boss_chair.png", 96],
    boss_desk:     ["boss_desk.png", 340],
    company_gate:  ["company_gate.png", 176, 176, 40],
    desk:          ["desk.png", 165],
    ...Object.fromEntries(DESK_VARIANTS.map((name) => [
      name, [name + ".png", 165, 448, 280],
    ])),
    window:        ["window.png", 170],
    ...Object.fromEntries(WINDOW_PHASES.map((phase) => [
      "window_" + phase, ["window_" + phase + ".png", 170, 256, 216],
    ])),
    pantry_back:   ["pantry_back.png", 188, 752, 888],
    pantry_front:  ["pantry_front.png", 188, 752, 888],
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
    ...Object.fromEntries(WORKER_APPEARANCE_CATEGORIES.map((category) => [
      "worker_part_" + category,
      ["worker_part_" + category + ".png", 54,
        WORKER_ATLAS_CELL.w, WORKER_ATLAS_CELL.h],
    ])),
    worker_fallback: [
      "worker_fallback.png", 54, WORKER_ATLAS_CELL.w, WORKER_ATLAS_CELL.h,
    ],
  };
  const SPRITE_MANIFEST = MANIFEST;
  const images = {};
  let loaded = 0, total = Object.keys(MANIFEST).length;

  function manifestEntry(entry) {
    const [file, displayWidth, sourceWidth, sourceHeight] = entry;
    return { file, displayWidth, sourceWidth, sourceHeight };
  }

  function load(onProgress) {
    const jobs = Object.entries(MANIFEST).map(([name, entry]) =>
      new Promise((resolve) => {
        const spec = manifestEntry(entry);
        const img = new Image();
        img.onload = () => {
          const sourceWidth = spec.sourceWidth || img.naturalWidth || img.width;
          const sourceHeight = spec.sourceHeight || img.naturalHeight || img.height;
          images[name] = {
            img,
            w: spec.displayWidth,
            h: sourceWidth && sourceHeight
              ? Math.round(sourceHeight * spec.displayWidth / sourceWidth)
              : 0,
            sourceW: sourceWidth,
            sourceH: sourceHeight,
            cellW: spec.sourceWidth,
            cellH: spec.sourceHeight,
          };
          loaded++;
          onProgress && onProgress(loaded, total);
          resolve();
        };
        img.onerror = () => {
          console.warn("missing sprite", spec.file);
          loaded++;
          onProgress && onProgress(loaded, total);
          resolve();
        };
        img.src = "/assets/" + spec.file + "?v=5";
      }));
    return Promise.all(jobs);
  }

  function get(name) {
    const isWorkerPose = name === "sit_naked"
      || Object.prototype.hasOwnProperty.call(WORKER_POSE_ROWS, name);
    return images[name]
      || (isWorkerPose ? images.worker_fallback : null)
      || images[WORKER_POSE_LEGACY[name]];
  }

  /** draw anchored at bottom-center (feet/base) */
  function draw(ctx, name, x, yBottom, opts = {}) {
    const s = images[name];
    if (!s) return false;
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
    return true;
  }

  function normalizePose(pose) {
    if (pose === "sit_naked") return "sit";
    return WORKER_POSE_ROWS[pose] == null ? "stand_front" : pose;
  }

  function appearanceColumn(appearance, category) {
    const categoryIndex = WORKER_APPEARANCE_CATEGORIES.indexOf(category);
    let value = Array.isArray(appearance)
      ? appearance[categoryIndex] : appearance?.[category];
    if (value == null) value = 0;
    if (typeof value === "string") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) value = numeric;
      else {
        const suffix = value.match(/(?:^|[_-])(\d+)$/);
        value = suffix ? Number(suffix[1]) : 0;
      }
    }
    if (!Number.isFinite(value)) value = 0;
    return Math.max(0, Math.min(8, Math.trunc(value)));
  }

  function hasWorkerAtlas() {
    return WORKER_ATLAS_LAYER_ORDER.every((name) => Boolean(images[name]));
  }

  /**
   * Draw the complete worker stack from one atlas cell. All layers share one
   * save/restore pair and one anchor transform, avoiding seams during flips
   * and rotations.
   */
  function drawWorker(ctx, pose, appearance, x, yBottom, opts = {}) {
    const canonicalPose = normalizePose(pose);
    const useParts = hasWorkerAtlas();
    const layers = useParts
      ? WORKER_ATLAS_LAYER_ORDER.map(name => ({ name, column: appearanceColumn(
        appearance, name.slice("worker_part_".length),
      ) }))
      : images.worker_fallback ? [{ name: "worker_fallback", column: 0 }] : [];
    if (!layers.length) return false;

    const width = opts.width || opts.w || WORKER_POSE_DISPLAY_WIDTHS[canonicalPose];
    const height = opts.height || opts.h || Math.round(
      width * WORKER_ATLAS_CELL.h / WORKER_ATLAS_CELL.w,
    );
    const dx = opts.dx || 0;
    const dy = opts.dy || 0;

    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.translate(x + dx, yBottom + dy);
    if (opts.flip) ctx.scale(-1, 1);
    if (opts.rotate) ctx.rotate(opts.rotate);

    for (const entry of layers) {
      const layer = images[entry.name];
      if (!layer) continue;
      const cellW = layer.cellW || WORKER_ATLAS_CELL.w;
      const cellH = layer.cellH || WORKER_ATLAS_CELL.h;
      ctx.drawImage(
        layer.img,
        entry.column * cellW,
        WORKER_POSE_ROWS[canonicalPose] * cellH,
        cellW,
        cellH,
        -width / 2,
        -height,
        width,
        height,
      );
    }
    ctx.restore();
    return true;
  }

  return {
    load, get, draw, drawWorker, hasWorkerAtlas,
    manifest: SPRITE_MANIFEST, MANIFEST: SPRITE_MANIFEST,
    atlasLayerOrder: WORKER_ATLAS_LAYER_ORDER,
  };
})();

const DESK_LOCATIONS = Object.freeze([
  { x: 140, y: 490 }, { x: 375, y: 490 }, { x: 845, y: 490 }, { x: 1080, y: 490 },
  { x: 140, y: 645 }, { x: 375, y: 645 }, { x: 845, y: 645 }, { x: 1080, y: 645 },
]);
const PANTRY_RECT = Object.freeze({
  x: 1090, y: 158, w: 188, h: 222,
});
const PANTRY_ENTRANCE = Object.freeze({ x: 1140, y: 380, w: 48, h: 0 });
const PANTRY_ENTRANCE_RANGE = Object.freeze({ x1: 1140, x2: 1188, y: 380 });
const PANTRY_BACK = Object.freeze({ x: 1184, y: 380 });
const PANTRY_FRONT = Object.freeze({ x: 1184, y: 380 });
const LOUNGE_SPOTS = Object.freeze([
  { x: 70, y: 338, kind: "coffee", zone: "upper_left" },
  { x: 1160, y: 700, kind: "chaise", zone: "lower_right" },
  { x: 190, y: 350, kind: "coffee", zone: "upper_left" },
  { x: 1052, y: 706, kind: "cushion", zone: "lower_right" },
  { x: 130, y: 370, kind: "coffee", zone: "upper_left" },
  { x: 916, y: 710, kind: "cushion", zone: "lower_right" },
]);
const PANTRY_WAIT_SPOTS = Object.freeze([
  { x: 1122, y: 378, kind: "pantry_wait" },
  { x: 1182, y: 378, kind: "pantry_wait" },
  { x: 1242, y: 378, kind: "pantry_wait" },
  { x: 1122, y: 270, kind: "pantry_wait" },
  { x: 1182, y: 270, kind: "pantry_wait" },
  { x: 1242, y: 270, kind: "pantry_wait" },
]);
const OVERFLOW_ORIGIN = Object.freeze({ x: 52, y: 430 });
const OVERFLOW_STEP = Object.freeze({ x: 44, y: 28 });
const OVERFLOW_PATTERN = Object.freeze([
  { x: 40, y: 300, kind: "stand", zone: "upper_left" },
  { x: 1225, y: 700, kind: "stand", zone: "lower_right" },
  { x: 130, y: 300, kind: "stand", zone: "upper_left" },
  { x: 1106, y: 710, kind: "stand", zone: "lower_right" },
  { x: 220, y: 300, kind: "stand", zone: "upper_left" },
  { x: 982, y: 710, kind: "stand", zone: "lower_right" },
  { x: 28, y: 410, kind: "stand", zone: "upper_left" },
  { x: 1250, y: 590, kind: "stand", zone: "lower_right" },
  { x: 255, y: 410, kind: "stand", zone: "upper_left" },
  { x: 962, y: 650, kind: "stand", zone: "lower_right" },
  { x: 28, y: 520, kind: "stand", zone: "upper_left" },
  { x: 1250, y: 470, kind: "stand", zone: "lower_right" },
]);
function overflowCoordinate(index) {
  const n = Number.isFinite(Number(index)) ? Math.max(0, Math.trunc(Number(index))) : 0;
  return { ...OVERFLOW_PATTERN[n % OVERFLOW_PATTERN.length] };
}
const OVERFLOW_SPOTS = Object.freeze(
  OVERFLOW_PATTERN.map(spot => Object.freeze({ ...spot })),
);
const ACTIVE_OVERFLOW_PER_ROW = 16;
function activeOverflowCoordinate(index) {
  const n = Number.isFinite(Number(index)) ? Math.max(0, Math.trunc(Number(index))) : 0;
  const row = Math.floor(n / ACTIVE_OVERFLOW_PER_ROW);
  const slot = n % ACTIVE_OVERFLOW_PER_ROW;
  const side = slot % 2 === 0 ? -1 : 1;
  const column = Math.floor(slot / 2);
  return {
    x: 640 + side * (46 + column * 30),
    y: 706 - row * 34,
    kind: "briefcase",
    zone: "entrance",
  };
}
const ACTIVE_OVERFLOW_SPOTS = Object.freeze(
  Array.from({ length: ACTIVE_OVERFLOW_PER_ROW }, (_, index) =>
    Object.freeze(activeOverflowCoordinate(index))),
);

/* office layout (logical 1280x720) */
const LAYOUT = {
  W: 1280, H: 720,
  wallBottom: 150,
  window: { x: 250, y: 138 },
  boss: { x: 640, deskBottom: 352, chairBottom: 305, bossBottom: 256,
          headX: 640, headY: 180, frontY: 396 },
  queueSlots: [
    { x: 640, y: 396 }, { x: 640, y: 438 }, { x: 654, y: 480 },
    { x: 626, y: 522 }, { x: 654, y: 562 }, { x: 626, y: 602 },
    { x: 654, y: 640 }, { x: 626, y: 672 },
  ],
  deliveryLaneSpacing: 90,
  door: { x: 640, y: 706 },
  aisleX: 640,
  chaise: { x: 1160, y: 712 },
  pantry: PANTRY_RECT,
  pantryRect: PANTRY_RECT,
  pantryEntrance: PANTRY_ENTRANCE,
  pantryEntranceRange: PANTRY_ENTRANCE_RANGE,
  pantryBack: PANTRY_BACK,
  pantryFront: PANTRY_FRONT,
  loungeSpots: LOUNGE_SPOTS,
  loungeWaitSpots: LOUNGE_SPOTS,
  pantryWaitSpots: PANTRY_WAIT_SPOTS,
  teaWaitSpots: PANTRY_WAIT_SPOTS,
  waitSpots: Object.freeze([...LOUNGE_SPOTS, ...PANTRY_WAIT_SPOTS]),
  overflow: {
    origin: OVERFLOW_ORIGIN, step: OVERFLOW_STEP,
    spots: OVERFLOW_SPOTS, coordinate: overflowCoordinate,
  },
  overflowSpots: OVERFLOW_SPOTS,
  waitOverflowSpots: OVERFLOW_SPOTS,
  activeOverflow: {
    spots: ACTIVE_OVERFLOW_SPOTS, coordinate: activeOverflowCoordinate,
  },
  activeOverflowSpots: ACTIVE_OVERFLOW_SPOTS,
  overflowCoordinate,
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
  desks: DESK_LOCATIONS.map((location, index) => ({
    ...location, index, variant: index, sprite: DESK_VARIANTS[index],
  })),
};

const exported = {
  SPRITES,
  MANIFEST: SPRITES.manifest,
  SPRITE_MANIFEST: SPRITES.manifest,
  WORKER_APPEARANCE_CATEGORIES,
  WORKER_ATLAS_CELL,
  WORKER_ATLAS_LAYER_ORDER,
  WORKER_POSE_LEGACY,
  WORKER_POSE_MAPPING,
  WORKER_POSE_MAP,
  WORKER_POSE_TO_ROW,
  WORKER_POSE_ROWS,
  WORKER_POSE_DISPLAY_WIDTHS,
  WORKER_POSES,
  POSE_MAPPING,
  POSE_ROWS,
  WINDOW_PHASES,
  DESK_VARIANTS,
  LAYOUT,
  PANTRY_RECT,
  PANTRY_ENTRANCE,
  PANTRY_ENTRANCE_RANGE,
  PANTRY_FRONT,
  LOUNGE_SPOTS,
  PANTRY_WAIT_SPOTS,
  OVERFLOW_SPOTS,
  overflowCoordinate,
  ACTIVE_OVERFLOW_SPOTS,
  activeOverflowCoordinate,
};

if (typeof globalThis !== "undefined") Object.assign(globalThis, exported);
if (typeof module !== "undefined" && module.exports) module.exports = exported;
