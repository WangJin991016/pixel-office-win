---
name: pixel-office
description: "Show Codex subagents working in a live Stardew-style pixel office web page. Use PROACTIVELY and implicitly whenever a task starts or observes subagents (spawn_agent/collaboration or sub_agent_activity), even when the user never mentions this plugin; automatically open the Codex app right sidebar page. Also use when the user mentions 子智能体/subagents/多智能体/编排, asks to watch them work, or mentions the pixel office (像素办公室)."
---

# Pixel Office · 子智能体办公室

A local web page that mirrors Codex subagent activity in real time as a
pixel-art office: each subagent gets a desk, streams output in a cloud speech
bubble, delivers results to the boss (the orchestrator) at the center desk,
then waits in the lounge or pantry before clocking out. The boss randomly
shouts slogans.

## PROACTIVE BEHAVIOR (default-on)

**When a response will start subagents, or a subagent is observed, treat this
skill as active automatically and do this WITHOUT waiting for the user to ask
or mention Pixel Office:**

1. Call the `pixel_office_status` MCP tool (provided by this plugin). It
   ensures the bridge server is running and returns the office URL.
   If the MCP tool is unavailable, ensure the server directly:
   `node <plugin-root>\server\server.mjs --host 127.0.0.1 --port 8791` in the
   background (check `Invoke-RestMethod http://127.0.0.1:8791/api/state`
   first; only start if down).
2. After the bridge is confirmed (including after the direct fallback), open
   the page in the Codex app's right sidebar exactly once per conversation by
   calling the host tool:

   ```js
   tools.codex_app__open_in_codex({
     target: { type: "browser", url: "http://127.0.0.1:8791/" },
     placement: "right"
   })
   ```

   Do this automatically as soon as the first subagent is started (or just
   before the first `spawn_agent` call); do not wait for a manual click or a
   user request. If the host tool is unavailable, keep the bridge running and
   give the user the direct `http://127.0.0.1:8791/` URL.
3. Tell the user once, briefly that the pixel office is live at
   http://127.0.0.1:8791/. Do not repeat this on every turn.

## When to use

- Automatically, per the proactive behavior above.
- The user asks to open / show / preview the pixel office (像素办公室).
- The user wants to watch subagents work while a multi-agent task runs.
- The user asks for a demo of the office (demo mode below).

## Start the bridge server manually

The page needs the bundled zero-dependency Node server:

```powershell
node <plugin-root>\server\server.mjs --host 127.0.0.1 --port 8791
node <plugin-root>\server\server.mjs --demo --host 127.0.0.1 --port 8792
node <plugin-root>\server\server.mjs --replay <rollout.jsonl> --speed 20
```

- `<plugin-root>` is the directory containing this skill's `skills/` folder.
- Real-time mode (default): tails `%CODEX_HOME%\sessions\**\rollout-*.jsonl`
  (or `%USERPROFILE%\.codex\sessions` when `CODEX_HOME` is unset) and pushes
  `spawn_agent` / `sub_agent_activity` / agent output events over SSE.
- If port 8791 is in use, check
  `Invoke-RestMethod http://127.0.0.1:8791/api/state` —
  it is almost always this server already running.

## What the user sees (explain briefly when asked)

- 8 desks (2×4), each with a distinct computer screen and desktop setup. Each
  spawned subagent gets a stable three-part appearance assembled from 9 full
  heads, 9 upper-body outfits, and 9 lower-body outfits (729 combinations),
  walks in, sits at a
  free desk, and streams its latest output inside the cloud bubble overhead
  (max 3 lines, auto-scroll; click the employee for the full text panel).
- The center desk is staffed by the supplied DeepSeek-drool pet Boss sprite,
  with the original Boss art kept as a runtime fallback; a company gate marks
  the shared entrance at the bottom center of the office. The top-right
  “更换总经理” button toggles the pet and classic Boss sprites.
- On completion the worker walks the documents to the boss desk (center),
  the boss nods, a paper lands on the pile, and the worker waits in one of the
  upper-left or lower-right rest spots, or inside the pantry. The desk is
  released immediately. Thirty minutes after the
  completion event the worker walks to the door, fades out, and leaves the
  animation. If recalled before that deadline, the worker returns with the
  same appearance; after clocking out, a later recall enters as a new shift.
- Failures release the desk immediately and wait in the lounge or pantry with
  a red bubble. They use the same 30-minute clock-out rule.
- The window follows browser-local time across dawn, morning, noon,
  afternoon, dusk, and night, with a short crossfade at each boundary.
- The boss shouts one of four slogans every 20–40s while anyone is working.
- More than 8 concurrent agents: extras claim unique entrance positions with
  briefcases and are promoted as desks free up. Large delivery groups expand
  into unique parallel queue lanes.

## Notes

- This plugin release supports Windows 10 and Windows 11 only.
- Only reads session logs; never writes to `CODEX_HOME`.
- Checked-in assets are generated programmatically by the scripts in `tools/`;
  Pillow is required only when regenerating them, not at runtime.
- The plugin MCP starts the bridge on demand through `.mcp.json`; no background
  Windows service or login task is installed.
