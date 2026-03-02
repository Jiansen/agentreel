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
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
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


MAX_TRANSCRIPT_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_TRANSCRIPTS = 200
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 10  # uploads per window

TRANSCRIPT_DIR = Path(os.environ.get(
    "TRANSCRIPT_DIR", os.path.expanduser("~/transcripts")
))
VIEWER_BASE = os.environ.get(
    "VIEWER_BASE", "https://agentreel.agent-status.com"
)


class RateLimiter:
    """Simple in-memory sliding-window rate limiter per IP."""

    def __init__(self, window: int = RATE_LIMIT_WINDOW, limit: int = RATE_LIMIT_MAX):
        self.window = window
        self.limit = limit
        self.lock = Lock()
        self.hits: dict[str, list[float]] = {}

    def allow(self, ip: str) -> bool:
        now = time.time()
        with self.lock:
            timestamps = self.hits.get(ip, [])
            timestamps = [t for t in timestamps if now - t < self.window]
            if len(timestamps) >= self.limit:
                self.hits[ip] = timestamps
                return False
            timestamps.append(now)
            self.hits[ip] = timestamps
            return True


class TranscriptStore:
    """Manages uploaded transcript JSONL files on disk."""

    def __init__(self, directory: Path):
        self.directory = directory
        self.directory.mkdir(parents=True, exist_ok=True)
        self.lock = Lock()

    def save(self, body: bytes) -> dict:
        tid = uuid.uuid4().hex[:12]
        path = self.directory / f"{tid}.jsonl"
        event_count = 0
        for line in body.decode("utf-8", errors="replace").split("\n"):
            stripped = line.strip()
            if stripped:
                try:
                    json.loads(stripped)
                    event_count += 1
                except json.JSONDecodeError:
                    pass
        if event_count == 0:
            raise ValueError("No valid JSONL lines found")

        with open(path, "wb") as f:
            f.write(body)

        self._evict_old()

        return {
            "id": tid,
            "events": event_count,
            "bytes": len(body),
            "viewUrl": f"{VIEWER_BASE}/?url={self._public_url(tid)}",
        }

    def list_all(self) -> list[dict]:
        result = []
        for p in sorted(self.directory.glob("*.jsonl"), key=os.path.getmtime, reverse=True):
            tid = p.stem
            stat = p.stat()
            meta_path = self.directory / f"{tid}.meta.json"
            video_url = None
            if meta_path.exists():
                try:
                    meta = json.loads(meta_path.read_text())
                    video_url = meta.get("videoUrl")
                except json.JSONDecodeError:
                    pass
            entry: dict = {
                "id": tid,
                "bytes": stat.st_size,
                "created": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ).strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            if video_url:
                entry["videoUrl"] = video_url
            result.append(entry)
        return result

    def get(self, tid: str) -> bytes | None:
        if not re.match(r"^[a-f0-9]{12}$", tid):
            return None
        path = self.directory / f"{tid}.jsonl"
        if not path.exists():
            return None
        return path.read_bytes()

    def get_meta(self, tid: str) -> dict | None:
        if not re.match(r"^[a-f0-9]{12}$", tid):
            return None
        path = self.directory / f"{tid}.jsonl"
        if not path.exists():
            return None
        meta_path = self.directory / f"{tid}.meta.json"
        meta = {}
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text())
            except json.JSONDecodeError:
                pass
        stat = path.stat()
        return {
            "id": tid,
            "bytes": stat.st_size,
            "created": datetime.fromtimestamp(
                stat.st_mtime, tz=timezone.utc
            ).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "videoUrl": meta.get("videoUrl"),
            "viewUrl": f"{VIEWER_BASE}/?url={self._public_url(tid)}",
        }

    def set_video_url(self, tid: str, video_url: str) -> dict | None:
        if not re.match(r"^[a-f0-9]{12}$", tid):
            return None
        path = self.directory / f"{tid}.jsonl"
        if not path.exists():
            return None
        meta_path = self.directory / f"{tid}.meta.json"
        meta = {}
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text())
            except json.JSONDecodeError:
                pass
        meta["videoUrl"] = video_url
        meta["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        meta_path.write_text(json.dumps(meta))
        return self.get_meta(tid)

    def _evict_old(self):
        files = sorted(self.directory.glob("*.jsonl"), key=os.path.getmtime)
        while len(files) > MAX_TRANSCRIPTS:
            oldest = files.pop(0)
            oldest.unlink(missing_ok=True)

    def _public_url(self, tid: str) -> str:
        port = os.environ.get("RELAY_PORT", "8765")
        host = os.environ.get("RELAY_HOST", "localhost")
        return f"http://{host}:{port}/api/transcripts/{tid}"


watcher = SessionWatcher()
transcript_store = TranscriptStore(TRANSCRIPT_DIR)
upload_limiter = RateLimiter()
sse_clients: list = []
sse_lock = Lock()

_watch_dir_ref: str | None = None


def _extract_session_summary(filepath: str, limit_events: int = 500) -> dict | None:
    """Extract task name, status, and summary from a session JSONL file."""
    try:
        fname = os.path.basename(filepath)
        stat = os.stat(filepath)
        task = ""
        started_at = ""
        last_agent = ""
        event_count = 0
        has_end = False

        with open(filepath, "r") as f:
            for line in f:
                event_count += 1
                if event_count > limit_events:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue

                etype = obj.get("type", "")
                if etype == "session":
                    started_at = obj.get("timestamp", "")
                elif etype == "message" and obj.get("message", {}).get("role") == "user":
                    if not task:
                        content = obj["message"].get("content", "")
                        if isinstance(content, list):
                            content = " ".join(
                                b.get("text", "") for b in content if b.get("type") == "text"
                            )
                        task = str(content)[:80]
                elif etype == "message" and obj.get("message", {}).get("role") == "assistant":
                    content = obj["message"].get("content", "")
                    if isinstance(content, list):
                        texts = [b.get("text", "") for b in content if b.get("type") == "text"]
                        content = " ".join(texts)
                    if content:
                        last_agent = str(content)[:150]

                if etype in ("session.end", "result"):
                    has_end = True

        if not task:
            return None

        return {
            "file": fname,
            "task": task,
            "startedAt": started_at or datetime.fromtimestamp(
                stat.st_mtime, tz=timezone.utc
            ).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "status": "done" if has_end else "running",
            "events": event_count,
            "summary": last_agent,
        }
    except Exception:
        return None


def get_session_history(limit: int = 10) -> list[dict]:
    """Return summaries of recent sessions from the watch directory."""
    watch_dir = _watch_dir_ref
    if not watch_dir:
        return []
    pattern = os.path.join(watch_dir, "**", "*.jsonl")
    files = sorted(glob.glob(pattern, recursive=True), key=os.path.getmtime, reverse=True)
    results = []
    for fpath in files[:limit]:
        info = _extract_session_summary(fpath)
        if info:
            results.append(info)
    return results


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

        elif self.path == "/api/history":
            self._json_response({"sessions": get_session_history()})

        elif self.path == "/api/transcripts":
            self._json_response({
                "transcripts": transcript_store.list_all(),
            })

        elif self.path.startswith("/api/transcripts/"):
            parts = self.path.rstrip("/").split("/")
            tid = parts[3] if len(parts) > 3 else ""
            suffix = parts[4] if len(parts) > 4 else None

            if suffix == "meta":
                meta = transcript_store.get_meta(tid)
                if meta is None:
                    self.send_error(404, "Transcript not found")
                else:
                    self._json_response(meta)
            else:
                data = transcript_store.get(tid)
                if data is None:
                    self.send_error(404, "Transcript not found")
                else:
                    self._raw_response(data, "application/x-ndjson")

        else:
            self.send_error(
                404,
                "Not found. Endpoints: /api/stream, /api/events, "
                "/api/status, /api/transcript, /api/transcripts",
            )

    def do_POST(self):
        if self.path == "/api/transcript":
            self._handle_transcript_upload()
        elif self.path.startswith("/api/transcripts/") and self.path.rstrip("/").endswith("/video"):
            self._handle_video_link()
        else:
            self.send_error(404, "POST accepted at /api/transcript or /api/transcripts/{id}/video")

    def _handle_video_link(self):
        parts = self.path.rstrip("/").split("/")
        tid = parts[3] if len(parts) > 4 else ""
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > 4096:
            self._json_error(400, "Invalid body")
            return
        body = self.rfile.read(length)
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self._json_error(400, "Invalid JSON")
            return
        video_url = payload.get("videoUrl", "").strip()
        if not video_url:
            self._json_error(400, "videoUrl is required")
            return
        result = transcript_store.set_video_url(tid, video_url)
        if result is None:
            self._json_error(404, "Transcript not found")
        else:
            self._json_response(result)

    def _handle_transcript_upload(self):
        client_ip = self.client_address[0]
        if not upload_limiter.allow(client_ip):
            self._json_error(429, "Rate limit exceeded. Try again later.")
            return

        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            self._json_error(400, "Empty body")
            return
        if length > MAX_TRANSCRIPT_BYTES:
            self._json_error(413, f"Body too large (max {MAX_TRANSCRIPT_BYTES} bytes)")
            return

        body = self.rfile.read(length)
        try:
            result = transcript_store.save(body)
        except ValueError as e:
            self._json_error(400, str(e))
            return

        self._json_response(result, status=201)

    def _json_error(self, status: int, message: str):
        body = json.dumps({"error": message}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json_response(self, data: dict, status: int = 200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _raw_response(self, data: bytes, content_type: str):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

    global _watch_dir_ref

    if args.file:
        watcher.set_file(args.file)
        print(f"[relay] Watching file: {args.file}")
    if args.watch_dir:
        _watch_dir_ref = args.watch_dir
        print(f"[relay] Watching directory: {args.watch_dir}")
    if not args.file and not args.watch_dir:
        print("[relay] No file or directory specified. Waiting for sessions...")

    poll_thread = Thread(target=poll_loop, args=(args.watch_dir,), daemon=True)
    poll_thread.start()

    server = HTTPServer(("0.0.0.0", args.port), RelayHandler)
    print(f"[relay] SSE server on http://0.0.0.0:{args.port}")
    print("[relay] Endpoints: /api/stream (SSE), /api/events (JSON), /api/status, /health")
    print(f"[relay] Transcript upload: POST /api/transcript  |  GET /api/transcripts")
    print(f"[relay] Transcript store: {TRANSCRIPT_DIR}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[relay] Shutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
