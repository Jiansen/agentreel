#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Watchdog
# Monitors PID files and restarts dead services.
#
# Watches:
#   ~/pids/relay.pid   — relay_server.py
#   ~/pids/tasks.pid   — task_loop.sh
#   ~/pids/stream.pid  — stream_dual.sh (only if stream keys configured)
#
# Usage: ZAI_API_KEY="..." ./watchdog.sh
#
# Environment:
#   ZAI_API_KEY       — Required for task_loop restart
#   CHECK_INTERVAL    — Seconds between checks (default: 15)

ZAI_API_KEY="${ZAI_API_KEY:-}"
PID_DIR="${HOME}/pids"
CHECK_INTERVAL="${CHECK_INTERVAL:-15}"

log() { echo "[watchdog] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"; }

is_alive() {
  local pid_file="${PID_DIR}/$1.pid"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

restart_relay() {
  log "Starting relay_server.py"
  nohup python3 ~/relay_server.py \
    --watch-dir ~/.openclaw/agents/main/sessions/ \
    --port "${RELAY_PORT:-8765}" \
    > ~/logs/relay.log 2>&1 &
  echo $! > "${PID_DIR}/relay.pid"
  log "relay PID: $(cat "${PID_DIR}/relay.pid")"
}

restart_tasks() {
  log "Starting task_loop.sh"
  nohup bash -c "export ZAI_API_KEY='${ZAI_API_KEY:-}' && bash ~/task_loop.sh" \
    > ~/logs/task_loop.log 2>&1 &
  echo $! > "${PID_DIR}/tasks.pid"
  log "tasks PID: $(cat "${PID_DIR}/tasks.pid")"
}

restart_stream() {
  log "Starting stream_dual.sh"
  nohup bash ~/stream_dual.sh > ~/logs/stream.log 2>&1 &
  echo $! > "${PID_DIR}/stream.pid"
  log "stream PID: $(cat "${PID_DIR}/stream.pid")"
}

mkdir -p "$PID_DIR" ~/logs
log "=== Watchdog started (check every ${CHECK_INTERVAL}s) ==="

while true; do
  is_alive relay  || { log "relay DOWN — restarting";  restart_relay; }
  is_alive tasks  || { log "tasks DOWN — restarting";  restart_tasks; }

  if [[ -n "${YT_STREAM_KEY:-}" || -n "${TW_STREAM_KEY:-}" ]]; then
    is_alive stream || { log "stream DOWN — restarting"; restart_stream; }
  fi

  sleep "$CHECK_INTERVAL"
done
