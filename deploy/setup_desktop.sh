#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Desktop Layout
# Sets up a split-screen VNC desktop for live streaming:
#   Left:  Terminal (showing task loop / agent output)
#   Right: Browser with AgentReel Live Viewer
#
# Run inside VNC session (DISPLAY=:1).
# Prerequisites: wmctrl, firefox or chromium-browser
#
# Usage: DISPLAY=:1 ./setup_desktop.sh

DISPLAY="${DISPLAY:-:1}"
export DISPLAY

RELAY_PORT="${RELAY_PORT:-8765}"
RELAY_HOST="${RELAY_HOST:-localhost}"
AGENTREEL_URL="${AGENTREEL_URL:-https://reels.agent-status.com}"

log() { echo "[desktop] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"; }
log "Setting up split-screen desktop on ${DISPLAY}"

# Left half: Terminal tailing task loop log
log "Opening terminal (left half)..."
xfce4-terminal \
  --title="AgentReel Tasks" \
  --geometry=96x50+0+0 \
  -e "bash -c 'tail -f ~/logs/task_loop.log 2>/dev/null || echo Waiting for task_loop...; sleep 999999'" &
sleep 2

# Right half: Browser with AgentReel Live Viewer
LIVE_URL="${AGENTREEL_URL}/live?stream=http://${RELAY_HOST}:${RELAY_PORT}"
log "Opening browser → ${LIVE_URL}"
if command -v firefox &>/dev/null; then
  firefox --new-window "$LIVE_URL" &
elif command -v chromium-browser &>/dev/null; then
  chromium-browser --new-window "$LIVE_URL" &
else
  log "WARNING: No browser found. Install firefox or chromium-browser."
fi
sleep 3

# Tile windows using wmctrl
if command -v wmctrl &>/dev/null; then
  log "Tiling windows..."
  SCREEN_W=$(xdpyinfo 2>/dev/null | grep dimensions | awk '{print $2}' | cut -dx -f1)
  SCREEN_H=$(xdpyinfo 2>/dev/null | grep dimensions | awk '{print $2}' | cut -dx -f2)
  HALF_W=$((SCREEN_W / 2))

  wmctrl -r "AgentReel Tasks" -e "0,0,0,${HALF_W},${SCREEN_H}" 2>/dev/null || true
  sleep 1
  wmctrl -r "AgentReel" -e "0,${HALF_W},0,${HALF_W},${SCREEN_H}" 2>/dev/null || \
    wmctrl -r "Firefox" -e "0,${HALF_W},0,${HALF_W},${SCREEN_H}" 2>/dev/null || \
    wmctrl -r "Chromium" -e "0,${HALF_W},0,${HALF_W},${SCREEN_H}" 2>/dev/null || true
  log "Windows tiled"
else
  log "WARNING: wmctrl not found (apt-get install wmctrl). Manual arrangement needed."
fi

log "Desktop setup complete"
