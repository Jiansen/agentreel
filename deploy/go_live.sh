#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Go Live
# One-command startup for 24h live streaming.
#
# Starts: VNC → relay server → task loop → desktop layout → (optional) RTMP stream → watchdog
#
# Usage:
#   ./go_live.sh
#   source ~/stream.env && ./go_live.sh
#
# Prerequisites:
#   - Server set up with deploy/setup_server.sh
#   - OpenClaw configured (openclaw configure)
#   - VNC password set (vncpasswd)
#   - relay_server.py, task_loop.sh, stream_dual.sh, setup_desktop.sh, watchdog.sh in ~/
#   - (Optional) ~/stream.env with YT_*/TW_* for YouTube/Twitch streaming

# Load centralized config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_config="${SCRIPT_DIR}/../lib/config.sh"
[ -f "$_config" ] && . "$_config"
[ -f "${AGENTREEL_DIR:-$HOME/.agentreel}/lib/config.sh" ] && . "${AGENTREEL_DIR:-$HOME/.agentreel}/lib/config.sh"

if ! command -v openclaw &>/dev/null; then
  echo "ERROR: openclaw not found. Install OpenClaw first." >&2
  exit 1
fi
RELAY_PORT="${AGENTREEL_RELAY_PORT}"

log() { echo "[go-live] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"; }
mkdir -p ~/pids ~/logs ~/digests

log "=== AgentReel Go Live ==="

# [1/6] VNC
log "[1/6] Checking VNC..."
if vncserver -list 2>/dev/null | grep -q ":1"; then
  log "VNC :1 already running"
else
  ~/start-vnc.sh
  sleep 3
fi
export DISPLAY="${AGENTREEL_DISPLAY}"

# [2/6] Relay server
log "[2/6] Starting relay server on :${RELAY_PORT}..."
pkill -f "relay_server.py" 2>/dev/null || true
sleep 1
nohup python3 "${AGENTREEL_DIR}/server/relay_server.py" \
  --watch-dir "${AGENTREEL_WATCH_DIR}" \
  --port "$RELAY_PORT" \
  > "${AGENTREEL_LOG_DIR}/relay.log" 2>&1 &
echo $! > ~/pids/relay.pid
log "relay PID: $(cat ~/pids/relay.pid)"

# [3/6] Task loop
log "[3/6] Starting task loop..."
pkill -f "task_loop.sh" 2>/dev/null || true
sleep 1
nohup bash ~/task_loop.sh \
  > ~/logs/task_loop.log 2>&1 &
echo $! > ~/pids/tasks.pid
log "tasks PID: $(cat ~/pids/tasks.pid)"

# [4/6] Desktop layout
log "[4/6] Setting up desktop..."
sleep 3
bash ~/setup_desktop.sh 2>&1 || log "Desktop setup warnings (non-fatal)"

# [5/6] RTMP streaming (if configured)
if [[ -n "${YT_STREAM_KEY:-}" || -n "${TW_STREAM_KEY:-}" ]]; then
  log "[5/6] Starting dual RTMP stream..."
  pkill -f "stream_dual.sh" 2>/dev/null || true
  sleep 1
  nohup bash ~/stream_dual.sh > ~/logs/stream.log 2>&1 &
  echo $! > ~/pids/stream.pid
  log "stream PID: $(cat ~/pids/stream.pid)"
else
  log "[5/6] SKIP: No stream keys. Set YT_STREAM_KEY/TW_STREAM_KEY to enable RTMP."
fi

# [6/6] Watchdog
log "[6/6] Starting watchdog..."
pkill -f "watchdog.sh" 2>/dev/null || true
sleep 1
nohup bash ~/watchdog.sh > ~/logs/watchdog.log 2>&1 &
echo $! > ~/pids/watchdog.pid
log "watchdog PID: $(cat ~/pids/watchdog.pid)"

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
log ""
log "=== All services started ==="
log ""
log "  Relay:    http://localhost:${RELAY_PORT}"
log "  Tasks:    tail -f ~/logs/task_loop.log"
[[ -f ~/pids/stream.pid ]] && log "  Stream:   RTMP dual (PID $(cat ~/pids/stream.pid))"
log "  Watchdog: monitoring all services"
log ""
log "  View live: https://agentreel.agent-status.com/live?stream=http://${SERVER_IP}:${RELAY_PORT}"
log ""
log "  Stop all: for f in ~/pids/*.pid; do kill \$(cat \$f) 2>/dev/null; done"
