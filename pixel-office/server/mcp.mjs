#!/usr/bin/env node
/**
 * pixel-office MCP server (zero-dependency, stdio JSON-RPC).
 *
 * Codex starts this automatically for sessions because the plugin declares
 * mcpServers. Its job:
 *   1. ensure the pixel-office bridge server is running (spawn if missing)
 *   2. expose tiny status tools so Codex can report the office state/link
 */
"use strict";

import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.join(__dirname, "server.mjs");
const PORT = Number(process.env.PIXEL_OFFICE_PORT || 8791);
const HOST = process.env.PIXEL_OFFICE_HOST || "127.0.0.1";
const BASE = `http://${HOST}:${PORT}`;
let bridgeStartPromise = null;
let bridgeWatchdog = null;

function bridgeUp() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE}/api/state`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1200, () => { req.destroy(); resolve(false); });
  });
}

function ensureBridge() {
  if (bridgeStartPromise) return bridgeStartPromise;
  bridgeStartPromise = (async () => {
    if (await bridgeUp()) return { started: false, running: true };
    let child;
    try {
      child = spawn(process.execPath, [
        BRIDGE, "--host", HOST, "--port", String(PORT),
      ], {
        detached: true,
        windowsHide: true,
        stdio: "ignore",
        env: { ...process.env },
      });
      // An asynchronous spawn error must not become an unhandled exception.
      child.on("error", () => {});
      child.unref();
    } catch {
      return { started: true, running: false };
    }
    // Give the detached child a moment to bind.
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (await bridgeUp()) return { started: true, running: true };
    }
    return { started: true, running: false };
  })().finally(() => {
    bridgeStartPromise = null;
  });
  return bridgeStartPromise;
}

function startBridgeWatchdog() {
  if (bridgeWatchdog) return;
  bridgeWatchdog = setInterval(() => {
    void ensureBridge().catch(() => {});
  }, 5000);
  bridgeWatchdog.unref?.();
}

function fetchState() {
  return new Promise((resolve) => {
    http.get(`${BASE}/api/state`, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on("error", () => resolve(null));
  });
}

const TOOLS = [
  {
    name: "pixel_office_status",
    description: "Ensure the pixel-office bridge server is running and report the office URL plus the current subagent workers (names, states). Call this automatically as soon as a response starts or observes subagents, even if the user did not mention Pixel Office; then use the Codex app host tool codex_app__open_in_codex with the browser URL and right placement to show it.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "pixel_office_demo",
    description: "Report the demo-mode URL for the pixel office (scripted fake agents) when no real subagent session is available.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

async function callTool(name) {
  if (name === "pixel_office_status") {
    const st = await ensureBridge();
    const state = st.running ? await fetchState() : null;
    return textResult({
      running: st.running,
      justStarted: st.started,
      url: `${BASE}/`,
      openIn: `Codex app 宿主工具 codex_app__open_in_codex({target:{type:'browser',url:'${BASE}/'},placement:'right'})；若宿主工具不可用，再使用任意浏览器`,
      agents: state ? state.agents : [],
      sessionLabel: state ? state.sessionLabel : "",
      demo: state ? state.demo : false,
    });
  }
  if (name === "pixel_office_demo") {
    return textResult({
      note: "演示模式需要单独进程（与实时模式端口错开或先停掉实时模式）",
      command: `node ${JSON.stringify(BRIDGE)} --demo --host ${HOST} --port 8792`,
      url: `http://${HOST}:8792/`,
    });
  }
  throw new Error("unknown tool: " + name);
}

/* ---------------- minimal stdio JSON-RPC (MCP) ---------------- */
let buffer = "";

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (msg.jsonrpc !== "2.0") return;
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case "initialize":
      send({
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: (params && params.protocolVersion) || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "pixel-office", version: "0.3.3" },
        },
      });
      return;
    case "notifications/initialized":
    case "initialized":
      return; // notification, no reply
    case "ping":
      if (isRequest) send({ jsonrpc: "2.0", id, result: {} });
      return;
    case "tools/list":
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
      return;
    case "tools/call": {
      try {
        const result = await callTool(params && params.name);
        send({ jsonrpc: "2.0", id, result });
      } catch (e) {
        send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: String(e) }], isError: true } });
      }
      return;
    }
    default:
      if (isRequest) {
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: "method not found: " + method } });
      }
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    try { await handle(msg); } catch { /* keep serving */ }
  }
});

// Warm-up: bring the bridge up as soon as Codex starts this MCP server, then
// recover it if the detached Windows child is later terminated.
startBridgeWatchdog();
ensureBridge().then(st => {
  process.stderr.write(`[pixel-office] mcp ready; bridge running=${st.running} started=${st.started} url=${BASE}/\n`);
}).catch(() => {
  process.stderr.write(`[pixel-office] mcp bridge start failed; watchdog will retry url=${BASE}/\n`);
});
