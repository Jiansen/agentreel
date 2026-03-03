#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Watchdog v2
# Monitors PID files and restarts dead services with dedup + health checks.
#
# Watches:
#   ~/pids/relay.pid   — relay_server.py
#   ~/pids/tasks.pid   — task_daemon.sh
#   ~/pids/stream.pid  — stream_dual.sh (only if stream keys configured)
#
# Usage: ZAI_API_KEY="..." ./watchdog.sh
#
# Environment:
#   ZAI_API_KEY       — Required for task_daemon restart
#   CHECK_INTERVAL    — Seconds between checks (default: 30)

LOCK_FILE="/tmp/agentreel-watchdog.lock"
AGENTREEL_DIR="${AGENTREEL_DIR:-$HOME/.agentreel}"
ZAI_API_KEY="${ZAI_API_KEY:-}"
[[ -f ~/stream.env ]] && source ~/stream.env
PID_DIR="${AGENTREEL_DIR}/pids"
CHECK_INTERVAL="${CHECK_INTERVAL:-30}"
MAX_RESTART_BURST=3
BURST_WINDOW=300

log() { echo "[watchdog] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"; }

# --- Single-instance guard ---
acquire_lock() {
  if [ -f "$LOCK_FILE" ]; then
    local old_pid
    old_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
      log "Another watchdog (PID $old_pid) is running. Exiting."
      exit 0
    fi
    log "Stale lock found (PID $old_pid). Reclaiming."
    rm -f "$LOCK_FILE"
  fi
  echo $$ > "$LOCK_FILE"
  trap 'rm -f "$LOCK_FILE"' EXIT INT TERM
}

# --- Process dedup ---
kill_duplicates() {
  local pattern="$1"
  local expected_pid="$2"
  local pids
  pids=$(pgrep -f "$pattern" 2>/dev/null | grep -v "^$$\$" | grep -v "^${expected_pid}$" || true)
  if [ -n "$pids" ]; then
    log "Killing duplicate processes matching '$pattern': $pids"
    echo "$pids" | xargs -r kill 2>/dev/null || true
  fi
}

# --- Restart burst protection ---
declare -A restart_times
restart_allowed() {
  local svc="$1"
  local now
  now=$(date +%s)
  local key="${svc}_times"
  local times="${restart_times[$key]:-}"
  local recent=""
  local count=0
  for t in $times; do
    if (( now - t < BURST_WINDOW )); then
      recent="$recent $t"
      (( count++ )) || true
    fi
  done
  restart_times[$key]="$recent"
  if (( count >= MAX_RESTART_BURST )); then
    log "WARN: $svc restarted $count times in ${BURST_WINDOW}s — cooling down"
    return 1
  fi
  restart_times[$key]="${recent} ${now}"
  return 0
}

is_alive() {
  local pid_file="${PID_DIR}/$1.pid"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

restart_relay() {
  restart_allowed relay || return 0
  log "Starting relay_server.py"
  local relay_port="${RELAY_PORT:-8765}"

  local stale
  stale=$(lsof -ti:"$relay_port" 2>/dev/null || true)
  if [ -n "$stale" ]; then
    log "Killing stale process on port $relay_port: $stale"
    echo "$stale" | xargs -r kill -9 2>/dev/null || true
    sleep 1
  fi

  nohup python3 "${AGENTREEL_DIR}/relay_server.py" \
    --watch-dir ~/.openclaw/agents/main/sessions/ \
    --port "$relay_port" \
    > "${AGENTREEL_DIR}/logs/relay.log" 2>&1 &
  echo $! > "${PID_DIR}/relay.pid"
  log "relay PID: $(cat "${PID_DIR}/relay.pid")"
}

restart_tasks() {
  restart_allowed tasks || return 0
  log "Starting task_daemon.sh"
  nohup bash -c "export ZAI_API_KEY='${ZAI_API_KEY:-}' && bash ~/task_daemon.sh" \
    > "${AGENTREEL_DIR}/logs/task_daemon.log" 2>&1 &
  echo $! > "${PID_DIR}/tasks.pid"
  log "tasks PID: $(cat "${PID_DIR}/tasks.pid")"
}

restart_stream() {
  restart_allowed stream || return 0
  log "Starting stream_dual.sh"
  source ~/stream.env 2>/dev/null || true

  local ffmpeg_count
  ffmpeg_count=$(pgrep -c ffmpeg 2>/dev/null || echo 0)
  if (( ffmpeg_count > 0 )); then
    log "Killing $ffmpeg_count stale ffmpeg process(es)"
    killall -9 ffmpeg 2>/dev/null || true
    sleep 2
  fi

  nohup bash ~/stream_dual.sh > "${AGENTREEL_DIR}/logs/stream.log" 2>&1 &
  echo $! > "${PID_DIR}/stream.pid"
  log "stream PID: $(cat "${PID_DIR}/stream.pid")"
}

# --- Health checks (beyond PID liveness) ---
check_relay_health() {
  if ! is_alive relay; then return 1; fi
  local relay_port="${RELAY_PORT:-8765}"
  if ! (echo >/dev/tcp/127.0.0.1/$relay_port) 2>/dev/null; then
    log "relay PID alive but port $relay_port not listening"
    local pid
    pid=$(cat "${PID_DIR}/relay.pid" 2>/dev/null || echo "")
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
    rm -f "${PID_DIR}/relay.pid"
    return 1
  fi
  return 0
}

check_ffmpeg_health() {
  if ! is_alive stream; then return 1; fi
  local ffmpeg_count
  ffmpeg_count=$(pgrep -c ffmpeg 2>/dev/null || echo 0)
  if (( ffmpeg_count > 1 )); then
    log "Multiple ffmpeg ($ffmpeg_count) — killing all and restarting"
    killall -9 ffmpeg 2>/dev/null || true
    local pid
    pid=$(cat "${PID_DIR}/stream.pid" 2>/dev/null || echo "")
    [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
    rm -f "${PID_DIR}/stream.pid"
    sleep 2
    return 1
  fi
  return 0
}

# --- Main ---
acquire_lock
mkdir -p "$PID_DIR" ~/logs
log "=== Watchdog v2 started (PID $$, check every ${CHECK_INTERVAL}s) ==="

while true; do
  # Relay: health check (PID + port)
  check_relay_health || { log "relay DOWN — restarting"; restart_relay; }

  # Dedup relay
  if is_alive relay; then
    kill_duplicates "relay_server.py" "$(cat "${PID_DIR}/relay.pid" 2>/dev/null || echo 0)"
  fi

  # Tasks
  is_alive tasks || { log "tasks DOWN — restarting"; restart_tasks; }

  # Stream (if keys configured)
  if [[ -n "${YT_STREAM_KEY:-}" || -n "${TW_STREAM_KEY:-}" ]]; then
    check_ffmpeg_health || { log "stream DOWN — restarting"; restart_stream; }
  fi

  sleep "$CHECK_INTERVAL"
done
