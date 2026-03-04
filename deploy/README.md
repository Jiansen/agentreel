# AgentReel Deploy

Scripts for setting up a 24/7 AgentReel live streaming server.

## Quick Start

```bash
# 1. Set up a fresh Ubuntu 24.04 VPS
ssh root@your-server 'bash -s' < deploy/setup_server.sh

# 2. Copy deploy scripts to the server
scp deploy/*.sh user@your-server:~/

# 3. Copy relay server
scp server/relay_server.py user@your-server:~/

# 4. Configure VNC + OpenClaw on the server
ssh user@your-server
vncpasswd
openclaw configure

# 5. Go live
~/go_live.sh
```

## What Each Script Does

| Script | Purpose |
|--------|---------|
| `setup_server.sh` | Installs Node.js, OpenClaw, VNC, ffmpeg, Docker on Ubuntu |
| `go_live.sh` | One-command startup: VNC → relay → tasks → desktop → stream → watchdog |
| `task_loop.sh` | Runs OpenClaw tasks continuously (customize the task list inside) |
| `relay_server.py` | SSE server that streams agent events to AgentReel's `/live` page |
| `stream_dual.sh` | Captures VNC desktop and streams to YouTube + Twitch |
| `setup_desktop.sh` | Arranges terminal + browser in split-screen on VNC desktop |
| `watchdog.sh` | Monitors all services and auto-restarts any that die |

## Streaming to YouTube/Twitch

### 1. Create `~/stream.env`

```bash
export YT_RTMP_URL="rtmp://a.rtmp.youtube.com/live2"
export YT_STREAM_KEY="your-youtube-stream-key"
export TW_RTMP_URL="rtmp://fra05.contribute.live-video.net/app"
export TW_STREAM_KEY="your-twitch-stream-key"
```

### 2. YouTube Setup (one-time, must be done before ffmpeg push)

YouTube requires a scheduled stream event with **auto-start enabled**.
Without this, pushing RTMP will show "Preparing stream" but never go live.

1. Go to [YouTube Studio Live](https://studio.youtube.com/)
2. Click **+ Create → Go Live** (a popup opens — close it)
3. Click the **Calendar icon** (Manage tab) → **Schedule Stream**
4. Fill in title, description. Select **Streaming software** as type
5. Set visibility to **Public**
6. **Enable Auto-start** ← this is the crucial step
7. Optionally enable **Auto-stop** if stream has a scheduled end
8. Wait until YouTube shows: *"Connect streaming software to go live"*
9. Copy the **Stream Key** (or reuse existing one)

**Why "Schedule Stream" instead of direct "Go Live"?**
Streams created via Manage → Schedule are persistent: if ffmpeg disconnects
briefly (network hiccup), YouTube will auto-reconnect when ffmpeg resumes.
Direct "Go Live" streams terminate immediately on disconnect.

**Restarting after ffmpeg crash:**
- If auto-start is ON: just restart ffmpeg. YouTube resumes automatically.
- If auto-start is OFF (or stream event ended): you must create a new
  scheduled stream in YouTube Studio before restarting ffmpeg.

### 3. Twitch Setup

Twitch is simpler — just push to the RTMP URL with your stream key.
No manual "Go Live" step needed. Stream starts when ffmpeg connects.

### 4. Start streaming

```bash
source ~/stream.env && ~/go_live.sh
```

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| YouTube stuck on "Preparing stream" | Auto-start not enabled, or stream event ended | Create new scheduled stream with auto-start ON |
| YouTube shows "Stream ended" | Previous stream event closed | Create new scheduled stream |
| Twitch says "offline" | ffmpeg not running | Check `pgrep ffmpeg` and restart |
| Both streams blurry text | Low bitrate | Increase `-b:v` to 6500k+ in stream script |
| ffmpeg high CPU (>90%) | Dual-stream encoding | Use tee muxer (single encode) or upgrade VPS |

## Customizing Tasks

Edit the `run_cycle()` function in `task_loop.sh` to define what the agent does on stream. Each task is an OpenClaw prompt that generates a new session.

## Architecture

```
VPS
├── VNC Desktop (:1)
│   ├── Terminal (left) — tail -f task_loop.log
│   └── Browser (right) — AgentReel /live viewer
├── relay_server.py — watches .jsonl sessions → SSE stream
├── task_loop.sh — generates OpenClaw sessions
├── stream_dual.sh — captures desktop → RTMP
└── watchdog.sh — keeps everything alive
```
