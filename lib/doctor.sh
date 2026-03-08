#!/usr/bin/env bash
# AgentReel Doctor + Crash Report — extracted from install.sh CLI
# Sourced by the `agentreel` CLI; depends on config.sh globals + CLI utility functions.

cmd_doctor() {
  local pass=0 warn_count=0 fail_count=0 total=0
  local report_lines=""
  local DOCTOR_REPORT_URL="https://agentreel.agent-status.com/api/install-report"
  local agent_mode=false
  local json_checks=""

  for arg in "$@"; do
    case "$arg" in
      --agent) agent_mode=true ;;
    esac
  done

  _check() {
    local status="$1" label="$2" detail="$3"
    total=$(( total + 1 ))
    case "$status" in
      PASS) pass=$(( pass + 1 )) ;;
      WARN) warn_count=$(( warn_count + 1 )) ;;
      FAIL) fail_count=$(( fail_count + 1 )) ;;
    esac
    report_lines="${report_lines}${status}|${label}|${detail}\n"

    if [ "$agent_mode" = true ]; then
      local id
      id=$(echo "$label" | tr '[:upper:] ' '[:lower:]_' | tr -cd 'a-z0-9_')
      [ -n "$json_checks" ] && json_checks="${json_checks},"
      json_checks="${json_checks}{\"id\":\"${id}\",\"status\":\"${status}\",\"label\":\"${label}\",\"detail\":\"$(echo "$detail" | sed 's/"/\\"/g')\"}"
    else
      case "$status" in
        PASS) echo "  ✅ $label  $detail" ;;
        WARN) echo "  ⚠️  $label  $detail" ;;
        FAIL) echo "  ❌ $label  $detail" ;;
      esac
    fi
  }

  _suggest() {
    [ "$agent_mode" = true ] && return 0
    echo "     → $1"
  }

  if [ "$agent_mode" = true ]; then
    : # silent header for agent mode
  else
    echo ""
    echo "AgentReel Doctor v$(type get_local_version &>/dev/null && get_local_version || echo 'unknown') — Full System Check"
    type check_update &>/dev/null && check_update
    echo "═══════════════════════════════════════"
    echo ""
  fi

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
  local skill_path="${AGENTREEL_SKILL_DIR:-$HOME/.openclaw/skills/agentreel}/SKILL.md"
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

  # 9. Desktop / Livestream checks (only if desktop is enabled)
  if command -v Xvfb &>/dev/null && [ "${AGENTREEL_NO_DESKTOP:-0}" != "1" ]; then
    local agent_display="${AGENTREEL_DISPLAY:-:99}"
    local bcast_display="${AGENTREEL_BROADCAST_DISPLAY:-:100}"
    local cdp_port="${AGENTREEL_CDP_PORT:-18802}"
    local vnc_ws_port="${AGENTREEL_VNC_WS_PORT:-6080}"

    # 9a. Xvfb displays
    if pgrep -f "Xvfb ${agent_display}" >/dev/null 2>&1; then
      _check PASS "Xvfb agent" "${agent_display} running"
    else
      _check FAIL "Xvfb agent" "${agent_display} not running"
      _suggest "Run: agentreel start"
    fi
    if pgrep -f "Xvfb ${bcast_display}" >/dev/null 2>&1; then
      _check PASS "Xvfb broadcast" "${bcast_display} running"
    else
      _check WARN "Xvfb broadcast" "${bcast_display} not running (needed for streaming)"
    fi

    # 9b. Agent Chrome CDP
    if curl -sf --max-time 3 "http://127.0.0.1:${cdp_port}/json/version" >/dev/null 2>&1; then
      local agent_tabs
      agent_tabs=$(curl -sf "http://127.0.0.1:${cdp_port}/json/list" 2>/dev/null | python3 -c "import json,sys; tabs=json.load(sys.stdin); print(len(tabs))" 2>/dev/null || echo "?")
      _check PASS "Agent Chrome" "CDP on ${cdp_port}, ${agent_tabs} tab(s)"
    else
      _check WARN "Agent Chrome" "CDP ${cdp_port} not responding (agent browser not started)"
      _suggest "It starts automatically with the next task_daemon task"
    fi

    # 9c. OpenClaw browser profile
    if [ -f "$HOME/.openclaw/openclaw.json" ]; then
      local oc_profile
      oc_profile=$(python3 -c "import json; d=json.load(open('$HOME/.openclaw/openclaw.json')); print(d.get('browser',{}).get('defaultProfile','?'))" 2>/dev/null || echo "?")
      if [ "$oc_profile" = "visible" ]; then
        _check PASS "Browser profile" "OpenClaw default profile = visible"
      else
        _check WARN "Browser profile" "OpenClaw default profile = ${oc_profile} (expected 'visible')"
        _suggest "Run: agentreel start (auto-configures visible profile)"
      fi
    fi

    # 9d. x11vnc
    if pgrep -f "x11vnc.*display ${agent_display}" >/dev/null 2>&1; then
      _check PASS "x11vnc" "capturing ${agent_display}"
    else
      _check WARN "x11vnc" "not running (needed for browser view in stream)"
      _suggest "Run: x11vnc -display ${agent_display} -rfbport 5999 -nopw -shared -forever -bg"
    fi

    # 9e. websockify
    if pgrep -f "websockify.*${vnc_ws_port}" >/dev/null 2>&1; then
      _check PASS "websockify" "port ${vnc_ws_port}"
    else
      _check WARN "websockify" "not running (needed for VNC in browser)"
    fi

    # 9f. ffmpeg (stream)
    local ffmpeg_count
    ffmpeg_count=$(pgrep -c -x ffmpeg 2>/dev/null) || ffmpeg_count=0
    if [ "$ffmpeg_count" -eq 1 ]; then
      local ffmpeg_display
      ffmpeg_display=$(ps aux | grep "[f]fmpeg" | grep -o "\-i :[0-9]*" | head -1 | tr -d ' ')
      local ffmpeg_rate
      ffmpeg_rate=$(ps aux | grep "[f]fmpeg" | grep -o "maxrate [0-9]*k" | head -1)
      if [ "$ffmpeg_display" = "-i ${bcast_display}" ]; then
        _check PASS "ffmpeg" "1 instance, capturing ${bcast_display}, ${ffmpeg_rate:-unknown bitrate}"
      else
        _check WARN "ffmpeg" "capturing ${ffmpeg_display:-unknown} (expected ${bcast_display})"
        _suggest "Restart stream: kill ffmpeg, update DISPLAY_NUM=${bcast_display} in stream.env"
      fi
    elif [ "$ffmpeg_count" -gt 1 ]; then
      _check FAIL "ffmpeg" "${ffmpeg_count} instances running (should be 1)"
      _suggest "Kill all: pkill -9 -f stream_dual; killall -9 ffmpeg; then restart"
    elif [ "$ffmpeg_count" -eq 0 ]; then
      if [ -n "${YT_STREAM_KEY:-}" ] || [ -n "${TW_STREAM_KEY:-}" ]; then
        _check WARN "ffmpeg" "not running (stream keys configured but not streaming)"
      else
        _check PASS "ffmpeg" "not running (no stream keys configured)"
      fi
    fi

    # 9g. Kiosk Chrome on broadcast display
    if pgrep -f "chromium.*kiosk" >/dev/null 2>&1; then
      _check PASS "Kiosk Chrome" "running on ${bcast_display}"
    else
      _check WARN "Kiosk Chrome" "not running (needed for streaming)"
    fi
  fi

  # Agent mode: output JSON and exit
  if [ "$agent_mode" = true ]; then
    local vport="${AGENTREEL_PORT:-3000}"
    local rport="${AGENTREEL_RELAY_PORT:-8765}"
    local has_vision="false"
    local vision_hint="unknown"
    if [ -f "$HOME/.openclaw/openclaw.json" ]; then
      local models
      models=$(python3 -c "
import json
d=json.load(open('$HOME/.openclaw/openclaw.json'))
m=d.get('models',{})
names=[v.get('model','') for v in m.values() if isinstance(v,dict)]
print(','.join(names))
" 2>/dev/null || echo "")
      if [ -n "$models" ]; then
        vision_hint="Models configured: ${models}. Most modern models support image input — try browser screenshot + image tool for visual QA."
      else
        vision_hint="No models detected in OpenClaw config. Use browser snapshot (DOM) for structural checks, or configure a model with: openclaw configure"
      fi
    fi
    cat <<AGENTEOF
{
  "version": "doctor-agent-1.0",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%S")",
  "summary": {"total": $total, "pass": $pass, "warn": $warn_count, "fail": $fail_count},
  "checks": [${json_checks}],
  "endpoints": {
    "viewer": "http://localhost:${vport}",
    "live": "http://localhost:${vport}/live",
    "relay_health": "http://localhost:${rport}/health",
    "relay_stream": "http://localhost:${rport}/api/stream",
    "relay_history": "http://localhost:${rport}/api/history",
    "vnc_status": "http://localhost:${vport}/api/vnc-status"
  },
  "vision": {
    "has_vision_model": ${has_vision},
    "hint": "${vision_hint}",
    "visual_qa_doc": "See AGENT_QA.md Section 2 for screenshot-based visual checks"
  },
  "next_steps": [
    $([ "$fail_count" -gt 0 ] && echo '"Fix FAIL items before proceeding to visual QA",' || true)
    "Run visual QA checks per AGENT_QA.md Section 2 (requires browser + image tools)",
    "Run functional QA checks per AGENT_QA.md Section 3",
    "Generate report in AGENT_QA.md Section 4 format"
  ]
}
AGENTEOF
    return 0
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

cmd_crash_report() {
  local report_dir="/tmp/agentreel-crash-$(date -u +"%Y%m%d-%H%M%S")"
  mkdir -p "$report_dir"

  echo "Collecting crash report → $report_dir"

  echo "--- System ---" > "$report_dir/system.txt"
  uname -srm >> "$report_dir/system.txt"
  echo "Node: $(node -v 2>/dev/null || echo N/A)" >> "$report_dir/system.txt"
  echo "Python: $(python3 -V 2>&1 || echo N/A)" >> "$report_dir/system.txt"
  echo "AgentReel: $(type get_local_version &>/dev/null && get_local_version || echo unknown)" >> "$report_dir/system.txt"
  echo "OpenClaw: $(openclaw -V 2>/dev/null || echo N/A)" >> "$report_dir/system.txt"

  echo "--- Processes ---" > "$report_dir/processes.txt"
  ps aux | grep -E "next|relay|chromium|ffmpeg|task_daemon|watchdog|x11vnc|websockify|Xvfb|openclaw" | grep -v grep >> "$report_dir/processes.txt" 2>/dev/null || true

  echo "--- Ports ---" > "$report_dir/ports.txt"
  for p in ${AGENTREEL_PORT:-3000} ${AGENTREEL_RELAY_PORT:-8765} ${AGENTREEL_VNC_WS_PORT:-6080} ${AGENTREEL_VNC_RFB_PORT:-5999} ${AGENTREEL_CDP_PORT:-18802}; do
    if (echo >/dev/tcp/127.0.0.1/$p) 2>/dev/null; then
      echo "Port $p: IN USE" >> "$report_dir/ports.txt"
    else
      echo "Port $p: free" >> "$report_dir/ports.txt"
    fi
  done

  for logfile in viewer.log relay.log chromium-agent.log chromium-kiosk.log; do
    if [ -f "$AGENTREEL_DIR/logs/$logfile" ]; then
      tail -50 "$AGENTREEL_DIR/logs/$logfile" > "$report_dir/$logfile" 2>/dev/null || true
    fi
  done

  for logfile in task_daemon.log stream.log watchdog.log; do
    if [ -f "$HOME/logs/$logfile" ]; then
      tail -50 "$HOME/logs/$logfile" > "$report_dir/$logfile" 2>/dev/null || true
    fi
  done

  agentreel doctor > "$report_dir/doctor.txt" 2>&1 || true

  local archive="/tmp/agentreel-crash-$(date -u +"%Y%m%d-%H%M%S").tar.gz"
  tar -czf "$archive" -C /tmp "$(basename "$report_dir")" 2>/dev/null
  echo ""
  echo "Crash report: $archive"
  echo "Attach this file to a GitHub issue:"
  echo "  https://github.com/Jiansen/agentreel/issues/new"
  rm -rf "$report_dir"
}
