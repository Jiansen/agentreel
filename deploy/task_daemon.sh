#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# task_daemon.sh — Queue-based task executor with rate-limit backoff
#
# Architecture:
#   Feeder (this script, --feed mode) → ~/task_queue/pending/*.task
#   Worker (this script, default mode)  → picks oldest task, runs it, moves to done/
#
# Rate limiting:
#   - Tracks API call timestamps in ~/task_queue/.rate_log
#   - On "rate limit" error: exponential backoff (60s → 120s → 240s → ... → max 900s)
#   - On success: reset backoff, respect MIN_INTERVAL between tasks
#
# Daemon:
#   - PID file at ~/task_queue/daemon.pid
#   - Signal handling: SIGTERM/SIGINT → graceful shutdown
#   - Logs to ~/task_queue/daemon.log + stdout
#
# Usage:
#   ./task_daemon.sh                     # Start daemon (worker + auto-feeder)
#   ./task_daemon.sh --feed              # Generate one batch of tasks into queue
#   ./task_daemon.sh --status            # Show daemon status
#   ./task_daemon.sh --stop              # Stop daemon gracefully
#   ./task_daemon.sh --enqueue "msg"     # Manually enqueue a task
#
# Environment:
#   ZAI_API_KEY       — Required for worker mode
#   MIN_INTERVAL      — Min seconds between tasks (default: 180)
#   MAX_INTERVAL      — Max backoff seconds (default: 900)
#   TASK_TIMEOUT      — Per-task timeout (default: 600)
#   FEED_INTERVAL     — Seconds between auto-feed cycles (default: 300)
#   QUEUE_LOW_MARK    — Trigger feed when queue drops below this (default: 3)
#   GATEWAY_LOG       — Path to openclaw-gateway log (default: /var/log/openclaw-gateway.log)
#   TELEGRAM_YIELD    — Seconds to yield after Telegram activity (default: 300)
#   INTERRUPT_POLL    — Seconds between Telegram checks during task execution (default: 10)

QUEUE_DIR="${HOME}/task_queue"
PENDING="${QUEUE_DIR}/pending"
DONE="${QUEUE_DIR}/done"
FAILED="${QUEUE_DIR}/failed"
PID_FILE="${QUEUE_DIR}/daemon.pid"
LOG_FILE="${QUEUE_DIR}/daemon.log"
RATE_LOG="${QUEUE_DIR}/.rate_log"

MIN_INTERVAL="${MIN_INTERVAL:-180}"
MAX_INTERVAL="${MAX_INTERVAL:-900}"
TASK_TIMEOUT="${TASK_TIMEOUT:-600}"
FEED_INTERVAL="${FEED_INTERVAL:-300}"
QUEUE_LOW_MARK="${QUEUE_LOW_MARK:-3}"

FORMAT_INSTRUCTIONS='FORMAT REQUIREMENTS: [PLAN] 1. Navigate to ... [STEP 1/N BEGIN] ... [STEP 1/N COMPLETE] ... Use [THINKING] for analysis, [DISCOVERY] for interesting findings, [CHALLENGE] for obstacles, [OUTPUT] for final results, [SUMMARY] for conclusion. CLEANUP: When done, close all browser tabs you opened to keep the desktop clean for the next task.'

current_backoff=0
shutdown_requested=0

# ─── Helpers ───

log() {
  local msg="[task_daemon] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

ensure_dirs() {
  mkdir -p "$PENDING" "$DONE" "$FAILED" "${HOME}/digests" "${HOME}/outputs"
}

# ─── Signal handling ───

handle_signal() {
  log "Received shutdown signal, finishing current task..."
  shutdown_requested=1
}

trap handle_signal SIGTERM SIGINT

# ─── PID management ───

write_pid() {
  echo $$ > "$PID_FILE"
  log "Daemon started (PID=$$)"
}

check_pid() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
    rm -f "$PID_FILE"
  fi
  return 1
}

remove_pid() {
  rm -f "$PID_FILE"
  log "Daemon stopped (PID=$$)"
}

# ─── Queue operations ───

queue_size() {
  find "$PENDING" -name "*.task" -type f 2>/dev/null | wc -l | tr -d ' '
}

enqueue_task() {
  local session_id="$1"
  local message="$2"
  local label="$3"
  local timeout="${4:-$TASK_TIMEOUT}"
  local ts
  ts=$(date +"%Y%m%d-%H%M%S")
  local taskfile="${PENDING}/${ts}_${session_id}.task"

  cat > "$taskfile" <<TASKEOF
SESSION_ID=${session_id}
MESSAGE=${message}
LABEL=${label}
TIMEOUT=${timeout}
TASKEOF
  log "Enqueued: ${label} → $(basename "$taskfile")"
}

dequeue_task() {
  local oldest
  oldest=$(find "$PENDING" -name "*.task" -type f -print0 2>/dev/null | \
    xargs -0 ls -1t 2>/dev/null | tail -1)
  if [ -n "$oldest" ]; then
    echo "$oldest"
    return 0
  fi
  return 1
}

# ─── Telegram yield (pause when user is chatting) ───

GATEWAY_LOG="${GATEWAY_LOG:-/var/log/openclaw-gateway.log}"
TELEGRAM_YIELD="${TELEGRAM_YIELD:-300}"

telegram_active() {
  [ ! -f "$GATEWAY_LOG" ] && return 1
  local last_msg_line
  last_msg_line=$(grep -n '\[telegram\] sendMessage ok\|embedded run agent end.*runId' "$GATEWAY_LOG" 2>/dev/null | tail -1)
  [ -z "$last_msg_line" ] && return 1

  local line_ts
  line_ts=$(echo "$last_msg_line" | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}' | head -1)
  [ -z "$line_ts" ] && return 1

  local msg_epoch now_epoch
  msg_epoch=$(date -d "${line_ts}" +%s 2>/dev/null) || return 1
  now_epoch=$(date +%s)
  local age=$(( now_epoch - msg_epoch ))

  if [ "$age" -lt "$TELEGRAM_YIELD" ]; then
    return 0
  fi
  return 1
}

# ─── Rate limit tracking ───

record_api_call() {
  date +%s >> "$RATE_LOG"
  tail -100 "$RATE_LOG" > "${RATE_LOG}.tmp" && mv "${RATE_LOG}.tmp" "$RATE_LOG"
}

seconds_since_last_call() {
  if [ ! -f "$RATE_LOG" ] || [ ! -s "$RATE_LOG" ]; then
    echo 9999
    return
  fi
  local last now
  last=$(tail -1 "$RATE_LOG")
  now=$(date +%s)
  echo $(( now - last ))
}

# ─── Browser cleanup ───

CDP_PORT="${AGENTREEL_CDP_PORT:-18802}"

cleanup_agent_browser() {
  local cdp="http://127.0.0.1:${CDP_PORT}"

  curl -sf --max-time 5 "${cdp}/json/version" >/dev/null 2>&1 || return 0

  curl -sf --max-time 3 "${cdp}/json/new?about:blank" >/dev/null 2>&1

  local tab_ids
  tab_ids=$(curl -sf --max-time 5 "${cdp}/json/list" 2>/dev/null | python3 -c "
import json, sys
try:
    tabs = json.load(sys.stdin)
    blank_kept = False
    for t in tabs:
        url = t.get('url', '')
        if url == 'about:blank' and not blank_kept:
            blank_kept = True
            continue
        if t.get('type') == 'page':
            print(t['id'])
except: pass
" 2>/dev/null) || return 0

  local count=0
  while IFS= read -r tab_id; do
    [ -z "$tab_id" ] && continue
    curl -sf --max-time 3 "${cdp}/json/close/${tab_id}" >/dev/null 2>&1 || true
    (( count++ )) || true
    sleep 0.2
  done <<< "$tab_ids"

  if [ "$count" -gt 0 ]; then
    log "Cleanup: closed $count browser tab(s), kept 1 blank tab"
  fi
}

# ─── Task execution ───

INTERRUPT_POLL="${INTERRUPT_POLL:-10}"

run_task() {
  local taskfile="$1"
  local session_id message label timeout

  session_id=$(grep '^SESSION_ID=' "$taskfile" | cut -d= -f2-)
  message=$(grep '^MESSAGE=' "$taskfile" | cut -d= -f2-)
  label=$(grep '^LABEL=' "$taskfile" | cut -d= -f2-)
  timeout=$(grep '^TIMEOUT=' "$taskfile" | cut -d= -f2-)
  timeout="${timeout:-$TASK_TIMEOUT}"

  log "Running: ${label} (session: ${session_id}, timeout: ${timeout}s)"

  local start_ts result_file exit_code interrupted=0
  start_ts=$(date +%s)
  result_file="${QUEUE_DIR}/last_result.json"

  DISPLAY=:99 openclaw agent \
    --local \
    --session-id "$session_id" \
    --message "$message" \
    --json \
    > "$result_file" 2>&1 &
  local agent_pid=$!

  while kill -0 "$agent_pid" 2>/dev/null; do
    local elapsed=$(( $(date +%s) - start_ts ))

    if [ "$elapsed" -ge "$timeout" ]; then
      log "Task timeout (${elapsed}s >= ${timeout}s) — killing"
      kill "$agent_pid" 2>/dev/null; sleep 2; kill -9 "$agent_pid" 2>/dev/null
      break
    fi

    if [ $shutdown_requested -eq 1 ]; then
      log "Shutdown requested — killing agent"
      kill "$agent_pid" 2>/dev/null; sleep 2; kill -9 "$agent_pid" 2>/dev/null
      break
    fi

    if telegram_active; then
      log "Telegram active mid-task — interrupting for priority"
      interrupted=1
      kill "$agent_pid" 2>/dev/null; sleep 2; kill -9 "$agent_pid" 2>/dev/null
      break
    fi

    sleep "$INTERRUPT_POLL"
  done

  wait "$agent_pid" 2>/dev/null
  exit_code=$?

  local dur=$(( $(date +%s) - start_ts ))
  record_api_call

  if [ "$interrupted" -eq 1 ]; then
    log "INTERRUPTED for Telegram (${dur}s) — task returns to queue"
    mv "$taskfile" "${PENDING}/retry_$(basename "$taskfile")"
    return 3
  fi

  if grep -qi "rate limit" "$result_file" 2>/dev/null; then
    log "RATE LIMITED (${dur}s) — backing off"
    mv "$taskfile" "${FAILED}/$(basename "$taskfile")"
    increase_backoff
    return 2
  fi

  if [ $exit_code -eq 0 ]; then
    log "OK (${dur}s, backoff reset)"
    mv "$taskfile" "${DONE}/$(basename "$taskfile")"
    current_backoff=0
    return 0
  else
    log "FAILED exit=${exit_code} (${dur}s)"
    mv "$taskfile" "${FAILED}/$(basename "$taskfile")"
    return 1
  fi
}

increase_backoff() {
  if [ "$current_backoff" -eq 0 ]; then
    current_backoff=60
  else
    current_backoff=$(( current_backoff * 2 ))
  fi
  if [ "$current_backoff" -gt "$MAX_INTERVAL" ]; then
    current_backoff="$MAX_INTERVAL"
  fi
  log "Backoff set to ${current_backoff}s"
}

effective_wait() {
  if [ "$current_backoff" -gt 0 ]; then
    echo "$current_backoff"
  else
    echo "$MIN_INTERVAL"
  fi
}

# ─── Task definitions (same as task_loop.sh) ───

feed_tasks() {
  local ts
  ts=$(date +"%Y%m%d-%H%M%S")

  local tier1_tasks=(
    "hn|Browse Hacker News (news.ycombinator.com) and find today top 5 AI-related stories. For each story note: title, points, comment count, and the source domain.|HN AI Scout|600"
    "gh-trend|Browse GitHub Trending (github.com/trending) and find today's top 5 trending repositories. Use the browser to visit the page and extract: repo name, description, language, and today's star count.|GitHub Trending|600"
    "ph|Browse Product Hunt (producthunt.com) and find today's top 5 trending AI products. For each: name, tagline, upvotes, and a brief assessment of the product.|PH AI Products|600"
    "reddit|Browse Reddit r/MachineLearning (reddit.com/r/MachineLearning/hot) and find the top 5 hot posts. For each: title, score, comment count, and key discussion points.|Reddit ML Hot|600"
  )

  local review_sites=("cursor.com" "replit.com" "v0.dev" "bolt.new" "lovable.dev" "windsurf.com")
  local review_site="${review_sites[$((RANDOM % ${#review_sites[@]}))]}"

  local tier2_tasks=(
    "compare|Compare Cursor vs Windsurf vs Copilot for AI-assisted coding. Browse each product's website, note pricing, key features, and target audience. Write a comparison table.|Product Comparison|900"
    "review|Browse ${review_site} and write a brief UX review. Navigate the site, note the landing page design, key features, pricing, and your overall impression.|UX Review: ${review_site}|900"
  )

  local tier3_tasks=(
    "digest|Write a brief AI Opportunity Digest (under 300 words) covering: 1) What is hot in AI right now, 2) Underserved niches or gaps, 3) One actionable startup idea. Save it to ~/digests/digest-${ts}.md.|Opportunity Digest|600"
    "creative|Write a Did You Know thread about a surprising fact in AI history. Format as 5 short posts suitable for social media.|Creative Brief|600"
  )

  local rotation=(1 1 2 1 1 3)
  local batch_size=${#rotation[@]}

  log "Feeding ${batch_size} tasks into queue..."

  for tier_num in "${rotation[@]}"; do
    local task_str
    case "$tier_num" in
      1) task_str="${tier1_tasks[$((RANDOM % ${#tier1_tasks[@]}))]}" ;;
      2) task_str="${tier2_tasks[$((RANDOM % ${#tier2_tasks[@]}))]}" ;;
      3) task_str="${tier3_tasks[$((RANDOM % ${#tier3_tasks[@]}))]}" ;;
    esac

    local session_prefix message label task_timeout
    session_prefix=$(echo "$task_str" | cut -d'|' -f1)
    message=$(echo "$task_str" | cut -d'|' -f2)
    label=$(echo "$task_str" | cut -d'|' -f3)
    task_timeout=$(echo "$task_str" | cut -d'|' -f4)
    task_timeout="${task_timeout:-$TASK_TIMEOUT}"

    enqueue_task "${session_prefix}-${ts}" "${message} ${FORMAT_INSTRUCTIONS}" "$label" "$task_timeout"
    ts=$(date +"%Y%m%d-%H%M%S")
    sleep 1
  done

  log "Queue size: $(queue_size)"
}

# ─── Housekeeping ───

cleanup_old() {
  find "$DONE" -name "*.task" -mtime +2 -delete 2>/dev/null || true
  find "$FAILED" -name "*.task" -mtime +2 -delete 2>/dev/null || true
}

# ─── Commands ───

cmd_status() {
  ensure_dirs
  echo "=== task_daemon status ==="
  if pid=$(check_pid); then
    echo "Daemon: RUNNING (PID=$pid)"
  else
    echo "Daemon: STOPPED"
  fi
  echo "Queue:  $(queue_size) pending"
  echo "Done:   $(find "$DONE" -name "*.task" 2>/dev/null | wc -l | tr -d ' ')"
  echo "Failed: $(find "$FAILED" -name "*.task" 2>/dev/null | wc -l | tr -d ' ')"
  local since
  since=$(seconds_since_last_call)
  echo "Last API call: ${since}s ago"
  if [ -f "$LOG_FILE" ]; then
    echo ""
    echo "--- Recent log ---"
    tail -10 "$LOG_FILE"
  fi
}

cmd_stop() {
  if pid=$(check_pid); then
    log "Stopping daemon (PID=$pid)..."
    kill "$pid"
    local waited=0
    while kill -0 "$pid" 2>/dev/null && [ $waited -lt 30 ]; do
      sleep 1
      waited=$((waited + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
      log "Force killing..."
      kill -9 "$pid"
    fi
    rm -f "$PID_FILE"
    echo "Daemon stopped."
  else
    echo "Daemon not running."
  fi
}

cmd_enqueue() {
  ensure_dirs
  local msg="$1"
  local label="${2:-Manual Task}"
  local timeout="${3:-$TASK_TIMEOUT}"
  local priority="${4:-normal}"
  local ts
  ts=$(date +"%Y%m%d-%H%M%S")

  local session_id="manual-${ts}"
  local taskfile

  if [ "$priority" = "high" ]; then
    taskfile="${PENDING}/00000000-000000_${session_id}.task"
  else
    taskfile="${PENDING}/${ts}_${session_id}.task"
  fi

  cat > "$taskfile" <<TASKEOF
SESSION_ID=${session_id}
MESSAGE=${msg} ${FORMAT_INSTRUCTIONS}
LABEL=${label}
TIMEOUT=${timeout}
TASKEOF
  log "Enqueued: ${label} → $(basename "$taskfile") (priority=${priority}, timeout=${timeout}s)"
  echo "Task enqueued. Queue size: $(queue_size)"
}

cmd_feed() {
  ensure_dirs
  feed_tasks
  echo "Feed complete. Queue size: $(queue_size)"
}

# ─── Main daemon loop ───

cmd_daemon() {
  ZAI_API_KEY="${ZAI_API_KEY:?Set ZAI_API_KEY}"
  ensure_dirs

  if pid=$(check_pid); then
    echo "ERROR: Daemon already running (PID=$pid). Use --stop first."
    exit 1
  fi

  write_pid
  trap remove_pid EXIT

  log "=== Daemon started ==="
  log "MIN_INTERVAL=${MIN_INTERVAL}s, MAX_INTERVAL=${MAX_INTERVAL}s, TASK_TIMEOUT=${TASK_TIMEOUT}s"
  log "FEED_INTERVAL=${FEED_INTERVAL}s, QUEUE_LOW_MARK=${QUEUE_LOW_MARK}"

  local last_feed=0

  while [ $shutdown_requested -eq 0 ]; do
    local now
    now=$(date +%s)

    # Auto-feed when queue is low
    local qsize
    qsize=$(queue_size)
    if [ "$qsize" -lt "$QUEUE_LOW_MARK" ] && [ $(( now - last_feed )) -ge "$FEED_INTERVAL" ]; then
      feed_tasks
      last_feed=$now
      qsize=$(queue_size)
    fi

    # Yield to Telegram conversations
    if telegram_active; then
      log "Telegram active — yielding ${TELEGRAM_YIELD}s"
      sleep "$TELEGRAM_YIELD" &
      wait $! || true
      [ $shutdown_requested -eq 1 ] && break
      continue
    fi

    # Pick next task
    if ! taskfile=$(dequeue_task); then
      log "Queue empty, waiting ${FEED_INTERVAL}s for next feed cycle..."
      sleep "$FEED_INTERVAL" &
      wait $! || true
      continue
    fi

    # Respect rate limit timing
    local since wait_time
    since=$(seconds_since_last_call)
    wait_time=$(effective_wait)

    if [ "$since" -lt "$wait_time" ]; then
      local sleep_for=$(( wait_time - since ))
      log "Rate pacing: waiting ${sleep_for}s (since_last=${since}s, target=${wait_time}s)"
      sleep "$sleep_for" &
      wait $! || true
      [ $shutdown_requested -eq 1 ] && break
    fi

    # Execute
    local task_result=0
    run_task "$taskfile" || task_result=$?

    # Post-task cleanup: close all Chrome tabs except the first (about:blank)
    cleanup_agent_browser

    if [ "$task_result" -eq 3 ]; then
      log "Yielding ${TELEGRAM_YIELD}s after interrupt"
      sleep "$TELEGRAM_YIELD" &
      wait $! || true
      [ $shutdown_requested -eq 1 ] && break
      continue
    fi

    # Periodic housekeeping
    cleanup_old
  done

  log "=== Daemon shutting down gracefully ==="
}

# ─── Entry point ───

ensure_dirs

case "${1:-}" in
  --status) cmd_status ;;
  --stop)   cmd_stop ;;
  --feed)   cmd_feed ;;
  --enqueue)
    shift
    cmd_enqueue "${1:?Usage: task_daemon.sh --enqueue MSG [LABEL] [TIMEOUT] [PRIORITY]}" "${2:-}" "${3:-}" "${4:-}"
    ;;
  --telegram)
    shift
    cmd_enqueue "${1:?Usage: task_daemon.sh --telegram \"message\"}" "Telegram Task" "$TASK_TIMEOUT" "high"
    ;;
  --help|-h)
    echo "Usage: task_daemon.sh [--status|--stop|--feed|--enqueue MSG|--telegram MSG|--help]"
    echo "  (no args)   Start daemon"
    echo "  --status    Show daemon status"
    echo "  --stop      Stop daemon gracefully"
    echo "  --feed      Generate one batch of tasks"
    echo "  --enqueue   Add a task: --enqueue MSG [LABEL] [TIMEOUT] [PRIORITY]"
    echo "  --telegram  Add a high-priority task from Telegram"
    ;;
  "")
    cmd_daemon
    ;;
  *)
    echo "Unknown command: $1. Use --help."
    exit 1
    ;;
esac
