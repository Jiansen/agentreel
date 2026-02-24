# AgentReel Server Components

## relay_server.py — SSE Relay for Live Mode

Watches an OpenClaw JSONL session file and streams new events to the
AgentReel `/live` page via Server-Sent Events (SSE).

### Quick Start

```bash
# Watch a specific session file
python3 relay_server.py --file ~/.openclaw/agents/main/sessions/my-session.jsonl

# Auto-detect the latest session in a directory
python3 relay_server.py --watch-dir ~/.openclaw/agents/main/sessions/ --port 8765
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/stream` | SSE event stream (connect from AgentReel `/live`) |
| `/api/events` | JSON dump of all events so far |
| `/api/status` | Current watcher status |
| `/health` | Health check |

### Connect from AgentReel

Open `https://reels.agent-status.com/live?stream=http://YOUR_SERVER:8765`

### Requirements

- Python 3.10+
- No external dependencies (stdlib only)
