#!/usr/bin/env python3
"""AgentReel MCP Server — lets AI agents interact with AgentReel.

Usage (stdio transport, for OpenClaw/Cursor/etc.):
  python3 mcp/agentreel_mcp.py

Configure in openclaw.json:
  {
    "mcpServers": {
      "agentreel": {
        "command": "python3",
        "args": ["/path/to/agentreel/mcp/agentreel_mcp.py"]
      }
    }
  }
"""

import json
import os
import sys
import subprocess
import glob
from datetime import datetime, timezone
from pathlib import Path

AGENTREEL_DIR = os.environ.get("AGENTREEL_DIR", os.path.expanduser("~/.agentreel"))
AGENTREEL_PORT = os.environ.get("AGENTREEL_PORT", "3000")
RELAY_PORT = os.environ.get("AGENTREEL_RELAY_PORT", "8765")
SESSIONS_DIR = os.environ.get(
    "AGENTREEL_WATCH_DIR",
    os.path.expanduser("~/.openclaw/agents/main/sessions/"),
)

SERVER_INFO = {
    "name": "agentreel",
    "version": "0.1.0",
    "protocolVersion": "2024-11-05",
}

TOOLS = [
    {
        "name": "agentreel_status",
        "description": "Check AgentReel service status (viewer, relay, streaming). Use this to verify AgentReel is running before sharing links.",
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "agentreel_sessions",
        "description": "List recent agent sessions available for replay. Returns session IDs, timestamps, sizes, and whether they are currently active.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Max number of sessions to return (default 10)",
                    "default": 10,
                }
            },
            "required": [],
        },
    },
    {
        "name": "agentreel_live_url",
        "description": "Get the URL to watch the current live agent session in AgentReel. Share this with users so they can watch your work in real-time.",
        "inputSchema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "agentreel_replay_url",
        "description": "Get the replay URL for a specific session. Users can open this to review a completed task.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "session_id": {
                    "type": "string",
                    "description": "Session ID to get replay URL for. Use agentreel_sessions to list available sessions.",
                }
            },
            "required": ["session_id"],
        },
    },
    {
        "name": "agentreel_config",
        "description": "View or update AgentReel configuration. Use without 'key' to view all config, or provide key+value to set.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "Config key (port, relay_port, watch_dir, twitch_key, youtube_key, resolution, bitrate, watermark_text, watermark_visible, qr_url, task_timeout, task_pause)",
                },
                "value": {
                    "type": "string",
                    "description": "Value to set (omit to read current value)",
                },
            },
            "required": [],
        },
    },
]


def _now_utc():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _check_pid(pidfile):
    try:
        pid = int(Path(pidfile).read_text().strip())
        os.kill(pid, 0)
        return pid
    except (FileNotFoundError, ValueError, ProcessLookupError, PermissionError):
        return None


def _get_hostname():
    try:
        result = subprocess.run(
            ["hostname", "-I"], capture_output=True, text=True, timeout=2
        )
        return result.stdout.strip().split()[0] if result.stdout.strip() else "localhost"
    except Exception:
        return "localhost"


def tool_status(_args):
    pids_dir = os.path.join(AGENTREEL_DIR, "pids")
    viewer_pid = _check_pid(os.path.join(pids_dir, "viewer.pid"))
    relay_pid = _check_pid(os.path.join(pids_dir, "relay.pid"))
    stream_pid = _check_pid(os.path.join(pids_dir, "stream.pid"))

    host = _get_hostname()

    status = {
        "viewer": {
            "running": viewer_pid is not None,
            "pid": viewer_pid,
            "url": f"http://{host}:{AGENTREEL_PORT}",
        },
        "relay": {
            "running": relay_pid is not None,
            "pid": relay_pid,
            "port": RELAY_PORT,
        },
        "stream": {
            "running": stream_pid is not None,
            "pid": stream_pid,
        },
        "sessions_dir": SESSIONS_DIR,
        "sessions_dir_exists": os.path.isdir(SESSIONS_DIR),
        "live_url": f"http://{host}:{AGENTREEL_PORT}/live",
        "timestamp": _now_utc(),
    }

    running = [k for k, v in status.items() if isinstance(v, dict) and v.get("running")]
    summary = f"AgentReel: {', '.join(running) if running else 'no services'} running"
    if viewer_pid:
        summary += f"\nViewer: http://{host}:{AGENTREEL_PORT}"
        summary += f"\nLive: http://{host}:{AGENTREEL_PORT}/live"

    return {"text": summary, "data": status}


def tool_sessions(args):
    limit = args.get("limit", 10)
    if not os.path.isdir(SESSIONS_DIR):
        return {"text": f"Sessions directory not found: {SESSIONS_DIR}", "data": []}

    files = glob.glob(os.path.join(SESSIONS_DIR, "*.jsonl"))
    files.sort(key=os.path.getmtime, reverse=True)
    files = files[:limit]

    sessions = []
    for f in files:
        name = Path(f).stem
        stat = os.stat(f)
        age_s = (datetime.now(timezone.utc) - datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)).total_seconds()
        sessions.append({
            "session_id": name,
            "size_kb": round(stat.st_size / 1024, 1),
            "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "active": age_s < 300,
        })

    lines = [f"{'*' if s['active'] else ' '} {s['session_id']}  ({s['size_kb']}KB, {s['modified']})" for s in sessions]
    text = f"{len(sessions)} sessions:\n" + "\n".join(lines) if sessions else "No sessions found."
    return {"text": text, "data": sessions}


def tool_live_url(_args):
    host = _get_hostname()
    url = f"http://{host}:{AGENTREEL_PORT}/live"
    return {"text": f"Live viewer: {url}\n\nShare this URL to let others watch your agent work in real-time.", "data": {"url": url}}


def tool_replay_url(args):
    session_id = args.get("session_id", "")
    if not session_id:
        return {"text": "Error: session_id is required", "data": {}}

    jsonl_path = os.path.join(SESSIONS_DIR, f"{session_id}.jsonl")
    if not os.path.exists(jsonl_path):
        return {"text": f"Session not found: {session_id}", "data": {}}

    host = _get_hostname()
    url = f"http://{host}:{AGENTREEL_PORT}/?url=http://{host}:{RELAY_PORT}/api/transcripts/{session_id}"
    return {
        "text": f"Replay: {url}\n\nShare this URL to let others review the '{session_id}' session.",
        "data": {"url": url, "session_id": session_id},
    }


def tool_config(args):
    config_file = os.path.join(AGENTREEL_DIR, "config.json")
    key = args.get("key")
    value = args.get("value")

    try:
        config = json.loads(Path(config_file).read_text()) if os.path.exists(config_file) else {}
    except Exception:
        config = {}

    if key and value:
        config[key] = value
        os.makedirs(AGENTREEL_DIR, exist_ok=True)
        Path(config_file).write_text(json.dumps(config, indent=2))
        return {"text": f"Set {key} = {value}", "data": config}
    elif key:
        val = config.get(key, "(not set)")
        return {"text": f"{key} = {val}", "data": {key: val}}
    else:
        text = "\n".join(f"  {k}: {v}" for k, v in config.items()) if config else "(no configuration set)"
        return {"text": f"AgentReel config:\n{text}", "data": config}


TOOL_HANDLERS = {
    "agentreel_status": tool_status,
    "agentreel_sessions": tool_sessions,
    "agentreel_live_url": tool_live_url,
    "agentreel_replay_url": tool_replay_url,
    "agentreel_config": tool_config,
}


# === MCP stdio transport ===

def send_response(msg):
    out = json.dumps(msg)
    sys.stdout.write(f"Content-Length: {len(out)}\r\n\r\n{out}")
    sys.stdout.flush()


def read_message():
    headers = {}
    while True:
        line = sys.stdin.readline()
        if not line or line.strip() == "":
            break
        if ":" in line:
            k, v = line.split(":", 1)
            headers[k.strip().lower()] = v.strip()

    length = int(headers.get("content-length", 0))
    if length == 0:
        return None

    body = sys.stdin.read(length)
    return json.loads(body)


def handle_request(msg):
    method = msg.get("method", "")
    req_id = msg.get("id")
    params = msg.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": SERVER_INFO["protocolVersion"],
                "serverInfo": {"name": SERVER_INFO["name"], "version": SERVER_INFO["version"]},
                "capabilities": {"tools": {}},
            },
        }

    if method == "notifications/initialized":
        return None

    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"tools": TOOLS},
        }

    if method == "tools/call":
        tool_name = params.get("name", "")
        tool_args = params.get("arguments", {})
        handler = TOOL_HANDLERS.get(tool_name)

        if not handler:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": f"Unknown tool: {tool_name}"}],
                    "isError": True,
                },
            }

        try:
            result = handler(tool_args)
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": result["text"]}],
                },
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": f"Error: {e}"}],
                    "isError": True,
                },
            }

    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {"code": -32601, "message": f"Method not found: {method}"},
    }


def main():
    while True:
        msg = read_message()
        if msg is None:
            break
        response = handle_request(msg)
        if response:
            send_response(response)


if __name__ == "__main__":
    main()
