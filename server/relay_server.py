#!/usr/bin/env python3
"""
AgentReel SSE Relay Server

Watches an OpenClaw JSONL session file and streams new events to
connected browsers via Server-Sent Events.

Usage:
    python3 relay_server.py --file /path/to/session.jsonl --port 8765
    python3 relay_server.py --watch-dir ~/.openclaw/sessions/ --port 8765

Environment:
    RELAY_PORT=8765
    RELAY_FILE=/path/to/session.jsonl    (single file mode)
    RELAY_WATCH_DIR=~/.openclaw/sessions/ (auto-detect latest file)
"""

import argparse
import glob
import json
import os
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Lock, Thread


class SessionWatcher:
    """Watches a JSONL file for new lines and notifies listeners."""

    def __init__(self):
        self.file_path: str | None = None
        self.position: int = 0
        self.listeners: list = []
        self.lock = Lock()
        self.events: list[str] = []
        self.session_active = False

    def set_file(self, path: str):
        with self.lock:
            self.file_path = path
            self.position = 0
            self.events = []
            self.session_active = True
            self._read_existing()

    def _read_existing(self):
        if not self.file_path or not os.path.exists(self.file_path):
            return
        with open(self.file_path, "r") as f:
            content = f.read()
            self.position = len(content.encode("utf-8"))
            for line in content.strip().split("\n"):
                if line.strip():
                    self.events.append(line)

    def poll(self):
        if not self.file_path or not os.path.exists(self.file_path):
            return []
        new_lines = []
        try:
            with open(self.file_path, "r") as f:
                f.seek(self.position)
                new_content = f.read()
                if new_content:
                    self.position += len(new_content.encode("utf-8"))
                    for line in new_content.strip().split("\n"):
                        if line.strip():
                            new_lines.append(line)
                            with self.lock:
                                self.events.append(line)
        except Exception:
            pass
        return new_lines

    def get_all_events(self) -> list[str]:
        with self.lock:
            return list(self.events)

    def get_status(self) -> dict:
        return {
            "file": self.file_path,
            "events": len(self.events),
            "active": self.session_active,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }


watcher = SessionWatcher()
sse_clients: list = []
sse_lock = Lock()


class RelayHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._json_response({"status": "ok", **watcher.get_status()})

        elif self.path == "/api/status":
            self._json_response(watcher.get_status())

        elif self.path == "/api/events":
            events = watcher.get_all_events()
            self._json_response({"events": events, "count": len(events)})

        elif self.path == "/api/stream":
            self._handle_sse()

        else:
            self.send_error(404, "Not found. Use /api/stream, /api/events, or /api/status")

    def _json_response(self, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _handle_sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        # Send all existing events first
        for event_line in watcher.get_all_events():
            self._send_sse_event("event", event_line)

        # Register as SSE client
        with sse_lock:
            sse_clients.append(self)

        try:
            while True:
                time.sleep(1)
                self._send_sse_event("heartbeat", json.dumps(watcher.get_status()))
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with sse_lock:
                if self in sse_clients:
                    sse_clients.remove(self)

    def _send_sse_event(self, event_type: str, data: str):
        msg = f"event: {event_type}\ndata: {data}\n\n"
        self.wfile.write(msg.encode("utf-8"))
        self.wfile.flush()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def log_message(self, format, *args):
        if "/api/stream" not in str(args):
            sys.stderr.write(f"[relay] {args[0]}\n")


def broadcast_event(event_line: str):
    with sse_lock:
        dead = []
        for client in sse_clients:
            try:
                client._send_sse_event("event", event_line)
            except Exception:
                dead.append(client)
        for d in dead:
            sse_clients.remove(d)


def poll_loop(watch_dir: str | None):
    while True:
        if watch_dir:
            pattern = os.path.join(watch_dir, "**", "*.jsonl")
            files = sorted(glob.glob(pattern, recursive=True), key=os.path.getmtime)
            if files and files[-1] != watcher.file_path:
                print(f"[relay] New session file: {files[-1]}")
                watcher.set_file(files[-1])

        new_lines = watcher.poll()
        for line in new_lines:
            broadcast_event(line)
            print(f"[relay] New event → {len(sse_clients)} client(s)")

        time.sleep(0.5)


def main():
    parser = argparse.ArgumentParser(description="AgentReel SSE Relay Server")
    parser.add_argument("--file", help="JSONL file to watch")
    parser.add_argument("--watch-dir", help="Directory to watch for latest JSONL")
    parser.add_argument("--port", type=int, default=int(os.environ.get("RELAY_PORT", "8765")))
    args = parser.parse_args()

    if args.file:
        watcher.set_file(args.file)
        print(f"[relay] Watching file: {args.file}")
    elif args.watch_dir:
        print(f"[relay] Watching directory: {args.watch_dir}")
    else:
        print("[relay] No file or directory specified. Waiting for sessions...")

    poll_thread = Thread(target=poll_loop, args=(args.watch_dir,), daemon=True)
    poll_thread.start()

    server = HTTPServer(("0.0.0.0", args.port), RelayHandler)
    print(f"[relay] SSE server on http://0.0.0.0:{args.port}")
    print("[relay] Endpoints: /api/stream (SSE), /api/events (JSON), /api/status, /health")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[relay] Shutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
