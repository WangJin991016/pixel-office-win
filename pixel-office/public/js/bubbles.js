/* speech bubbles: worker cloud bubble (3-line scroll, strict clipping)
   and boss square shout bubble. Text NEVER escapes the shape interior:
   drawing is clipped to the bubble path and the text box is inset. */
"use strict";

const BUBBLE_FONT = "13px 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
const BOSS_FONT = "bold 15px 'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";

const BUBBLE = {
  width: 212,
  padX: 16,
  padY: 12,
  lineH: 17,
  maxLines: 3,
  scrollMs: 1500,      // dwell per line when scrolling
  scrollAnimMs: 320,
};

function isCJK(ch) {
  return /[　-鿿豈-﫿＀-￯]/.test(ch);
}

/** wrap text into lines that fit maxW; CJK breaks per char, latin per word */
function wrapText(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split("\n")) {
    if (!para) { lines.push(""); continue; }
    let cur = "";
    // tokenize: latin words (with trailing space) or single CJK/punct chars
    const tokens = para.match(/[A-Za-z0-9_'./:#-]+\s*|\s+|./gu) || [];
    for (const tk of tokens) {
      const probe = cur + tk;
      if (cur && ctx.measureText(probe).width > maxW) {
        lines.push(cur.replace(/\s+$/, ""));
        cur = tk.replace(/^\s+/, "");
        // token itself too long (rare): hard-break it
        while (ctx.measureText(cur).width > maxW && cur.length > 1) {
          let n = cur.length - 1;
          while (n > 1 && ctx.measureText(cur.slice(0, n)).width > maxW) n--;
          lines.push(cur.slice(0, n));
          cur = cur.slice(n);
        }
      } else {
        cur = probe;
      }
    }
    if (cur) lines.push(cur.replace(/\s+$/, ""));
  }
  return lines;
}

/** build a cloud path: rounded body + three bumps + tail toward (tx,ty) */
function cloudPath(cx, top, w, h, tx, ty, inflate = 0) {
  const p = new Path2D();
  const r = 16 + inflate;
  const x = cx - w / 2 - inflate, y = top - inflate;
  const bw = w + inflate * 2, bh = h + inflate * 2;
  // body
  p.moveTo(x + r, y);
  p.lineTo(x + bw - r, y);
  p.arcTo(x + bw, y, x + bw, y + r, r);
  p.lineTo(x + bw, y + bh - r);
  p.arcTo(x + bw, y + bh, x + bw - r, y + bh, r);
  p.lineTo(x + r, y + bh);
  p.arcTo(x, y + bh, x, y + bh - r, r);
  p.lineTo(x, y + r);
  p.arcTo(x, y, x + r, y, r);
  p.closePath();
  // bumps on top
  const bumps = [ [0.26, 13], [0.5, 17], [0.74, 12] ];
  for (const [fx, br] of bumps) {
    const bx = cx - w / 2 + w * fx, by = top + 2;
    const R = br + inflate;
    p.moveTo(bx + R, by);
    p.arc(bx, by, R, 0, Math.PI * 2);
  }
  // tail circles down toward the speaker
  const dx = tx - cx, dy = ty - (top + h);
  const steps = Math.max(2, Math.min(4, Math.round(dy / 12)));
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const bx = cx + dx * t, by = top + h + dy * t;
    const br = 6 - i * 1.2 + (i === 1 ? inflate : 0);
    if (br <= 1.5) break;
    p.moveTo(bx + br, by);
    p.arc(bx, by, br, 0, Math.PI * 2);
  }
  return p;
}

class CloudBubble {
  constructor() {
    this.text = "";
    this.lines = [];
    this.scrollIdx = 0;        // first visible line
    this.scrollAnim = 0;       // 0..1 while animating
    this.lastScroll = 0;
    this.visible = true;
    this.mood = "normal";      // normal | error | dim
    this.bounds = null;        // for click hit-test
    this.dirty = true;
  }

  setText(text) {
    if (text === this.text) return;
    this.text = text;
    this.dirty = true;
    // jump scroll to show the newest content
    this._needsSnap = true;
  }

  rewrap(ctx) {
    ctx.save();
    ctx.font = BUBBLE_FONT;
    this.lines = wrapText(ctx, this.text, BUBBLE.width - BUBBLE.padX * 2);
    ctx.restore();
    if (this._needsSnap) {
      this.scrollIdx = Math.max(0, this.lines.length - BUBBLE.maxLines);
      this._needsSnap = false;
    }
    this.dirty = false;
  }

  update(now) {
    const extra = this.lines.length - BUBBLE.maxLines;
    if (extra <= 0) return;
    if (this.scrollAnim > 0) {
      this.scrollAnim = Math.min(1, this.scrollAnim + 16 / BUBBLE.scrollAnimMs);
      return;
    }
    if (now - this.lastScroll > BUBBLE.scrollMs) {
      this.lastScroll = now;
      this.scrollAnim = 0.0001;
      this.scrollIdx = (this.scrollIdx + 1) % (extra + 1);
    }
  }

  draw(ctx, cx, headX, headY, now) {
    if (!this.visible || !this.text) { this.bounds = null; return; }
    if (this.dirty) this.rewrap(ctx);
    const maxTextW = BUBBLE.width - BUBBLE.padX * 2;
    const innerH = BUBBLE.maxLines * BUBBLE.lineH + BUBBLE.padY * 2;
    const bodyW = BUBBLE.width;
    const bodyH = innerH + 6;
    const top = headY - 116 - bodyH;        // bubble sits above the head
    const outlineCol = this.mood === "error" ? "#a03a2a" : "#4a3b2c";
    const fillCol = this.mood === "error" ? "#ffdcd2"
      : this.mood === "dim" ? "rgba(247,240,226,0.88)" : "#fffdf2";

    ctx.save();
    // two-pass draw: inflated silhouette in outline color, then normal fill —
    // fills merge into a clean cloud with no interior seam lines
    ctx.fillStyle = outlineCol;
    ctx.fill(cloudPath(cx, top, bodyW, bodyH, headX, headY - 20, 3));
    const path = cloudPath(cx, top, bodyW, bodyH, headX, headY - 20);
    ctx.fillStyle = fillCol;
    ctx.fill(path);

    // clip text to the cloud interior (never overflows)
    ctx.clip(path);
    ctx.font = BUBBLE_FONT;
    ctx.fillStyle = this.mood === "error" ? "#7c2418" : "#3a2f28";
    ctx.textBaseline = "top";

    const n = BUBBLE.maxLines;
    const total = this.lines.length;
    const extra = total - n;
    let firstLine = Math.min(this.scrollIdx, Math.max(0, extra));
    let yOff = 0;
    if (this.scrollAnim > 0) {
      const t = 1 - Math.pow(1 - this.scrollAnim, 3);
      yOff = -BUBBLE.lineH * t;
      if (this.scrollAnim >= 1) { this.scrollAnim = 0; }
      firstLine = Math.max(0, firstLine - 1);
    }
    const textX = cx - maxTextW / 2;
    for (let i = 0; i < n + 1; i++) {
      const li = firstLine + i;
      if (li >= total) break;
      let s = this.lines[li];
      const y = top + BUBBLE.padY + 3 + i * BUBBLE.lineH + yOff;
      if (y > top + bodyH - BUBBLE.padY) break;
      // last visible line with more below gets an ellipsis
      if (i === n - 1 && li < total - 1 && this.scrollAnim === 0) {
        while (s && ctx.measureText(s + "…").width > maxTextW) s = s.slice(0, -1);
        s += "…";
      }
      ctx.fillText(s, textX, y);
    }
    ctx.restore();

    this.bounds = { x: cx - bodyW / 2, y: top - 18, w: bodyW, h: bodyH + 40 };
  }

  hitTest(px, py) {
    const b = this.bounds;
    return !!b && px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }
}

/* ------------------------------------------------ boss square shout bubble */
const BOSS_PHRASES = [
  "你不干有的是智能体干",
  "快点，要是不会让AI干啊",
  "我们要提质增效",
  "干完这个任务，提升你为部门经理！",
];

class BossBubble {
  constructor() {
    this.text = null;
    this.until = 0;
    this.since = 0;
    this.pool = [];
  }

  shout(now, ms = 3600) {
    if (!this.pool.length) this.pool = [...BOSS_PHRASES];
    const i = Math.floor(Math.random() * this.pool.length);
    this.text = this.pool.splice(i, 1)[0];
    this.since = now;
    this.until = now + ms;
  }

  draw(ctx, headX, headY, now) {
    if (!this.text || now > this.until) return;
    const age = now - this.since;
    const pop = age < 180 ? 0.6 + 0.4 * (age / 180) : 1;
    ctx.save();
    ctx.font = BOSS_FONT;
    const tw = ctx.measureText(this.text).width;
    const w = Math.min(tw + 30, 300), h = 40;
    // Align the shout-tail tip with the boss's head instead of placing the
    // bubble in a detached fixed corner.
    const bx = Math.max(8, Math.min(1280 - w - 8, headX - w * 0.24));
    const by = Math.max(8, headY - h - 22);
    ctx.translate(bx + w / 2, by + h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-(bx + w / 2), -(by + h / 2));

    const rrect = (inset) => {
      const p = new Path2D();
      const r = 9 - inset * 0.5;
      const x0 = bx + inset, y0 = by + inset, x1 = bx + w - inset, y1 = by + h - inset;
      p.moveTo(x0 + r, y0);
      p.lineTo(x1 - r, y0);
      p.arcTo(x1, y0, x1, y0 + r, r);
      p.lineTo(x1, y1 - r);
      p.arcTo(x1, y1, x1 - r, y1, r);
      p.lineTo(x0 + r, y1);
      p.arcTo(x0, y1, x0, y1 - r, r);
      p.lineTo(x0, y0 + r);
      p.arcTo(x0, y0, x0 + r, y0, r);
      p.closePath();
      return p;
    };
    const spike = (grow) => {
      const p = new Path2D();
      p.moveTo(bx + w * 0.32 - grow, by + h - 2);
      p.lineTo(bx + w * 0.24, by + h + 17 + grow);
      p.lineTo(bx + w * 0.42 + grow, by + h - 2);
      p.closePath();
      return p;
    };
    // outline pass then fill pass (merged silhouette, no seam)
    ctx.fillStyle = "#8a4a1f";
    ctx.fill(rrect(-3)); ctx.fill(spike(3));
    ctx.fillStyle = "#ffedc4";
    const body = rrect(0);
    ctx.fill(body); ctx.fill(spike(0));

    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = "#6d2f10";
    ctx.textBaseline = "middle";
    let text = this.text, maxW = w - 26;
    while (text.length > 2 && ctx.measureText(text).width > maxW) text = text.slice(0, -1);
    if (text !== this.text) text = text.slice(0, -1) + "…";
    ctx.fillText(text, bx + w / 2 - ctx.measureText(text).width / 2, by + h / 2 + 1);
    ctx.restore();
    ctx.restore();
  }
}
