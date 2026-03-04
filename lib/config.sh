#!/usr/bin/env bash
# AgentReel configuration — Single Source of Truth
# All scripts (install.sh CLI, deploy/*.sh) source this file.
# User overrides go in ~/.agentreel/config.env (shell-sourceable).

# Guard against double-sourcing
[ "${_AGENTREEL_CONFIG_LOADED:-}" = "1" ] && return 0
_AGENTREEL_CONFIG_LOADED=1

# ── Paths ──────────────────────────────────────────────────
export AGENTREEL_DIR="${AGENTREEL_DIR:-$HOME/.agentreel}"
export AGENTREEL_WATCH_DIR="${AGENTREEL_WATCH_DIR:-$HOME/.openclaw/agents/main/sessions/}"
export AGENTREEL_NOVNC_DIR="${AGENTREEL_NOVNC_DIR:-/usr/share/novnc}"
export AGENTREEL_SKILL_DIR="${AGENTREEL_SKILL_DIR:-$HOME/.openclaw/skills/agentreel}"
export AGENTREEL_CHROME_DIR="${AGENTREEL_CHROME_DIR:-$HOME/.config/agentreel-chrome}"

# ── Ports ──────────────────────────────────────────────────
export AGENTREEL_PORT="${AGENTREEL_PORT:-3000}"
export AGENTREEL_RELAY_PORT="${AGENTREEL_RELAY_PORT:-8765}"
export AGENTREEL_CDP_PORT="${AGENTREEL_CDP_PORT:-18802}"
export AGENTREEL_VNC_WS_PORT="${AGENTREEL_VNC_WS_PORT:-6080}"
export AGENTREEL_VNC_RFB_PORT="${AGENTREEL_VNC_RFB_PORT:-5999}"

# ── Display ────────────────────────────────────────────────
export AGENTREEL_DISPLAY="${AGENTREEL_DISPLAY:-:99}"
export AGENTREEL_BROADCAST_DISPLAY="${AGENTREEL_BROADCAST_DISPLAY:-:100}"
export AGENTREEL_RESOLUTION="${AGENTREEL_RESOLUTION:-1920x1080}"
export AGENTREEL_NO_DESKTOP="${AGENTREEL_NO_DESKTOP:-0}"

# ── Streaming ──────────────────────────────────────────────
export AGENTREEL_BITRATE="${AGENTREEL_BITRATE:-4500k}"
export AGENTREEL_MAXRATE="${AGENTREEL_MAXRATE:-6000k}"
export AGENTREEL_FPS="${AGENTREEL_FPS:-30}"

# ── Agent Chrome flags ─────────────────────────────────────
export AGENTREEL_CHROME_FLAGS="${AGENTREEL_CHROME_FLAGS:---no-sandbox --disable-gpu --noerrdialogs --disable-features=InfiniteSessionRestore}"

# ── Derived (computed from above) ──────────────────────────
export AGENTREEL_CONFIG_FILE="${AGENTREEL_DIR}/.agentreel-config.json"
export AGENTREEL_PID_DIR="${AGENTREEL_DIR}/pids"
export AGENTREEL_LOG_DIR="${AGENTREEL_DIR}/logs"

# ── Load user overrides ───────────────────────────────────
_user_config="${AGENTREEL_DIR}/config.env"
if [ -f "$_user_config" ]; then
  # shellcheck source=/dev/null
  . "$_user_config"
fi

# Also load stream.env if present (streaming keys etc.)
_stream_env="${AGENTREEL_DIR}/stream.env"
[ -f "$_stream_env" ] && . "$_stream_env"
_stream_env2="$HOME/stream.env"
[ -f "$_stream_env2" ] && . "$_stream_env2"
