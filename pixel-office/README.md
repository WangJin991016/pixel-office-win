# Pixel Office for Windows

> A Windows-only Codex Desktop plugin that turns live subagent activity into a pixel-art office.

Version `0.3.2+codex.20260820` · Windows 10/11 · Community project, not an official OpenAI product

![Pixel Office for Windows](docs/preview.png)

## Highlights

- Eight fixed desks with distinct screens and desktop setups.
- 9 heads × 9 upper outfits × 9 lower outfits: 729 stable worker appearances.
- Fifteen shared poses covering front, side, back, seated, walking, documents, coffee, and briefcases.
- Completed and failed workers release their desks immediately.
- Completed workers deliver documents to the Boss; failed workers keep a red bubble.
- Terminal workers wait in the lounge or pantry and clock out after 30 minutes.
- Active overflow and delivery queues allocate unique positions instead of stacking workers.
- The window follows browser-local dawn, morning, noon, afternoon, dusk, and night.
- Clicking a worker opens the task, state, and full observed output history.

Pixel Office observes Codex-created subagents. It does not create or control them.

## Requirements

- Windows 10 or Windows 11.
- Codex Desktop and Codex CLI with plugin support.
- Node.js 18 or newer.
- Git.
- Local port `8791`.

Runtime uses only Node.js standard-library modules. Python and Pillow are needed only to regenerate checked-in artwork.

macOS and Linux installation are not supported by this repository.

## Install from GitHub

Run in PowerShell:

```powershell
codex plugin marketplace add WangJin991016/pixel-office-win --ref main
codex plugin add pixel-office@pixel-office-win
```

Restart Codex Desktop completely and start a new task so the skill and MCP server load.

Verify installation:

```powershell
codex plugin marketplace list
codex plugin list
```

The plugin MCP starts the local bridge on demand. Open <http://127.0.0.1:8791/> if the Codex sidebar does not open automatically.

## Manual modes

From this plugin directory:

```powershell
# Live
node .\server\server.mjs --host 127.0.0.1 --port 8791

# Demo
node .\server\server.mjs --demo --host 127.0.0.1 --port 8792

# Replay
node .\server\server.mjs --replay "A:\path\to\rollout.jsonl" --speed 20
```

Check the bridge:

```powershell
Invoke-RestMethod http://127.0.0.1:8791/api/state
```

## Update and uninstall

```powershell
# Update
codex plugin marketplace upgrade pixel-office-win
codex plugin add pixel-office@pixel-office-win

# Uninstall
codex plugin remove pixel-office@pixel-office-win
codex plugin marketplace remove pixel-office-win
```

Restart Codex Desktop after updating or uninstalling.

## Privacy

The bridge reads rollout files under `%CODEX_HOME%\sessions`, or `%USERPROFILE%\.codex\sessions` when `CODEX_HOME` is unset. Those files can contain prompts and subagent output.

The service is read-only with respect to rollout files and binds to `127.0.0.1` by default. Its `/api/state` and `/events` endpoints have no authentication, so never port-forward or expose port `8791`.

## Development

```powershell
node --test .\tests\server-appearance-03.test.mjs .\tests\client-lifecycle-02.test.cjs
node .\tests\scene-render-02.test.cjs
py -3 .\tests\assets-02.test.py
```

See the [Windows project README](https://github.com/WangJin991016/pixel-office-win#readme) and [development guide](docs/DEVELOPMENT.md) for architecture, lifecycle, asset generation, and regression details.

## License and credit

MIT licensed. Original Pixel Office by [frankshane](https://github.com/frankshane); this repository maintains the Windows/Codex release and subsequent visual, lifecycle, and queue improvements.
