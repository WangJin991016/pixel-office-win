#!/usr/bin/env node
/**
 * pixel-office bridge server (zero-dependency Node).
 *
 * - Serves the office web page from ../public
 * - Tails ~/.codex/sessions rollout JSONL files to track subagents:
 *     root file:  spawn_agent calls, sub_agent_activity events
 *     agent file: assistant messages (streaming output), task_complete
 * - Pushes state to the page over SSE.
 *
 * Usage:
 *   node server.mjs [--port 8791] [--demo] [--replay FILE [--speed N]]
 *                   [--sessions-dir DIR]
 */
"use strict";

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : dflt;
}
const PORT = Number(opt("port", 8791));
const DEMO = args.includes("--demo");
const REPLAY = opt("replay", null);
const SPEED = Number(opt("speed", 20));
const SESSIONS_DIR = opt("sessions-dir", path.join(os.homedir(), ".codex", "sessions"));

const PUBLIC = path.join(__dirname, "..", "public");
const POLL_MS = 700;
const OUTPUT_THROTTLE_MS = 450;
const MAX_TEXT = 2400;

// ---------------------------------------------------------------- state
/** agents: Map<id, {id, name, threadId, state, text, task, history, spawnedAt}> */
const agents = new Map();
let sessionActive = false;
let sessionLabel = "";
let seq = 0;

const sseClients = new Set();

function broadcast(type, data) {
  const msg = `data: ${JSON.stringify({ type, ...data, seq: ++seq })}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

function snapshot() {
  return {
    agents: [...agents.values()].map(a => ({
      id: a.id, name: a.name, state: a.state, text: a.text,
      task: a.task, history: [...(a.history || [])],
    })),
    sessionActive, sessionLabel, demo: DEMO || !!REPLAY,
  };
}

function setAgent(id, patch) {
  const a = agents.get(id);
  if (!a) return;
  Object.assign(a, patch);
}

// ------------------------------------------------------- agent lifecycle
let anonCounter = 0;
const FAILURE_AGENT_STATES = new Set(["failed", "failed_idle"]);
const INACTIVE_AGENT_STATES = new Set(["resting", "failed", "failed_idle"]);
const pendingSpawns = new Map(); // spawn call id -> {task}

function readableTask(value) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\r/g, "").trim();
  // Recent Codex builds encrypt the spawn message in rollout logs.
  if (!text || /^gAAAA[A-Za-z0-9_-]{40,}$/.test(text)) return "";
  return text;
}

function onSpawnHint(callId, params) {
  // spawn_agent call is only a hint; the sub_agent_activity "started" event
  // arrives a moment later with thread id + name and creates the actor.
  const taskName = String(params.task_name || "").trim();
  const task = readableTask(params.message) || taskName;
  if (callId) pendingSpawns.set(String(callId), { task });
  console.log("[pixel-office] spawn hint:", taskName);
}

function onActivity(ev) {
  const threadId = ev.agent_thread_id;
  const name = (ev.agent_path || "").split("/").filter(Boolean).pop() || "agent-" + ++anonCounter;
  const kind = String(ev.kind || "").toLowerCase();
  const hint = kind === "started" ? pendingSpawns.get(String(ev.event_id || "")) : null;
  let a = [...agents.values()].find(x => x.threadId === threadId);
  if (!a) {
    a = {
      id: "ag-" + String(threadId || Date.now()).replace(/-/g, "").slice(-8), name, threadId,
      state: "working", text: "开始干活…", task: hint?.task || name,
      history: [], spawnedAt: Date.now(),
    };
    agents.set(a.id, a);
    broadcast("spawn", { id: a.id, name, state: "working", task: a.task });
  } else if (hint?.task && hint.task !== a.task) {
    setAgent(a.id, { task: hint.task });
    broadcast("task", { id: a.id, task: hint.task });
  }
  if (hint) pendingSpawns.delete(String(ev.event_id || ""));
  if (kind === "started") {
    // A duplicate/late started event must not revive an already failed worker.
    if (!FAILURE_AGENT_STATES.has(a.state)) {
      setAgent(a.id, { state: "working", text: a.text === "报到中…" ? "开始干活…" : a.text });
      broadcast("state", { id: a.id, state: "working" });
    }
  } else if (kind === "interacted") {
    // new work for an existing agent -> recall from the lounge
    setAgent(a.id, { state: "working" });
    broadcast("state", { id: a.id, state: "recalled" });
  } else if (kind && /complete|finish|done|closed/i.test(kind)) {
    // completion usually arrives via the agent's own file; accept either
    if (!INACTIVE_AGENT_STATES.has(a.state)) {
      setAgent(a.id, { state: "completed" });
      broadcast("state", { id: a.id, state: "completed" });
    }
  } else if (kind && /error|fail|abort|interrupt|pause|cancel|stop|terminat|crash|exception/i.test(kind)) {
    onAgentFailed(a, kind);
  }
}

let lastOutputPush = new Map();
function onAgentText(a, text, meta = {}) {
  if (!a || !text) return;
  text = String(text).replace(/\r/g, "").trim();
  if (!text) return;
  const now = Date.now();
  const recordAt = Number.isFinite(meta.at) ? meta.at : now;
  const source = String(meta.source || "");
  const history = a.history || (a.history = []);
  // The same message is normally written through response_item and
  // agent_message. Suppress only that cross-channel twin (plus the
  // task_complete echo), while preserving a real repeated message later.
  const sameAsLast = history.at(-1) === text;
  const crossChannelTwin = sameAsLast && source && a.lastHistorySource
    && source !== a.lastHistorySource
    && Math.abs(recordAt - (a.lastHistoryAt || 0)) <= 1000;
  if ((source === "task_complete" && sameAsLast) || crossChannelTwin) return;
  history.push(text);
  a.lastHistoryAt = recordAt;
  a.lastHistorySource = source;
  broadcast("progress", { id: a.id, text });

  if (text.length > MAX_TEXT) text = text.slice(-MAX_TEXT);
  const prev = a.text;
  setAgent(a.id, { text });
  const last = lastOutputPush.get(a.id) || 0;
  if (now - last >= OUTPUT_THROTTLE_MS && text !== prev) {
    lastOutputPush.set(a.id, now);
    broadcast("output", { id: a.id, text });
  }
}

function onAgentComplete(a, summary, at) {
  if (!a) return;
  // A failure/interruption can be followed by a late task_complete line.
  if (a.state === "failed" || a.state === "failed_idle") return;
  if (summary) onAgentText(a, summary, { at, source: "task_complete" });
  if (a.state !== "resting") {
    setAgent(a.id, { state: "completed" });
    broadcast("state", { id: a.id, state: "completed", summary: a.text });
  }
}

function onAgentFailed(a, reason = "") {
  if (!a || FAILURE_AGENT_STATES.has(a.state)) return;
  reason = String(reason || "").trim();
  if (reason) onAgentText(a, `任务失败：${reason}`);
  setAgent(a.id, { state: "failed" });
  const event = { id: a.id, state: "failed" };
  if (reason) event.reason = reason;
  broadcast("state", event);
}

function onRootFailed(reason = "") {
  for (const a of agents.values()) {
    if (!INACTIVE_AGENT_STATES.has(a.state)) onAgentFailed(a, reason);
  }
}

function onRootComplete() {
  sessionActive = false;
  broadcast("session", { active: false });
}

// ---------------------------------------------------------------- tailing
const fileOffsets = new Map();      // file -> bytes read
let rootFile = null;
let rootId = null;
let lastIndexBuild = 0;

/** session index: sessionId -> {file, isSub, parent, agentPath, nick, mtime} */
const sessionIndex = new Map();

function recentDirs() {
  // sessions/YYYY/MM/DD for the last few days
  const out = [];
  const now = new Date();
  for (let back = 0; back < 4; back++) {
    const d = new Date(now.getTime() - back * 864e5);
    const p = path.join(
      SESSIONS_DIR,
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    );
    if (fs.existsSync(p)) out.push(p);
  }
  return out;
}

function listRollouts(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(f => f.startsWith("rollout-") && f.endsWith(".jsonl"))
      .map(f => path.join(dir, f));
  } catch { return []; }
}

/** index every rollout by its session_meta first line (cheap: 1 line each) */
function rebuildIndex() {
  for (const dir of recentDirs()) {
    for (const f of listRollouts(dir)) {
      let m;
      try { m = fs.statSync(f).mtimeMs; } catch { continue; }
      const old = sessionIndex.get(fileIdFromName(f));
      if (old && old.mtime === m) continue;
      let meta = null;
      try {
        const fd = fs.openSync(f, "r");
        const buf = Buffer.alloc(262144);
        const n = fs.readSync(fd, buf, 0, 262144, 0);
        fs.closeSync(fd);
        const firstLine = buf.toString("utf8", 0, n).split("\n")[0];
        const rec = safeParse(firstLine);
        if (rec && rec.payload && rec.type === "session_meta") meta = rec.payload;
      } catch { /* unreadable */ }
      if (!meta) continue;
      const sub = meta.thread_source === "subagent"
        || (meta.source && typeof meta.source === "object" && meta.source.subagent);
      const spawn = meta.source && meta.source.subagent
        ? meta.source.subagent.thread_spawn : null;
      // NB: in a subagent thread file, session_id is the PARENT session and
      // `id` is the thread's own id. Root files have id === session_id.
      const ownId = meta.id || meta.session_id;
      sessionIndex.set(ownId, {
        file: f, isSub: !!sub,
        parent: spawn ? spawn.parent_thread_id : null,
        agentPath: spawn ? spawn.agent_path : null,
        nick: spawn ? spawn.agent_nickname : null,
        bornAt: meta.timestamp ? new Date(meta.timestamp).getTime() : 0,
        mtime: m,
      });
    }
  }
  lastIndexBuild = Date.now();
}

function fileIdFromName(f) {
  const m = /rollout-.*-([0-9a-f-]{36})\.jsonl$/.exec(f);
  return m ? m[1] : f;
}

function readNewLines(file) {
  let stat;
  try { stat = fs.statSync(file); } catch { return []; }
  let off = fileOffsets.get(file);
  if (off == null) off = 0;                    // tail from start (file may predate us)
  if (stat.size < off) off = 0;                // truncated/rotated
  if (stat.size === off) return [];
  const fd = fs.openSync(file, "r");
  const len = stat.size - off;
  const buf = Buffer.alloc(len);
  fs.readSync(fd, buf, 0, len, off);
  fs.closeSync(fd);
  fileOffsets.set(file, stat.size);
  return buf.toString("utf8").split("\n").filter(l => l.trim());
}

function safeParse(line) {
  try { return JSON.parse(line); } catch { return null; }
}

/** Extract display text from a message-ish payload. */
function payloadText(p) {
  if (!p || typeof p !== "object") return "";
  if (typeof p.text === "string") return p.text;
  if (typeof p.message === "string") return p.message;
  if (Array.isArray(p.content)) {
    return p.content
      .map(c => (c && (c.text || c.output_text)) || "")
      .filter(Boolean).join("\n");
  }
  return "";
}

function processRootLine(line) {
  const rec = safeParse(line);
  if (!rec) return;
  const p = rec.payload;
  if (!p) return;

  if (rec.type === "session_meta") {
    sessionLabel = `${p.cwd ? path.basename(p.cwd) : "session"} · ${p.cli_version || ""}`.trim();
    sessionActive = true;
    return;
  }
  if (rec.type === "response_item" && p.type === "function_call"
      && p.namespace === "collaboration" && p.name === "spawn_agent") {
    try {
      const a = typeof p.arguments === "string"
        ? JSON.parse(p.arguments || "{}") : (p.arguments || {});
      onSpawnHint(p.call_id, a);
    } catch { /* encrypted arg blob: ignore */ }
    return;
  }
  if (p.type === "sub_agent_activity") {
    onActivity(p);
    return;
  }
  if (rec.type === "event_msg" && p.type === "turn_aborted") {
    onRootFailed(p.reason || "interrupted");
    onRootComplete();
    return;
  }
  if (rec.type === "event_msg" && p.type === "error") {
    onRootFailed(p.message || "error");
    onRootComplete();
    return;
  }
  if (p.type === "task_complete" && rec.type === "event_msg") {
    // root session finished a turn (not necessarily the whole session)
    onRootComplete();
    return;
  }
}

function processAgentLine(a, line) {
  const rec = safeParse(line);
  if (!rec || !rec.payload) return;
  const p = rec.payload;
  const recordAt = rec.timestamp ? new Date(rec.timestamp).getTime() : Date.now();
  if (rec.type === "response_item" && p.type === "function_call"
      && p.namespace === "collaboration" && p.name === "spawn_agent") {
    try {
      const params = typeof p.arguments === "string"
        ? JSON.parse(p.arguments || "{}") : (p.arguments || {});
      onSpawnHint(p.call_id, params);
    } catch { /* malformed/encrypted argument envelope: ignore */ }
    return;
  }
  if (p.type === "sub_agent_activity") {
    onActivity(p);
    return;
  }
  if (p.type === "turn_aborted") {
    onAgentFailed(a, p.reason || "interrupted");
    return;
  }
  if (p.type === "error") {
    onAgentFailed(a, p.message || "error");
    return;
  }
  if (p.type === "task_complete") {
    onAgentComplete(a, p.last_agent_message, recordAt);
    return;
  }
  if (rec.type === "response_item" && p.type === "message" && p.role === "assistant") {
    const t = payloadText(p);
    if (t) onAgentText(a, t, { at: recordAt, source: "response_item" });
    return;
  }
  if (p.type === "agent_message") {
    const t = payloadText(p);
    if (t) onAgentText(a, t, { at: recordAt, source: "agent_message" });
  }
}

/** register a newly discovered subagent file belonging to our session tree */
function discoverSubagent(id, info) {
  let a = [...agents.values()].find(x => x.threadId === id);
  if (a) return a;
  const name = (info.agentPath || "").split("/").filter(Boolean).pop()
    || info.nick || "agent-" + ++anonCounter;
  a = {
    id: "ag-" + String(id).replace(/-/g, "").slice(-8), name, threadId: id,
    state: "working", text: "开始干活…", task: name,
    history: [], spawnedAt: Date.now(),
  };
  agents.set(a.id, a);
  broadcast("spawn", { id: a.id, name, state: "working", task: a.task });
  return a;
}

function belongsToTree(info) {
  // depth-1: parent is the root; deeper: parent is a known subagent
  if (!info.parent) return false;
  if (info.parent === rootId) return true;
  return [...agents.values()].some(x => x.threadId === info.parent);
}

function processAgentLineSince(a, line, sinceMs) {
  // a subagent thread file begins with the forked parent context (old
  // timestamps) — skip anything older than the thread's own birth
  if (sinceMs) {
    const t = lineTs(line);
    if (t && t < sinceMs - 2000) return;
  }
  processAgentLine(a, line);
}

function lineTs(line) {
  const m = /"timestamp":"([^"]+)"/.exec(line);
  return m ? new Date(m[1]).getTime() : 0;
}

function poll() {
  if (Date.now() - lastIndexBuild > 5000) rebuildIndex();

  // the root session = newest non-subagent rollout
  let newest = null, newestM = 0, newestId = null;
  for (const [id, info] of sessionIndex) {
    if (!info.isSub && info.mtime > newestM) { newestM = info.mtime; newest = info.file; newestId = id; }
  }
  if (newest && (newest !== rootFile)) {
    const switching = rootFile !== null;
    rootFile = newest; rootId = newestId;
    fileOffsets.set(rootFile, 0);
    if (switching) {
      agents.clear();
      pendingSpawns.clear();
      broadcast("reset", {});
    }
    sessionActive = true;
  }
  if (rootFile) {
    for (const line of readNewLines(rootFile)) processRootLine(line);
  }
  // subagents: discover via the index (parent chain), then tail their files
  for (const [id, info] of sessionIndex) {
    if (!info.isSub || !belongsToTree(info)) continue;
    const a = discoverSubagent(id, info);
    for (const line of readNewLines(info.file)) processAgentLineSince(a, line, info.bornAt);
  }
}

// ---------------------------------------------------------------- replay
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function replay(file, speed) {
  console.log(`[pixel-office] replaying ${file} at ${speed}x`);
  const rootRec = safeParse(fs.readFileSync(file, "utf8").split("\n")[0]);
  const replayRootId = rootRec && rootRec.payload && rootRec.payload.session_id;

  // find subagent thread files (same period dirs) whose parent is this root
  const subFiles = new Map();   // tid -> {file, bornAt}
  for (const dir of recentDirs()) {
    for (const f of listRollouts(dir)) {
      if (f === file) continue;
      try {
        const fd = fs.openSync(f, "r");
        const buf = Buffer.alloc(262144);
        const n = fs.readSync(fd, buf, 0, 262144, 0);
        fs.closeSync(fd);
        const rec = safeParse(buf.toString("utf8", 0, n).split("\n")[0]);
        const meta = rec && rec.payload;
        if (meta && rec && rec.type === "session_meta") {
          const spawn = meta.source && meta.source.subagent
            ? meta.source.subagent.thread_spawn : null;
          if (spawn && spawn.parent_thread_id === replayRootId) {
            // subagent file: session_id = parent session, id = own thread id
            subFiles.set(meta.id || meta.session_id, {
              file: f,
              bornAt: meta.timestamp ? new Date(meta.timestamp).getTime() : 0,
            });
          }
        }
      } catch { /* skip */ }
    }
  }
  console.log(`[pixel-office] found ${subFiles.size} subagent thread(s)`);

  // merge every line (root + subagent files), sorted by timestamp, one pass.
  // subagent lines older than the thread's birth are the forked parent
  // context — skip them, they are not this agent's own output.
  const tagged = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.trim()) tagged.push({ line, tid: null, bornAt: 0 });
  }
  for (const [tid, info] of subFiles) {
    for (const line of fs.readFileSync(info.file, "utf8").split("\n")) {
      if (line.trim()) tagged.push({ line, tid, bornAt: info.bornAt });
    }
  }
  const parsed = tagged
    .map(t => ({ ...t, rec: safeParse(t.line) }))
    .filter(t => t.rec && t.rec.timestamp)
    .filter(t => !t.tid || new Date(t.rec.timestamp).getTime() >= t.bornAt - 2000)
    .sort((a, b) => new Date(a.rec.timestamp) - new Date(b.rec.timestamp));

  sessionActive = true;
  let prevT = null, wall0 = Date.now(), t0 = null;
  let matched = 0, dropped = 0;
  for (const { rec, tid } of parsed) {
    const t = new Date(rec.timestamp).getTime();
    if (t0 === null) { t0 = t; wall0 = Date.now(); prevT = t; }
    let wait = (t - t0) / speed - (Date.now() - wall0);
    if (t - prevT > 120000) wait = Math.min(wait, 1200);   // compress idle gaps
    prevT = t;
    if (wait > 0) await sleep(wait);

    if (tid === null) {
      processRootLine(JSON.stringify(rec));
    } else {
      const a = [...agents.values()].find(x => x.threadId === tid);
      if (a) { matched++; processAgentLine(a, JSON.stringify(rec)); }
      else {
        dropped++;
        if (dropped <= 3) console.log("[replay] no agent for tid", tid, "have:", [...agents.values()].map(x => x.threadId));
      }
    }
  }
  console.log(`[pixel-office] replay finished (agent lines matched: ${matched}, dropped: ${dropped})`);
}

// ---------------------------------------------------------------- demo
const DEMO_AGENTS = [
  {
    name: "需求分析", delay: 1.5, fail: false,
    task: "拆解需求、识别边界条件并输出优先级明确的分析结果",
    lines: [
      "正在阅读需求文档……", "梳理出 3 个核心子任务", "发现边界条件：并发交付时的排序问题",
      "输出需求拆解文档 v1", "交叉检查与老板目标的偏差……",
    ],
    final: "需求拆解完成：3 个子任务，优先级 P0/P1/P1，已同步给开发组。",
  },
  {
    name: "前端开发", delay: 4, fail: false,
    task: "实现办公室场景、气泡动画与实时状态展示",
    lines: [
      "搭建页面骨架：办公室场景 canvas", "实现云朵气泡组件（CJK 自动换行）",
      "修复气泡文字溢出问题", "接入 SSE 实时状态流", "走路动画两帧循环调优中……",
    ],
    final: "前端完成：场景/气泡/动画全部就绪，自测通过。",
  },
  {
    name: "后端开发", delay: 6.5, fail: false,
    task: "实现会话日志监听、事件解析与 SSE 状态桥接",
    lines: [
      "设计日志监听桥接器", "实现 rollout JSONL 增量 tail", "解析 spawn_agent / sub_agent_activity",
      "子智能体线程文件绑定完成", "压力测试：8 并发 agent 无丢帧",
    ],
    final: "后端完成：事件延迟 < 1s，8 并发稳定。",
  },
  {
    name: "测试工程师", delay: 9, fail: true,
    task: "覆盖交付、休息、失败和召回流程并提交回归结论",
    lines: [
      "编写 e2e 用例：交付流程", "发现 bug：气泡在 2 行时抖动", "提交回归报告……",
      "断言失败：躺椅 ZZZ 粒子未出现",
    ],
    final: "阻塞：ZZZ 粒子偶现丢失，已打回前端。",
  },
  {
    name: "文案撰写", delay: 11, fail: false,
    task: "撰写老板喊话、交付话术与 README 文案",
    lines: [
      "起草老板喊话文案", "「你不干有的是智能体干」语气校准：要凶但不越界",
      "润色交付话术", "输出 README 趣味段落",
    ],
    final: "文案交付：喊话 4 条 + 交付话术 6 条 + README 彩蛋。",
  },
];

async function runDemo() {
  console.log("[pixel-office] demo mode");
  sessionActive = true;
  sessionLabel = "演示会话 · demo";
  const loop = async () => {
    for (const spec of DEMO_AGENTS) {
      await sleep(spec.delay * 1000 * (spec.delay === 1.5 ? 1 : 0.3) + 800);
      const id = "demo-" + spec.name;
      agents.set(id, {
        id, name: spec.name, threadId: null, state: "working",
        text: "开始干活…", task: spec.task, history: [], spawnedAt: Date.now(),
      });
      broadcast("spawn", { id, name: spec.name, state: "working", task: spec.task });
      (async () => {
        for (const line of spec.lines) {
          await sleep(2200 + Math.random() * 1800);
          onAgentText(agents.get(id), line);
        }
        await sleep(2000);
        const a = agents.get(id);
        if (!a) return;
        if (spec.fail) {
          onAgentText(a, spec.final);
          setAgent(id, { state: "failed" });
          broadcast("state", { id, state: "failed" });
          await sleep(9000);
          // boss sends it back: recall and succeed this time
          setAgent(id, { state: "working" });
          broadcast("state", { id, state: "recalled" });
          onAgentText(agents.get(id), "收到打回，修复 ZZZ 粒子……");
          await sleep(6000);
          onAgentComplete(agents.get(id), "修复完成，全部用例通过。");
        } else {
          onAgentComplete(a, spec.final);
        }
      })();
    }
    await sleep(34000);
    if (agents.size) {
      agents.clear();
      broadcast("reset", {});
      sessionActive = true;
    }
    loop();
  };
  loop();
}

// ---------------------------------------------------------------- http
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json",
};

// ------------------------------------------------- sidebar self-registration
// The Codex desktop app keeps its browser-sidebar local-server list in
// browser-sidebar-local-servers.json. Register ourselves so the office entry
// shows up in the sidebar without any manual step (best-effort, never fatal).
function registerSidebar() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150" viewBox="0 0 240 150"><rect width="240" height="150" rx="10" fill="#7a4e2d"/><rect x="18" y="18" width="204" height="114" rx="8" fill="#c88a4e"/><rect x="30" y="46" width="60" height="40" rx="2" fill="#5b3a20"/><rect x="36" y="30" width="48" height="20" rx="2" fill="#2f6b2f"/><rect x="150" y="40" width="56" height="46" rx="2" fill="#5b3a20"/><rect x="156" y="28" width="44" height="16" rx="2" fill="#4a7fb5"/><text x="30" y="116" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="15" font-weight="600" fill="#fffdf2">Pixel Office</text><text x="30" y="130" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="10" fill="#ffe9c9">localhost:${PORT}</text></svg>`;
  const entry = {
    hiddenRouteUrls: [],
    lastOpenedAt: null,
    lastRunningAt: Date.now(),
    lastSeenAt: Date.now(),
    previewImageDataUrl: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"),
    routes: [],
    title: "Pixel Office · 子智能体办公室",
    url: `http://localhost:${PORT}/`,
  };
  const dirs = ["Codex", "Codex (Dev)"];
  for (const d of dirs) {
    const file = path.join(os.homedir(), "Library", "Application Support", d,
      "browser-sidebar-local-servers.json");
    try {
      if (!fs.existsSync(file)) continue;
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!Array.isArray(data.servers)) data.servers = [];
      const i = data.servers.findIndex(s => s && s.url === entry.url);
      if (i >= 0) {
        data.servers[i] = { ...data.servers[i],
          lastRunningAt: entry.lastRunningAt, lastSeenAt: entry.lastSeenAt,
          title: entry.title, previewImageDataUrl: data.servers[i].previewImageDataUrl || entry.previewImageDataUrl };
      } else {
        data.servers.push(entry);
      }
      const tmp = file + ".pixel-office-tmp";
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, file);
      console.log(`[pixel-office] sidebar registered in ${d}`);
    } catch (e) {
      console.warn(`[pixel-office] sidebar registration skipped (${d}):`, e.message);
    }
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(`data: ${JSON.stringify({ type: "snapshot", ...snapshot() })}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }
  if (url.pathname === "/api/state") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snapshot()));
    return;
  }
  if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  let p = decodeURIComponent(url.pathname);
  if (p === "/") p = "/index.html";
  const file = path.join(PUBLIC, p);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[pixel-office] 办公室开张 → http://localhost:${PORT}`);
  registerSidebar();
  if (DEMO) runDemo();
  else if (REPLAY) replay(REPLAY, SPEED);
  else {
    console.log(`[pixel-office] watching ${SESSIONS_DIR}`);
    setInterval(poll, POLL_MS);
    poll();
  }
});
