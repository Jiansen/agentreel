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

install_desktop() {
  if [ "${AGENTREEL_NO_DESKTOP:-0}" = "1" ]; then
    warn "Skipping desktop (AGENTREEL_NO_DESKTOP=1)"
    return 0
  fi

  if [ "$OS" = "macos" ]; then
    warn "Desktop module not available on macOS (use Screen Sharing or OBS for streaming)"
    return 0
  fi

  log "Installing desktop environment (Xvfb + Chromium)..."

  local pkgs_needed=""
  check_command Xvfb  || pkgs_needed="$pkgs_needed xvfb"
  check_command ffmpeg || pkgs_needed="$pkgs_needed ffmpeg"
  check_command xdotool || pkgs_needed="$pkgs_needed xdotool"

  if [ -n "$pkgs_needed" ]; then
    sudo apt-get update -qq 2>/dev/null
    # shellcheck disable=SC2086
    sudo apt-get install -y -qq $pkgs_needed 2>/dev/null
  fi

  if ! check_command chromium && ! check_command chromium-browser; then
    if check_command snap; then
      sudo snap install chromium 2>/dev/null || sudo apt-get install -y -qq chromium-browser 2>/dev/null
    else
      sudo apt-get install -y -qq chromium-browser 2>/dev/null
    fi
  fi

  local desktop_ok=true
  if check_command Xvfb; then
    ok "Xvfb installed"
  else
    warn "Xvfb not installed"; desktop_ok=false
  fi
  if check_command chromium || check_command chromium-browser; then
    ok "Chromium installed"
  else
    warn "Chromium not installed"; desktop_ok=false
  fi
  if check_command ffmpeg; then
    ok "ffmpeg installed"
  else
    warn "ffmpeg not installed (streaming won't work, but live page will)"
  fi

  if [ "$desktop_ok" = true ]; then
    ok "Desktop environment ready"
  else
    warn "Partial desktop install — /live page may show 'Waiting for VNC'"
    warn "Fix: sudo apt-get install xvfb chromium-browser"
  fi
}

deploy_openclaw_skill() {
  if [ -d "$HOME/.openclaw" ]; then
    local skill_dir="$HOME/.openclaw/skills/agentreel"
    mkdir -p "$skill_dir"
    cp "$INSTALL_DIR/skills/agentreel/SKILL.md" "$skill_dir/SKILL.md"
    ok "OpenClaw skill deployed ($skill_dir/SKILL.md)"
    log "  Skill uses requires.bins=[agentreel] — auto-eligible when agentreel is on PATH"

    local memory_file="$HOME/.openclaw/workspace/MEMORY.md"
    mkdir -p "$(dirname "$memory_file")"
    local agentreel_block
    agentreel_block=$(cat <<'MEMBLOCK'

## AgentReel

AgentReel is installed on this machine. It records agent sessions and makes them
viewable as live streams or replays.

### Where to Watch

- Public viewer: https://agentreel.agent-status.com/live
- Local viewer: http://localhost:3000/live (after `agentreel start`)
- GitHub: https://github.com/Jiansen/agentreel

### Commands

- `agentreel start` — start the viewer and relay server
- `agentreel stop` — stop all services
- `agentreel status` — check if services are running
- `agentreel doctor` — full system health check
- `agentreel doctor --report` — health check + submit report to GitHub Issues
- `agentreel config` — show/set configuration
- `agentreel update` — update to latest version

### Format Tags

When executing tasks, use these tags for the live viewer:
[PLAN], [STEP X/N BEGIN], [STEP X/N COMPLETE], [THINKING],
[DISCOVERY], [CHALLENGE], [OUTPUT], [SUMMARY]

### Troubleshooting

1. Run `agentreel doctor` for a full check with fix suggestions
2. If still broken: `agentreel doctor --report` submits diagnostics to GitHub
MEMBLOCK
)
    if [ -f "$memory_file" ]; then
      if grep -q "## AgentReel" "$memory_file" 2>/dev/null; then
        ok "MEMORY.md already contains AgentReel section (skipped)"
      else
        echo "$agentreel_block" >> "$memory_file"
        ok "MEMORY.md updated with AgentReel section"
      fi
    else
      echo "# Memory" > "$memory_file"
      echo "$agentreel_block" >> "$memory_file"
      ok "MEMORY.md created with AgentReel section"
    fi
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
  echo "  doctor          Full system health check"
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
  local display_num="${AGENTREEL_DISPLAY:-:99}"
  local resolution="${AGENTREEL_RESOLUTION:-1920x1080}"

  echo "Starting AgentReel..."

  mkdir -p "$AGENTREEL_DIR/logs" "$AGENTREEL_DIR/pids"

  # Desktop (Xvfb + Chromium)
  if command -v Xvfb &>/dev/null && [ "${AGENTREEL_NO_DESKTOP:-0}" != "1" ]; then
    if ! pgrep -f "Xvfb ${display_num}" >/dev/null 2>&1; then
      Xvfb "$display_num" -screen 0 "${resolution}x24" &
      echo $! > "$AGENTREEL_DIR/pids/xvfb.pid"
      sleep 1
      echo "  Desktop: Xvfb ${display_num} (${resolution})"
    else
      echo "  Desktop: Xvfb ${display_num} already running"
    fi

    local chromium_cmd=""
    if command -v chromium &>/dev/null; then chromium_cmd="chromium"
    elif command -v chromium-browser &>/dev/null; then chromium_cmd="chromium-browser"
    fi

    if [ -n "$chromium_cmd" ] && ! pgrep -f "chromium.*broadcast" >/dev/null 2>&1; then
      sleep 2
      local broadcast_url="http://localhost:${port}/broadcast?preset=landscape&relay=http%3A%2F%2Flocalhost%3A${relay_port}"
      DISPLAY="$display_num" nohup "$chromium_cmd" \
        --no-sandbox --disable-gpu \
        --user-data-dir=/tmp/chromium-bcast \
        --window-size="${resolution%%x*},${resolution##*x}" \
        --no-first-run --disable-background-timer-throttling \
        --disable-session-crashed-bubble --disable-infobars \
        --disable-notifications --kiosk "$broadcast_url" \
        > "$AGENTREEL_DIR/logs/chromium.log" 2>&1 &
      echo $! > "$AGENTREEL_DIR/pids/chromium.pid"
      echo "  Browser: Chromium kiosk → /broadcast"
    fi
  else
    echo "  Desktop: skipped (Xvfb not found or disabled)"
  fi

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
  if [ -f ".next/BUILD_ID" ]; then
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
  echo "  Live:   http://localhost:${port}/live"
  echo "  Stop:   agentreel stop"
}

cmd_stop() {
  echo "Stopping AgentReel..."
  for pidfile in "$AGENTREEL_DIR/pids/"*.pid; do
    [ -f "$pidfile" ] || continue
    local name pid
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    kill "$pid" 2>/dev/null && echo "  Stopped $name (PID $pid)" || true
    rm -f "$pidfile"
  done
  pkill -f "relay_server.py" 2>/dev/null || true
  pkill -f "chromium.*broadcast" 2>/dev/null || true
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

cmd_doctor() {
  local pass=0 warn_count=0 fail_count=0 total=0
  local report_lines=""
  local DOCTOR_REPORT_URL="https://agentreel.agent-status.com/api/install-report"

  _check() {
    local status="$1" label="$2" detail="$3"
    total=$(( total + 1 ))
    case "$status" in
      PASS) pass=$(( pass + 1 )); echo "  ✅ $label  $detail" ;;
      WARN) warn_count=$(( warn_count + 1 )); echo "  ⚠️  $label  $detail" ;;
      FAIL) fail_count=$(( fail_count + 1 )); echo "  ❌ $label  $detail" ;;
    esac
    report_lines="${report_lines}${status}|${label}|${detail}\n"
  }

  _suggest() { echo "     → $1"; }

  echo ""
  echo "AgentReel Doctor — Full System Check"
  echo "═══════════════════════════════════════"
  echo ""

  # 1. Build
  if [ -f "$AGENTREEL_DIR/.next/BUILD_ID" ]; then
    _check PASS "Build" ".next/BUILD_ID present"
  else
    _check FAIL "Build" "No build found in $AGENTREEL_DIR/.next/"
    _suggest "Run: cd $AGENTREEL_DIR && npm install && npx next build"
  fi

  # 2. Viewer process
  local viewer_ok=false
  if [ -f "$AGENTREEL_DIR/pids/viewer.pid" ]; then
    local vpid
    vpid=$(cat "$AGENTREEL_DIR/pids/viewer.pid")
    if kill -0 "$vpid" 2>/dev/null; then
      local vport="${AGENTREEL_PORT:-3000}"
      if curl -sf "http://localhost:$vport" >/dev/null 2>&1; then
        _check PASS "Viewer" "running (PID $vpid), http://localhost:$vport responds"
        viewer_ok=true
      else
        _check WARN "Viewer" "process running (PID $vpid) but HTTP not responding"
        _suggest "Check logs: tail $AGENTREEL_DIR/logs/viewer.log"
      fi
    else
      _check FAIL "Viewer" "PID file exists but process not running"
      _suggest "Run: agentreel start"
    fi
  else
    _check FAIL "Viewer" "not running (no PID file)"
    _suggest "Run: agentreel start"
  fi

  # 3. Relay process
  local relay_ok=false
  if [ -f "$AGENTREEL_DIR/pids/relay.pid" ]; then
    local rpid
    rpid=$(cat "$AGENTREEL_DIR/pids/relay.pid")
    if kill -0 "$rpid" 2>/dev/null; then
      local rport="${AGENTREEL_RELAY_PORT:-8765}"
      if curl -sf "http://localhost:$rport/health" >/dev/null 2>&1; then
        _check PASS "Relay" "running (PID $rpid), http://localhost:$rport responds"
        relay_ok=true
      else
        _check WARN "Relay" "process running (PID $rpid) but /health not responding"
        _suggest "Check logs: tail $AGENTREEL_DIR/logs/relay.log"
      fi
    else
      _check FAIL "Relay" "PID file exists but process not running"
      _suggest "Run: agentreel start"
    fi
  else
    _check FAIL "Relay" "not running (no PID file)"
    _suggest "Run: agentreel start"
  fi

  # 4. Sessions directory
  local watch_dir="${AGENTREEL_WATCH_DIR:-$HOME/.openclaw/agents/main/sessions/}"
  if [ -d "$watch_dir" ]; then
    local file_count
    file_count=$(find "$watch_dir" -maxdepth 2 -name "*.jsonl" -type f 2>/dev/null | wc -l | tr -d ' ')
    if [ "$file_count" -gt 0 ]; then
      local latest
      latest=$(find "$watch_dir" -maxdepth 2 -name "*.jsonl" -type f -printf '%T@ %p\n' 2>/dev/null \
        | sort -rn | head -1 | cut -d' ' -f2- 2>/dev/null || \
        find "$watch_dir" -maxdepth 2 -name "*.jsonl" -type f -exec ls -t {} + 2>/dev/null | head -1)
      local latest_name
      latest_name=$(basename "$latest" 2>/dev/null || echo "unknown")
      _check PASS "Sessions" "$watch_dir ($file_count sessions, latest: $latest_name)"
    else
      _check WARN "Sessions" "$watch_dir exists but no .jsonl files yet"
      _suggest "Send a task to your AI agent to generate sessions"
    fi
  else
    _check WARN "Sessions" "watch dir not found: $watch_dir"
    _suggest "Install OpenClaw or set AGENTREEL_WATCH_DIR"
  fi

  # 5. OpenClaw
  if command -v openclaw &>/dev/null; then
    local gw_running=false
    if pgrep -f "openclaw.*gateway" >/dev/null 2>&1 || \
       systemctl is-active openclaw-gateway >/dev/null 2>&1; then
      gw_running=true
    fi
    if [ "$gw_running" = true ]; then
      _check PASS "OpenClaw" "installed, gateway running"
    else
      _check WARN "OpenClaw" "installed but gateway not running"
      _suggest "Start it: openclaw gateway start (or systemctl start openclaw-gateway)"
    fi
  else
    _check WARN "OpenClaw" "not installed (optional)"
    _suggest "Install: curl -fsSL https://openclaw.ai/install.sh | bash"
  fi

  # 6. Ports
  local vport="${AGENTREEL_PORT:-3000}"
  local rport="${AGENTREEL_RELAY_PORT:-8765}"
  if (echo >/dev/tcp/127.0.0.1/"$vport") 2>/dev/null; then
    if [ "$viewer_ok" = true ]; then
      _check PASS "Port $vport" "in use by AgentReel viewer"
    else
      _check WARN "Port $vport" "in use by another process"
      _suggest "Check: lsof -i :$vport | head -5"
    fi
  else
    if [ "$viewer_ok" = true ]; then
      _check WARN "Port $vport" "viewer running but port not responding"
    else
      _check PASS "Port $vport" "available"
    fi
  fi
  if (echo >/dev/tcp/127.0.0.1/"$rport") 2>/dev/null; then
    if [ "$relay_ok" = true ]; then
      _check PASS "Port $rport" "in use by AgentReel relay"
    else
      _check WARN "Port $rport" "in use by another process"
      _suggest "Check: lsof -i :$rport | head -5"
    fi
  else
    if [ "$relay_ok" = true ]; then
      _check WARN "Port $rport" "relay running but port not responding"
    else
      _check PASS "Port $rport" "available"
    fi
  fi

  # 7. Skill
  local skill_path="$HOME/.openclaw/skills/agentreel/SKILL.md"
  if [ -f "$skill_path" ]; then
    _check PASS "Skill" "$skill_path present"
  elif [ -d "$HOME/.openclaw" ]; then
    _check WARN "Skill" "OpenClaw found but skill not deployed"
    _suggest "Run: agentreel update (redeploys skill) or copy manually"
  else
    _check PASS "Skill" "skipped (no OpenClaw)"
  fi

  # 8. Config
  if [ -f "$CONFIG_FILE" ]; then
    _check PASS "Config" "$CONFIG_FILE present"
  else
    _check WARN "Config" "no config file (using defaults)"
    _suggest "Create one: agentreel config set port $vport"
  fi

  # Summary
  echo ""
  echo "═══════════════════════════════════════"
  echo "  Result: $pass passed, $warn_count warnings, $fail_count failed (of $total checks)"

  if [ "$fail_count" -gt 0 ]; then
    echo ""
    echo "  Some checks failed. Fix the issues above, then run: agentreel doctor"
    echo ""
    echo "  Submit diagnostic report to GitHub?"
    echo "    agentreel doctor --report"
  fi
  echo ""

  # --report flag: submit to GitHub via webhook
  if [ "${1:-}" = "--report" ]; then
    echo "  Submitting diagnostic report..."
    local doc_report
    doc_report=$(cat <<DOCEOF
{
  "version": "doctor-1.0",
  "type": "doctor",
  "os": "$(uname -srm)",
  "node": "$(node -v 2>/dev/null || echo 'N/A')",
  "python": "$(python3 -V 2>&1 2>/dev/null || echo 'N/A')",
  "result": "pass=${pass},warn=${warn_count},fail=${fail_count}",
  "checks": "$(echo -e "$report_lines" | sed 's/"/\\"/g' | tr '\n' ';')",
  "has_openclaw": $(command -v openclaw &>/dev/null && echo "true" || echo "false"),
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%S")"
}
DOCEOF
)
    if curl -sf -X POST -H "Content-Type: application/json" \
         -d "$doc_report" "$DOCTOR_REPORT_URL" >/dev/null 2>&1; then
      echo "  ✅ Report submitted — check https://github.com/Jiansen/agentreel/issues"
    else
      echo "  ⚠️  Report submission failed (network issue or endpoint down)"
    fi
    echo ""
  fi

  return "$fail_count"
}

case "${1:-help}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  doctor)  shift; cmd_doctor "$@" ;;
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

VIEWER_VERIFIED="false"

verify_install() {
  log "Verifying installation..."
  cd "$INSTALL_DIR"

  PORT=$PORT npx next start -p "$PORT" &
  local VIEWER_PID=$!
  sleep 5

  if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
    ok "Viewer responding on http://localhost:$PORT"
    VIEWER_VERIFIED="true"
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

print_acceptance_report() {
  local duration=$(( $(date +%s) - START_TIME ))
  local has_build=false has_relay=false has_openclaw=false has_skill=false
  local viewer_verified="${VIEWER_VERIFIED:-false}"

  [ -f "$INSTALL_DIR/.next/BUILD_ID" ] && has_build=true
  [ -f "$INSTALL_DIR/server/relay_server.py" ] && command -v python3 &>/dev/null && has_relay=true
  command -v openclaw &>/dev/null && has_openclaw=true
  [ -f "$HOME/.openclaw/skills/agentreel/SKILL.md" ] && has_skill=true

  echo ""
  echo -e "${BOLD}${CYAN}"
  echo "  ╔═══════════════════════════════════════════╗"
  echo "  ║      AgentReel Installation Report        ║"
  echo "  ╚═══════════════════════════════════════════╝"
  echo -e "${NC}"

  echo -e "  ${BOLD}Core Components${NC}"
  if [ "$has_build" = true ]; then
    echo -e "    ${GREEN}✓${NC} Viewer (Next.js)                installed"
  else
    echo -e "    ${RED}✗${NC} Viewer                           build failed"
  fi
  if [ "$has_relay" = true ]; then
    echo -e "    ${GREEN}✓${NC} Relay Server (Python SSE)       installed"
  else
    echo -e "    ${YELLOW}–${NC} Relay Server                     skipped (needs Python 3.10+)"
  fi
  echo -e "    ${GREEN}✓${NC} CLI (agentreel)                  installed"

  echo ""
  echo -e "  ${BOLD}Integration${NC}"
  if [ "$has_skill" = true ]; then
    echo -e "    ${GREEN}✓${NC} OpenClaw Skill                   deployed"
  elif [ "$has_openclaw" = true ]; then
    echo -e "    ${YELLOW}–${NC} OpenClaw Skill                   deploy failed"
  else
    echo -e "    ${YELLOW}–${NC} OpenClaw Skill                   skipped (OpenClaw not found)"
  fi
  echo -e "    ${YELLOW}–${NC} MCP Server                       available (manual: mcp/agentreel_mcp.py)"

  echo ""
  echo -e "  ${BOLD}Desktop${NC}"
  if command -v Xvfb &>/dev/null; then
    echo -e "    ${GREEN}✓${NC} Virtual Display (Xvfb)           installed"
  else
    echo -e "    ${YELLOW}–${NC} Virtual Display (Xvfb)           not installed"
  fi
  if command -v chromium &>/dev/null || command -v chromium-browser &>/dev/null; then
    echo -e "    ${GREEN}✓${NC} Chromium                          installed"
  else
    echo -e "    ${YELLOW}–${NC} Chromium                          not installed"
  fi

  echo ""
  echo -e "  ${BOLD}Optional Modules${NC}"
  if command -v ffmpeg &>/dev/null; then
    echo -e "    ${GREEN}✓${NC} Streaming (ffmpeg)               installed"
    echo "       → Config: agentreel config set youtube_key YOUR_KEY"
  else
    echo -e "    ${YELLOW}–${NC} Streaming (ffmpeg)               not installed"
    echo "       → Install: sudo apt-get install ffmpeg"
  fi

  echo ""
  echo -e "  ${BOLD}Verification${NC}"
  if [ "$viewer_verified" = true ]; then
    echo -e "    ${GREEN}✓${NC} Viewer HTTP check                passed"
  else
    echo -e "    ${YELLOW}–${NC} Viewer HTTP check                skipped or failed"
  fi
  echo "       → Full check: agentreel doctor"

  echo ""
  echo -e "  ${BOLD}Configuration${NC}"
  echo "    Install dir:   $INSTALL_DIR"
  echo "    Viewer port:   $PORT"
  echo "    Relay port:    ${AGENTREEL_RELAY_PORT:-8765}"
  echo "    Watch dir:     ${AGENTREEL_WATCH_DIR:-~/.openclaw/agents/main/sessions/}"
  echo "    Config file:   $INSTALL_DIR/.agentreel-config.json"
  if [ -n "${ADMIN_TOKEN:-}" ]; then
    echo "    Admin token:   $ADMIN_TOKEN"
    echo "    Settings URL:  http://localhost:${PORT}/settings"
  fi

  echo ""
  echo -e "  ${BOLD}Access URLs${NC}"
  echo "    Local:   http://localhost:${PORT}/live"
  local pub_ip
  pub_ip=$(curl -sf --max-time 3 https://ifconfig.me 2>/dev/null || curl -sf --max-time 3 https://api.ipify.org 2>/dev/null || echo "")
  if [ -n "$pub_ip" ]; then
    echo "    Public:  http://${pub_ip}:${PORT}/live"
    echo -e "    ${YELLOW}Note: public access requires port ${PORT} open in firewall/security group${NC}"
  else
    echo "    Public:  (could not detect public IP)"
    echo "    Tip:     if on a cloud server, open port ${PORT} and use your server's public IP"
  fi

  echo ""
  echo -e "  ${BOLD}Next Steps${NC}"
  echo "    1. agentreel start              Start viewer + relay"
  echo "    2. agentreel doctor             Verify everything works"
  if [ "$has_openclaw" = true ]; then
    echo "    3. Send a task to your agent    Watch at the URLs above"
  else
    echo "    3. Install OpenClaw             curl -fsSL https://openclaw.ai/install.sh | bash"
    echo "    4. Send a task to your agent    Watch at the URLs above"
  fi
  echo ""
  echo "  Docs: https://github.com/Jiansen/agentreel"

  echo ""
  echo -e "  ${GREEN}${BOLD}✅ Installation completed in ${duration}s${NC}"

  if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
    echo ""
    echo -e "  ${YELLOW}Note: Run 'source ~/.bashrc' or restart your shell to use 'agentreel' command${NC}"
  fi
  echo ""
}

notify_agent_start() {
  echo ""
  echo "---AGENTREEL_INSTALL_START---"
  echo "AgentReel installation starting on $(uname -srm)."
  echo "Installer v${VERSION}. This may take 1-3 minutes."
  echo "Steps: Node.js → Python → git → clone → npm install → build → CLI → verify"
  echo "---AGENTREEL_INSTALL_START_END---"
  echo ""
}

notify_agent_end() {
  local duration=$(( $(date +%s) - START_TIME ))
  local result="SUCCESS"
  [ -n "$FAILED_STEP" ] && result="FAILED at $FAILED_STEP"

  local components="viewer"
  command -v python3 &>/dev/null && [ -f "$INSTALL_DIR/server/relay_server.py" ] && components="$components, relay"
  components="$components, cli"
  command -v openclaw &>/dev/null && [ -f "$HOME/.openclaw/skills/agentreel/SKILL.md" ] && components="$components, openclaw-skill"

  local pub_ip
  pub_ip=$(curl -sf --max-time 3 https://ifconfig.me 2>/dev/null || echo "")

  echo ""
  echo "---AGENTREEL_INSTALL_DONE---"
  echo "Result: $result (${duration}s)"
  echo "Components: $components"
  echo "Port: $PORT"
  if [ "$result" = "SUCCESS" ]; then
    echo "Quick start: agentreel start && agentreel doctor"
    echo "Local URL: http://localhost:${PORT}/live"
    [ -n "$pub_ip" ] && echo "Public URL: http://${pub_ip}:${PORT}/live (requires port ${PORT} open in firewall)"
    [ -n "${ADMIN_TOKEN:-}" ] && echo "Settings: http://localhost:${PORT}/settings (token: ${ADMIN_TOKEN})"
    echo "IMPORTANT: Save the admin token above — it's needed to access settings."
  else
    echo "Error: ${ERROR_MSG}"
    echo "Retry: curl -fsSL https://agentreel.agent-status.com/install.sh | bash"
    echo "Debug: agentreel doctor --report"
  fi
  echo "---AGENTREEL_INSTALL_DONE_END---"
  echo ""
}

print_success() {
  notify_agent_end
  print_acceptance_report
}

print_failure() {
  notify_agent_end
  local duration=$(( $(date +%s) - START_TIME ))
  echo ""
  echo -e "${RED}${BOLD}  ❌ Installation failed at step: ${FAILED_STEP} (${duration}s)${NC}"
  echo "  Error: ${ERROR_MSG}"
  echo ""
  echo "  Try:"
  echo "    1. Fix the error above"
  echo "    2. Re-run: curl -fsSL https://agentreel.agent-status.com/install.sh | bash"
  echo ""
  echo "  Debug: agentreel doctor --report"
  echo ""
}

# === Parse flags ===

for arg in "$@"; do
  case "$arg" in
    --no-desktop)  export AGENTREEL_NO_DESKTOP=1 ;;
    --no-relay)    export AGENTREEL_NO_RELAY=1 ;;
    --minimal)     export AGENTREEL_NO_DESKTOP=1; export AGENTREEL_NO_RELAY=1 ;;
  esac
done

# === MAIN ===

banner
notify_agent_start
detect_os

log "Step 1/7: Checking Node.js..."
install_node || { print_failure; send_report; exit 1; }

log "Step 2/7: Checking Python..."
install_python

log "Step 3/7: Checking git..."
install_git || { print_failure; send_report; exit 1; }

log "Step 4/7: Cloning repository..."
clone_repo || { print_failure; send_report; exit 1; }

log "Step 5/7: Installing dependencies..."
install_deps || { print_failure; send_report; exit 1; }

log "Step 6/7: Building..."
build_app || { print_failure; send_report; exit 1; }

log "Step 7/7: Desktop environment..."
install_desktop

create_cli
deploy_openclaw_skill

# Generate admin token for settings panel
ADMIN_TOKEN=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))" 2>/dev/null || head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 32)
CONFIG_DIR="$INSTALL_DIR"
CONFIG_PATH="$CONFIG_DIR/.agentreel-config.json"
mkdir -p "$CONFIG_DIR"
if [ -f "$CONFIG_PATH" ]; then
  python3 -c "
import json
f = '$CONFIG_PATH'
d = json.load(open(f))
if '_admin_token' not in d:
    d['_admin_token'] = '$ADMIN_TOKEN'
    json.dump(d, open(f, 'w'), indent=2)
" 2>/dev/null
else
  echo "{\"_admin_token\": \"$ADMIN_TOKEN\"}" > "$CONFIG_PATH"
fi
log "Admin token generated for settings panel"

verify_install

print_success
send_report
