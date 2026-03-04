#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# VOD Rotation — run every 11h via cron/systemd timer.
# Waits for the current agent task to finish before rotating,
# so each VOD segment contains complete tasks (better for clips).
#
# crontab example (every 11h, offset to avoid midnight):
#   0 */11 * * * /home/ubuntu/agentreel/deploy/yt_rotate_cron.sh >> /home/ubuntu/.agentreel/logs/yt_rotate.log 2>&1
#
# Requires: Python 3.8+, YouTube OAuth2 credentials in stream.env

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_config="${SCRIPT_DIR}/../lib/config.sh"
set -a
[ -f "$_config" ] && . "$_config"
[ -f "${AGENTREEL_DIR:-$HOME/.agentreel}/lib/config.sh" ] && . "${AGENTREEL_DIR:-$HOME/.agentreel}/lib/config.sh"
set +a

LOG_DIR="${AGENTREEL_LOG_DIR:-$HOME/.agentreel/logs}"
mkdir -p "$LOG_DIR"

log() { echo "[yt-rotate] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"; }

TASK_ACTIVE_FILE="${HOME}/task_queue/.task_active"
MAX_WAIT=900  # wait up to 15 min for current task

YT_SCRIPT="${SCRIPT_DIR}/yt_broadcast.py"
if [[ ! -f "$YT_SCRIPT" ]]; then
  log "ERROR: yt_broadcast.py not found at $YT_SCRIPT"
  exit 1
fi

if [[ -z "${YOUTUBE_AGENTREEL_CLIENT_ID:-}" ]]; then
  log "ERROR: YouTube OAuth2 credentials not set. Check stream.env."
  exit 1
fi

# Wait for current task to finish (task-aware rotation)
if [[ -f "$TASK_ACTIVE_FILE" ]]; then
  task_info=$(cat "$TASK_ACTIVE_FILE" 2>/dev/null || echo "")
  log "Task in progress: ${task_info}. Waiting for completion..."
  waited=0
  while [[ -f "$TASK_ACTIVE_FILE" ]] && [[ $waited -lt $MAX_WAIT ]]; do
    sleep 30
    waited=$((waited + 30))
    log "Still waiting for task... (${waited}s / ${MAX_WAIT}s)"
  done
  if [[ -f "$TASK_ACTIVE_FILE" ]]; then
    log "WARNING: Task still running after ${MAX_WAIT}s. Rotating anyway."
  else
    log "Task completed. Proceeding with rotation."
  fi
else
  log "No active task. Proceeding with rotation."
fi

TITLE="🤖 AgentReel Live — $(date -u +'%Y-%m-%d %H:%M UTC')"
log "Rotating broadcast: ${TITLE}"

python3 "$YT_SCRIPT" rotate --title "$TITLE" 2>&1

log "Rotation complete"
