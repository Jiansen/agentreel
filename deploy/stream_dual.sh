#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Dual Stream
# Captures the VNC desktop and streams to YouTube + Twitch via ffmpeg tee muxer.
# Auto-restarts on failure.
#
# Usage:
#   source ~/stream.env && ./stream_dual.sh
#
# stream.env example:
#   export YT_RTMP_URL="rtmp://a.rtmp.youtube.com/live2"
#   export YT_STREAM_KEY="xxxx-xxxx-xxxx-xxxx"
#   export TW_RTMP_URL="rtmp://fra05.contribute.live-video.net/app"
#   export TW_STREAM_KEY="live_xxxxxxxx"
#
# At least one platform (YT or TW) must be configured.

DISPLAY_NUM="${DISPLAY_NUM:-:1}"
RESOLUTION="${RESOLUTION:-1920x1080}"
FPS="${FPS:-30}"
BITRATE="${BITRATE:-2500k}"
RESTART_DELAY="${RESTART_DELAY:-10}"
RECORD_LOCAL="${RECORD_LOCAL:-false}"
RECORDINGS_DIR="${RECORDINGS_DIR:-$HOME/recordings}"

log() { echo "[stream] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"; }

build_tee_output() {
  local outputs="" count=0

  if [[ -n "${YT_RTMP_URL:-}" && -n "${YT_STREAM_KEY:-}" ]]; then
    outputs="[f=flv:onfail=ignore]${YT_RTMP_URL}/${YT_STREAM_KEY}"
    count=$((count + 1))
    log "YouTube target configured"
  fi

  if [[ -n "${TW_RTMP_URL:-}" && -n "${TW_STREAM_KEY:-}" ]]; then
    [[ $count -gt 0 ]] && outputs="${outputs}|"
    outputs="${outputs}[f=flv:onfail=ignore]${TW_RTMP_URL}/${TW_STREAM_KEY}"
    count=$((count + 1))
    log "Twitch target configured"
  fi

  if [[ $count -eq 0 ]]; then
    log "ERROR: No stream targets. Set YT_RTMP_URL+YT_STREAM_KEY or TW_RTMP_URL+TW_STREAM_KEY."
    exit 1
  fi

  log "Streaming to ${count} target(s)"
  echo "$outputs"
}

run_stream() {
  local tee_output
  tee_output=$(build_tee_output)

  if [[ "$RECORD_LOCAL" == "true" ]]; then
    mkdir -p "$RECORDINGS_DIR"
    local segment_file="${RECORDINGS_DIR}/stream-$(date +"%Y%m%d-%H%M%S").mp4"
    tee_output="${tee_output}|[f=mp4]${segment_file}"
    log "Local recording enabled: ${segment_file}"
  fi

  log "Starting ffmpeg (${RESOLUTION} @ ${FPS}fps, ${BITRATE})"

  ffmpeg \
    -f x11grab -video_size "${RESOLUTION}" -framerate "${FPS}" -i "${DISPLAY_NUM}" \
    -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
    -c:v libx264 -preset veryfast -tune zerolatency \
    -maxrate "${BITRATE}" -bufsize "$((${BITRATE%k} * 2))k" \
    -pix_fmt yuv420p -g $((FPS * 2)) \
    -c:a aac -b:a 128k -ar 44100 \
    -f tee "${tee_output}"
}

log "=== AgentReel Dual Stream ==="
while true; do
  run_stream || true
  log "Stream ended. Restarting in ${RESTART_DELAY}s..."
  sleep "$RESTART_DELAY"
done
