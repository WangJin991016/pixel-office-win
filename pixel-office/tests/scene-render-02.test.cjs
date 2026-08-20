"use strict";

const assert = require("node:assert/strict");
const {
  DESK_VARIANTS,
  LAYOUT,
  SPRITE_MANIFEST,
  WORKER_APPEARANCE_CATEGORIES,
  WORKER_ATLAS_LAYER_ORDER,
  WORKER_POSE_MAPPING,
  WORKER_POSE_ROWS,
  SPRITES,
  WINDOW_PHASES,
  overflowCoordinate,
  ACTIVE_OVERFLOW_SPOTS,
  activeOverflowCoordinate,
} = require("../public/js/sprites.js");
const {
  classifyWindowScene,
  getWindowSceneBlend,
} = require("../public/js/scene.js");

const localDate = (hour, minute = 0) => new Date(2026, 0, 1, hour, minute);
const atOffset = (hour, minute) => {
  const date = localDate(hour, minute);
  date.setMinutes(date.getMinutes() - 10);
  return date;
};

assert.deepEqual(WINDOW_PHASES, [
  "dawn", "morning", "noon", "afternoon", "dusk", "night",
]);
assert.deepEqual(Object.keys(WORKER_POSE_ROWS), [
  "stand_front", "stand_side", "stand_back",
  "walk_front", "walk_front_b", "walk_side_a", "walk_side_b",
  "walk_back", "walk_back_b",
  "documents", "coffee", "briefcase", "sit", "upper_front", "upper_back",
]);
assert.deepEqual(WORKER_APPEARANCE_CATEGORIES, [
  "head", "upper", "lower",
]);
assert.deepEqual(WORKER_ATLAS_LAYER_ORDER, [
  "worker_part_lower", "worker_part_upper", "worker_part_head",
]);
assert.deepEqual(Object.fromEntries(
  ["stand_side", "walk_side_a", "walk_side_b", "upper_front"]
    .map((pose) => [pose, WORKER_POSE_MAPPING[pose]]),
), {
  stand_side: { row: 1, legacy: "stand_side" },
  walk_side_a: { row: 5, legacy: "walk_side_a" },
  walk_side_b: { row: 6, legacy: "walk_side_b" },
  upper_front: { row: 13, legacy: "upper_front" },
});
assert.equal(DESK_VARIANTS.length, 8);
assert.deepEqual(DESK_VARIANTS, Array.from(
  { length: 8 }, (_, index) => "desk_variant_" + index,
));

for (const [index, [name, hour, minute]] of [
  ["dawn", 5, 0],
  ["morning", 7, 0],
  ["noon", 11, 0],
  ["afternoon", 14, 0],
  ["dusk", 17, 0],
  ["night", 19, 0],
].entries()) {
  assert.equal(classifyWindowScene(localDate(hour, minute)), name);
  const before = getWindowSceneBlend(atOffset(hour, minute), false);
  assert.equal(before.phase, index === 0 ? "night" : WINDOW_PHASES[index - 1]);
  assert.equal(before.blend, 0);
  assert.equal(getWindowSceneBlend(localDate(hour, minute), false).phase, name);
}

for (const [hour, minute] of [[7, 0], [11, 0], [14, 0], [17, 0], [19, 0]]) {
  const date = localDate(hour, minute);
  date.setMinutes(date.getMinutes() - 5);
  assert.equal(getWindowSceneBlend(date, false).blend, 0.5);
}
assert.equal(getWindowSceneBlend(localDate(6, 55), false).blend, 0.5);
const nightFade = localDate(4, 55);
assert.equal(getWindowSceneBlend(nightFade, false).phase, "night");
assert.equal(getWindowSceneBlend(nightFade, false).nextPhase, "dawn");
assert.equal(getWindowSceneBlend(nightFade, false).blend, 0.5);
assert.equal(getWindowSceneBlend(nightFade, true).blend, 0);
assert.equal(getWindowSceneBlend(nightFade, true).reducedMotion, true);

assert.equal(LAYOUT.W, 1280);
assert.equal(LAYOUT.H, 720);
assert.equal(LAYOUT.desks.length, 8);
assert.deepEqual(LAYOUT.desks.map(({ x, y }) => [x, y]), [
  [140, 490], [375, 490], [845, 490], [1080, 490],
  [140, 645], [375, 645], [845, 645], [1080, 645],
]);
assert.deepEqual(LAYOUT.desks.map(({ sprite }) => sprite), DESK_VARIANTS);
assert.equal(LAYOUT.loungeSpots.length, 6);
assert.equal(LAYOUT.pantryWaitSpots.length, 6);
assert.equal(LAYOUT.loungeSpots.filter(spot => spot.zone === "upper_left").length, 3);
assert.equal(LAYOUT.loungeSpots.filter(spot => spot.zone === "lower_right").length, 3);
for (const spot of LAYOUT.loungeSpots.filter(spot => spot.zone === "upper_left")) {
  assert.ok(spot.x < 260 && spot.y >= 280 && spot.y <= 440);
}
for (const spot of LAYOUT.loungeSpots.filter(spot => spot.zone === "lower_right")) {
  assert.ok(spot.x >= 880 && spot.y >= 680);
}
assert.ok(LAYOUT.pantryRect && LAYOUT.pantryEntrance && LAYOUT.pantryFront);
assert.deepEqual(LAYOUT.pantryRect, { x: 1090, y: 158, w: 188, h: 222 });
assert.deepEqual(LAYOUT.pantryEntrance, { x: 1140, y: 380, w: 48, h: 0 });
for (const spot of LAYOUT.pantryWaitSpots) {
  assert.ok(spot.x >= 1090 && spot.x <= 1278);
  assert.ok(spot.y >= 158 && spot.y <= 380);
}
assert.deepEqual(overflowCoordinate(4), overflowCoordinate(4));
assert.notDeepEqual(overflowCoordinate(4), overflowCoordinate(5));
assert.strictEqual(LAYOUT.waitOverflowSpots, LAYOUT.overflowSpots);
for (const spot of LAYOUT.overflowSpots) {
  assert.ok(["upper_left", "lower_right"].includes(spot.zone));
  if (spot.zone === "upper_left") assert.ok(spot.x < 260);
  if (spot.zone === "lower_right") assert.ok(spot.x >= 880);
}
assert.equal(new Set(LAYOUT.overflowSpots.map(spot => `${spot.x}:${spot.y}`)).size, 12);
assert.equal(LAYOUT.overflowSpots.filter(spot => spot.zone === "upper_left").length, 6);
assert.equal(LAYOUT.overflowSpots.filter(spot => spot.zone === "lower_right").length, 6);
assert.strictEqual(LAYOUT.activeOverflowSpots, ACTIVE_OVERFLOW_SPOTS);
assert.equal(ACTIVE_OVERFLOW_SPOTS.length, 16);
for (let first = 0; first < ACTIVE_OVERFLOW_SPOTS.length; first++) {
  for (let second = first + 1; second < ACTIVE_OVERFLOW_SPOTS.length; second++) {
    const a = ACTIVE_OVERFLOW_SPOTS[first];
    const b = ACTIVE_OVERFLOW_SPOTS[second];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 30);
  }
}
const activeOverflowProbe = Array.from({ length: 40 }, (_, index) =>
  activeOverflowCoordinate(index));
assert.equal(new Set(activeOverflowProbe.map(spot => `${spot.x}:${spot.y}`)).size, 40);
assert.ok(activeOverflowProbe.every(spot =>
  spot.x >= 0 && spot.x <= LAYOUT.W && spot.y >= 0 && spot.y <= LAYOUT.H));

for (const phase of WINDOW_PHASES) {
  assert.ok(SPRITE_MANIFEST["window_" + phase]);
  assert.equal(SPRITE_MANIFEST["window_" + phase][2], 256);
  assert.equal(SPRITE_MANIFEST["window_" + phase][3], 216);
}
assert.equal(SPRITE_MANIFEST.worker_fallback[2], 104);
assert.equal(SPRITE_MANIFEST.worker_fallback[3], 192);
for (const pantrySprite of ["pantry_back", "pantry_front"]) {
  assert.equal(SPRITE_MANIFEST[pantrySprite][1], 188);
  assert.equal(
    Math.round(SPRITE_MANIFEST[pantrySprite][3]
      * SPRITE_MANIFEST[pantrySprite][1] / SPRITE_MANIFEST[pantrySprite][2]),
    222,
  );
}
for (const category of WORKER_APPEARANCE_CATEGORIES) {
  assert.ok(SPRITE_MANIFEST["worker_part_" + category]);
}
for (const desk of DESK_VARIANTS) assert.ok(SPRITE_MANIFEST[desk]);
assert.equal(typeof SPRITES.drawWorker, "function");

console.log("scene-render-02: ok");
