<p align="center">
  <strong>AgentReel</strong>
  <br />
  <em>Beautiful replay & live viewer for AI agent sessions</em>
</p>

<p align="center">
  <a href="https://reels.agent-status.com/?demo">Live Demo</a> ·
  <a href="https://reels.agent-status.com/live">Live Mode</a> ·
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#live-mode">Live Streaming</a>
</p>

---

## What is AgentReel?

AgentReel turns your AI agent transcripts into beautiful, interactive timelines. Drag & drop a JSONL file to replay a session, or connect to a live relay server to watch an agent work in real-time.

Currently supports **OpenClaw** transcripts (v3 + legacy). More formats coming soon.

## Features

- **Drag & Drop Replay** — Drop your `.jsonl` file. No upload, no account, no install.
- **Live Mode** — Watch an AI agent work in real-time via Server-Sent Events.
- **Interactive Timeline** — Step through events with playback controls. Filter by type. Search by keyword.
- **One-Click Sharing** — Shareable links (data compressed in URL) or standalone HTML files.
- **Session Insights** — Tokens, cost, duration, tool call stats, and errors at a glance.
- **Privacy First** — Everything runs in your browser. Your data never leaves your machine.
- **Dark Theme** — Color-coded events, smooth animations, keyboard navigation (j/k/arrows).

## Quick Start

### Use Online

Visit **[reels.agent-status.com](https://reels.agent-status.com)** and drop your OpenClaw JSONL file.

Try the demo: [reels.agent-status.com/?demo](https://reels.agent-status.com/?demo)

### Run Locally

```bash
git clone https://github.com/Jiansen/agentreel.git
cd agentreel
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Live Mode

AgentReel can show an agent session as it happens. This requires a **relay server** that watches a JSONL file and streams new events via SSE.

### 1. Start the Relay Server

The relay server is included in `server/relay_server.py` (Python 3.10+, no external dependencies).

```bash
# Watch a specific session file
python3 server/relay_server.py --file ~/.openclaw/agents/main/sessions/my-session.jsonl

# Auto-detect the latest session in a directory
python3 server/relay_server.py --watch-dir ~/.openclaw/agents/main/sessions/ --port 8765
```

Relay endpoints:

| Endpoint | Description |
|----------|-------------|
| `/api/stream` | SSE event stream (for AgentReel `/live`) |
| `/api/events` | JSON dump of all events |
| `/api/status` | Current session status |
| `/health` | Health check |

### 2. Connect from AgentReel

Open the live viewer with your relay URL:

```
https://reels.agent-status.com/live?stream=http://YOUR_SERVER:8765
```

Or visit [/live](https://reels.agent-status.com/live) and enter the URL manually.

### 3. Generate Sessions (OpenClaw example)

```bash
# Run an OpenClaw task (generates a JSONL session the relay picks up)
export ZAI_API_KEY="your-key"
openclaw agent --local --session-id my-task --message "Analyze this server"
```

The relay server auto-detects new session files and starts streaming them.

### 4. 24/7 Live Streaming Setup

For a full 24/7 streaming setup (VNC desktop → YouTube/Twitch), see the **[deploy/](deploy/)** directory. It includes server provisioning, task automation, RTMP streaming, process monitoring, and a one-command `go_live.sh` startup script.

## Supported Formats

| Format | Status | Notes |
|--------|--------|-------|
| OpenClaw JSONL (v3) | Supported | Auto-detected, includes thinking + toolCall |
| OpenClaw JSONL (legacy) | Supported | Anthropic-style flat messages |
| OpenHands sessions | Planned | |
| LangChain traces | Planned | |
| Generic JSONL | Planned | |

## Sharing

Three ways to share sessions:

1. **Share Link** — Compresses transcript into the URL hash. No server needed.
2. **Standalone HTML** — Single `.html` file with embedded viewer and data.
3. **Raw JSONL** — Download the original transcript.

## Project Structure

```
agentreel/
  src/
    app/            # Next.js pages (/, /live, /openclaw-replay, etc.)
    components/     # React components (Viewer, EventCard, LiveViewer, etc.)
    lib/
      parsers/      # Format adapters (openclaw.ts — one per supported format)
      share.ts      # Sharing utilities
    types/          # Canonical timeline types (TimelineEvent, ParsedSession)
  server/
    relay_server.py # SSE relay for live mode (Python, stdlib only)
  deploy/
    setup_server.sh # Server setup (Node.js, OpenClaw, VNC, ffmpeg, Docker)
    go_live.sh      # One-command 24h live streaming startup
    task_loop.sh    # Continuous agent task generation (customizable)
    stream_dual.sh  # RTMP dual-stream to YouTube + Twitch
    setup_desktop.sh# VNC desktop layout (terminal + browser split)
    watchdog.sh     # Process monitor with auto-restart
  public/
    demo.jsonl      # Sample transcript for ?demo
```

**Architecture note**: Parsers in `src/lib/parsers/` are adapters that convert source formats into canonical `TimelineEvent` types. The core viewer components never reference source-specific formats.

## Tech Stack

- [Next.js](https://nextjs.org/) 15+ with App Router
- [React](https://react.dev/) 19
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Framer Motion](https://www.framer.com/motion/) for animations
- [react-markdown](https://github.com/remarkjs/react-markdown) + remark-gfm

## Contributing

Contributions welcome! Areas where help is needed:

- **New parser adapters** — Add support for other agent frameworks (see `src/lib/parsers/`)
- **UI/UX improvements** — Animations, responsive layout, accessibility
- **Performance** — Handle very large transcripts (10k+ events)
- **Live mode** — Relay server improvements, reconnection, multi-session

## License

MIT
