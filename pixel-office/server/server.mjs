#!/usr/bin/env node
/**
 * pixel-office bridge server (zero-dependency Node).
 *
 * - Serves the office web page from ../public
 * - Tails %CODEX_HOME%/sessions rollout JSONL files to track subagents:
 *     root file:  spawn_agent calls, sub_agent_activity events
 *     agent file: assistant messages (streaming output), task_complete
 * - Pushes state to the page over SSE.
 *
 * Usage:
 *   node server.mjs [--port 8791] [--host 127.0.0.1] [--demo]
 *                   [--replay FILE [--speed N]] [--sessions-dir DIR]
 */
"use strict";

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import {
  APPEARANCE_CATEGORIES,
  APPEARANCE_VERSION,
  makeAppearance,
} from "./appearance.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- args
const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : dflt;
}
const PORT = Number(opt("port", 8791));
const HOST = opt("host", process.env.PIXEL_OFFICE_HOST || "127.0.0.1");
const DEMO = args.includes("--demo");
const REPLAY = opt("replay", null);
const SPEED = Number(opt("speed", 20));
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const SESSIONS_DIR = opt("sessions-dir", path.join(CODEX_HOME, "sessions"));

const PUBLIC = path.join(__dirname, "..", "public");
const POLL_MS = 700;
const OUTPUT_THROTTLE_MS = 450;
const MAX_TEXT = 2400;
const LIVE_HOLD_MS = 1_800_000;
const DEMO_HOLD_MS = 30_000;
function replaySpeed() {
  return Number.isFinite(SPEED) && SPEED > 0 ? SPEED : 1;
}

function terminalHoldMs() {
  if (DEMO) return DEMO_HOLD_MS;
  if (REPLAY) return LIVE_HOLD_MS / replaySpeed();
  return LIVE_HOLD_MS;
}

// ---------------------------------------------------------------- state
/** agents: Map<id, {id, name, threadId, state, text, task, history,
 *   spawnedAt, workStartedAt, terminalAt, leaveAt, appearanceGeneration,
 *   appearance}> */
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
      ...agentLifecycleFields(a),
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

function onActivity(ev, at = Date.now()) {
  const eventAt = finiteTime(at);
  const threadId = ev.agent_thread_id;
  const name = (ev.agent_path || "").split("/").filter(Boolean).pop() || "agent-" + ++anonCounter;
  const kind = String(ev.kind || "").toLowerCase();
  const hint = kind === "started" ? pendingSpawns.get(String(ev.event_id || "")) : null;
  let a = [...agents.values()].find(x => x.threadId === threadId);
  if (!a) {
    a = {
      id: "ag-" + String(threadId || Date.now()).replace(/-/g, "").slice(-8), name, threadId,
      state: "working", text: "开始干活…", task: hint?.task || name,
      history: [], spawnedAt: eventAt, workStartedAt: eventAt,
      terminalAt: null, leaveAt: null, appearanceGeneration: 0,
      appearanceSessionId: appearanceSessionId(),
    };
    ensureAgentLifecycle(a);
    agents.set(a.id, a);
    broadcastSpawn(a);
  } else if (hint?.task && hint.task !== a.task) {
    setAgent(a.id, { task: hint.task });
    broadcast("task", { id: a.id, task: hint.task });
  }
  if (hint) pendingSpawns.delete(String(ev.event_id || ""));
  if (kind === "started") {
    // A duplicate/late started event must not revive a terminal worker.  A
    // genuinely newer start is handled below before the failure sticky guard,
    // so failed workers can be recalled for a new round.
    if (workEventIsStale(a, eventAt)) return;
    const wasTerminal = isTerminalAgent(a);
    if (reopenTerminalAgent(a, eventAt)) return;
    if (wasTerminal || FAILURE_AGENT_STATES.has(a.state)) return;
    // An active duplicate started event updates no lifecycle timestamps.
    setAgent(a.id, { state: "working", text: a.text === "报到中…" ? "开始干活…" : a.text });
    broadcastState(a, "working");
  } else if (kind === "interacted") {
    // new work for an existing agent -> recall from the lounge
    if (workEventIsStale(a, eventAt)) return;
    if (isTerminalAgent(a)) {
      reopenTerminalAgent(a, eventAt);
      return;
    }
    const afterLeave = Number.isFinite(a.leaveAt) && eventAt >= a.leaveAt;
    beginWork(a, eventAt, afterLeave);
    setAgent(a.id, { state: "working" });
    broadcastState(a, "recalled");
  } else if (kind && /complete|finish|done|closed/i.test(kind)) {
    // completion usually arrives via the agent's own file; accept either
    onAgentComplete(a, ev.summary || ev.last_agent_message, eventAt);
  } else if (kind && /error|fail|abort|interrupt|pause|cancel|stop|terminat|crash|exception/i.test(kind)) {
    onAgentFailed(a, ev.reason || ev.message || kind, eventAt);
  }
}

let lastOutputPush = new Map();
function onAgentText(a, text, meta = {}) {
  if (!a || !text) return;
  if (Number.isFinite(meta.at) && workEventIsStale(a, meta.at)) return;
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

function onAgentComplete(a, summary, at = Date.now()) {
  // Terminal facts are sticky until beginWork() opens a newer round. This
  // rejects both failed-to-completed and completed-to-failed late inversions.
  if (!a || isTerminalAgent(a)) return;
  const eventAt = finiteTime(at);
  if (workEventIsStale(a, eventAt)) return;
  if (summary) onAgentText(a, summary, { at: eventAt, source: "task_complete" });
  markTerminal(a, eventAt);
  if (a.state !== "resting") {
    setAgent(a.id, { state: "completed" });
    broadcastState(a, "completed", { summary: a.text });
  }
}

function onAgentFailed(a, reason = "", at = Date.now()) {
  if (!a || isTerminalAgent(a)) return;
  const eventAt = finiteTime(at);
  if (workEventIsStale(a, eventAt)) return;
  reason = String(reason || "").trim();
  if (reason) onAgentText(a, `任务失败：${reason}`, { at: eventAt, source: "failure" });
  markTerminal(a, eventAt);
  setAgent(a.id, { state: "failed" });
  const event = {};
  if (reason) event.reason = reason;
  broadcastState(a, "failed", event);
}

function onRootFailed(reason = "", at = Date.now()) {
  for (const a of agents.values()) {
    if (!INACTIVE_AGENT_STATES.has(a.state)) onAgentFailed(a, reason, at);
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
let activeSessionId = null;
let lastIndexBuild = 0;

function finiteTime(value, fallback = Date.now()) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function appearanceSessionId() {
  return String(rootId || activeSessionId || (DEMO ? "demo" : REPLAY ? "replay" : "pixel-office"));
}

function ensureAgentLifecycle(a) {
  if (!a) return a;
  if (!Number.isInteger(a.appearanceGeneration) || a.appearanceGeneration < 0) {
    a.appearanceGeneration = 0;
  }
  a.appearanceVersion = APPEARANCE_VERSION;
  if (!Object.prototype.hasOwnProperty.call(a, "terminalAt")) a.terminalAt = null;
  if (!Object.prototype.hasOwnProperty.call(a, "leaveAt")) a.leaveAt = null;
  if (!a.appearanceSessionId) a.appearanceSessionId = appearanceSessionId();
  const threadId = String(a.threadId || a.id || "agent");
  // Always derive this object so legacy records and refreshed snapshots use
  // the same exact contract and seed.
  a.appearance = makeAppearance(a.appearanceSessionId, threadId, a.appearanceGeneration);
  return a;
}

function agentLifecycleFields(a) {
  ensureAgentLifecycle(a);
  return {
    terminalAt: Number.isFinite(a.terminalAt) ? a.terminalAt : null,
    leaveAt: Number.isFinite(a.leaveAt) ? a.leaveAt : null,
    workStartedAt: Number.isFinite(a.workStartedAt) ? a.workStartedAt : null,
    appearanceVersion: APPEARANCE_VERSION,
    appearanceGeneration: a.appearanceGeneration,
    appearance: { ...a.appearance },
  };
}

function broadcastSpawn(a) {
  broadcast("spawn", {
    id: a.id, name: a.name || a.id || "", state: a.state, task: a.task || a.name || "",
    ...agentLifecycleFields(a),
  });
}

function broadcastState(a, state, extra = {}) {
  broadcast("state", {
    id: a.id, name: a.name || a.id || "", task: a.task || a.name || "", state,
    ...agentLifecycleFields(a),
    ...extra,
  });
}

function beginWork(a, at, incrementAppearance = false) {
  ensureAgentLifecycle(a);
  const workAt = finiteTime(at);
  if (incrementAppearance) {
    const leaveAt = Number.isFinite(a.leaveAt) ? a.leaveAt : null;
    if (leaveAt !== null && workAt >= leaveAt) a.appearanceGeneration += 1;
  }
  a.workStartedAt = workAt;
  a.terminalAt = null;
  a.leaveAt = null;
  a.appearance = makeAppearance(
    a.appearanceSessionId,
    String(a.threadId || a.id || "agent"),
    a.appearanceGeneration,
  );
  return workAt;
}

function workEventIsStale(a, at) {
  const workStartedAt = Number(a && a.workStartedAt);
  return Number.isFinite(workStartedAt) && finiteTime(at) < workStartedAt;
}

function markTerminal(a, at) {
  const terminalAt = finiteTime(at);
  a.terminalAt = terminalAt;
  a.leaveAt = terminalAt + terminalHoldMs();
  return terminalAt;
}

function isTerminalAgent(a) {
  return a && (a.state === "completed" || a.state === "resting"
    || FAILURE_AGENT_STATES.has(a.state)
    || Number.isFinite(a.terminalAt) || Number.isFinite(a.leaveAt));
}

function reopenTerminalAgent(a, at) {
  if (!a || workEventIsStale(a, at) || !isTerminalAgent(a)) return false;
  const eventAt = finiteTime(at);
  const terminalAt = Number(a.terminalAt);
  if (Number.isFinite(terminalAt) && eventAt <= terminalAt) return false;
  const afterLeave = Number.isFinite(a.leaveAt) && eventAt >= a.leaveAt;
  beginWork(a, eventAt, afterLeave);
  setAgent(a.id, { state: "working" });
  broadcastState(a, "recalled");
  return true;
}

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

function recordTimestamp(rec) {
  return rec && rec.timestamp ? finiteTime(new Date(rec.timestamp).getTime()) : Date.now();
}

function processRootLine(line, clockAt = null) {
  const rec = safeParse(line);
  if (!rec) return;
  const p = rec.payload;
  if (!p) return;
  const eventAt = Number.isFinite(clockAt) ? clockAt : recordTimestamp(rec);

  if (rec.type === "session_meta") {
    sessionLabel = `${p.cwd ? path.basename(p.cwd) : "session"} · ${p.cli_version || ""}`.trim();
    activeSessionId = p.session_id || p.id || activeSessionId;
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
    onActivity(p, eventAt);
    return;
  }
  if (rec.type === "event_msg" && p.type === "turn_aborted") {
    onRootFailed(p.reason || "interrupted", eventAt);
    onRootComplete();
    return;
  }
  if (rec.type === "event_msg" && p.type === "error") {
    onRootFailed(p.message || "error", eventAt);
    onRootComplete();
    return;
  }
  if (p.type === "task_complete" && rec.type === "event_msg") {
    // root session finished a turn (not necessarily the whole session)
    onRootComplete();
    return;
  }
}

function processAgentRecord(a, rec, clockAt = null) {
  if (!rec || !rec.payload) return;
  const p = rec.payload;
  const recordAt = recordTimestamp(rec);
  const eventAt = Number.isFinite(clockAt) ? clockAt : recordAt;
  if (p.type === "task_started") {
    // Child-rollout task_started is a real new work marker only after the
    // agent has reached a terminal state.  Active duplicates must not move
    // workStartedAt or clear their terminal fields; terminal agents are
    // recalled with the same before/after-leave appearance rule as activity.
    reopenTerminalAgent(a, eventAt);
    return;
  }
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
    onActivity(p, eventAt);
    return;
  }
  if (p.type === "turn_aborted") {
    onAgentFailed(a, p.reason || "interrupted", eventAt);
    return;
  }
  if (p.type === "error") {
    onAgentFailed(a, p.message || "error", eventAt);
    return;
  }
  if (p.type === "task_complete") {
    onAgentComplete(a, p.last_agent_message, eventAt);
    return;
  }
  if (rec.type === "response_item" && p.type === "message" && p.role === "assistant") {
    const t = payloadText(p);
    if (t) onAgentText(a, t, { at: eventAt, source: "response_item" });
    return;
  }
  if (p.type === "agent_message") {
    const t = payloadText(p);
    if (t) onAgentText(a, t, { at: eventAt, source: "agent_message" });
  }
}

function processAgentLine(a, line) {
  processAgentRecord(a, safeParse(line));
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
    history: [], spawnedAt: info.bornAt || Date.now(),
    workStartedAt: info.bornAt || Date.now(), terminalAt: null, leaveAt: null,
    appearanceGeneration: 0, appearanceSessionId: appearanceSessionId(),
  };
  ensureAgentLifecycle(a);
  agents.set(a.id, a);
  broadcastSpawn(a);
  return a;
}

function belongsToTree(info) {
  // depth-1: parent is the root; deeper: parent is a known subagent
  if (!info.parent) return false;
  if (info.parent === rootId) return true;
  return [...agents.values()].some(x => x.threadId === info.parent);
}

function processAgentLineSince(a, line, sinceMs, clockAt = null) {
  const rec = safeParse(line);
  if (!rec || !rec.payload) return;

  // A forked rollout starts with a copy of the parent's JSONL history.  Those
  // records can have the same wall-clock timestamp as the child's session
  // metadata, so a simple line-timestamp cutoff is not sufficient: the
  // copied parent task_complete would immediately put a new employee to bed.
  // The first task_started whose payload time is at/after the child birth is
  // the child's own turn; ignore everything before that marker.
  if (sinceMs) {
    const t = lineTs(line);
    if (t && t < sinceMs - 2000) return;
    if (!a.ownTurnStarted) {
      const p = rec.payload;
      const startedAt = p.type === "task_started" ? Number(p.started_at) * 1000 : NaN;
      if (Number.isFinite(startedAt) && startedAt >= sinceMs - 1000) {
        a.ownTurnStarted = true;
      } else {
        return;
      }
    }
  }
  processAgentRecord(a, rec, clockAt);
}

function lineTs(line) {
  const m = /"timestamp":"([^"]+)"/.exec(line);
  return m ? new Date(m[1]).getTime() : 0;
}

function poll() {
  if (Date.now() - lastIndexBuild > 5000) rebuildIndex();

  // Usually the newest non-subagent rollout is the active root.  Desktop
  // continuations can, however, write a newer root rollout while the
  // collaboration service still records children against the original root
  // id.  Prefer that parent root whenever a newer child file points to it;
  // otherwise the page would reset to an empty office during a live task.
  let newest = null, newestM = 0, newestId = null;
  for (const [id, info] of sessionIndex) {
    if (!info.isSub && info.mtime > newestM) { newestM = info.mtime; newest = info.file; newestId = id; }
  }
  const latestChildByRoot = new Map();
  for (const info of sessionIndex.values()) {
    if (!info.isSub || !info.parent) continue;
    let parentId = info.parent;
    for (let depth = 0; depth < 32; depth++) {
      const parentInfo = sessionIndex.get(parentId);
      if (!parentInfo || !parentInfo.isSub) break;
      parentId = parentInfo.parent;
    }
    const parentInfo = sessionIndex.get(parentId);
    if (!parentInfo || parentInfo.isSub) continue;
    const previous = latestChildByRoot.get(parentId) || 0;
    if (info.mtime > previous) latestChildByRoot.set(parentId, info.mtime);
  }
  let preferredRootId = null, preferredChildMtime = newestM;
  for (const [id, childMtime] of latestChildByRoot) {
    if (childMtime > preferredChildMtime) {
      preferredRootId = id;
      preferredChildMtime = childMtime;
    }
  }
  if (preferredRootId) {
    const preferred = sessionIndex.get(preferredRootId);
    newest = preferred.file;
    newestId = preferredRootId;
  }
  if (newest && (newest !== rootFile)) {
    const switching = rootFile !== null;
    rootFile = newest; rootId = newestId; activeSessionId = newestId;
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
  const effectiveSpeed = Number.isFinite(speed) && speed > 0 ? speed : replaySpeed();
  console.log(`[pixel-office] replaying ${file} at ${effectiveSpeed}x`);
  const rootRec = safeParse(fs.readFileSync(file, "utf8").split("\n")[0]);
  const replayRootId = rootRec && rootRec.payload && rootRec.payload.session_id;
  rootId = replayRootId || rootId;
  activeSessionId = replayRootId || activeSessionId;

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
              agentPath: spawn.agent_path || "",
              nick: spawn.agent_nickname || spawn.nickname || "",
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
    .filter(t => !t.tid || new Date(t.rec.timestamp).getTime() >= t.bornAt - 2000);

  // Current Codex logs can wrap spawn_agent inside the generic tool runner,
  // leaving no direct root activity record for replay() to consume.  The
  // child session_meta is still an authoritative birth record, so add one
  // synthetic discovery marker at that exact time.  A real activity event
  // with the same thread id is harmless because discoverSubagent/onActivity
  // both deduplicate by threadId.
  for (const [tid, info] of subFiles) {
    parsed.push({
      rec: { timestamp: new Date(info.bornAt || Date.now()).toISOString() },
      tid: null,
      bornAt: info.bornAt,
      syntheticSpawn: { tid, info },
    });
  }
  parsed.sort((a, b) => {
    const timeDelta = new Date(a.rec.timestamp) - new Date(b.rec.timestamp);
    if (timeDelta) return timeDelta;
    return Number(Boolean(b.syntheticSpawn)) - Number(Boolean(a.syntheticSpawn));
  });

  sessionActive = true;
  let prevT = null, wall0 = Date.now(), t0 = null;
  let matched = 0, dropped = 0;
  for (const { rec, tid, syntheticSpawn } of parsed) {
    const t = new Date(rec.timestamp).getTime();
    if (t0 === null) { t0 = t; wall0 = Date.now(); prevT = t; }
    let wait = (t - t0) / effectiveSpeed - (Date.now() - wall0);
    if (t - prevT > 120000) wait = Math.min(wait, 1200);   // compress idle gaps
    prevT = t;
    if (wait > 0) await sleep(wait);
    const playbackAt = Date.now();

    if (syntheticSpawn) {
      discoverSubagent(syntheticSpawn.tid, {
        ...syntheticSpawn.info,
        bornAt: playbackAt,
      });
    } else if (tid === null) {
      processRootLine(JSON.stringify(rec), playbackAt);
    } else {
      const a = [...agents.values()].find(x => x.threadId === tid);
      if (a) {
        matched++;
        processAgentLineSince(a, JSON.stringify(rec), subFiles.get(tid)?.bornAt || 0, playbackAt);
      }
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
  rootId = "demo";
  activeSessionId = "demo";
  const loop = async () => {
    for (const spec of DEMO_AGENTS) {
      await sleep(spec.delay * 1000 * (spec.delay === 1.5 ? 1 : 0.3) + 800);
      const id = "demo-" + spec.name;
      const spawnedAt = Date.now();
      agents.set(id, {
        id, name: spec.name, threadId: null, state: "working",
        text: "开始干活…", task: spec.task, history: [], spawnedAt,
        workStartedAt: spawnedAt, terminalAt: null, leaveAt: null,
        appearanceGeneration: 0, appearanceSessionId: "demo",
      });
      const demoAgent = agents.get(id);
      ensureAgentLifecycle(demoAgent);
      broadcastSpawn(demoAgent);
      (async () => {
        for (const line of spec.lines) {
          await sleep(2200 + Math.random() * 1800);
          onAgentText(agents.get(id), line);
        }
        await sleep(2000);
        const a = agents.get(id);
        if (!a) return;
        if (spec.fail) {
          onAgentFailed(a, spec.final, Date.now());
          await sleep(9000);
          // boss sends it back: recall and succeed this time
          const recalled = agents.get(id);
          if (!recalled) return;
          beginWork(recalled, Date.now());
          setAgent(id, { state: "working" });
          broadcastState(recalled, "recalled");
          onAgentText(recalled, "收到打回，修复 ZZZ 粒子……");
          await sleep(6000);
          onAgentComplete(agents.get(id), "修复完成，全部用例通过。");
        } else {
          onAgentComplete(a, spec.final);
        }
      })();
    }
    await sleep(34000);
    // Keep terminal workers visible for their complete demo hold.  A failed
    // worker can be recalled during this wait, so recompute deadlines until
    // every in-flight script has reached its final terminal state.
    while (agents.size) {
      if ([...agents.values()].some(a => !Number.isFinite(a.leaveAt))) {
        await sleep(250);
        continue;
      }
      const latestLeaveAt = Math.max(...[...agents.values()].map(a => a.leaveAt));
      const remaining = latestLeaveAt - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(remaining, 500));
    }
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
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

server.listen(PORT, HOST, () => {
  console.log(`[pixel-office] 办公室开张 → http://${HOST}:${PORT}`);
  if (DEMO) runDemo();
  else if (REPLAY) replay(REPLAY, SPEED);
  else {
    console.log(`[pixel-office] watching ${SESSIONS_DIR}`);
    setInterval(poll, POLL_MS);
    poll();
  }
});
