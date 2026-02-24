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
ZAI_API_KEY="your-key" ~/go_live.sh
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

Create a `~/stream.env` on your server:

```bash
export YT_RTMP_URL="rtmp://a.rtmp.youtube.com/live2"
export YT_STREAM_KEY="your-youtube-stream-key"
export TW_RTMP_URL="rtmp://fra05.contribute.live-video.net/app"
export TW_STREAM_KEY="your-twitch-stream-key"
```

Then:

```bash
source ~/stream.env && ZAI_API_KEY="..." ~/go_live.sh
```

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
