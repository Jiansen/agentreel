#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Task Loop — Loads tasks from a JSON config file.
#
# Usage:
#   ZAI_API_KEY="..." ./task_loop.sh                              # uses tasks-example.json
#   ZAI_API_KEY="..." TASK_CONFIG=tasks-livestream.json ./task_loop.sh
#
# Environment:
#   ZAI_API_KEY       — Required. API key for the model provider.
#   TASK_CONFIG       — Path to task config JSON (default: tasks-example.json in same dir)
#   TASK_TIMEOUT      — Override: max seconds per task
#   TASK_PAUSE        — Override: seconds between tasks
#   MAX_FAILURES      — Override: consecutive failures before cooldown
#   COOLDOWN          — Override: cooldown seconds after max failures

ZAI_API_KEY="${ZAI_API_KEY:?Set ZAI_API_KEY}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_CONFIG="${TASK_CONFIG:-${SCRIPT_DIR}/tasks-example.json}"

if [ ! -f "$TASK_CONFIG" ]; then
  echo "ERROR: Task config not found: $TASK_CONFIG" >&2
  echo "Create one from tasks-example.json or use TASK_CONFIG=path/to/config.json" >&2
  exit 1
fi

# Parse config defaults (env vars override JSON defaults)
json_val() { python3 -c "import json,sys; d=json.load(open('$TASK_CONFIG')); print(d.get('defaults',{}).get('$1','$2'))" 2>/dev/null || echo "$2"; }

TASK_TIMEOUT="${TASK_TIMEOUT:-$(json_val timeout 300)}"
TASK_PAUSE="${TASK_PAUSE:-$(json_val pause 120)}"
MAX_FAILURES="${MAX_FAILURES:-$(json_val max_failures 3)}"
COOLDOWN="${COOLDOWN:-$(json_val cooldown 600)}"

FORMAT_INSTRUCTIONS=$(python3 -c "import json; print(json.load(open('$TASK_CONFIG')).get('format_instructions',''))" 2>/dev/null || echo "")

LOG_DIR="${HOME}/task_loop_logs"
mkdir -p "$LOG_DIR" ~/digests ~/outputs

consecutive_failures=0
task_index=0

log() {
  echo "[task_loop] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"
}

run_task() {
  local session_id="$1"
  local message="$2"
  local label="$3"
  local timeout_val="${4:-$TASK_TIMEOUT}"

  log "=== Task: ${label} (session: ${session_id}, timeout: ${timeout_val}s) ==="
  local start_ts
  start_ts=$(date +%s)

  if timeout --kill-after=30 --signal=KILL "$timeout_val" openclaw agent \
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

# Parse rotation array from config
ROTATION_JSON=$(python3 -c "import json; print(json.dumps(json.load(open('$TASK_CONFIG')).get('rotation',[1,1,2])))" 2>/dev/null || echo "[1,1,2]")
ROTATION_LEN=$(python3 -c "import json; print(len(json.loads('$ROTATION_JSON')))" 2>/dev/null || echo "3")

get_tier_for_index() {
  python3 -c "import json; r=json.loads('$ROTATION_JSON'); print(r[$1 % len(r)])" 2>/dev/null || echo "1"
}

# Pick a random task from a tier in the config, resolve templates, return: session_id label message timeout
pick_task() {
  local tier="$1"
  local ts="$2"
  python3 -c "
import json, random, sys

config = json.load(open('$TASK_CONFIG'))
tier_tasks = config.get('tiers', {}).get(str($tier), [])
if not tier_tasks:
    print('unknown\tNo Task\tNo tasks configured for tier $tier\t$TASK_TIMEOUT')
    sys.exit(0)

task = random.choice(tier_tasks)
tid = task.get('id', 'task')
label = task.get('label', 'Task')
timeout = task.get('timeout', $TASK_TIMEOUT)
msg = task.get('message', '')

# Resolve {random_prompt} template
if '{random_prompt}' in msg and 'random_prompts' in task:
    msg = random.choice(task['random_prompts'])

# Resolve {random_site} template
if '{random_site}' in msg and 'random_sites' in task:
    msg = msg.replace('{random_site}', random.choice(task['random_sites']))

# Resolve {ts} template
msg = msg.replace('{ts}', '$ts')

session_id = f'{tid}-{\"$ts\"}'
print(f'{session_id}\t{label}\t{msg}\t{timeout}')
" 2>/dev/null || echo "unknown-${ts}	Unknown Task	Error loading task config	$TASK_TIMEOUT"
}

# === MAIN LOOP ===

log "Starting task loop — config: ${TASK_CONFIG}"
log "Pause: ${TASK_PAUSE}s, timeout: ${TASK_TIMEOUT}s, rotation length: ${ROTATION_LEN}"

while true; do
  if (( consecutive_failures >= MAX_FAILURES )); then
    log "WARNING: ${consecutive_failures} consecutive failures, cooldown ${COOLDOWN}s"
    sleep "$COOLDOWN"
    consecutive_failures=0
  fi

  local_tier=$(get_tier_for_index "$task_index")
  ts=$(date +"%Y%m%d-%H%M%S")
  task_index=$(( task_index + 1 ))

  log "--- Task #${task_index} (Tier ${local_tier}) ---"

  IFS=$'\t' read -r session_id label message timeout <<< "$(pick_task "$local_tier" "$ts")"

  if [ -n "$FORMAT_INSTRUCTIONS" ]; then
    message="${message} ${FORMAT_INSTRUCTIONS}"
  fi

  run_task "$session_id" "$message" "$label" "$timeout" || true

  log "Next task in ${TASK_PAUSE}s..."
  sleep "$TASK_PAUSE"
done
