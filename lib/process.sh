#!/usr/bin/env bash
# AgentReel Process Management — extracted from install.sh CLI
# Sourced by the `agentreel` CLI; depends on config.sh globals + CLI utility functions.

cmd_start() {
  local port
  port=$(find_port "${AGENTREEL_PORT}")
  local relay_port
  relay_port=$(find_port "${AGENTREEL_RELAY_PORT}")
  local watch_dir="${AGENTREEL_WATCH_DIR}"
  local display_num="${AGENTREEL_DISPLAY}"
  local resolution="${AGENTREEL_RESOLUTION}"

  echo "Starting AgentReel (v$(get_local_version))..."
  check_update

  mkdir -p "${AGENTREEL_LOG_DIR}" "${AGENTREEL_PID_DIR}"

  # 1. Desktop — dual Xvfb displays
  local desktop_enabled=false
  local broadcast_display="${AGENTREEL_BROADCAST_DISPLAY}"
  if command -v Xvfb &>/dev/null && [ "${AGENTREEL_NO_DESKTOP}" != "1" ]; then
    desktop_enabled=true
    if ! pgrep -f "Xvfb ${display_num}" >/dev/null 2>&1; then
      Xvfb "$display_num" -screen 0 "${resolution}x24" -ac &
      echo $! > "$AGENTREEL_DIR/pids/xvfb.pid"
      sleep 1
      echo "  Desktop: Xvfb ${display_num} (agent workspace)"
    else
      echo "  Desktop: Xvfb ${display_num} already running"
    fi
    if ! pgrep -f "Xvfb ${broadcast_display}" >/dev/null 2>&1; then
      Xvfb "$broadcast_display" -screen 0 "${resolution}x24" -ac &
      echo $! > "$AGENTREEL_DIR/pids/xvfb-broadcast.pid"
      sleep 1
      echo "  Broadcast: Xvfb ${broadcast_display} (kiosk display)"
    else
      echo "  Broadcast: Xvfb ${broadcast_display} already running"
    fi
    for disp in "$display_num" "$broadcast_display"; do
      if command -v fluxbox &>/dev/null && ! pgrep -f "fluxbox.*${disp}" >/dev/null 2>&1; then
        DISPLAY="$disp" fluxbox > /dev/null 2>&1 &
      fi
    done
  else
    echo "  Desktop: skipped (Xvfb not found or disabled)"
  fi

  # 2. Relay server
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

  # 3. Viewer (Next.js)
  local stale_viewers
  stale_viewers=$(pgrep -f "next.*start.*-p" 2>/dev/null || true)
  if [ -n "$stale_viewers" ]; then
    echo "$stale_viewers" | xargs -r kill 2>/dev/null || true
    sleep 1
  fi
  cd "$AGENTREEL_DIR"
  if [ -f ".next/BUILD_ID" ]; then
    if [ -f "server.js" ]; then
      PORT="$port" nohup node server.js \
        > "$AGENTREEL_DIR/logs/viewer.log" 2>&1 &
    else
      PORT="$port" nohup npx next start -p "$port" \
        > "$AGENTREEL_DIR/logs/viewer.log" 2>&1 &
    fi
    echo $! > "$AGENTREEL_DIR/pids/viewer.pid"
    echo "  Viewer: http://localhost:${port}"
  else
    PORT="$port" nohup npx next dev --turbopack -p "$port" \
      > "$AGENTREEL_DIR/logs/viewer.log" 2>&1 &
    echo $! > "$AGENTREEL_DIR/pids/viewer.pid"
    echo "  Viewer: http://localhost:${port} (dev mode)"
  fi

  # 4. Chromium — dual browser setup
  if [ "$desktop_enabled" = true ]; then
    local chromium_cmd=""
    if command -v chromium &>/dev/null; then chromium_cmd="chromium"
    elif command -v chromium-browser &>/dev/null; then chromium_cmd="chromium-browser"
    fi

    if [ -n "$chromium_cmd" ]; then
      local tries=0
      while [ $tries -lt 15 ]; do
        if curl -sf --max-time 2 "http://localhost:${port}/" >/dev/null 2>&1; then
          break
        fi
        tries=$(( tries + 1 ))
        sleep 2
      done

      local cdp_port="${AGENTREEL_CDP_PORT}"
      local vnc_port="${AGENTREEL_VNC_WS_PORT}"

      # 4a. Agent Chrome on agent display with CDP
      if ! pgrep -f "chromium.*remote-debugging-port=${cdp_port}" >/dev/null 2>&1; then
        DISPLAY="$display_num" nohup "$chromium_cmd" \
          --no-sandbox --disable-gpu \
          --remote-debugging-port="$cdp_port" \
          --user-data-dir="${AGENTREEL_CHROME_DIR}" \
          --window-size="${resolution%%x*},${resolution##*x}" \
          --no-first-run --disable-background-timer-throttling \
          --disable-session-crashed-bubble --disable-infobars \
          --disable-notifications --start-maximized \
          --noerrdialogs \
          --disable-features=InfiniteSessionRestore \
          "about:blank" \
          > "$AGENTREEL_DIR/logs/chromium-agent.log" 2>&1 &
        echo $! > "$AGENTREEL_DIR/pids/chromium-agent.pid"
        sleep 3
        DISPLAY="$display_num" xdotool search --class "Chromium" windowmove 0 0 windowsize "${resolution%%x*}" "${resolution##*x}" 2>/dev/null || true
        echo "  Agent Browser: Chrome on ${display_num} (CDP ${cdp_port})"

        setup_openclaw_visible_profile "$cdp_port"
      fi

      # 4a.2 Ensure vnc_clean.html exists
      if [ -d /usr/share/novnc ] && [ ! -f /usr/share/novnc/vnc_clean.html ]; then
        cat > /tmp/vnc_clean.html <<'VNCEOF'
<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Agent VNC</title>
<style>
  html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#000; }
  #screen { width:100%; height:100%; }
</style>
</head><body>
<div id="screen"></div>
<script type="module">
import RFB from './core/rfb.js';
const params = new URLSearchParams(location.search);
const host = params.get('host') || location.hostname;
const port = params.get('port') || '6080';
const path = params.get('path') || 'websockify';
const url = `ws://${host}:${port}/${path}`;
const rfb = new RFB(document.getElementById('screen'), url, {});
rfb.viewOnly = false;
rfb.scaleViewport = true;
rfb.resizeSession = false;
rfb.showDotCursor = false;
</script>
</body></html>
VNCEOF
        sudo cp /tmp/vnc_clean.html /usr/share/novnc/vnc_clean.html 2>/dev/null || \
          cp /tmp/vnc_clean.html /usr/share/novnc/vnc_clean.html 2>/dev/null || true
        rm -f /tmp/vnc_clean.html
      fi

      # 4a.3 x11vnc + websockify
      local vnc_rfb="${AGENTREEL_VNC_RFB_PORT}"
      if command -v x11vnc &>/dev/null; then
        if ! pgrep -f "x11vnc.*display ${display_num}" >/dev/null 2>&1; then
          x11vnc -display "$display_num" -rfbport "${vnc_rfb}" -nopw -shared -forever -bg \
            > "${AGENTREEL_LOG_DIR}/x11vnc.log" 2>&1 || true
          echo "  x11vnc: capturing ${display_num} → rfbport ${vnc_rfb}"
        fi
      fi
      if command -v websockify &>/dev/null; then
        if ! pgrep -f "websockify.*${vnc_port}" >/dev/null 2>&1; then
          nohup websockify --web "${AGENTREEL_NOVNC_DIR}" "$vnc_port" "localhost:${vnc_rfb}" \
            > "${AGENTREEL_LOG_DIR}/websockify.log" 2>&1 &
          echo $! > "$AGENTREEL_DIR/pids/websockify.pid"
          echo "  websockify: ws://localhost:${vnc_port}"
        fi
      fi

      # 4b. Kiosk Chrome on broadcast display
      if ! pgrep -f "chromium.*kiosk.*live" >/dev/null 2>&1; then
        local live_url="http://localhost:${port}/live?vnc=http%3A%2F%2Flocalhost%3A${vnc_port}%2Fvnc_clean.html&relay=http%3A%2F%2Flocalhost%3A${relay_port}"
        rm -rf /tmp/chromium-kiosk 2>/dev/null || true
        mkdir -p /tmp/chromium-kiosk/Default
        cat > /tmp/chromium-kiosk/Default/Preferences << 'KIOSK_PREFS'
{"profile":{"exit_type":"Normal","exited_cleanly":true},"session":{"restore_on_startup":5},"browser":{"has_seen_welcome_page":true,"command_line_flag_security_warnings_enabled":false}}
KIOSK_PREFS
        local snap_dir="$HOME/snap/chromium/common/chromium"
        if [ -d "$snap_dir/Default" ]; then
          rm -rf "$snap_dir/Default/Sessions" "$snap_dir/Default/Session Storage" 2>/dev/null
          rm -f  "$snap_dir/Default/Current Session" "$snap_dir/Default/Current Tabs" \
                 "$snap_dir/Default/Last Session" "$snap_dir/Default/Last Tabs" 2>/dev/null
          rm -rf "$snap_dir/Crash Reports" 2>/dev/null
          python3 -c "
import json
for p in ['$snap_dir/Default/Preferences']:
    try:
        with open(p,'r') as f: d=json.load(f)
        d.setdefault('profile',{})['exit_type']='Normal'
        d['profile']['exited_cleanly']=True
        d.setdefault('session',{})['restore_on_startup']=5
        d.setdefault('browser',{})['command_line_flag_security_warnings_enabled']=False
        with open(p,'w') as f: json.dump(d,f)
    except: pass
" 2>/dev/null || true
        fi
        DISPLAY="$broadcast_display" nohup "$chromium_cmd" \
          --no-sandbox --disable-gpu --test-type \
          --user-data-dir=/tmp/chromium-kiosk \
          --window-size="${resolution%%x*},${resolution##*x}" \
          --no-first-run --disable-background-timer-throttling \
          --disable-session-crashed-bubble --disable-infobars \
          --disable-notifications --noerrdialogs \
          --disable-features=InfiniteSessionRestore,SessionRestore \
          --hide-crash-restore-bubble \
          --enable-automation \
          --kiosk "$live_url" \
          > "$AGENTREEL_DIR/logs/chromium-kiosk.log" 2>&1 &
        echo $! > "$AGENTREEL_DIR/pids/chromium-kiosk.pid"
        sleep 3
        DISPLAY="$broadcast_display" xdotool search --class "Chromium" windowmove 0 0 windowsize "${resolution%%x*}" "${resolution##*x}" 2>/dev/null || true
        echo "  Kiosk: Chrome on ${broadcast_display} → /live (VNC+relay)"
      fi
    fi
  fi

  echo ""
  echo "  Live:   http://localhost:${port}/live"
  echo "  Stop:   agentreel stop"
}

cmd_stop() {
  echo "Stopping AgentReel..."

  if [ -f /tmp/agentreel-watchdog.lock ]; then
    local wd_pid
    wd_pid=$(cat /tmp/agentreel-watchdog.lock 2>/dev/null || echo "")
    if [ -n "$wd_pid" ] && kill -0 "$wd_pid" 2>/dev/null; then
      kill "$wd_pid" 2>/dev/null && echo "  Stopped watchdog (PID $wd_pid)" || true
    fi
    rm -f /tmp/agentreel-watchdog.lock
  fi
  pkill -f "watchdog.sh" 2>/dev/null || true

  for pidfile in "$AGENTREEL_DIR/pids/"*.pid "${HOME}/pids/"*.pid; do
    [ -f "$pidfile" ] || continue
    local name pid
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    kill "$pid" 2>/dev/null && echo "  Stopped $name (PID $pid)" || true
    rm -f "$pidfile"
  done

  pkill -f "relay_server.py" 2>/dev/null || true
  pkill -f "chromium.*kiosk" 2>/dev/null || true
  pkill -f "chromium.*chromium-agent" 2>/dev/null || true
  pkill -f "task_daemon.sh" 2>/dev/null || true
  pkill -f "stream_dual.sh" 2>/dev/null || true
  killall -9 ffmpeg 2>/dev/null || true
  pkill -f "x11vnc" 2>/dev/null || true
  pkill -f "websockify" 2>/dev/null || true
  echo "Done."
}

cmd_status() {
  echo "AgentReel Status"
  local found=false
  for pidfile in "$AGENTREEL_DIR/pids/"*.pid; do
    [ -f "$pidfile" ] || continue
    found=true
    name=$(basename "$pidfile" .pid)
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo "  $name: running (PID $pid)"
    else
      echo "  $name: stopped"
      rm -f "$pidfile"
    fi
  done

  if [ -f /tmp/agentreel-watchdog.lock ]; then
    local wd_pid
    wd_pid=$(cat /tmp/agentreel-watchdog.lock 2>/dev/null || echo "")
    if [ -n "$wd_pid" ] && kill -0 "$wd_pid" 2>/dev/null; then
      echo "  watchdog: running (PID $wd_pid)"
      found=true
    fi
  fi

  $found || echo "  No services running."
}
