/* static background: floor, wall, wall decor, rug, edge props.
   Everything floor-standing is bottom-anchored ON the floor; wall decor sits
   fully inside the wall band — nothing gets clipped by the wall/floor seam. */
"use strict";

const WINDOW_CROSSFADE_MINUTES = 10;
const WINDOW_PHASE_NAMES = Object.freeze([
  "dawn", "morning", "noon", "afternoon", "dusk", "night",
]);
const WINDOW_PHASE_DEFINITIONS = Object.freeze([
  Object.freeze({ name: "dawn", start: 300, end: 420 }),
  Object.freeze({ name: "morning", start: 420, end: 660 }),
  Object.freeze({ name: "noon", start: 660, end: 840 }),
  Object.freeze({ name: "afternoon", start: 840, end: 1020 }),
  Object.freeze({ name: "dusk", start: 1020, end: 1140 }),
  Object.freeze({ name: "night", start: 1140, end: 1740 }),
]);

function wallDate(wallNow) {
  if (wallNow && typeof wallNow.getTime === "function") {
    const time = wallNow.getTime();
    if (!Number.isNaN(time)) return new Date(time);
  }
  if (typeof wallNow === "number" || typeof wallNow === "string") {
    const date = new Date(wallNow);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function localMinuteOfDay(date) {
  return date.getHours() * 60 + date.getMinutes()
    + date.getSeconds() / 60 + date.getMilliseconds() / 60000;
}

function phaseDetails(wallNow) {
  const date = wallDate(wallNow);
  const minuteOfDay = ((localMinuteOfDay(date) % 1440) + 1440) % 1440;
  const definition = minuteOfDay >= 1140 || minuteOfDay < 300
    ? WINDOW_PHASE_DEFINITIONS[5]
    : WINDOW_PHASE_DEFINITIONS.find((phase) =>
      minuteOfDay >= phase.start && minuteOfDay < phase.end);
  const phaseMinute = definition.name === "night" && minuteOfDay < 300
    ? minuteOfDay + 1440 : minuteOfDay;
  const phaseIndex = WINDOW_PHASE_NAMES.indexOf(definition.name);
  const nextPhase = WINDOW_PHASE_NAMES[(phaseIndex + 1) % WINDOW_PHASE_NAMES.length];
  return {
    date,
    minuteOfDay,
    definition,
    phaseMinute,
    nextPhase,
  };
}

function prefersReducedMotion() {
  const browser = typeof globalThis !== "undefined" ? globalThis : {};
  const matchMedia = browser.matchMedia
    || (browser.window && browser.window.matchMedia);
  return typeof matchMedia === "function"
    && Boolean(matchMedia.call(browser.window || browser,
      "(prefers-reduced-motion: reduce)")?.matches);
}

/** Return the active local-time window phase name. */
function classifyWindowScene(wallNow = new Date()) {
  return phaseDetails(wallNow).definition.name;
}

/**
 * Return the active/next phase and crossfade amount for a local wall-clock
 * instant. The blend is from 0 to 1 during only the last ten minutes of a
 * phase. Reduced-motion callers receive a hard switch (blend 0).
 */
function getWindowSceneBlend(wallNow = new Date(), reducedMotion = prefersReducedMotion()) {
  const details = phaseDetails(wallNow);
  const remaining = details.definition.end - details.phaseMinute;
  const crossfading = remaining > 0 && remaining <= WINDOW_CROSSFADE_MINUTES;
  const blend = reducedMotion || !crossfading
    ? 0
    : Math.max(0, Math.min(1,
      (WINDOW_CROSSFADE_MINUTES - remaining) / WINDOW_CROSSFADE_MINUTES));
  return {
    phase: details.definition.name,
    currentPhase: details.definition.name,
    nextPhase: details.nextPhase,
    blend,
    alpha: blend,
    crossfading: !reducedMotion && crossfading,
    reducedMotion: Boolean(reducedMotion),
    minuteOfDay: details.minuteOfDay,
  };
}

// Public aliases keep the pure helper easy to discover from browser consoles
// and compatible with the first scene-render preview harness.
const dateToWindowBlend = getWindowSceneBlend;
const blendWindowScene = getWindowSceneBlend;
const getWindowBlend = getWindowSceneBlend;

class Scene {
  constructor() {
    this.layer = document.createElement("canvas");
    this.layer.width = LAYOUT.W;
    this.layer.height = LAYOUT.H;
    this.built = false;
    this.reducedMotion = null;
    this.windowState = getWindowSceneBlend(new Date(), prefersReducedMotion());
    this.currentWindowPhase = this.windowState.phase;
    this.currentPhase = this.windowState.phase;
    this.windowPhase = this.windowState.phase;
    this.windowBlend = this.windowState.blend;
    this.debug = this.getDebugState();
  }

  build() {
    if (this.built) return;
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

    // wall decor — the time-varying window is drawn after this cached layer
    SPRITES.draw(ctx, "certificate", 66, 128);
    SPRITES.draw(ctx, "chart", 452, 122);
    SPRITES.draw(ctx, "clock", 560, 92);
    SPRITES.draw(ctx, "ac", 996, 70);

    // floor-standing furniture, bottom-anchored
    SPRITES.draw(ctx, "plant2", 1046, 318);
    SPRITES.draw(ctx, "plant1", 66, 214);
    SPRITES.draw(ctx, "copier", 74, 600);
    SPRITES.draw(ctx, "water", 70, 376);
    SPRITES.draw(ctx, "plant1", 1006, 706);
    // Tea-room back belongs to the cached room. The front is intentionally
    // left for actors' Y-sorted foreground entities so bubbles stay topmost.
    if (LAYOUT.pantryBack) {
      SPRITES.draw(ctx, "pantry_back", LAYOUT.pantryBack.x, LAYOUT.pantryBack.y);
    }

    // rug under the boss zone
    SPRITES.draw(ctx, "rug", LAYOUT.boss.x, LAYOUT.boss.deskBottom + 30);

    this.built = true;
  }

  drawWindow(ctx, state) {
    const anchor = LAYOUT.window || { x: 250, y: 138 };
    const currentName = "window_" + state.phase;
    const nextName = "window_" + state.nextPhase;
    const currentLoaded = SPRITES.get(currentName);
    const nextLoaded = SPRITES.get(nextName);

    if (currentLoaded) {
      SPRITES.draw(ctx, currentName, anchor.x, anchor.y);
    } else if (SPRITES.get("window")) {
      // Legacy 0.1 art packs have only window.png.
      SPRITES.draw(ctx, "window", anchor.x, anchor.y);
    }
    if (state.blend > 0 && nextLoaded) {
      SPRITES.draw(ctx, nextName, anchor.x, anchor.y, { alpha: state.blend });
    }
  }

  getDebugState() {
    return {
      phase: this.currentWindowPhase,
      currentPhase: this.currentWindowPhase,
      nextPhase: this.windowState.nextPhase,
      blend: this.windowBlend,
      reducedMotion: this.windowState.reducedMotion,
      minuteOfDay: this.windowState.minuteOfDay,
      crossfading: this.windowState.crossfading,
    };
  }

  draw(ctx, wallNow = new Date()) {
    if (!this.built) this.build();
    ctx.drawImage(this.layer, 0, 0);
    const reducedMotion = this.reducedMotion == null
      ? prefersReducedMotion() : Boolean(this.reducedMotion);
    this.windowState = getWindowSceneBlend(wallNow, reducedMotion);
    this.currentWindowPhase = this.windowState.phase;
    this.currentPhase = this.windowState.phase;
    this.windowPhase = this.windowState.phase;
    this.windowBlend = this.windowState.blend;
    this.debug = this.getDebugState();
    if (typeof globalThis !== "undefined") globalThis.__sceneDebug = this.debug;
    this.drawWindow(ctx, this.windowState);
    return this.windowState;
  }
}

const sceneExports = {
  Scene,
  WINDOW_CROSSFADE_MINUTES,
  WINDOW_PHASES: WINDOW_PHASE_NAMES,
  WINDOW_PHASE_DEFINITIONS,
  classifyWindowScene,
  getWindowSceneBlend,
  dateToWindowBlend,
  blendWindowScene,
  getWindowBlend,
  prefersReducedMotion,
};

if (typeof globalThis !== "undefined") Object.assign(globalThis, sceneExports);
if (typeof module !== "undefined" && module.exports) module.exports = sceneExports;
