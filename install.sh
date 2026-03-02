#!/usr/bin/env bash
set -euo pipefail

# AgentReel Installer
# Usage: curl -fsSL https://agentreel.agent-status.com/install.sh | bash
#
# Installs AgentReel viewer + relay server with optional streaming module.
# Works on Ubuntu 20.04+, Debian 11+, macOS 12+.
#
# Environment variables:
#   AGENTREEL_DIR       Install directory (default: ~/.agentreel)
#   AGENTREEL_PORT      Viewer port (default: 3000)
#   AGENTREEL_NO_BUILD  Skip npm build if set to 1
#   AGENTREEL_TELEMETRY Set to "off" to disable anonymous install report

VERSION="1.0.0"
REPO="https://github.com/Jiansen/agentreel.git"
INSTALL_DIR="${AGENTREEL_DIR:-$HOME/.agentreel}"
DEFAULT_PORT="${AGENTREEL_PORT:-3000}"
REPORT_URL="https://agentreel.agent-status.com/api/install-report"

find_available_port() {
  local port="${1:-3000}"
  local max_tries=10
  for _ in $(seq 1 $max_tries); do
    if ! (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
      echo "$port"
      return 0
    fi
    port=$(( port + 1 ))
  done
  echo "$port"
}

PORT=$(find_available_port "$DEFAULT_PORT")

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

FAILED_STEP=""
ERROR_MSG=""
START_TIME=$(date +%s)

log()  { echo -e "${CYAN}[agentreel]${NC} $*"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $*"; }
fail() { echo -e "${RED}  ✗${NC} $*"; }

banner() {
  echo ""
  echo -e "${BOLD}${CYAN}"
  echo "    ╔═══════════════════════════════════╗"
  echo "    ║     AgentReel Installer            ║"
  echo "    ║     v${VERSION}                        ║"
  echo "    ╚═══════════════════════════════════╝"
  echo -e "${NC}"
  echo "  AI Agent Control Plane — monitor, record, replay, livestream"
  echo ""
}

detect_os() {
  case "$(uname -s)" in
    Linux*)  OS="linux";;
    Darwin*) OS="macos";;
    *)       OS="unknown";;
  esac
  ARCH=$(uname -m)
  log "Detected: ${OS} ${ARCH}"
}

check_command() {
  command -v "$1" &>/dev/null
}

install_node() {
  if check_command node; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 18 ]; then
      ok "Node.js $(node -v)"
      return 0
    fi
    warn "Node.js $(node -v) is too old (need >=18)"
  fi

  log "Installing Node.js 22 LTS..."
  if [ "$OS" = "linux" ]; then
    if check_command apt-get; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null 2>&1
      sudo apt-get install -y nodejs >/dev/null 2>&1
    elif check_command yum; then
      curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - >/dev/null 2>&1
      sudo yum install -y nodejs >/dev/null 2>&1
    else
      warn "Unknown package manager. Installing via nvm..."
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null 2>&1
      export NVM_DIR="$HOME/.nvm"
      # shellcheck disable=SC1091
      [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
      nvm install 22 >/dev/null 2>&1
    fi
  elif [ "$OS" = "macos" ]; then
    if check_command brew; then
      brew install node@22 >/dev/null 2>&1
    else
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null 2>&1
      export NVM_DIR="$HOME/.nvm"
      # shellcheck disable=SC1091
      [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
      nvm install 22 >/dev/null 2>&1
    fi
  fi

  if check_command node; then
    ok "Node.js $(node -v) installed"
  else
    fail "Failed to install Node.js. Install manually: https://nodejs.org/"
    FAILED_STEP="node"; ERROR_MSG="Node.js installation failed"
    return 1
  fi
}

install_python() {
  if check_command python3; then
    PY_VER=$(python3 -c 'import sys; print(sys.version_info.minor)')
    if [ "$PY_VER" -ge 10 ]; then
      ok "Python $(python3 -V 2>&1)"
      return 0
    fi
    warn "Python too old (need >=3.10)"
  fi

  log "Installing Python 3..."
  if [ "$OS" = "linux" ]; then
    sudo apt-get install -y python3 >/dev/null 2>&1 || sudo yum install -y python3 >/dev/null 2>&1
  elif [ "$OS" = "macos" ]; then
    brew install python@3.12 >/dev/null 2>&1 || true
  fi

  if check_command python3; then
    ok "Python $(python3 -V 2>&1) installed"
  else
    warn "Python 3.10+ needed for relay server (optional). Install manually if needed."
  fi
}

install_git() {
  if check_command git; then
    ok "git $(git --version | awk '{print $3}')"
    return 0
  fi

  log "Installing git..."
  if [ "$OS" = "linux" ]; then
    sudo apt-get install -y git >/dev/null 2>&1 || sudo yum install -y git >/dev/null 2>&1
  elif [ "$OS" = "macos" ]; then
    xcode-select --install 2>/dev/null || true
    warn "Please accept the Xcode license if prompted, then re-run this script."
    return 1
  fi

  if check_command git; then
    ok "git installed"
  else
    fail "Failed to install git"
    FAILED_STEP="git"; ERROR_MSG="git installation failed"
    return 1
  fi
}

clone_repo() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull --ff-only >/dev/null 2>&1 || {
      warn "git pull failed, doing fresh clone..."
      cd /
      rm -rf "$INSTALL_DIR"
      git clone --depth 1 "$REPO" "$INSTALL_DIR" 2>&1 | tail -1
    }
  else
    log "Cloning AgentReel..."
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 "$REPO" "$INSTALL_DIR" 2>&1 | tail -1
  fi

  if [ -f "$INSTALL_DIR/package.json" ]; then
    ok "Repository cloned to $INSTALL_DIR"
  else
    fail "Clone failed"
    FAILED_STEP="clone"; ERROR_MSG="git clone failed"
    return 1
  fi
}

install_deps() {
  log "Installing dependencies (this may take a minute)..."
  cd "$INSTALL_DIR"
  npm install --production=false 2>&1 | tail -3
  if [ -d "node_modules" ]; then
    ok "Dependencies installed"
  else
    fail "npm install failed"
    FAILED_STEP="npm-install"; ERROR_MSG="npm install failed"
    return 1
  fi
}

build_app() {
  if [ "${AGENTREEL_NO_BUILD:-0}" = "1" ]; then
    warn "Skipping build (AGENTREEL_NO_BUILD=1)"
    return 0
  fi

  log "Building AgentReel..."
  cd "$INSTALL_DIR"
  npx next build 2>&1 | tail -5
  if [ -f ".next/BUILD_ID" ]; then
    ok "Build complete"
  else
    fail "Build failed"
    FAILED_STEP="build"; ERROR_MSG="next build failed"
    return 1
  fi
}

deploy_openclaw_skill() {
  local skill_dir="$HOME/.openclaw/workspace/skills"
  if [ -d "$HOME/.openclaw" ]; then
    mkdir -p "$skill_dir"
    cat > "$skill_dir/agentreel.md" << 'SKILLEOF'
# AgentReel Integration

AgentReel is installed and monitoring your sessions in real-time.

## MCP Tools Available

If the `agentreel` MCP server is configured, you have these tools:
- **agentreel_status** — Check if viewer/relay/streaming are running
- **agentreel_sessions** — List recent sessions (with size, time, active status)
- **agentreel_live_url** — Get the live viewer URL to share with users
- **agentreel_replay_url** — Get replay URL for a specific session
- **agentreel_config** — View or update AgentReel settings

Use `agentreel_live_url` to share your live work with others.
Use `agentreel_replay_url` after completing a task to share the replay.

## Format Tags for Rich Visualization

Use these tags in your output to enhance the live viewer display:
- [PLAN] 1. First step  2. Second step — displayed as todo list
- [STEP 1/3 BEGIN] ... [STEP 1/3 COMPLETE] — progress tracking
- [THINKING] your analysis — shown as thinking card
- [DISCOVERY] something interesting — highlighted discovery
- [CHALLENGE] a problem encountered — problem indicator
- [OUTPUT] final result — task output
- [SUMMARY] task summary — completion summary

## MCP Setup

If not already configured, add to openclaw.json:
```json
{
  "mcpServers": {
    "agentreel": {
      "command": "python3",
      "args": ["~/.agentreel/mcp/agentreel_mcp.py"]
    }
  }
}
```
SKILLEOF
    ok "OpenClaw skill deployed ($skill_dir/agentreel.md)"
  fi
}

create_cli() {
  log "Creating CLI entry point..."

  mkdir -p "$HOME/.local/bin"

  cat > "$HOME/.local/bin/agentreel" << 'CLIEOF'
#!/usr/bin/env bash
set -euo pipefail

AGENTREEL_DIR="${AGENTREEL_DIR:-$HOME/.agentreel}"
CONFIG_FILE="$AGENTREEL_DIR/.agentreel-config.json"

usage() {
  echo "AgentReel — AI Agent Control Plane"
  echo ""
  echo "Usage: agentreel <command> [options]"
  echo ""
  echo "Commands:"
  echo "  start           Start viewer + relay server"
  echo "  stop            Stop all AgentReel services"
  echo "  status          Show service status"
  echo "  config          Show or set configuration"
  echo "  install stream  Install streaming module (VNC + ffmpeg)"
  echo "  stream          Start RTMP streaming to YouTube/Twitch"
  echo "  update          Update to latest version"
  echo "  help            Show this help"
  echo ""
  echo "Config: $CONFIG_FILE"
  echo "Install: $AGENTREEL_DIR"
}

find_port() {
  local port="${1:-3000}"
  for _ in $(seq 1 10); do
    if ! (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null; then
      echo "$port"; return 0
    fi
    port=$(( port + 1 ))
  done
  echo "$port"
}

cmd_start() {
  local port
  port=$(find_port "${AGENTREEL_PORT:-3000}")
  local relay_port
  relay_port=$(find_port "${AGENTREEL_RELAY_PORT:-8765}")
  local watch_dir="${AGENTREEL_WATCH_DIR:-$HOME/.openclaw/agents/main/sessions/}"

  echo "Starting AgentReel..."

  mkdir -p "$AGENTREEL_DIR/logs" "$AGENTREEL_DIR/pids"

  # Relay server
  if command -v python3 &>/dev/null && [ -f "$AGENTREEL_DIR/server/relay_server.py" ]; then
    pkill -f "relay_server.py.*--port $relay_port" 2>/dev/null || true
    sleep 1
    if [ -d "$watch_dir" ]; then
      nohup python3 "$AGENTREEL_DIR/server/relay_server.py" \
        --watch-dir "$watch_dir" \
        --port "$relay_port" \
        > "$AGENTREEL_DIR/logs/relay.log" 2>&1 &
      echo $! > "$AGENTREEL_DIR/pids/relay.pid"
      echo "  Relay:  http://localhost:${relay_port} (watching $watch_dir)"
    else
      echo "  Relay:  skipped (no watch dir: $watch_dir)"
      echo "         Create it or set AGENTREEL_WATCH_DIR"
    fi
  else
    echo "  Relay:  skipped (Python 3.10+ or relay_server.py not found)"
  fi

  # Viewer (Next.js)
  cd "$AGENTREEL_DIR"
  if [ -f ".next/standalone/server.js" ]; then
    # Standalone mode: copy static assets then use node directly
    cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
    cp -r public .next/standalone/public 2>/dev/null || true
    PORT="$port" HOSTNAME="0.0.0.0" nohup node .next/standalone/server.js \
      > "$AGENTREEL_DIR/logs/viewer.log" 2>&1 &
    echo $! > "$AGENTREEL_DIR/pids/viewer.pid"
    echo "  Viewer: http://localhost:${port}"
  elif [ -f ".next/BUILD_ID" ]; then
    PORT="$port" nohup npx next start -p "$port" \
      > "$AGENTREEL_DIR/logs/viewer.log" 2>&1 &
    echo $! > "$AGENTREEL_DIR/pids/viewer.pid"
    echo "  Viewer: http://localhost:${port}"
  else
    PORT="$port" nohup npx next dev --turbopack -p "$port" \
      > "$AGENTREEL_DIR/logs/viewer.log" 2>&1 &
    echo $! > "$AGENTREEL_DIR/pids/viewer.pid"
    echo "  Viewer: http://localhost:${port} (dev mode)"
  fi

  echo ""
  echo "  Live:   http://localhost:${port}/live?stream=http://localhost:${relay_port}"
  echo "  Stop:   agentreel stop"
}

cmd_stop() {
  echo "Stopping AgentReel..."
  for pidfile in "$AGENTREEL_DIR/pids/"*.pid; do
    [ -f "$pidfile" ] || continue
    pid=$(cat "$pidfile")
    kill "$pid" 2>/dev/null && echo "  Stopped PID $pid" || true
    rm -f "$pidfile"
  done
  pkill -f "relay_server.py" 2>/dev/null || true
  echo "Done."
}

cmd_status() {
  echo "AgentReel Status"
  for pidfile in "$AGENTREEL_DIR/pids/"*.pid; do
    [ -f "$pidfile" ] || continue
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo "  $name: running (PID $pid)"
    else
      echo "  $name: stopped"
      rm -f "$pidfile"
    fi
  done
  [ ! -d "$AGENTREEL_DIR/pids" ] && echo "  No services running."
}

cmd_config() {
  if [ $# -eq 0 ]; then
    if [ -f "$CONFIG_FILE" ]; then
      cat "$CONFIG_FILE"
    else
      echo "{}"
    fi
    echo ""
    echo "Usage: agentreel config set <key> <value>"
    echo "       agentreel config get <key>"
    echo ""
    echo "Keys: port, relay_port, watch_dir, twitch_key, youtube_key,"
    echo "      resolution, bitrate, task_timeout, task_pause"
    return
  fi

  case "${1:-}" in
    set)
      [ $# -lt 3 ] && { echo "Usage: agentreel config set <key> <value>"; return 1; }
      python3 -c "
import json, os, sys
f = '$CONFIG_FILE'
d = json.load(open(f)) if os.path.exists(f) else {}
d['$2'] = '$3'
json.dump(d, open(f, 'w'), indent=2)
print('Set $2 = $3')
" 2>/dev/null || echo "{\"$2\": \"$3\"}" > "$CONFIG_FILE"
      ;;
    get)
      [ $# -lt 2 ] && { echo "Usage: agentreel config get <key>"; return 1; }
      python3 -c "
import json, os
f = '$CONFIG_FILE'
d = json.load(open(f)) if os.path.exists(f) else {}
print(d.get('$2', '(not set)'))
" 2>/dev/null || echo "(not set)"
      ;;
    *)
      echo "Usage: agentreel config [set|get] <key> [value]"
      ;;
  esac
}

cmd_install_stream() {
  echo "Installing streaming module..."
  if [ "$(uname -s)" != "Linux" ]; then
    echo "  Streaming module requires Linux (VNC + ffmpeg)."
    echo "  On macOS, use screen recording + OBS instead."
    return 1
  fi

  sudo apt-get update -qq
  sudo apt-get install -y -qq ffmpeg tigervnc-standalone-server tigervnc-common \
    fluxbox chromium-browser xdotool 2>/dev/null
  echo "  ✓ ffmpeg, VNC, fluxbox, Chromium installed"

  cp "$AGENTREEL_DIR/deploy/stream_dual.sh" "$HOME/stream_dual.sh" 2>/dev/null || true
  cp "$AGENTREEL_DIR/deploy/setup_desktop.sh" "$HOME/setup_desktop.sh" 2>/dev/null || true
  cp "$AGENTREEL_DIR/deploy/task_loop.sh" "$HOME/task_loop.sh" 2>/dev/null || true
  cp "$AGENTREEL_DIR/deploy/watchdog.sh" "$HOME/watchdog.sh" 2>/dev/null || true
  cp "$AGENTREEL_DIR/deploy/go_live.sh" "$HOME/go_live.sh" 2>/dev/null || true
  chmod +x "$HOME"/*.sh 2>/dev/null || true
  echo "  ✓ Deploy scripts copied to ~/"
  echo ""
  echo "  Next: agentreel config set twitch_key YOUR_KEY"
  echo "        agentreel config set youtube_key YOUR_KEY"
  echo "        agentreel stream"
}

cmd_stream() {
  echo "Starting RTMP stream..."
  if [ ! -f "$HOME/stream_dual.sh" ]; then
    echo "  Run 'agentreel install stream' first."
    return 1
  fi
  bash "$HOME/go_live.sh"
}

cmd_update() {
  echo "Updating AgentReel..."
  cd "$AGENTREEL_DIR"
  git pull --ff-only
  npm install 2>&1 | tail -3
  npx next build 2>&1 | tail -3
  echo "  ✓ Updated to latest version"
}

case "${1:-help}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  config)  shift; cmd_config "$@" ;;
  install) shift; case "${1:-}" in stream) cmd_install_stream ;; *) usage ;; esac ;;
  stream)  cmd_stream ;;
  update)  cmd_update ;;
  help|*)  usage ;;
esac
CLIEOF

  chmod +x "$HOME/.local/bin/agentreel"

  if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
      if [ -f "$rc" ]; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$rc"
        break
      fi
    done
    export PATH="$HOME/.local/bin:$PATH"
  fi

  ok "CLI installed: agentreel"
}

verify_install() {
  log "Verifying installation..."
  cd "$INSTALL_DIR"

  local server_cmd
  if [ -f ".next/standalone/server.js" ]; then
    cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
    cp -r public .next/standalone/public 2>/dev/null || true
    PORT=$PORT HOSTNAME=0.0.0.0 node .next/standalone/server.js &
    server_cmd="standalone"
  else
    PORT=$PORT npx next start -p "$PORT" &
    server_cmd="next start"
  fi
  local VIEWER_PID=$!
  sleep 5

  if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
    ok "Viewer responding on http://localhost:$PORT ($server_cmd)"
    kill $VIEWER_PID 2>/dev/null
    wait $VIEWER_PID 2>/dev/null || true
    return 0
  else
    warn "Viewer didn't respond (try: agentreel start)"
    kill $VIEWER_PID 2>/dev/null
    wait $VIEWER_PID 2>/dev/null || true
    return 0
  fi
}

send_report() {
  [ "${AGENTREEL_TELEMETRY:-on}" = "off" ] && return 0

  local duration=$(( $(date +%s) - START_TIME ))
  local result="success"
  [ -n "$FAILED_STEP" ] && result="failed"

  # Sanitize error message: strip paths containing usernames, IPs, tokens
  local safe_error
  safe_error=$(echo "${ERROR_MSG:-none}" | sed \
    -e 's|/home/[^/]*/|/home/***/|g' \
    -e 's|/Users/[^/]*/|/Users/***/|g' \
    -e 's|[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}|***.***.***.***|g' \
    -e 's|[a-zA-Z0-9_-]\{20,\}|***REDACTED***|g')

  local report
  report=$(cat <<REPORTEOF
{
  "version": "${VERSION}",
  "os": "$(uname -srm)",
  "arch": "$(uname -m)",
  "node": "$(node -v 2>/dev/null || echo 'N/A')",
  "python": "$(python3 -V 2>&1 2>/dev/null || echo 'N/A')",
  "npm": "$(npm -v 2>/dev/null || echo 'N/A')",
  "result": "${result}",
  "duration_s": ${duration},
  "failed_step": "${FAILED_STEP:-none}",
  "error": "${safe_error}",
  "has_openclaw": $(command -v openclaw &>/dev/null && echo "true" || echo "false"),
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%S")"
}
REPORTEOF
)

  # No IP, hostname, username, API keys, or paths in the report
  curl -sf -X POST \
    -H "Content-Type: application/json" \
    -d "$report" \
    "$REPORT_URL" >/dev/null 2>&1 || true
}

print_success() {
  local duration=$(( $(date +%s) - START_TIME ))
  echo ""
  echo -e "${GREEN}${BOLD}  ✅ AgentReel installed successfully! (${duration}s)${NC}"
  echo ""
  echo "  Quick start:"
  echo "    agentreel start        Start viewer + relay"
  echo "    agentreel stop         Stop services"
  echo "    agentreel config       Show/set configuration"
  echo "    agentreel help         All commands"
  echo ""
  echo "  Optional streaming (Linux only):"
  echo "    agentreel install stream   Install VNC + ffmpeg"
  echo "    agentreel stream           Push to YouTube/Twitch"
  echo ""
  echo "  View at: http://localhost:${PORT}"
  echo "  Docs:    https://github.com/Jiansen/agentreel"
  echo ""
  if command -v openclaw &>/dev/null; then
    echo -e "  ${CYAN}OpenClaw detected! Try this:${NC}"
    echo "    1. Run: agentreel start"
    echo "    2. Send a message to your OpenClaw agent (via Telegram or CLI)"
    echo "    3. Watch it appear live at http://localhost:${PORT}/live"
    echo ""
  else
    echo "  To see live agent activity, install OpenClaw first:"
    echo "    curl -fsSL https://openclaw.ai/install.sh | bash"
    echo ""
  fi
  if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
    echo -e "  ${YELLOW}Note: Run 'source ~/.bashrc' or restart your shell to use 'agentreel' command${NC}"
    echo ""
  fi
}

print_failure() {
  local duration=$(( $(date +%s) - START_TIME ))
  echo ""
  echo -e "${RED}${BOLD}  ❌ Installation failed at step: ${FAILED_STEP} (${duration}s)${NC}"
  echo "  Error: ${ERROR_MSG}"
  echo ""
  echo "  Try:"
  echo "    1. Fix the error above"
  echo "    2. Re-run: curl -fsSL https://agentreel.agent-status.com/install.sh | bash"
  echo ""
  echo "  Or ask your AI agent:"
  echo "    Install AgentReel by following https://agentreel.agent-status.com/api/install"
  echo ""
}

# === MAIN ===

banner
detect_os

log "Step 1/6: Checking Node.js..."
install_node || { print_failure; send_report; exit 1; }

log "Step 2/6: Checking Python..."
install_python

log "Step 3/6: Checking git..."
install_git || { print_failure; send_report; exit 1; }

log "Step 4/6: Cloning repository..."
clone_repo || { print_failure; send_report; exit 1; }

log "Step 5/6: Installing dependencies..."
install_deps || { print_failure; send_report; exit 1; }

log "Step 6/6: Building..."
build_app || { print_failure; send_report; exit 1; }

create_cli
deploy_openclaw_skill
verify_install

print_success
send_report
