/* dynamic actors: workers (subagents) and the boss (orchestrator).
   Worker animation is a small state machine driven by server events:
     spawning -> working -> delivering -> waiting -> clockout_walk
     -> clockout_fade -> offstage; any visible terminal phase can be recalled.
*/
"use strict";

const WALK_SPEED = 150;         // px/s
const FRAME_MS = 170;           // walk frame flip
const PRESENT_MS = 1900;        // standing at the boss with documents
const ZZZ_MS = 950;
const FADE_MS = 520;
const APPEARANCE_VERSION = 3;
const APPEARANCE_KEYS = ["head", "upper", "lower"];
const LEGACY_APPEARANCE_KEYS = [
  "skin", "shirt", "pants", "shoes", "hairstyle", "hat", "face_accessory", "glasses",
];

const deliveryQueue = [];       // worker ids waiting at the boss
let deliveredPile = 0;          // paper stack on the boss desk
const restSpotOwners = new Map(); // spotIndex -> workerId
const waitSpotOwners = new Map();  // area:spot -> worker id
const activeOverflowOwners = new Map(); // entrance slot index -> active worker id

function hashString(value) {
  let hash = 0;
  for (const ch of String(value)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function inferredAppearanceVersion(value, declaredVersion = null) {
  if (declaredVersion !== null && declaredVersion !== undefined && declaredVersion !== "") {
    const declared = Number(declaredVersion);
    if (Number.isFinite(declared)) return Math.trunc(declared);
  }
  if (value && typeof value === "object" && APPEARANCE_KEYS.every(key => key in value)) {
    return APPEARANCE_VERSION;
  }
  if (value && typeof value === "object"
      && LEGACY_APPEARANCE_KEYS.some(key => key in value)) return 2;
  return APPEARANCE_VERSION;
}

function legacyAppearanceSeed(source, id, generation) {
  const values = LEGACY_APPEARANCE_KEYS.map(key => {
    const raw = Number(source[key]);
    return Number.isFinite(raw) ? Math.max(0, Math.min(5, Math.round(raw))) : 0;
  });
  return `${id}|${generation ?? 0}|${values.join("|")}`;
}

function normalizeAppearance(value, id = "", declaredVersion = null, generation = null) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const version = inferredAppearanceVersion(source, declaredVersion);
  if (version < APPEARANCE_VERSION || LEGACY_APPEARANCE_KEYS.some(key => key in source)) {
    const seed = legacyAppearanceSeed(source, id, generation);
    return Object.fromEntries(APPEARANCE_KEYS.map(key => [
      key, hashString(`${seed}|${key}`) % 9,
    ]));
  }
  const out = {};
  APPEARANCE_KEYS.forEach((key, index) => {
    const raw = Number(source[key]);
    out[key] = Number.isFinite(raw)
      ? Math.max(0, Math.min(8, Math.round(raw)))
      : hashString(`${id}|fallback|${index}|${key}`) % 9;
  });
  return out;
}

function copyAppearance(value) {
  return value && typeof value === "object" ? { ...value } : value;
}

function toWallTime(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function appearanceRevisionAllows(target, meta = {}, force = false) {
  if (meta.appearance === undefined) return false;
  const nextVersion = inferredAppearanceVersion(meta.appearance, meta.appearanceVersion);
  const currentVersion = Number(target.appearanceVersion) || 0;
  if (nextVersion < currentVersion) return false;

  const nextGeneration = meta.appearanceGeneration;
  const currentGeneration = target.appearanceGeneration;
  if (currentGeneration != null) {
    // Once a generation is known, an unversioned or older packet cannot be
    // proven current. This also prevents a V3 protocol upgrade from jumping
    // backwards across generations.
    if (nextGeneration == null) return false;
    const nextNumber = Number(nextGeneration);
    const currentNumber = Number(currentGeneration);
    if (Number.isFinite(nextNumber) && Number.isFinite(currentNumber)) {
      if (nextNumber < currentNumber) return false;
    } else if (String(nextGeneration) !== String(currentGeneration)) {
      return false;
    }
  }

  if (force) return true;
  if (nextVersion > currentVersion) return true;
  if (currentGeneration == null) return nextGeneration != null;
  const nextNumber = Number(nextGeneration);
  const currentNumber = Number(currentGeneration);
  if (Number.isFinite(nextNumber) && Number.isFinite(currentNumber)) {
    return nextNumber > currentNumber;
  }
  // Same-generation packets never change a visible shift's appearance. This
  // is what keeps a worker stable when a terminal phase is recalled.
  return false;
}

function applyAppearanceUpdate(target, id, meta = {}, force = false) {
  if (!appearanceRevisionAllows(target, meta, force)) return false;
  const nextVersion = inferredAppearanceVersion(meta.appearance, meta.appearanceVersion);
  target.appearance = normalizeAppearance(
    meta.appearance, id, nextVersion, meta.appearanceGeneration,
  );
  target.appearanceVersion = nextVersion;
  if (meta.appearanceGeneration != null) {
    target.appearanceGeneration = meta.appearanceGeneration;
  }
  return true;
}

function poseFacesSide(pose) {
  return ["stand_side", "walk_side_a", "walk_side_b", "briefcase", "sit", "sit_naked"]
    .includes(pose);
}

function spotPosition(spot) {
  if (Array.isArray(spot)) return { x: Number(spot[0]) || 0, y: Number(spot[1]) || 0 };
  const x = Number(spot?.x ?? spot?.left ?? 0);
  const y = Number(spot?.y ?? spot?.bottom ?? spot?.yBottom ?? 0);
  return { x, y };
}

function waitSpots(area) {
  const configured = area === "lounge" ? LAYOUT.loungeWaitSpots : LAYOUT.pantryWaitSpots;
  if (Array.isArray(configured) && configured.length) return configured;
  // The old layout's rest spots remain a safe local fallback until the scene
  // contract with lounge/pantry coordinates is merged.
  return area === "lounge" && Array.isArray(LAYOUT.restSpots) ? LAYOUT.restSpots : [];
}

function claimWaitSpot(id, terminalAt = null) {
  const seed = hashString(`${id}:${terminalAt ?? ""}`);
  const preferred = seed % 2 === 0 ? "lounge" : "pantry";
  const areas = [preferred, preferred === "lounge" ? "pantry" : "lounge"];
  for (const area of areas) {
    const spots = waitSpots(area);
    if (!spots.length) continue;
    const start = seed % spots.length;
    for (let offset = 0; offset < spots.length; offset++) {
      const idx = (start + offset) % spots.length;
      const key = `${area}:${idx}`;
      if (waitSpotOwners.has(key)) continue;
      waitSpotOwners.set(key, id);
      return { area, idx, ...spots[idx], ...spotPosition(spots[idx]) };
    }
  }
  const overflow = Array.isArray(LAYOUT.waitOverflowSpots) && LAYOUT.waitOverflowSpots.length
    ? LAYOUT.waitOverflowSpots : [{ x: LAYOUT.door.x - 180, y: LAYOUT.door.y - 6 }];
  const overflowStart = seed % overflow.length;
  for (let offset = 0; offset < overflow.length; offset++) {
    const idx = (overflowStart + offset) % overflow.length;
    const key = `overflow:${idx}`;
    if (waitSpotOwners.has(key)) continue;
    waitSpotOwners.set(key, id);
    return { area: "overflow", idx, ...overflow[idx], ...spotPosition(overflow[idx]) };
  }
  const fallback = spotPosition(overflow[hashString(id) % overflow.length]);
  return { area: "overflow", idx: -1, ...fallback, x: fallback.x - 24 };
}

function releaseWaitSpot(id) {
  for (const [key, owner] of waitSpotOwners) if (owner === id) waitSpotOwners.delete(key);
}

function removeFromQueues(id) {
  for (let i = deliveryQueue.length - 1; i >= 0; i--) {
    if (deliveryQueue[i] === id) deliveryQueue.splice(i, 1);
  }
  releaseRestSpot(id);
  releaseWaitSpot(id);
}

function claimRestSpot(id) {
  for (let i = 0; i < LAYOUT.restSpots.length; i++) {
    if (!restSpotOwners.has(i)) {
      restSpotOwners.set(i, id);
      return { idx: i, ...LAYOUT.restSpots[i] };
    }
  }
  // all taken: squeeze beside the last spot with a small offset
  const s = LAYOUT.restSpots[LAYOUT.restSpots.length - 1];
  return { idx: -1, ...s, x: s.x - 26 };
}
function releaseRestSpot(id) {
  for (const [i, owner] of restSpotOwners) if (owner === id) restSpotOwners.delete(i);
}

function corridorY(deskY) { return deskY + 20; }

function activeOverflowCoordinate(index) {
  const n = Number.isFinite(Number(index)) ? Math.max(0, Math.trunc(Number(index))) : 0;
  const configured = Array.isArray(LAYOUT.activeOverflowSpots)
    ? LAYOUT.activeOverflowSpots : [];
  if (configured[n]) return { ...configured[n], ...spotPosition(configured[n]) };
  if (typeof LAYOUT.activeOverflow?.coordinate === "function") {
    const point = LAYOUT.activeOverflow.coordinate(n);
    return { ...point, ...spotPosition(point) };
  }
  const perRow = 16;
  const row = Math.floor(n / perRow);
  const slot = n % perRow;
  const side = slot % 2 === 0 ? -1 : 1;
  const column = Math.floor(slot / 2);
  return {
    x: LAYOUT.door.x + side * (46 + column * 30),
    y: LAYOUT.door.y - row * 34,
    kind: "briefcase", zone: "entrance",
  };
}

function overflowSpot(id) {
  for (const [index, owner] of activeOverflowOwners) {
    if (owner === id) return { idx: index, ...activeOverflowCoordinate(index) };
  }
  const configuredCount = Math.max(1,
    Array.isArray(LAYOUT.activeOverflowSpots) ? LAYOUT.activeOverflowSpots.length : 8);
  const start = hashString(id) % configuredCount;
  let index = -1;
  for (let offset = 0; offset < configuredCount; offset++) {
    const candidate = (start + offset) % configuredCount;
    if (!activeOverflowOwners.has(candidate)) {
      index = candidate;
      break;
    }
  }
  if (index < 0) {
    index = configuredCount;
    while (activeOverflowOwners.has(index)) index++;
  }
  activeOverflowOwners.set(index, id);
  return { idx: index, ...activeOverflowCoordinate(index) };
}

function releaseOverflowSpot(id) {
  for (const [index, owner] of activeOverflowOwners) {
    if (owner === id) activeOverflowOwners.delete(index);
  }
}

function deliverySlot(index) {
  const configured = Array.isArray(LAYOUT.queueSlots) && LAYOUT.queueSlots.length
    ? LAYOUT.queueSlots : [{ x: LAYOUT.door.x, y: LAYOUT.door.y - 42 }];
  const n = Number.isFinite(Number(index)) ? Math.max(0, Math.trunc(Number(index))) : 0;
  if (n < configured.length) return spotPosition(configured[n]);
  const overflowIndex = n - configured.length;
  const row = overflowIndex % configured.length;
  const lane = Math.floor(overflowIndex / configured.length);
  const side = lane % 2 === 0 ? -1 : 1;
  const distance = (Math.floor(lane / 2) + 1)
    * (Number(LAYOUT.deliveryLaneSpacing) || 90);
  const base = spotPosition(configured[row]);
  return { x: base.x + side * distance, y: base.y };
}

class Worker {
  constructor(id, name, deskIdx, meta = {}) {
    if (!meta || typeof meta !== "object") meta = {};
    if (meta && typeof meta === "object" && !meta.appearance
        && [...APPEARANCE_KEYS, ...LEGACY_APPEARANCE_KEYS]
          .some(key => Object.prototype.hasOwnProperty.call(meta, key))) {
      meta = { appearance: meta };
    }
    this.id = id;
    this.name = name;
    this.deskIdx = deskIdx;                  // -1 => no desk (overflow)
    this.desk = deskIdx >= 0 ? LAYOUT.desks[deskIdx] : null;
    this.state = "spawning";
    this.x = LAYOUT.door.x;
    this.y = LAYOUT.door.y;
    this.waypoints = [];
    this.facing = 1;                         // 1 right, -1 left (side sprites)
    this.bubble = new CloudBubble();
    this.task = "";
    this.history = [];
    this.bobT = Math.random() * 10;
    this.frame = 0;
    this.lastFrame = 0;
    this.presentUntil = 0;
    this.zzz = [];                           // resting particles
    this.lastZzz = 0;
    this.throwAnim = null;                   // {t0, from, to}
    this.alpha = 1;
    this.terminalAt = toWallTime(meta.terminalAt);
    this.leaveAt = toWallTime(meta.leaveAt);
    this.terminalKind = null;
    this.waitArea = null;
    this.waitSpot = null;
    this.restSpot = null;
    this.fadeStarted = 0;
    this.removeRequested = false;
    this.appearanceVersion = inferredAppearanceVersion(meta.appearance, meta.appearanceVersion);
    this.appearanceGeneration = meta.appearanceGeneration ?? null;
    this.appearance = normalizeAppearance(
      meta.appearance, id, this.appearanceVersion, this.appearanceGeneration,
    );
    if (this.desk) {
      this.waypoints = this.pathTo(this.desk.x - 12, this.desk.y + 4);
    } else {
      // overflow: stand by the door with a briefcase
      this.waypoints = [overflowSpot(id)];
    }
  }

  /* ---------- movement ---------------------------------------------- */
  movementLane(salt = "") {
    return (hashString(`${this.id}:${this.terminalAt ?? ""}:${salt}`) % 5 - 2) * 18;
  }

  waitLane(spot, salt = "") {
    const index = Number(spot?.idx);
    if (!Number.isInteger(index) || index < 0) return this.movementLane(`wait-${salt}`);
    const slot = salt === "y" ? (index * 5 + 2) % 6 : index % 6;
    return (slot - 2.5) * 14;
  }

  compactPath(points) {
    const path = [];
    let previous = { x: this.x, y: this.y };
    for (const point of points) {
      const next = { x: Number(point.x), y: Number(point.y) };
      if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) continue;
      if (Math.hypot(next.x - previous.x, next.y - previous.y) < 1) continue;
      path.push(next);
      previous = next;
    }
    return path;
  }

  pathTo(x, y) {
    // L-shaped walk through the aisle so he never crosses desks
    const pts = [];
    const laneX = LAYOUT.aisleX + this.movementLane("aisle");
    const laneY = this.movementLane("corridor") / 3;
    const corr = (this.y <= 567 ? 512 : 668) + laneY;
    if (Math.abs(this.x - laneX) > 40) {
      pts.push({ x: this.x, y: corr });
      pts.push({ x: laneX, y: corr });
    }
    pts.push({ x: laneX, y });
    pts.push({ x, y });
    return this.compactPath(pts);
  }

  pathToWait(spot) {
    const target = this.waitStandPosition(spot);
    const laneX = this.waitLane(spot, "x");
    const laneY = this.waitLane(spot, "y") / 3;
    const points = [];

    if (spot?.area === "pantry") {
      // Enter through the room's bottom opening instead of cutting through
      // the boss desk and the right-hand workstations.
      const transitY = (this.y <= 567 ? 526 : 684) + laneY;
      const pantry = LAYOUT.pantryRect || LAYOUT.pantry || { x: 1090, w: 188 };
      const entrance = LAYOUT.pantryEntranceRange || { x1: 1140, x2: 1188, y: 380 };
      const edgeX = Math.min(pantry.x + pantry.w - 36, 1236 + laneX / 3);
      const entranceSlot = Number.isInteger(Number(spot?.idx)) && Number(spot.idx) >= 0
        ? Number(spot.idx) % 6 : hashString(this.id) % 6;
      const entranceX = Math.round(
        entrance.x1 + 6 + entranceSlot * Math.max(1, (entrance.x2 - entrance.x1 - 12) / 5),
      );
      points.push(
        { x: this.x, y: transitY },
        { x: edgeX, y: transitY },
        { x: edgeX, y: entrance.y },
        { x: entranceX, y: entrance.y },
        { x: entranceX, y: entrance.y - 2 },
        target,
      );
      return this.compactPath(points);
    }

    if (spot?.zone === "upper_left") {
      const transitY = (this.y <= 567 ? 526 : 684) + laneY;
      const leftAisleX = 530 + laneX;
      const stagingY = 360 + laneY / 2;
      points.push(
        { x: this.x, y: transitY },
        { x: leftAisleX, y: transitY },
        { x: leftAisleX, y: stagingY },
        { x: target.x, y: stagingY },
        target,
      );
      return this.compactPath(points);
    }

    if (spot?.zone === "lower_right") {
      const aisleX = LAYOUT.aisleX + laneX;
      const corridorY = (this.y <= 567 ? 526 : 684) + laneY;
      const bottomY = Math.min(704, 688 + laneY);
      points.push(
        { x: this.x, y: corridorY },
        { x: aisleX, y: corridorY },
        { x: aisleX, y: bottomY },
        { x: target.x, y: bottomY },
        target,
      );
      return this.compactPath(points);
    }

    return this.pathTo(target.x, target.y);
  }

  isWalking() {
    return this.waypoints.length > 0 && [
      "spawning", "delivering", "rest_walk", "recalled", "waiting", "clockout_walk",
    ].includes(this.state);
  }

  walkingPose() {
    if (!this.waypoints.length) return "stand_front";
    const dx = this.waypoints[0].x - this.x;
    const dy = this.waypoints[0].y - this.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return this.frame ? "walk_side_a" : "walk_side_b";
    }
    if (dy < 0) return this.frame ? "walk_back_b" : "walk_back";
    return this.frame ? "walk_front_b" : "walk_front";
  }

  waitingPose() {
    if (this.terminalKind === "failed") return "stand_front";
    const kind = this.waitSpot?.kind;
    if (this.waitArea === "pantry" || kind === "coffee") return "coffee";
    if (kind === "chaise" || kind === "cushion") return "sit_naked";
    return "stand_front";
  }

  moveStep(now, dt) {
    if (!this.waypoints.length) return false;
    const tgt = this.waypoints[0];
    const dx = tgt.x - this.x, dy = tgt.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = WALK_SPEED * dt / 1000;
    if (dist <= step) {
      this.x = tgt.x; this.y = tgt.y;
      this.waypoints.shift();
      return this.waypoints.length > 0;
    }
    this.x += dx / dist * step;
    this.y += dy / dist * step;
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 1 : -1;
    if (now - this.lastFrame > FRAME_MS) { this.frame ^= 1; this.lastFrame = now; }
    return true;
  }

  /* ---------- server-driven state changes --------------------------- */
  setText(text) { this.bubble.setText(text); }
  setTask(task) { this.task = String(task || "").trim(); }
  setHistory(history) {
    this.history = Array.isArray(history)
      ? history.map(text => String(text || "").trim()).filter(Boolean) : [];
  }
  setServerData(meta = {}, forceAppearance = false) {
    if (Object.prototype.hasOwnProperty.call(meta, "terminalAt")) {
      this.terminalAt = toWallTime(meta.terminalAt);
    }
    if (Object.prototype.hasOwnProperty.call(meta, "leaveAt")) {
      this.leaveAt = toWallTime(meta.leaveAt);
    }
    applyAppearanceUpdate(this, this.id, meta, forceAppearance);
  }
  appendProgress(text) {
    text = String(text || "").replace(/\r/g, "").trim();
    if (!text) return false;
    this.history.push(text);
    return true;
  }

  onCompleted(wallNow, animNow = wallNow, meta = {}) {
    if (animNow && typeof animNow === "object") {
      meta = animNow;
      animNow = wallNow;
    }
    this.setServerData(meta);
    if (["waiting", "clockout_walk", "clockout_fade", "offstage"].includes(this.state)) return;
    if (["delivering", "resting", "rest_walk"].includes(this.state)) return;
    releaseOverflowSpot(this.id);
    this.terminalKind = "completed";
    this.terminalAt = toWallTime(meta.terminalAt) ?? this.terminalAt ?? wallNow;
    this.state = "delivering";
    if (!deliveryQueue.includes(this.id)) deliveryQueue.push(this.id);
    const slot = deliverySlot(deliveryQueue.indexOf(this.id));
    this.waypoints = this.pathTo(slot.x, slot.y);
  }

  onRecalled(meta = {}, wallNow = Date.now(), animNow = wallNow) {
    this.setServerData(meta);
    if (this.state === "working") return;
    removeFromQueues(this.id);
    this.presentUntil = 0;
    this.throwAnim = null;
    this.fadeStarted = 0;
    this.removeRequested = false;
    this.alpha = 1;
    this.terminalAt = null;
    this.leaveAt = null;
    this.terminalKind = null;
    this.waitArea = null;
    this.waitSpot = null;
    this.restSpot = null;
    this.state = "recalled";
    this.bubble.mood = "normal";
    if (this.desk) this.waypoints = this.pathTo(this.desk.x - 12, this.desk.y + 4);
    else this.waypoints = [overflowSpot(this.id)];
  }

  onFailed(wallNow, animNow = wallNow, meta = {}) {
    if (animNow && typeof animNow === "object") {
      meta = animNow;
      animNow = wallNow;
    }
    if (["waiting", "clockout_walk", "clockout_fade", "offstage"].includes(this.state)) return;
    this.setServerData(meta);
    releaseOverflowSpot(this.id);
    removeFromQueues(this.id);
    this.presentUntil = 0;
    this.throwAnim = null;
    this.terminalKind = "failed";
    this.terminalAt = toWallTime(meta.terminalAt) ?? this.terminalAt ?? wallNow;
    this.bubble.mood = "error";
    this.beginTerminalWait(wallNow, animNow);
  }

  beginTerminalWait(wallNow, animNow) {
    releaseOverflowSpot(this.id);
    this.state = "waiting";
    this.zzz = [];
    this.throwAnim = null;
    for (let i = deliveryQueue.length - 1; i >= 0; i--) {
      if (deliveryQueue[i] === this.id) deliveryQueue.splice(i, 1);
    }
    releaseWaitSpot(this.id);
    this.waitArea = null;
    this.waitSpot = null;
    this.restSpot = null;
    this.waitSpot = claimWaitSpot(this.id, this.terminalAt);
    this.waitArea = this.waitSpot.area;
    const p = this.waitStandPosition(this.waitSpot);
    this.waypoints = this.pathToWait(this.waitSpot);
    this.bubble.mood = this.terminalKind === "failed" ? "error" : "dim";
    if (this.leaveAt == null || this.leaveAt <= wallNow) this.startClockOut(animNow);
  }

  waitStandPosition(spot) {
    const p = spotPosition(spot);
    if (spot?.standX != null || spot?.standY != null) {
      return { x: Number(spot.standX ?? p.x), y: Number(spot.standY ?? p.y) };
    }
    return { x: p.x, y: p.y };
  }

  hydrateTerminal(state, wallNow, animNow, meta = {}) {
    this.setServerData(meta, true);
    this.terminalKind = state === "failed" || state === "failed_idle" ? "failed" : "completed";
    this.bubble.mood = this.terminalKind === "failed" ? "error" : "dim";
    this.beginTerminalWait(wallNow, animNow);
    // A snapshot describes current reality, not a new terminal transition.
    // Restore directly at the stable wait spot so refresh/reconnect does not
    // replay every worker's route from the entrance and stack them in lanes.
    if (this.state === "waiting" && this.waitSpot) {
      const target = this.waitStandPosition(this.waitSpot);
      this.x = target.x;
      this.y = target.y;
      this.waypoints = [];
    }
  }

  startClockOut(animNow) {
    if (["clockout_walk", "clockout_fade", "offstage"].includes(this.state)) return;
    releaseWaitSpot(this.id);
    this.waitArea = null;
    this.waitSpot = null;
    this.state = "clockout_walk";
    this.waypoints = this.pathTo(LAYOUT.door.x, LAYOUT.door.y);
    this.fadeStarted = 0;
    this.alpha = 1;
    if (!this.waypoints.length) this.startFade(animNow);
  }

  startFade(animNow) {
    this.state = "clockout_fade";
    this.fadeStarted = animNow;
    this.alpha = 1;
  }

  updateDeadline(wallNow, animNow) {
    if (this.state === "waiting" && (this.leaveAt == null || wallNow >= this.leaveAt)) {
      this.startClockOut(animNow);
    }
  }

  /* ---------- per-frame update -------------------------------------- */
  update(now, dt, workers, wallNow = Date.now()) {
    this.bubble.update(now);
    switch (this.state) {
      case "spawning": {
        this.alpha = Math.min(1, (this.alpha ?? 0) + dt / 500);
        if (!this.moveStep(now, dt)) this.state = "working";
        break;
      }
      case "working":
        this.bobT += dt;
        break;
      case "delivering": {
        if (this.moveStep(now, dt)) break;
        // wait for our queue slot (only the front worker presents)
        const qi = deliveryQueue.indexOf(this.id);
        if (qi < 0) {
          this.state = "recalled";
          break;
        }
        const slot = deliverySlot(qi);
        if (Math.abs(this.x - slot.x) > 2 || Math.abs(this.y - slot.y) > 2) {
          this.waypoints = [{ x: slot.x, y: slot.y }];
          break;
        }
        if (qi === 0) {
          if (!this.presentUntil) this.presentUntil = now + PRESENT_MS;
          if (now >= this.presentUntil) {
            deliveryQueue.splice(0, 1);
            this.presentUntil = 0;
            deliveredPile = Math.min(deliveredPile + 1, 6);
            Boss.nod(now);
            this.beginTerminalWait(wallNow, now);
          }
        }
        break;
      }
      case "rest_walk":
        if (!this.moveStep(now, dt)) {
          this.state = "resting";
          this.bubble.mood = "dim";
          if (!this.bubble.text) this.bubble.setText("任务完成，休息中…");
        }
        break;
      case "resting":
        if (now - this.lastZzz > ZZZ_MS) {
          this.lastZzz = now;
          this.zzz.push({ x: this.x + 26, y: this.y - 58, t: 0 });
          if (this.zzz.length > 3) this.zzz.shift();
        }
        for (const z of this.zzz) z.t += dt;
        break;
      case "waiting": {
        this.updateDeadline(wallNow, now);
        if (this.state !== "waiting") break;
        this.moveStep(now, dt);
        if (this.state === "waiting" && this.terminalKind === "completed" && !this.bubble.text) {
          this.bubble.setText("任务完成，等待下班…");
        }
        break;
      }
      case "recalled":
        if (!this.moveStep(now, dt)) this.state = "working";
        break;
      case "clockout_walk":
        if (!this.moveStep(now, dt)) this.startFade(now);
        break;
      case "clockout_fade":
        this.alpha = Math.max(0, 1 - (now - this.fadeStarted) / FADE_MS);
        if (this.alpha <= 0) {
          this.state = "offstage";
          this.removeRequested = true;
        }
        break;
      case "failed":
      case "failed_back":
      case "failed_idle":
        // Kept as inert compatibility states for old snapshots. New failure
        // events always use waiting and never visit the trash path.
        break;
    }
  }

  /* ---------- drawing ------------------------------------------------ */
  drawWorker(ctx, pose, x, y, opts = {}) {
    if (typeof SPRITES.drawWorker === "function") {
      SPRITES.drawWorker(ctx, pose, this.appearance, x, y, opts);
    } else {
      // Compatibility with the pre-appearance sprite bundle.
      SPRITES.draw(ctx, pose, x, y, opts);
    }
  }

  drawSprite(ctx, now) {
    if (this.isWalking()) {
      const name = this.walkingPose();
      this.drawWorker(ctx, name, this.x, this.y, {
        flip: poseFacesSide(name) && this.facing === 1,
        alpha: this.alpha,
      });
      return;
    }

    switch (this.state) {
      case "delivering": {
        // standing in front of the boss holding the documents
        this.drawWorker(ctx, "documents", this.x, this.y, { alpha: this.alpha });
        break;
      }
      case "failed": {
        this.drawWorker(ctx, "stand_front", this.x, this.y, { alpha: this.alpha });
        break;
      }
      case "waiting": {
        const pose = this.waitingPose();
        this.drawWorker(ctx, pose, this.x, this.y, {
          flip: poseFacesSide(pose) && this.facing === 1,
          alpha: this.alpha,
        });
        break;
      }
      case "resting": {
        // lounging depends on the spot: chaise tilt / cushion sit / coffee stand
        const kind = this.restSpot ? this.restSpot.kind : "cushion";
        if (kind === "chaise") {
          this.drawWorker(ctx, "sit_naked", this.x + 38, this.y - 4, {
            flip: this.facing === 1, rotate: -0.16, alpha: this.alpha,
          });
        } else if (kind === "cushion") {
          this.drawWorker(ctx, "sit_naked", this.x, this.y - 4, {
            flip: this.facing === 1, alpha: this.alpha,
          });
        } else {
          this.drawWorker(ctx, "coffee", this.x, this.y, { alpha: this.alpha });
        }
        break;
      }
      case "failed_idle": {
        this.drawWorker(ctx, "stand_front", this.x, this.y, { alpha: this.alpha });
        break;
      }
      case "offstage":
        return;
      case "working": {
        if (this.desk) {
          const bob = Math.sin(this.bobT / 140) * 1.6;
          this.drawWorker(ctx, "upper_back", this.desk.x - 8, this.desk.y + 2 + bob, { alpha: this.alpha });
        } else {
          this.drawWorker(ctx, "briefcase", this.x, this.y, {
            flip: this.facing === 1, alpha: this.alpha,
          });
        }
        break;
      }
      default:
        this.drawWorker(ctx, "stand_front", this.x, this.y, { alpha: this.alpha });
    }
  }

  visualPose() {
    if (this.isWalking()) return { x: this.x, y: this.y, sprite: this.walkingPose() };
    if (this.state === "working" && this.desk) {
      return { x: this.desk.x - 8, y: this.desk.y + 2, sprite: "upper_back" };
    }
    if (this.state === "failed_idle" && this.desk) {
      return { x: this.x, y: this.y, sprite: "stand_front" };
    }
    if (this.state === "resting") {
      const kind = this.restSpot ? this.restSpot.kind : "cushion";
      if (kind === "chaise") {
        return { x: this.x + 38, y: this.y - 4, sprite: "sit_naked", pad: 14 };
      }
      if (kind === "cushion") {
        return { x: this.x, y: this.y - 4, sprite: "sit_naked" };
      }
      return { x: this.x, y: this.y, sprite: "coffee" };
    }
    if (this.state === "waiting") {
      return { x: this.x, y: this.y, sprite: this.waitingPose() };
    }
    if (this.state === "working" && !this.desk) {
      return { x: this.x, y: this.y, sprite: "briefcase" };
    }
    if (this.state === "delivering") {
      return { x: this.x, y: this.y, sprite: "documents" };
    }
    return { x: this.x, y: this.y, sprite: "stand_front" };
  }

  headPos() {
    const pose = this.visualPose();
    const sprite = SPRITES.get(pose.sprite);
    return { x: pose.x, y: pose.y - (sprite?.h || 90) + 20 };
  }

  hitBounds() {
    const pose = this.visualPose();
    const sprite = SPRITES.get(pose.sprite);
    const pad = pose.pad || 10;
    const w = Math.max(sprite?.w || 56, 56) + pad * 2;
    const h = (sprite?.h || 90) + pad * 2;
    return { x: pose.x - w / 2, y: pose.y - h + pad, w, h };
  }

  hitTest(px, py) {
    const b = this.hitBounds();
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }

  drawBubble(ctx, now) {
    // while delivering / heading to the lounge the documents pose tells the
    // story — hide the cloud so it never covers the boss
    const hidden = this.waypoints.length > 0 && (
      ["delivering", "rest_walk", "spawning", "clockout_walk", "clockout_fade", "offstage"].includes(this.state)
      || (this.state === "waiting" && this.terminalKind !== "failed")
    );
    this.bubble.visible = !hidden;
    const h = this.headPos();
    const cx = Math.max(BUBBLE.width / 2 + 6,
      Math.min(LAYOUT.W - BUBBLE.width / 2 - 6, h.x));
    this.bubble.draw(ctx, cx, h.x, h.y, now);
    if (this.state === "resting") {
      ctx.save();
      ctx.font = "bold 18px 'PingFang SC', serif";
      for (const z of this.zzz) {
        const t = z.t / 1400;
        if (t > 1) continue;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = "#4a6db5";
        ctx.strokeStyle = "#22304a";
        ctx.lineWidth = 2.5;
        const zx = z.x + t * 16, zy = z.y - t * 30;
        ctx.strokeText("Z", zx, zy);
        ctx.fillText("Z", zx, zy);
      }
      ctx.restore();
    }
    if (this.throwAnim) {
      const t = Math.min(1, (now - this.throwAnim.t0) / 650);
      const { from, to } = this.throwAnim;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - 14 - from.y) * t - 46 * Math.sin(Math.PI * t);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 5);
      ctx.fillStyle = "#f5f2e8";
      ctx.strokeStyle = "#4a3b2c";
      ctx.lineWidth = 1.5;
      ctx.fillRect(-6, -4, 12, 9);
      ctx.strokeRect(-6, -4, 12, 9);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------------ boss */
const Boss = {
  nodUntil: 0,
  nodCount: 0,
  bubble: new BossBubble(),
  nextShout: 0,

  nod(now) {
    this.nodUntil = now + 620;
  },

  update(now, anyWorking) {
    if (anyWorking) {
      if (!this.nextShout) this.nextShout = now + 12000 + Math.random() * 8000;
      if (now >= this.nextShout && now > this.bubble.until) {
        this.bubble.shout(now);
        this.nextShout = now + 20000 + Math.random() * 20000;   // 20-40s
      }
    } else {
      this.nextShout = 0;
    }
  },

  draw(ctx, now) {
    const nodding = now < this.nodUntil;
    const dy = nodding ? Math.round(Math.sin((this.nodUntil - now) / 90) * 2 + 2) : 0;
    SPRITES.draw(ctx, "boss_chair", LAYOUT.boss.x, LAYOUT.boss.chairBottom, { dy });
    SPRITES.draw(ctx, "boss", LAYOUT.boss.x, LAYOUT.boss.bossBottom, { dy });
    SPRITES.draw(ctx, "boss_desk", LAYOUT.boss.x, LAYOUT.boss.deskBottom);
    // delivered paper pile on the desk
    ctx.save();
    for (let i = 0; i < deliveredPile; i++) {
      ctx.fillStyle = "#f5f2e8";
      ctx.strokeStyle = "#8a7a5c";
      ctx.lineWidth = 1;
      const px = LAYOUT.boss.x - 128 + (i % 3) * 5;
      const py = LAYOUT.boss.deskBottom - 106 - Math.floor(i / 3) * 4;
      ctx.fillRect(px, py, 26, 5);
      ctx.strokeRect(px, py, 26, 5);
    }
    ctx.restore();
  },

  drawBubble(ctx, now) {
    this.bubble.draw(ctx, LAYOUT.boss.headX, LAYOUT.boss.headY, now);
  },
};

/* ------------------------------------------------------- office director */
function deskVariantName(deskIdx) {
  if (deskIdx == null || deskIdx < 0) return null;
  return (typeof DESK_VARIANTS !== "undefined" && DESK_VARIANTS[deskIdx])
    || `desk_variant_${deskIdx}`;
}

class Office {
  constructor() {
    this.workers = new Map();   // id -> Worker
    this.archived = new Map();  // terminal records, intentionally not visible
    this.freeDesks = [...Array(LAYOUT.desks.length).keys()];
    this.usedDesks = new Map(); // id -> deskIdx
  }

  spawn(id, name, claimDesk = true, meta = {}) {
    if (claimDesk && typeof claimDesk === "object") {
      meta = claimDesk;
      claimDesk = true;
    }
    if (this.workers.has(id)) return this.workers.get(id);
    const deskIdx = claimDesk && this.freeDesks.length ? this.freeDesks.shift() : -1;
    const w = new Worker(id, name, deskIdx, meta);
    if (deskIdx >= 0) this.usedDesks.set(id, deskIdx);
    this.workers.set(id, w);
    this.archived.delete(id);
    return w;
  }

  get(id) { return this.workers.get(id); }
  getRecord(id) { return this.workers.get(id) || this.archived.get(id) || null; }

  recordFromWorker(w, state = null) {
    return {
      id: w.id, name: w.name, state: state || (w.terminalKind || w.state),
      text: w.bubble.text || "", task: w.task, history: [...w.history],
      terminalAt: w.terminalAt, leaveAt: w.leaveAt,
      appearanceVersion: w.appearanceVersion,
      appearanceGeneration: w.appearanceGeneration,
      appearance: copyAppearance(w.appearance), visible: false,
    };
  }

  archiveSnapshot(agent) {
    const record = {
      id: agent.id, name: agent.name, state: agent.state,
      text: String(agent.text || ""), task: String(agent.task || agent.name || ""),
      history: Array.isArray(agent.history) ? [...agent.history] : [],
      terminalAt: toWallTime(agent.terminalAt), leaveAt: toWallTime(agent.leaveAt),
      appearanceVersion: agent.appearanceVersion ?? null,
      appearanceGeneration: agent.appearanceGeneration ?? null,
      appearance: normalizeAppearance(
        agent.appearance, agent.id, agent.appearanceVersion, agent.appearanceGeneration,
      ), visible: false,
    };
    this.archived.set(agent.id, record);
    return record;
  }

  updateRecord(id, patch = {}) {
    const record = this.getRecord(id);
    if (!record) return null;
    if (record instanceof Worker) {
      if (patch.text != null) record.setText(patch.text);
      if (patch.task != null) record.setTask(patch.task);
      if (patch.history != null) record.setHistory(patch.history);
      record.setServerData(patch);
      return record;
    }
    if (patch.text != null) record.text = String(patch.text);
    if (patch.state != null) record.state = String(patch.state);
    if (patch.task != null) record.task = String(patch.task);
    if (patch.history != null) record.history = [...patch.history];
    if (patch.progress != null) record.history.push(String(patch.progress));
    if (patch.terminalAt !== undefined) record.terminalAt = toWallTime(patch.terminalAt);
    if (patch.leaveAt !== undefined) record.leaveAt = toWallTime(patch.leaveAt);
    applyAppearanceUpdate(record, id, patch);
    return record;
  }

  assignDesk(w) {
    if (!w || w.desk || !this.freeDesks.length) return false;
    releaseOverflowSpot(w.id);
    const deskIdx = this.freeDesks.shift();
    w.deskIdx = deskIdx;
    w.desk = LAYOUT.desks[deskIdx];
    this.usedDesks.set(w.id, deskIdx);
    w.waypoints = w.pathTo(w.desk.x - 12, w.desk.y + 4);
    if (w.state === "working") w.state = "recalled";
    return true;
  }

  releaseDesk(id, promote = true) {
    const deskIdx = this.usedDesks.get(id);
    if (deskIdx == null) return false;
    this.usedDesks.delete(id);
    if (!this.freeDesks.includes(deskIdx)) {
      this.freeDesks.push(deskIdx);
      this.freeDesks.sort((a, b) => a - b);
    }
    const w = this.workers.get(id);
    if (w) {
      w.deskIdx = -1;
      w.desk = null;
    }
    if (promote) this.promoteWaiting();
    return true;
  }

  promoteWaiting() {
    while (this.freeDesks.length) {
      const waiting = [...this.workers.values()].find(w =>
        !w.desk && ["spawning", "working", "recalled"].includes(w.state));
      if (!waiting || !this.assignDesk(waiting)) break;
    }
  }

  complete(id, wallNow, animNow = wallNow, meta = {}) {
    if (animNow && typeof animNow === "object") {
      meta = animNow;
      animNow = wallNow;
    }
    const w = this.workers.get(id);
    if (!w) return this.updateRecord(id, meta);
    w.onCompleted(wallNow, animNow, meta);
    this.releaseDesk(id);
    return w;
  }

  fail(id, wallNow, animNow = wallNow, meta = {}) {
    if (animNow && typeof animNow === "object") {
      meta = animNow;
      animNow = wallNow;
    }
    const w = this.workers.get(id);
    if (!w) return this.updateRecord(id, meta);
    w.onFailed(wallNow, animNow, meta);
    this.releaseDesk(id);
    return w;
  }

  recall(id, meta = {}, wallNow = Date.now(), animNow = wallNow) {
    const w = this.workers.get(id);
    if (!w) {
      const old = this.archived.get(id);
      if (!old) return null;
      const baseline = { ...old, terminalAt: null, leaveAt: null };
      const fresh = this.spawn(id, meta.name || old.name, true, baseline);
      fresh.setText(meta.text ?? old.text);
      fresh.setTask(meta.task ?? old.task);
      fresh.setHistory(meta.history ?? old.history);
      fresh.setServerData(meta);
      fresh.terminalAt = null;
      fresh.leaveAt = null;
      return fresh;
    }
    if (meta.name) w.name = String(meta.name);
    if (meta.task != null) w.setTask(meta.task);
    w.onRecalled(meta, wallNow, animNow);
    if (!w.desk && !this.assignDesk(w)) {
      const spot = overflowSpot(w.id);
      w.waypoints = w.pathTo(spot.x, spot.y);
    }
    return w;
  }

  reset() {
    this.workers.clear();
    this.freeDesks = [...Array(LAYOUT.desks.length).keys()];
    this.usedDesks.clear();
    deliveryQueue.length = 0;
    restSpotOwners.clear();
    waitSpotOwners.clear();
    activeOverflowOwners.clear();
    this.archived.clear();
    deliveredPile = 0;
  }

  anyWorking() {
    return [...this.workers.values()].some(w =>
      ["working", "spawning", "delivering", "recalled"].includes(w.state));
  }

  update(now, dt, wallNow = Date.now()) {
    for (const w of [...this.workers.values()]) {
      w.update(now, dt, this.workers, wallNow);
      if (w.removeRequested && this.workers.get(w.id) === w) this.archiveWorker(w);
    }
    Boss.update(now, this.anyWorking());
  }

  archiveWorker(w) {
    const terminalState = w.state === "offstage"
      ? "offstage" : (w.terminalKind === "failed" ? "failed" : "completed");
    const record = this.recordFromWorker(w, terminalState);
    removeFromQueues(w.id);
    releaseOverflowSpot(w.id);
    this.releaseDesk(w.id, false);
    this.workers.delete(w.id);
    this.archived.set(w.id, record);
    this.promoteWaiting();
    return record;
  }

  draw(ctx, now) {
    // z-order: boss (back) -> entities sorted by feet y -> bubbles on top
    Boss.draw(ctx, now);

    const ents = [];
    ents.push({ y: LAYOUT.chaise.y, draw: () => SPRITES.draw(ctx, "chaise", LAYOUT.chaise.x, LAYOUT.chaise.y) });
    for (const c of LAYOUT.cushions) {
      ents.push({
        y: c.y,
        draw: () => {
          ctx.save();
          ctx.fillStyle = "#3e8878";
          ctx.strokeStyle = "#2b2a24";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(c.x, c.y - 8, 30, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#57a894";
          ctx.beginPath();
          ctx.ellipse(c.x - 4, c.y - 10, 18, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        },
      });
    }
    for (const b of LAYOUT.trashBins) {
      ents.push({ y: b.y, draw: () => SPRITES.draw(ctx, "trash", b.x, b.y) });
    }
    // Desks are permanent furniture; only their worker/nameplate ownership changes.
    const ownerByDesk = new Map([...this.usedDesks].map(([id, deskIdx]) => [deskIdx, id]));
    for (let deskIdx = 0; deskIdx < LAYOUT.desks.length; deskIdx++) {
      const ownerId = ownerByDesk.get(deskIdx);
      const w = ownerId ? this.workers.get(ownerId) : null;
      const d = LAYOUT.desks[deskIdx];
      ents.push({
        y: d.y,
        draw: () => {
          SPRITES.draw(ctx, deskVariantName(deskIdx), d.x, d.y);
          if (w) this.drawNameplate(ctx, w);
        },
      });
    }
    if (LAYOUT.pantryFront) {
      const pantry = LAYOUT.pantryFront;
      const p = spotPosition(pantry);
      ents.push({
        y: p.y,
        draw: () => SPRITES.draw(ctx, pantry.sprite || "pantry_front", p.x, p.y),
      });
    }
    // workers: seated ones sit on a chair in front of their desk
    for (const w of this.workers.values()) {
      const seated = w.desk && ["working"].includes(w.state);
      if (seated) {
        ents.push({
          y: w.desk.y + 16,
          draw: () => SPRITES.draw(ctx, "chair", w.desk.x - 8, w.desk.y + 18),
        });
        ents.push({ y: w.desk.y + 18, draw: () => w.drawSprite(ctx, now) });
      } else {
        ents.push({ y: w.y, draw: () => w.drawSprite(ctx, now) });
      }
    }
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    // bubbles above everything
    for (const w of this.workers.values()) w.drawBubble(ctx, now);
    Boss.drawBubble(ctx, now);
  }

  drawNameplate(ctx, w) {
    const d = w.desk;
    ctx.save();
    const label = w.name.length > 9 ? w.name.slice(0, 9) : w.name;
    ctx.font = "11px 'PingFang SC', sans-serif";
    const tw = Math.max(46, ctx.measureText(label).width + 20);
    // bottom-right corner of the desk front, clear of the seated worker
    const x = d.x + 82 - tw, y = d.y - 8;
    ctx.fillStyle = "#8a5a33";
    ctx.strokeStyle = "#4c2f1a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, tw, 16, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffe9c9";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 12, y + 8.5);
    // state LED
    const colors = {
      working: "#5fce5f", spawning: "#e8c94a", delivering: "#e8c94a",
      resting: "#6a9fd8", waiting: "#6a9fd8", clockout_walk: "#e8c94a",
      clockout_fade: "#e8c94a", offstage: "#999", failed: "#e05a4a", failed_idle: "#e05a4a",
      completed: "#e8c94a", recalled: "#5fce5f",
    };
    ctx.fillStyle = colors[w.state] || "#999";
    ctx.beginPath();
    ctx.arc(x + 7, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
