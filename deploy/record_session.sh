#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Session Recorder — Dual Backend (ffmpeg / Cua)
#
# Records a VNC desktop session as video, with optional RTMP streaming.
# Supports two backends:
#   - ffmpeg (default): lightweight screen capture to mp4, with optional RTMP push
#   - cua:             VNC protocol-level recording via Cua CLI (high fidelity)
#
# Usage:
#   ./record_session.sh --backend ffmpeg --session-id my-session
#   ./record_session.sh --backend ffmpeg --session-id my-session --stream "rtmp://a.rtmp.youtube.com/live2/KEY"
#   ./record_session.sh --backend cua --session-id my-session --vnc-url vnc://localhost:5901
#   ./record_session.sh --stop
#
# Output:
#   recordings/{session-id}.mp4   (ffmpeg backend)
#   recordings/{session-id}.js    (cua backend)

BACKEND="${BACKEND:-ffmpeg}"
SESSION_ID=""
STREAM_URL=""
VNC_URL="${VNC_URL:-vnc://localhost:5901}"
DISPLAY_NUM="${DISPLAY_NUM:-:1}"
RESOLUTION="${RESOLUTION:-1920x1080}"
FPS="${FPS:-15}"
BITRATE="${BITRATE:-1500k}"
RECORDINGS_DIR="${RECORDINGS_DIR:-$HOME/recordings}"
PID_FILE="${RECORDINGS_DIR}/.recorder.pid"
SEGMENT_TIME="${SEGMENT_TIME:-1800}"
STOP_MODE=false

log() { echo "[record] $(date +"%Y-%m-%dT%H:%M:%SZ") $*"; }

usage() {
  cat <<EOF
Usage: $0 [OPTIONS]

Options:
  --backend ffmpeg|cua   Recording backend (default: ffmpeg)
  --session-id ID        Session identifier for output filename
  --stream URL           RTMP URL for live streaming (ffmpeg only)
  --vnc-url URL          VNC server URL (cua only, default: vnc://localhost:5901)
  --display NUM          X display number (ffmpeg only, default: :1)
  --resolution WxH       Capture resolution (ffmpeg only, default: 1920x1080)
  --fps N                Frame rate (ffmpeg only, default: 15)
  --bitrate RATE         Video bitrate (ffmpeg only, default: 1500k)
  --segment-time SECS    Segment duration in seconds (ffmpeg only, default: 1800)
  --recordings-dir PATH  Output directory (default: ~/recordings)
  --stop                 Stop any running recorder
  -h, --help             Show this help
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend) BACKEND="$2"; shift 2 ;;
    --session-id) SESSION_ID="$2"; shift 2 ;;
    --stream) STREAM_URL="$2"; shift 2 ;;
    --vnc-url) VNC_URL="$2"; shift 2 ;;
    --display) DISPLAY_NUM="$2"; shift 2 ;;
    --resolution) RESOLUTION="$2"; shift 2 ;;
    --fps) FPS="$2"; shift 2 ;;
    --bitrate) BITRATE="$2"; shift 2 ;;
    --segment-time) SEGMENT_TIME="$2"; shift 2 ;;
    --recordings-dir) RECORDINGS_DIR="$2"; shift 2 ;;
    --stop) STOP_MODE=true; shift ;;
    -h|--help) usage ;;
    *) log "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$RECORDINGS_DIR"

if $STOP_MODE; then
  if [[ -f "$PID_FILE" ]]; then
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "Stopping recorder (PID $pid)"
      kill "$pid"
      rm -f "$PID_FILE"
      log "Stopped"
    else
      log "PID $pid not running, cleaning up"
      rm -f "$PID_FILE"
    fi
  else
    log "No recorder running"
  fi
  exit 0
fi

if [[ -z "$SESSION_ID" ]]; then
  SESSION_ID="session-$(date +"%Y%m%d-%H%M%S")"
  log "Auto-generated session ID: $SESSION_ID"
fi

record_ffmpeg() {
  local outfile="${RECORDINGS_DIR}/${SESSION_ID}.mp4"
  log "Backend: ffmpeg"
  log "Output:  $outfile"

  local ffmpeg_args=(
    -f x11grab -video_size "$RESOLUTION" -framerate "$FPS" -i "$DISPLAY_NUM"
    -f lavfi -i "anullsrc=channel_layout=stereo:sample_rate=44100"
    -c:v libx264 -preset veryfast -tune zerolatency
    -maxrate "$BITRATE" -bufsize "$((${BITRATE%k} * 2))k"
    -pix_fmt yuv420p -g $((FPS * 2))
    -c:a aac -b:a 128k -ar 44100
  )

  if [[ -n "$STREAM_URL" ]]; then
    log "Dual output: file + RTMP stream"
    ffmpeg_args+=(
      -f tee
      "[f=mp4]${outfile}|[f=flv:onfail=ignore]${STREAM_URL}"
    )
  else
    ffmpeg_args+=(-f mp4 "$outfile")
  fi

  log "Starting ffmpeg (${RESOLUTION}@${FPS}fps, ${BITRATE})"
  ffmpeg "${ffmpeg_args[@]}" &
  echo $! > "$PID_FILE"
  log "Recorder PID: $(cat "$PID_FILE")"
  wait
}

record_cua() {
  if ! command -v cua &>/dev/null; then
    log "ERROR: Cua CLI not found. Install with: pip install cua-cli==0.1.5"
    exit 1
  fi

  local outfile="${RECORDINGS_DIR}/${SESSION_ID}.js"
  log "Backend: cua"
  log "Output:  $outfile"
  log "VNC:     $VNC_URL"

  cua skills record \
    --vnc-url "$VNC_URL" \
    --output "$outfile" \
    --name "$SESSION_ID" &
  echo $! > "$PID_FILE"
  log "Recorder PID: $(cat "$PID_FILE")"
  wait
}

log "=== AgentReel Session Recorder ==="
log "Session: $SESSION_ID"

case "$BACKEND" in
  ffmpeg) record_ffmpeg ;;
  cua)    record_cua ;;
  *)      log "ERROR: Unknown backend '$BACKEND'. Use 'ffmpeg' or 'cua'."; exit 1 ;;
esac

rm -f "$PID_FILE"
log "Recording finished"
