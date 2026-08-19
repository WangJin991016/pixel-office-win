#!/usr/bin/env bash
# Install pixel-office as a local Codex plugin:
#   1. create a local marketplace wrapper around this repo
#   2. register the marketplace + enable the plugin in ~/.codex/config.toml
#   3. codex plugin add (materialize), then swap the cache copy for a live
#      symlink so local edits take effect immediately
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"                 # .../codexplugins/pixel-office
BASE="$(dirname "$ROOT")"                             # .../codexplugins
MKT="$BASE/local-marketplace"
CFG="$HOME/.codex/config.toml"

# 1. marketplace skeleton
mkdir -p "$MKT/.agents/plugins" "$MKT/plugins"
cat > "$MKT/.agents/plugins/marketplace.json" <<'JSON'
{
  "name": "local-dev",
  "interface": { "displayName": "Local Dev" },
  "plugins": [
    {
      "name": "pixel-office",
      "source": { "source": "local", "path": "./plugins/pixel-office" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Fun"
    }
  ]
}
JSON
ln -sfn "$ROOT" "$MKT/plugins/pixel-office"

# 2. config.toml registration (idempotent)
python3 - "$CFG" "$MKT" <<'PY'
import sys
cfg, mkt = sys.argv[1], sys.argv[2]
s = open(cfg).read()
if "[marketplaces.local-dev]" not in s:
    s += f'''
[marketplaces.local-dev]
source_type = "local"
source = "{mkt}"

[plugins."pixel-office@local-dev"]
enabled = true
'''
    open(cfg, "w").write(s)
    print("config.toml: registered local-dev marketplace + pixel-office")
else:
    print("config.toml: already registered")
PY

# 3. materialize via codex CLI (re-add to sync local edits into the cache —
#    note: the cache must be a real directory; a symlink makes Codex report
#    the plugin as "not installed")
codex plugin add pixel-office@local-dev || true

# 4. launchd daemon: bridge server starts at login and stays alive
if [ "${1:-}" != "--no-daemon" ]; then
  NODE_BIN="$(command -v node || true)"
  PLIST="$HOME/Library/LaunchAgents/ai.pixeloffice.bridge.plist"
  if [ -n "$NODE_BIN" ]; then
    mkdir -p "$HOME/Library/LaunchAgents"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ai.pixeloffice.bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$ROOT/server/server.mjs</string>
    <string>--port</string><string>8791</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/pixel-office.log</string>
  <key>StandardErrorPath</key><string>/tmp/pixel-office.log</string>
</dict>
</plist>
EOF
    launchctl bootout "gui/$(id -u)/ai.pixeloffice.bridge" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null \
      || launchctl load "$PLIST" 2>/dev/null || true
    echo "launchd daemon installed: ai.pixeloffice.bridge (auto-starts at login)"
    echo "  卸载守护: launchctl bootout gui/\$(id -u)/ai.pixeloffice.bridge"
  fi
else
  echo "skipped launchd daemon (--no-daemon)"
fi

echo
echo "安装完成。在 Codex 里说「打开像素办公室」，或手动："
echo "  node \"$ROOT/server/server.mjs\"          # 实时监听"
echo "  node \"$ROOT/server/server.mjs\" --demo   # 演示模式"
echo "然后打开 http://localhost:8791/"
