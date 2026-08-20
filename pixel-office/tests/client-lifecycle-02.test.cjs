"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ACTORS = path.join(__dirname, "..", "public", "js", "actors.js");
const MAIN = path.join(__dirname, "..", "public", "js", "main.js");
const SPRITES_FILE = path.join(__dirname, "..", "public", "js", "sprites.js");
const APPEARANCE_KEYS = [
  "head", "upper", "lower",
];

function makeContext(layoutOverride = null) {
  const workerCalls = [];
  const drawCalls = [];
  const ctx = new Proxy({
    measureText: () => ({ width: 48 }),
  }, {
    get(target, key) {
      if (key in target) return target[key];
      return () => {};
    },
  });
  const defaultDesks = Array.from({ length: 8 }, (_, i) => ({ x: 100 + i * 120, y: 500 }));
  const layout = layoutOverride || {
    W: 1280, H: 720, aisleX: 640,
    door: { x: 640, y: 706 },
    queueSlots: [{ x: 640, y: 396 }, { x: 640, y: 438 }],
    desks: defaultDesks,
    boss: { x: 640, deskBottom: 352, chairBottom: 305, bossBottom: 256,
      headX: 640, headY: 180 },
    chaise: { x: 1160, y: 712 },
    cushions: [{ x: 1052, y: 710 }],
    trashBins: [{ x: 838, y: 372 }],
    restSpots: [{ x: 100, y: 340, kind: "coffee" }],
    loungeWaitSpots: [
      { x: 100, y: 340, kind: "coffee", zone: "upper_left" },
      { x: 1050, y: 700, kind: "cushion", zone: "lower_right" },
    ],
    pantryWaitSpots: [
      { x: 1112, y: 360, kind: "pantry_wait" },
      { x: 1190, y: 318, kind: "pantry_wait" },
    ],
    waitOverflowSpots: [{ x: 50, y: 430, kind: "stand", zone: "upper_left" }],
    pantryRect: { x: 1090, y: 158, w: 188, h: 222 },
    pantryEntranceRange: { x1: 1140, x2: 1188, y: 380 },
    pantryFront: { x: 240, y: 350 },
  };
  const desks = layout.desks;
  class Bubble {
    constructor() { this.text = ""; this.mood = "normal"; this.visible = true; this.until = 0; }
    setText(text) { this.text = String(text || ""); }
    update() {}
    draw() {}
    shout() {}
  }
  const sprites = {
    draw(ctxArg, name) { drawCalls.push(name); },
    drawWorker(ctxArg, pose, appearance, x, y, opts) {
      workerCalls.push({ pose, appearance: { ...appearance }, x, y, opts });
    },
    get() { return { w: 56, h: 90 }; },
  };
  const context = {
    console, Math, Map, Number, Object, Array, Date,
    LAYOUT: layout,
    SPRITES: sprites,
    DESK_VARIANTS: desks.map((_, i) => `desk_variant_${i}`),
    CloudBubble: Bubble,
    BossBubble: Bubble,
    BUBBLE: { width: 120 },
  };
  vm.createContext(context);
  const source = fs.readFileSync(ACTORS, "utf8");
  vm.runInContext(`${source}\nthis.__api = {\n    Office, Worker, deskVariantName, deliverySlot,\n    activeOverflowCount: () => activeOverflowOwners.size,\n  };`, context, { filename: ACTORS });
  return { ...context.__api, context, layout, workerCalls, drawCalls, ctx };
}

function appearance(seed) {
  return Object.fromEntries(APPEARANCE_KEYS.map((key, i) => [key, (seed + i) % 9]));
}

function finishAtWait(worker, terminalKind, terminalAt, leaveAt) {
  worker.terminalKind = terminalKind;
  worker.terminalAt = terminalAt;
  worker.leaveAt = leaveAt;
  worker.beginTerminalWait(terminalAt, 0);
  worker.waypoints = [];
}

const FADE_MS = 520;

test("completion/failure release desks immediately and promote overflow", () => {
  const { Office, ctx } = makeContext();
  const office = new Office();
  const workers = [];
  for (let i = 0; i < 9; i++) workers.push(office.spawn(`agent-${i}`, `A${i}`, true));
  workers.forEach(worker => { worker.state = "working"; });

  office.complete("agent-0", 0, 0, { terminalAt: 0, leaveAt: 30000 });
  assert.equal(workers[0].desk, null);
  assert.equal(office.usedDesks.has("agent-0"), false);
  assert.ok(workers[0].state === "delivering" || workers[0].state === "waiting");
  assert.ok(workers[8].desk, "the ninth worker is promoted into the released desk");

  office.fail("agent-1", 0, 0, { terminalAt: 0, leaveAt: 30000 });
  assert.equal(workers[1].desk, null);
  assert.equal(workers[1].bubble.mood, "error");
  assert.equal(workers[1].throwAnim, null);
  assert.equal(workers[1].bin, undefined);
  assert.equal(workers[1].state, "waiting");
  workers[1].drawBubble(ctx, 0);
  assert.equal(workers[1].bubble.visible, true, "failed red bubble remains visible during wait travel");
});

test("twenty active workers keep all twelve overflow positions unique and reusable", () => {
  const realLayout = require(SPRITES_FILE).LAYOUT;
  const { Office, activeOverflowCount } = makeContext(realLayout);
  const office = new Office();
  const workers = Array.from({ length: 20 }, (_, index) =>
    office.spawn(`overflow-${index}`, `Overflow ${index}`, true));
  workers.forEach(worker => { worker.state = "working"; });

  const activeTargets = () => [...office.workers.values()]
    .filter(worker => !worker.desk && ["spawning", "working", "recalled"].includes(worker.state))
    .map(worker => worker.waypoints.at(-1) || { x: worker.x, y: worker.y });
  const uniqueTargetCount = targets => new Set(
    targets.map(point => `${Math.round(point.x)}:${Math.round(point.y)}`),
  ).size;

  let targets = activeTargets();
  assert.equal(targets.length, 12);
  assert.equal(activeOverflowCount(), 12);
  assert.equal(uniqueTargetCount(targets), targets.length);

  office.fail("overflow-8", 0, 0, { terminalAt: 0, leaveAt: 30000 });
  const replacement = office.spawn("overflow-replacement", "Replacement", true);
  replacement.state = "working";
  targets = activeTargets();
  assert.equal(targets.length, 12);
  assert.equal(activeOverflowCount(), 12);
  assert.equal(uniqueTargetCount(targets), targets.length,
    "a terminal worker must release its active overflow slot");
});

test("twenty simultaneous completions receive unique delivery queue targets", () => {
  const realLayout = require(SPRITES_FILE).LAYOUT;
  const { Office } = makeContext(realLayout);
  const office = new Office();
  const workers = Array.from({ length: 20 }, (_, index) =>
    office.spawn(`delivery-${index}`, `Delivery ${index}`, true));
  workers.forEach(worker => { worker.state = "working"; });
  workers.forEach((worker, index) => {
    office.complete(worker.id, index, index, { terminalAt: index, leaveAt: 30000 + index });
  });

  const targets = workers.map(worker => worker.waypoints.at(-1));
  assert.ok(targets.every(Boolean));
  assert.equal(new Set(targets.map(point => `${point.x}:${point.y}`)).size, workers.length);
  assert.ok(targets.every(point =>
    point.x >= 0 && point.x <= realLayout.W && point.y >= 0 && point.y <= realLayout.H));
});

test("waiting uses the absolute 29:59/30:00 deadline", () => {
  const { Office } = makeContext();
  const office = new Office();
  const worker = office.spawn("deadline", "Deadline", true);
  worker.state = "working";
  office.releaseDesk(worker.id, false);
  finishAtWait(worker, "completed", 0, 30000);

  office.update(1000, 16, 29999);
  assert.equal(worker.state, "waiting");
  office.update(2000, 16, 30000);
  assert.equal(worker.state, "clockout_walk");
});

test("wait area is stable and hash-selected between lounge and pantry", () => {
  const { Office, context } = makeContext();
  const office = new Office();
  const first = office.spawn("stable", "Stable", false);
  first.terminalAt = 1234;
  first.leaveAt = 30000;
  first.terminalKind = "completed";
  first.beginTerminalWait(1234, 0);
  first.waypoints = [];
  const chosen = { area: first.waitArea, idx: first.waitSpot.idx };
  office.recall(first.id, {}, 2000, 0);
  first.terminalAt = 1234;
  first.leaveAt = 30000;
  first.terminalKind = "completed";
  first.beginTerminalWait(1234, 0);
  assert.deepEqual({ area: first.waitArea, idx: first.waitSpot.idx }, chosen);
  assert.ok(["lounge", "pantry"].includes(first.waitArea));
  assert.equal(Object.keys(context.LAYOUT).includes("waitOverflowSpots"), true);
});

test("waiting workers keep full front/back walking frames until reaching the rest spot", () => {
  const { Worker, ctx, workerCalls } = makeContext();
  const worker = new Worker("vertical-walker", "Vertical", -1, { appearance: appearance(0) });
  worker.state = "waiting";
  worker.terminalKind = "completed";
  worker.waitArea = "lounge";
  worker.waitSpot = { x: 100, y: 340, kind: "coffee", zone: "upper_left" };
  worker.x = 100;
  worker.y = 500;
  worker.waypoints = [{ x: 100, y: 400 }];

  worker.frame = 0;
  worker.drawSprite(ctx, 0);
  assert.equal(workerCalls.at(-1).pose, "walk_back");
  assert.equal(worker.visualPose().sprite, "walk_back");
  worker.frame = 1;
  worker.drawSprite(ctx, 170);
  assert.equal(workerCalls.at(-1).pose, "walk_back_b");
  assert.equal(worker.visualPose().sprite, "walk_back_b");

  worker.y = 300;
  worker.waypoints = [{ x: 100, y: 400 }];
  worker.frame = 0;
  worker.drawSprite(ctx, 340);
  assert.equal(workerCalls.at(-1).pose, "walk_front");
  worker.frame = 1;
  worker.drawSprite(ctx, 510);
  assert.equal(workerCalls.at(-1).pose, "walk_front_b");
  assert.ok(!workerCalls.some(call => ["sit_naked", "coffee"].includes(call.pose)));
});

test("pantry routes pass through the entrance and worker lanes are not identical", () => {
  const { Worker, layout } = makeContext();
  const pantrySpot = { area: "pantry", x: 1112, y: 318, kind: "pantry_wait" };
  const pantryWorker = new Worker("pantry-route", "Pantry", -1, { appearance: appearance(1) });
  pantryWorker.x = 375;
  pantryWorker.y = 500;
  const pantryPath = pantryWorker.pathToWait(pantrySpot);
  assert.equal(pantryPath.at(-1).x, 1112);
  assert.equal(pantryPath.at(-1).y, 318);
  assert.ok(pantryPath.some(point =>
    point.x >= layout.pantryEntranceRange.x1
    && point.x <= layout.pantryEntranceRange.x2
    && Math.abs(point.y - layout.pantryEntranceRange.y) <= 6));
  assert.ok(pantryPath.some(point => point.x >= 1200 && point.y > 380));

  const routes = new Set();
  for (let index = 0; index < 6; index++) {
    const id = `lane-${index}`;
    const worker = new Worker(id, id, -1, { appearance: appearance(2) });
    worker.x = 845;
    worker.y = 500;
    routes.add(JSON.stringify(worker.pathToWait({
      area: "lounge", idx: index, x: 80 + index * 20, y: 340 + index * 4,
      kind: "coffee", zone: "upper_left",
    })));
  }
  assert.equal(routes.size, 6, `expected one stable route per wait spot, got ${routes.size}`);
});

test("all fixed wait routes stay out of the eight desk rectangles", () => {
  const realLayout = require(SPRITES_FILE).LAYOUT;
  const { Worker } = makeContext(realLayout);
  const spots = [
    ...realLayout.loungeWaitSpots.map((spot, idx) => ({ area: "lounge", idx, ...spot })),
    ...realLayout.pantryWaitSpots.map((spot, idx) => ({ area: "pantry", idx, ...spot })),
    ...realLayout.waitOverflowSpots.map((spot, idx) => ({ area: "overflow", idx, ...spot })),
  ];
  const deskRects = realLayout.desks.map((desk) => ({
    x1: desk.x - 82.5, x2: desk.x + 82.5,
    y1: desk.y - 103, y2: desk.y,
  }));
  const segmentHitsDesk = (from, to) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 2));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const point = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      };
      if (deskRects.some((rect) =>
        point.x > rect.x1 && point.x < rect.x2
        && point.y > rect.y1 && point.y < rect.y2)) return true;
    }
    return false;
  };

  for (let deskIdx = 0; deskIdx < realLayout.desks.length; deskIdx++) {
    for (const spot of spots) {
      const worker = new Worker(`route-${deskIdx}-${spot.area}-${spot.idx}`, "Route", deskIdx, {
        appearance: appearance(deskIdx), terminalAt: 1234,
      });
      worker.x = realLayout.desks[deskIdx].x - 12;
      worker.y = realLayout.desks[deskIdx].y + 4;
      const path = worker.pathToWait(spot);
      let previous = { x: worker.x, y: worker.y };
      for (const point of path) {
        assert.equal(segmentHitsDesk(previous, point), false,
          `desk ${deskIdx} -> ${spot.area}:${spot.idx} crosses furniture at ${JSON.stringify(point)}`);
        previous = point;
      }
    }
  }
});

test("completed wait poses follow upper-left and lower-right furniture", () => {
  const { Worker } = makeContext();
  const worker = new Worker("wait-pose", "Pose", -1, { appearance: appearance(3) });
  worker.state = "waiting";
  worker.terminalKind = "completed";
  worker.waitArea = "lounge";
  worker.waypoints = [];
  worker.waitSpot = { kind: "coffee", zone: "upper_left" };
  assert.equal(worker.waitingPose(), "coffee");
  worker.waitSpot = { kind: "cushion", zone: "lower_right" };
  assert.equal(worker.waitingPose(), "sit_naked");
  worker.waitSpot = { kind: "stand", zone: "upper_left" };
  assert.equal(worker.waitingPose(), "stand_front");
  worker.terminalKind = "failed";
  worker.waitSpot = { kind: "coffee", zone: "upper_left" };
  assert.equal(worker.waitingPose(), "stand_front");
});

test("legacy terminal snapshots are archived without a visible worker", () => {
  const { Office } = makeContext();
  const office = new Office();
  office.archiveSnapshot({ id: "legacy", name: "Legacy", state: "completed", text: "old" });
  assert.equal(office.workers.has("legacy"), false);
  assert.equal(office.archived.get("legacy").visible, false);
  assert.equal(office.getRecord("legacy").name, "Legacy");
});

test("terminal snapshot hydration restores directly at its stable wait spot", () => {
  const { Worker, activeOverflowCount } = makeContext();
  const worker = new Worker("snapshot-wait", "Snapshot", -1, { appearance: appearance(1) });
  assert.equal(activeOverflowCount(), 1);
  worker.hydrateTerminal("completed", 1000, 0, {
    terminalAt: 900, leaveAt: 30000, appearance: appearance(1),
  });
  const target = worker.waitStandPosition(worker.waitSpot);
  assert.equal(worker.state, "waiting");
  assert.equal(worker.x, target.x);
  assert.equal(worker.y, target.y);
  assert.equal(worker.waypoints.length, 0);
  assert.equal(activeOverflowCount(), 0, "terminal hydration releases any active overflow slot");
});

test("recall cancels delivery, waiting, clockout walk, and fade while preserving appearance", () => {
  const { Office } = makeContext();
  const office = new Office();
  const oldAppearance = appearance(1);
  const worker = office.spawn("recall", "Recall", true, {
    appearance: oldAppearance, appearanceGeneration: 4,
  });
  worker.state = "working";
  office.complete(worker.id, 0, 0, { terminalAt: 0, leaveAt: 30000 });
  assert.equal(worker.state, "delivering");
  office.recall(worker.id, { appearance: appearance(5), appearanceGeneration: 4 }, 100, 0);
  assert.equal(worker.state, "recalled");
  assert.deepEqual(JSON.parse(JSON.stringify(worker.appearance)), oldAppearance);

  finishAtWait(worker, "completed", 0, 30000);
  office.recall(worker.id, { appearance: appearance(5), appearanceGeneration: 4 }, 1000, 0);
  assert.equal(worker.waitArea, null);
  assert.equal(worker.alpha, 1);

  finishAtWait(worker, "completed", 0, 30000);
  worker.startClockOut(0);
  worker.waypoints = [];
  assert.equal(worker.state, "clockout_walk");
  office.recall(worker.id, { appearance: appearance(5), appearanceGeneration: 4 }, 2000, 0);
  assert.equal(worker.state, "recalled");

  finishAtWait(worker, "completed", 0, 30000);
  worker.startFade(0);
  office.update(100, 16, 29999);
  assert.equal(worker.state, "clockout_fade");
  office.recall(worker.id, { appearance: appearance(5), appearanceGeneration: 4 }, 29999, 100);
  assert.equal(worker.state, "recalled");
  assert.equal(worker.alpha, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(worker.appearance)), oldAppearance);
});

test("removed worker is archived and newer-generation recall respawns through the door", () => {
  const { Office } = makeContext();
  const office = new Office();
  const worker = office.spawn("gone", "Old name", true, {
    appearance: appearance(0), appearanceGeneration: 1,
  });
  worker.state = "working";
  office.releaseDesk(worker.id, false);
  finishAtWait(worker, "completed", 0, 30000);
  worker.startFade(0);
  office.update(FADE_MS + 1, 16, 30001);
  assert.equal(office.workers.has("gone"), false);
  assert.ok(office.archived.has("gone"));
  assert.equal(office.archived.get("gone").state, "offstage");

  const freshAppearance = appearance(3);
  const fresh = office.recall("gone", {
    state: "working", name: "New name", task: "New task",
    appearance: freshAppearance, appearanceGeneration: 2,
  }, 30002, 600);
  assert.ok(fresh);
  assert.equal(fresh.x, 640);
  assert.equal(fresh.y, 706);
  assert.equal(fresh.name, "New name");
  assert.equal(fresh.task, "New task");
  assert.deepEqual(JSON.parse(JSON.stringify(fresh.appearance)), freshAppearance);
  assert.equal(office.archived.has("gone"), false);
});

test("legacy v2 appearance converts once and cannot downgrade an accepted v3 generation", () => {
  const { Worker } = makeContext();
  const legacy = {
    skin: 4, shirt: 2, pants: 5, shoes: 1,
    hairstyle: 3, hat: 5, face_accessory: 2, glasses: 4,
  };
  const worker = new Worker("legacy-look", "Legacy", -1, {
    appearanceVersion: 2, appearanceGeneration: 7, appearance: legacy,
  });
  assert.equal(worker.appearanceVersion, 2);
  assert.deepEqual(Object.keys(worker.appearance), APPEARANCE_KEYS);
  assert.ok(Object.values(worker.appearance).every(value => value >= 0 && value <= 8));
  const converted = JSON.parse(JSON.stringify(worker.appearance));

  const v3 = { head: 8, upper: 7, lower: 6 };
  worker.setServerData({
    appearanceVersion: 3, appearanceGeneration: 6, appearance: v3,
  });
  assert.equal(worker.appearanceVersion, 2);
  assert.equal(worker.appearanceGeneration, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(worker.appearance)), converted);

  worker.setServerData({
    appearanceVersion: 3, appearanceGeneration: 7, appearance: v3,
  });
  assert.equal(worker.appearanceVersion, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(worker.appearance)), v3);
  assert.notDeepEqual(JSON.parse(JSON.stringify(worker.appearance)), converted);

  worker.setServerData({
    appearanceVersion: 2, appearanceGeneration: 7,
    appearance: { ...legacy, skin: 0, shirt: 0 },
  }, true);
  assert.equal(worker.appearanceVersion, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(worker.appearance)), v3);
});

test("archived appearance updates and recalls use the same V3 revision arbitration", () => {
  const { Office } = makeContext();
  const office = new Office();
  const v3 = { head: 6, upper: 5, lower: 4 };
  office.archiveSnapshot({
    id: "archived-v3", name: "Archived", state: "offstage",
    appearanceVersion: 3, appearanceGeneration: 7, appearance: v3,
  });
  const legacy = {
    skin: 0, shirt: 1, pants: 2, shoes: 3,
    hairstyle: 4, hat: 5, face_accessory: 0, glasses: 1,
  };

  office.updateRecord("archived-v3", {
    appearanceVersion: 2, appearanceGeneration: 8, appearance: legacy,
  });
  const record = office.archived.get("archived-v3");
  assert.equal(record.appearanceVersion, 3);
  assert.equal(record.appearanceGeneration, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(record.appearance)), v3);

  const recalled = office.recall("archived-v3", {
    state: "working", appearanceVersion: 2,
    appearanceGeneration: 8, appearance: legacy,
  }, 50000, 50000);
  assert.equal(recalled.appearanceVersion, 3);
  assert.equal(recalled.appearanceGeneration, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(recalled.appearance)), v3);
});

test("all fixed desk variants and worker poses use the appearance renderer", () => {
  const { Office, context, ctx, drawCalls, workerCalls } = makeContext();
  const office = new Office();
  const worker = office.spawn("draw", "Draw", true, { appearance: appearance(2) });
  worker.state = "working";
  assert.deepEqual(Object.keys(worker.appearance), APPEARANCE_KEYS);
  office.draw(ctx, 0);
  const deskCalls = drawCalls.filter(name => /^desk_variant_[0-7]$/.test(name));
  assert.deepEqual(deskCalls.sort(), context.DESK_VARIANTS.slice().sort());
  assert.ok(workerCalls.some(call => call.pose === "upper_back"));
  assert.equal(workerCalls.at(-1).appearance.head, 2);
  assert.ok(drawCalls.includes("pantry_front"));
});

test("drawer source only restores, updates, and refreshes visible workers", () => {
  const actors = fs.readFileSync(ACTORS, "utf8");
  const source = fs.readFileSync(MAIN, "utf8");
  assert.match(source, /const selected = selectedId && office\.get\(selectedId\)/);
  assert.match(source, /const visible = office\.get\(drawerAgentId\)/);
  assert.match(source, /else if \(!visible && drawerAgentId === msg\.id\) closeDrawer\(\)/);
  assert.doesNotMatch(source, /const selected = selectedId && office\.getRecord\(selectedId\)/);
  for (const state of ["waiting", "clockout_walk", "clockout_fade", "offstage"]) {
    assert.match(actors, new RegExp(`\\"${state}\\"`));
    assert.match(source, new RegExp(`\\b${state}\\b`));
  }
});
