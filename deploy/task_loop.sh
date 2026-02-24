#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Task Loop
# Continuously feeds OpenClaw tasks for live streaming.
# Generates new sessions that the relay server picks up automatically.
#
# Customize the TASKS array to define what the agent does on stream.
#
# Usage:
#   ZAI_API_KEY="..." ./task_loop.sh
#   ZAI_API_KEY="..." TASK_PAUSE=300 ./task_loop.sh
#
# Environment:
#   ZAI_API_KEY       — Required. API key for the model provider.
#   TASK_TIMEOUT      — Max seconds per task (default: 300)
#   TASK_PAUSE        — Seconds between tasks (default: 300)
#   MAX_FAILURES      — Consecutive failures before cooldown (default: 3)
#   COOLDOWN          — Cooldown seconds after max failures (default: 600)

ZAI_API_KEY="${ZAI_API_KEY:?Set ZAI_API_KEY}"
TASK_TIMEOUT="${TASK_TIMEOUT:-300}"
TASK_PAUSE="${TASK_PAUSE:-300}"
MAX_FAILURES="${MAX_FAILURES:-3}"
COOLDOWN="${COOLDOWN:-600}"

LOG_DIR="${HOME}/task_loop_logs"
mkdir -p "$LOG_DIR" ~/digests

consecutive_failures=0
cycle=0

log() {
  echo "[task_loop] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"
}

run_task() {
  local session_id="$1"
  local message="$2"
  local label="$3"

  log "=== Task: ${label} (session: ${session_id}) ==="
  local start_ts
  start_ts=$(date +%s)

  if timeout "$TASK_TIMEOUT" openclaw agent \
    --local \
    --session-id "$session_id" \
    --message "$message" \
    --json \
    > "${LOG_DIR}/${session_id}.json" 2>&1; then
    local dur=$(( $(date +%s) - start_ts ))
    log "Completed in ${dur}s"
    consecutive_failures=0
    return 0
  else
    log "FAILED (exit=$?)"
    consecutive_failures=$(( consecutive_failures + 1 ))
    return 1
  fi
}

# === CUSTOMIZE YOUR TASKS HERE ===
# Each task is a label + OpenClaw prompt.
# The loop cycles through all tasks, then repeats.

run_cycle() {
  local ts
  ts=$(date +"%Y%m%d-%H%M%S")

  # Task 1: Scan Hacker News
  run_task "hn-${ts}" \
    "Fetch the current Hacker News front page (use web_fetch on https://news.ycombinator.com). Summarize the top 10 stories with title, points, and a one-line takeaway each. Highlight any stories related to AI, developer tools, or open-source." \
    "HN Scan" || true
  sleep "$TASK_PAUSE"

  # Task 2: Scan GitHub Trending
  run_task "gh-trend-${ts}" \
    "Fetch GitHub Trending page (use web_fetch on https://github.com/trending). List the top 5 trending repositories today with name, stars, language, and description. Note any AI/agent/automation frameworks." \
    "GitHub Trending" || true
  sleep "$TASK_PAUSE"

  # Task 3: Summarize and write digest
  run_task "digest-${ts}" \
    "Based on what you can observe about current tech trends, write a brief 'Opportunity Digest' (under 300 words) covering: 1) What is hot right now, 2) Gaps or underserved niches, 3) One actionable idea. Save it to ~/digests/digest-${ts}.md" \
    "Opportunity Digest" || true
}

# === MAIN LOOP ===

log "Starting task loop"
log "Pause between tasks: ${TASK_PAUSE}s, timeout: ${TASK_TIMEOUT}s"

while true; do
  cycle=$(( cycle + 1 ))
  log "--- Cycle ${cycle} ---"

  if (( consecutive_failures >= MAX_FAILURES )); then
    log "WARNING: ${consecutive_failures} consecutive failures, cooldown ${COOLDOWN}s"
    sleep "$COOLDOWN"
    consecutive_failures=0
  fi

  run_cycle

  log "Cycle ${cycle} complete. Next cycle in ${TASK_PAUSE}s..."
  sleep "$TASK_PAUSE"
done
