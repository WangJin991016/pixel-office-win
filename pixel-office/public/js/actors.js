/* dynamic actors: workers (subagents) and the boss (orchestrator).
   Worker animation is a small state machine driven by server events:
     spawning -> working -> (completed) delivering -> resting
     resting/working <- recalled ; working -> failed -> failed_idle
*/
"use strict";

const WALK_SPEED = 150;         // px/s
const FRAME_MS = 170;           // walk frame flip
const PRESENT_MS = 1900;        // standing at the boss with documents
const ZZZ_MS = 950;

const deliveryQueue = [];       // worker ids waiting at the boss
let deliveredPile = 0;          // paper stack on the boss desk
const restSpotOwners = new Map(); // spotIndex -> workerId

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

class Worker {
  constructor(id, name, deskIdx) {
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
    if (this.desk) {
      this.waypoints = this.pathTo(this.desk.x - 12, this.desk.y + 4);
    } else {
      // overflow: stand by the door with a briefcase
      const n = deliveryQueue.length;
      this.waypoints = [{ x: LAYOUT.door.x - 180 + (id.charCodeAt(3) % 5) * 46, y: LAYOUT.door.y - 6 }];
    }
  }

  /* ---------- movement ---------------------------------------------- */
  pathTo(x, y) {
    // L-shaped walk through the aisle so he never crosses desks
    const pts = [];
    const corr = this.y <= 567 ? 512 : 668;
    if (Math.abs(this.x - LAYOUT.aisleX) > 40) {
      pts.push({ x: this.x, y: corr });
      pts.push({ x: LAYOUT.aisleX, y: corr });
    }
    pts.push({ x: LAYOUT.aisleX, y });
    pts.push({ x, y });
    return pts;
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
  appendProgress(text) {
    text = String(text || "").replace(/\r/g, "").trim();
    if (!text) return false;
    this.history.push(text);
    return true;
  }

  onCompleted(now) {
    if (["delivering", "resting", "rest_walk"].includes(this.state)) return;
    this.state = "delivering";
    this.waypoints = this.pathTo(LAYOUT.queueSlots[0].x, LAYOUT.queueSlots[0].y);
    if (!deliveryQueue.includes(this.id)) deliveryQueue.push(this.id);
  }

  onRecalled() {
    if (this.state === "working") return;
    this.state = "recalled";
    this.bubble.mood = "normal";
    releaseRestSpot(this.id);
    this.restSpot = null;
    if (this.desk) this.waypoints = this.pathTo(this.desk.x - 12, this.desk.y + 4);
  }

  onFailed(now) {
    if (this.state === "failed" || this.state === "failed_idle") return;
    const qi = deliveryQueue.indexOf(this.id);
    if (qi >= 0) deliveryQueue.splice(qi, 1);
    this.presentUntil = 0;
    this.throwAnim = null;
    releaseRestSpot(this.id);
    this.restSpot = null;
    this.state = "failed";
    // walk to the nearest trash bin, then throw the papers away
    let bin = LAYOUT.trashBins[0];
    if (this.desk) {
      for (const b of LAYOUT.trashBins) {
        if (Math.hypot(b.x - this.desk.x, b.y - this.desk.y) <
            Math.hypot(bin.x - this.desk.x, bin.y - this.desk.y)) bin = b;
      }
    }
    this.bin = bin;
    this.waypoints = this.pathTo(bin.x - 20, bin.y + 12);
    this.bubble.mood = "error";
  }

  /* ---------- per-frame update -------------------------------------- */
  update(now, dt, workers) {
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
        const slot = LAYOUT.queueSlots[Math.min(qi, LAYOUT.queueSlots.length - 1)];
        if (Math.abs(this.x - slot.x) > 2 || Math.abs(this.y - slot.y) > 2) {
          this.waypoints = [{ x: slot.x, y: slot.y }];
          break;
        }
        if (qi === 0) {
          if (!this.presentUntil) this.presentUntil = now + PRESENT_MS;
          if (now >= this.presentUntil) {
            deliveryQueue.shift();
            this.presentUntil = 0;
            deliveredPile = Math.min(deliveredPile + 1, 6);
            Boss.nod(now);
            this.state = "rest_walk";
            this.restSpot = claimRestSpot(this.id);
            const s = this.restSpot;
            const standX = s.kind === "chaise" ? s.x - 46 : s.x;
            this.waypoints = this.pathTo(standX, s.y);
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
      case "recalled":
        if (!this.moveStep(now, dt)) this.state = "working";
        break;
      case "failed": {
        if (this.moveStep(now, dt)) break;
        if (!this.throwAnim) {
          this.throwAnim = { t0: now, from: { x: this.x + 8, y: this.y - 44 }, to: this.bin };
        }
        if (now - this.throwAnim.t0 > 650) {
          this.throwAnim = null;
          this.state = "failed_back";
          if (this.desk) this.waypoints = this.pathTo(this.desk.x - 12, this.desk.y + 4);
          else this.state = "failed_idle";
        }
        break;
      }
      case "failed_back":
        if (!this.moveStep(now, dt)) this.state = "failed_idle";
        break;
      case "failed_idle":
        break;
    }
  }

  /* ---------- drawing ------------------------------------------------ */
  drawSprite(ctx, now) {
    const walking = this.waypoints.length > 0 &&
      ["spawning", "delivering", "rest_walk", "recalled", "failed", "failed_back"].includes(this.state);

    if (walking) {
      const dx = this.waypoints[0].x - this.x;
      const dy = this.waypoints[0].y - this.y;
      let name;
      if (Math.abs(dx) >= Math.abs(dy)) {
        name = this.frame ? "walk_side_a" : "walk_side_b";
        SPRITES.draw(ctx, name, this.x, this.y, { flip: this.facing === 1, alpha: this.alpha });
      } else {
        name = dy < 0 ? "walk_back" : "walk_front";
        // subtle 2-frame hop so vertical walks don't look static
        SPRITES.draw(ctx, name, this.x, this.y + (this.frame ? -2 : 0), { alpha: this.alpha });
      }
      return;
    }

    switch (this.state) {
      case "delivering": {
        // standing in front of the boss holding the documents
        SPRITES.draw(ctx, "documents", this.x, this.y);
        break;
      }
      case "failed": {
        SPRITES.draw(ctx, "documents", this.x, this.y);
        break;
      }
      case "resting": {
        // lounging depends on the spot: chaise tilt / cushion sit / coffee stand
        const kind = this.restSpot ? this.restSpot.kind : "cushion";
        if (kind === "chaise") {
          SPRITES.draw(ctx, "sit_naked", this.x + 38, this.y - 4, { rotate: -0.16 });
        } else if (kind === "cushion") {
          SPRITES.draw(ctx, "sit_naked", this.x, this.y - 4);
        } else {
          SPRITES.draw(ctx, "coffee", this.x, this.y);
        }
        break;
      }
      case "failed_idle": {
        // face-down on the desk: slumped low, only the back of the head shows
        if (this.desk) SPRITES.draw(ctx, "upper_back", this.desk.x - 8, this.desk.y - 18);
        else SPRITES.draw(ctx, "stand_front", this.x, this.y);
        break;
      }
      case "working": {
        if (this.desk) {
          const bob = Math.sin(this.bobT / 140) * 1.6;
          SPRITES.draw(ctx, "upper_back", this.desk.x - 8, this.desk.y + 2 + bob);
        } else {
          SPRITES.draw(ctx, "briefcase", this.x, this.y);
        }
        break;
      }
      default:
        SPRITES.draw(ctx, "stand_front", this.x, this.y, { alpha: this.alpha });
    }
  }

  visualPose() {
    const walking = this.waypoints.length > 0 &&
      ["spawning", "delivering", "rest_walk", "recalled", "failed", "failed_back"].includes(this.state);
    if (walking) return { x: this.x, y: this.y, sprite: "walk_front" };
    if (this.state === "working" && this.desk) {
      return { x: this.desk.x - 8, y: this.desk.y + 2, sprite: "upper_back" };
    }
    if (this.state === "failed_idle" && this.desk) {
      return { x: this.desk.x - 8, y: this.desk.y - 18, sprite: "upper_back" };
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
    if (this.state === "working" && !this.desk) {
      return { x: this.x, y: this.y, sprite: "briefcase" };
    }
    if (this.state === "delivering" || this.state === "failed") {
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
    const hidden = ["delivering", "rest_walk", "spawning"].includes(this.state)
      && this.waypoints.length > 0;
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
class Office {
  constructor() {
    this.workers = new Map();   // id -> Worker
    this.freeDesks = [...Array(LAYOUT.desks.length).keys()];
    this.usedDesks = new Map(); // id -> deskIdx
  }

  spawn(id, name) {
    if (this.workers.has(id)) return this.workers.get(id);
    const deskIdx = this.freeDesks.length ? this.freeDesks.shift() : -1;
    const w = new Worker(id, name, deskIdx);
    if (deskIdx >= 0) this.usedDesks.set(id, deskIdx);
    this.workers.set(id, w);
    return w;
  }

  get(id) { return this.workers.get(id); }

  reset() {
    this.workers.clear();
    this.freeDesks = [...Array(LAYOUT.desks.length).keys()];
    this.usedDesks.clear();
    deliveryQueue.length = 0;
    restSpotOwners.clear();
    deliveredPile = 0;
  }

  anyWorking() {
    return [...this.workers.values()].some(w =>
      ["working", "spawning", "delivering", "recalled"].includes(w.state));
  }

  update(now, dt) {
    for (const w of this.workers.values()) w.update(now, dt, this.workers);
    Boss.update(now, this.anyWorking());
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
    // every occupied desk is its own entity
    for (const [id, deskIdx] of this.usedDesks) {
      const w = this.workers.get(id);
      const d = LAYOUT.desks[deskIdx];
      ents.push({
        y: d.y,
        draw: () => {
          SPRITES.draw(ctx, "desk", d.x, d.y);
          if (w) this.drawNameplate(ctx, w);
        },
      });
    }
    // workers: seated ones sit on a chair in front of their desk
    for (const w of this.workers.values()) {
      const seated = w.desk && ["working", "failed_idle"].includes(w.state);
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
      resting: "#6a9fd8", failed: "#e05a4a", failed_idle: "#e05a4a",
      completed: "#e8c94a", recalled: "#5fce5f",
    };
    ctx.fillStyle = colors[w.state] || "#999";
    ctx.beginPath();
    ctx.arc(x + 7, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
