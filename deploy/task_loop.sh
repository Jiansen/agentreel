#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Task Loop — Mixed tasks for 24/7 live streaming
#
# Task tiers: T1 (high visual — browser), T2 (medium — browser+code), T3 (low — text)
# Default rotation: T1 T1 T2 T1 T1 T3 (4:1:1 ratio for max screen activity)
#
# Usage:
#   ZAI_API_KEY="..." ./task_loop.sh
#   ZAI_API_KEY="..." TASK_PAUSE=120 ./task_loop.sh
#
# Environment:
#   ZAI_API_KEY       — Required. API key for the model provider.
#   TASK_TIMEOUT      — Max seconds per task (default: 300, code tasks use 600)
#   TASK_PAUSE        — Seconds between tasks (default: 120)
#   MAX_FAILURES      — Consecutive failures before cooldown (default: 3)
#   COOLDOWN          — Cooldown seconds after max failures (default: 600)

ZAI_API_KEY="${ZAI_API_KEY:?Set ZAI_API_KEY}"
TASK_TIMEOUT="${TASK_TIMEOUT:-300}"
TASK_PAUSE="${TASK_PAUSE:-120}"
MAX_FAILURES="${MAX_FAILURES:-3}"
COOLDOWN="${COOLDOWN:-600}"

LOG_DIR="${HOME}/task_loop_logs"
mkdir -p "$LOG_DIR" ~/digests ~/outputs

consecutive_failures=0
task_index=0

FORMAT_INSTRUCTIONS='FORMAT REQUIREMENTS: [PLAN] 1. Navigate to ... [STEP 1/N BEGIN] ... [STEP 1/N COMPLETE] ... Use [THINKING] for analysis, [DISCOVERY] for interesting findings, [CHALLENGE] for obstacles, [OUTPUT] for final results, [SUMMARY] for conclusion.'

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

  if timeout "$timeout_val" openclaw agent \
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

# ============================================================
# TIER 1: High visual — browser-heavy tasks
# ============================================================

task_hn_scout() {
  local ts="$1"
  run_task "hn-${ts}" \
    "Browse Hacker News (news.ycombinator.com) and find today top 5 AI-related stories. For each story note: title, points, comment count, and the source domain. ${FORMAT_INSTRUCTIONS}" \
    "HN AI Scout" || true
}

task_github_trending() {
  local ts="$1"
  run_task "gh-trend-${ts}" \
    "Browse GitHub Trending (github.com/trending) and find today's top 5 trending repositories. Use the browser to visit the page and extract: repo name, description, language, and today's star count. ${FORMAT_INSTRUCTIONS}" \
    "GitHub Trending" || true
}

task_producthunt() {
  local ts="$1"
  run_task "ph-${ts}" \
    "Browse Product Hunt (producthunt.com) and find today's top 5 trending AI products. For each: name, tagline, upvotes, and a brief assessment of the product. ${FORMAT_INSTRUCTIONS}" \
    "PH AI Products" || true
}

task_reddit_ml() {
  local ts="$1"
  run_task "reddit-${ts}" \
    "Browse Reddit r/MachineLearning (reddit.com/r/MachineLearning/hot) and find the top 5 hot posts. For each: title, score, comment count, and key discussion points. ${FORMAT_INSTRUCTIONS}" \
    "Reddit ML Hot" || true
}

task_web_review() {
  local ts="$1"
  local sites=("cursor.com" "replit.com" "v0.dev" "bolt.new" "lovable.dev" "windsurf.com")
  local site="${sites[$((RANDOM % ${#sites[@]}))]}"
  run_task "review-${ts}" \
    "Browse ${site} and write a brief UX review. Navigate the site, note the landing page design, key features, pricing, and your overall impression. Take note of what works well and what could be improved. ${FORMAT_INSTRUCTIONS}" \
    "UX Review: ${site}" || true
}

# ============================================================
# TIER 2: Medium visual — browser + coding mix
# ============================================================

task_build_tool() {
  local ts="$1"
  local tools=(
    "Write a Python script that fetches the current weather for 3 major tech cities (SF, NYC, London) using a free weather API and formats the output as a markdown table. Save it to ~/outputs/weather-${ts}.py"
    "Write a bash script that analyzes a git repository and outputs: total commits, top 5 contributors, most active day of week, and language breakdown. Save it to ~/outputs/git-analyzer-${ts}.sh"
    "Write a Python script that monitors a URL and sends a desktop notification if the page content changes. Include argparse for URL input. Save it to ~/outputs/url-monitor-${ts}.py"
    "Write a Node.js script that generates a simple SVG bar chart from JSON data input. Include sample data. Save it to ~/outputs/chart-gen-${ts}.js"
  )
  local tool="${tools[$((RANDOM % ${#tools[@]}))]}"
  run_task "build-${ts}" \
    "${tool} ${FORMAT_INSTRUCTIONS}" \
    "Build Mini Tool" "600" || true
}

task_compare_products() {
  local ts="$1"
  local comparisons=(
    "Compare Cursor vs Windsurf vs Copilot for AI-assisted coding. Browse each product's website, note pricing, key features, and target audience. Write a comparison table."
    "Compare Vercel vs Netlify vs Cloudflare Pages for frontend deployment. Browse each site, compare pricing tiers, build speed claims, and feature differences."
    "Compare OpenAI vs Anthropic vs Google Gemini API pricing and capabilities. Browse their documentation pages and create a feature/price comparison matrix."
  )
  local comp="${comparisons[$((RANDOM % ${#comparisons[@]}))]}"
  run_task "compare-${ts}" \
    "${comp} ${FORMAT_INSTRUCTIONS}" \
    "Product Comparison" "600" || true
}

# ============================================================
# TIER 3: Low visual — text/analysis (used sparingly)
# ============================================================

task_digest() {
  local ts="$1"
  run_task "digest-${ts}" \
    "Write a brief 'AI Opportunity Digest' (under 300 words) covering: 1) What is hot in AI right now, 2) Underserved niches or gaps, 3) One actionable startup idea. Save it to ~/digests/digest-${ts}.md. ${FORMAT_INSTRUCTIONS}" \
    "Opportunity Digest" || true
}

task_creative() {
  local ts="$1"
  local topics=(
    "Write a 'Did You Know?' thread about a surprising fact in AI history. Format as 5 short posts suitable for social media."
    "Write a brief technical blog post (400 words) about an emerging trend you find interesting in developer tools."
    "Draft a newsletter intro (200 words) summarizing this week's biggest AI news for a non-technical audience."
  )
  local topic="${topics[$((RANDOM % ${#topics[@]}))]}"
  run_task "creative-${ts}" \
    "${topic} ${FORMAT_INSTRUCTIONS}" \
    "Creative Brief" || true
}

# ============================================================
# TIER ROTATION: T1 T1 T2 T1 T1 T3 (repeat)
# ============================================================

TIER1_TASKS=(task_hn_scout task_github_trending task_producthunt task_reddit_ml task_web_review)
TIER2_TASKS=(task_build_tool task_compare_products)
TIER3_TASKS=(task_digest task_creative)

ROTATION=(1 1 2 1 1 3)

pick_random_from_tier() {
  local tier="$1"
  case "$tier" in
    1) local arr=("${TIER1_TASKS[@]}"); echo "${arr[$((RANDOM % ${#arr[@]}))]}" ;;
    2) local arr=("${TIER2_TASKS[@]}"); echo "${arr[$((RANDOM % ${#arr[@]}))]}" ;;
    3) local arr=("${TIER3_TASKS[@]}"); echo "${arr[$((RANDOM % ${#arr[@]}))]}" ;;
  esac
}

# === MAIN LOOP ===

log "Starting task loop (mixed tasks, visual-priority rotation)"
log "Pause between tasks: ${TASK_PAUSE}s, default timeout: ${TASK_TIMEOUT}s"
log "Rotation pattern: T1 T1 T2 T1 T1 T3"

while true; do
  if (( consecutive_failures >= MAX_FAILURES )); then
    log "WARNING: ${consecutive_failures} consecutive failures, cooldown ${COOLDOWN}s"
    sleep "$COOLDOWN"
    consecutive_failures=0
  fi

  local_tier="${ROTATION[$((task_index % ${#ROTATION[@]}))]}"
  task_fn=$(pick_random_from_tier "$local_tier")
  ts=$(date +"%Y%m%d-%H%M%S")

  task_index=$(( task_index + 1 ))
  log "--- Task #${task_index} (Tier ${local_tier}) ---"

  $task_fn "$ts"

  log "Next task in ${TASK_PAUSE}s..."
  sleep "$TASK_PAUSE"
done
