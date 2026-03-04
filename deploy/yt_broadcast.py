#!/usr/bin/env python3
"""YouTube Live Broadcast Manager — AgentReel

Manages YouTube broadcasts via the Data API v3 for 24/7 streaming:
  create   – new broadcast with auto-start (binds to persistent stream)
  complete – end current broadcast (triggers VOD archive)
  rotate   – complete current + create new (VOD cycling)
  list     – show active/upcoming broadcasts
  title    – update broadcast title
  status   – quick health check

Requires OAuth2 credentials (client_id, client_secret, refresh_token).
Set them via environment variables or ~/.agentreel/stream.env:
  YOUTUBE_AGENTREEL_CLIENT_ID
  YOUTUBE_AGENTREEL_CLIENT_SECRET
  YOUTUBE_AGENTREEL_REFRESH_TOKEN

Zero external dependencies — uses only Python stdlib.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

API_BASE = "https://www.googleapis.com/youtube/v3"
TOKEN_URL = "https://oauth2.googleapis.com/token"

# VOD rotation: restart every 11h to stay under YouTube's 12h archive limit
DEFAULT_ROTATE_HOURS = 11


def ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(msg: str) -> None:
    print(f"[yt-broadcast] {ts()} {msg}", file=sys.stderr)


def env_required(key: str) -> str:
    val = os.environ.get(key, "").strip()
    if not val:
        log(f"ERROR: {key} not set. Check stream.env or env vars.")
        sys.exit(1)
    return val


class YouTubeAPI:
    def __init__(self) -> None:
        self.client_id = env_required("YOUTUBE_AGENTREEL_CLIENT_ID")
        self.client_secret = env_required("YOUTUBE_AGENTREEL_CLIENT_SECRET")
        self.refresh_token = env_required("YOUTUBE_AGENTREEL_REFRESH_TOKEN")
        self._access_token: str | None = None

    @property
    def access_token(self) -> str:
        if self._access_token:
            return self._access_token
        self._access_token = self._refresh_access_token()
        return self._access_token

    def _refresh_access_token(self) -> str:
        log("Refreshing OAuth2 access token...")
        data = urllib.parse.urlencode({
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "refresh_token": self.refresh_token,
            "grant_type": "refresh_token",
        }).encode()
        req = urllib.request.Request(TOKEN_URL, data=data, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read())
            token = body.get("access_token")
            if not token:
                log(f"ERROR: No access_token in response: {body}")
                sys.exit(1)
            log("Access token refreshed OK")
            return token
        except urllib.error.HTTPError as e:
            log(f"ERROR: Token refresh failed: {e.code} {e.read().decode()}")
            sys.exit(1)

    def _api(self, method: str, endpoint: str, params: dict | None = None,
             body: dict | None = None) -> dict:
        url = f"{API_BASE}/{endpoint}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {self.access_token}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            log(f"API error: {method} {endpoint} → {e.code}: {err_body}")
            raise

    def list_broadcasts(self, status: str = "active,upcoming") -> list[dict]:
        items: list[dict] = []
        for s in status.split(","):
            resp = self._api("GET", "liveBroadcasts", {
                "part": "id,snippet,status,contentDetails",
                "broadcastStatus": s.strip(),
                "maxResults": "10",
            })
            items.extend(resp.get("items", []))
        return items

    def list_streams(self) -> list[dict]:
        try:
            resp = self._api("GET", "liveStreams", {
                "part": "id,snippet,cdn,status",
                "mine": "true",
                "maxResults": "10",
            })
            return resp.get("items", [])
        except urllib.error.HTTPError:
            return []

    def create_broadcast(self, title: str, description: str = "",
                         auto_start: bool = True) -> dict:
        scheduled = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        body = {
            "snippet": {
                "title": title,
                "description": description,
                "scheduledStartTime": scheduled,
            },
            "status": {
                "privacyStatus": "public",
                "selfDeclaredMadeForKids": False,
            },
            "contentDetails": {
                "enableAutoStart": auto_start,
                "enableAutoStop": False,
                "enableDvr": True,
                "latencyPreference": "ultraLow",
                "enableLowLatency": True,
            },
        }
        return self._api("POST", "liveBroadcasts", {
            "part": "snippet,status,contentDetails",
        }, body)

    def bind_stream(self, broadcast_id: str, stream_id: str) -> dict:
        return self._api("POST", "liveBroadcasts/bind", {
            "id": broadcast_id,
            "part": "id,contentDetails",
            "streamId": stream_id,
        })

    def transition(self, broadcast_id: str, status: str) -> dict:
        """Transition: testing → live → complete"""
        return self._api("POST", "liveBroadcasts/transition", {
            "id": broadcast_id,
            "broadcastStatus": status,
            "part": "id,status",
        })

    def update_title(self, broadcast_id: str, title: str,
                     description: str | None = None) -> dict:
        broadcasts = self._api("GET", "liveBroadcasts", {
            "part": "snippet",
            "id": broadcast_id,
        })
        items = broadcasts.get("items", [])
        if not items:
            log(f"ERROR: Broadcast {broadcast_id} not found")
            sys.exit(1)
        snippet = items[0]["snippet"]
        snippet["title"] = title
        if description is not None:
            snippet["description"] = description
        return self._api("PUT", "liveBroadcasts", {
            "part": "snippet",
        }, {"id": broadcast_id, "snippet": snippet})

    def get_default_stream_id(self) -> str:
        streams = self.list_streams()
        if not streams:
            log("ERROR: No liveStreams found. Create one in YouTube Studio first.")
            sys.exit(1)
        stream = streams[0]
        log(f"Using stream: {stream['snippet']['title']} (id={stream['id']})")
        return stream["id"]


def fmt_broadcast(b: dict) -> str:
    s = b.get("snippet", {})
    st = b.get("status", {})
    vid = b.get("id", "?")
    title = s.get("title", "(no title)")
    status = st.get("lifeCycleStatus", "?")
    scheduled = s.get("scheduledStartTime", "")
    return f"  {vid}  [{status}]  {title}  (scheduled: {scheduled})"


def cmd_list(api: YouTubeAPI, args: argparse.Namespace) -> None:
    broadcasts = api.list_broadcasts(args.status)
    if not broadcasts:
        log("No broadcasts found")
        return
    log(f"Found {len(broadcasts)} broadcast(s):")
    for b in broadcasts:
        print(fmt_broadcast(b))


def cmd_create(api: YouTubeAPI, args: argparse.Namespace) -> None:
    title = args.title or f"AgentReel Live — {ts()}"
    log(f"Creating broadcast: {title}")
    broadcast = api.create_broadcast(title, args.description or "")
    bid = broadcast["id"]
    log(f"Broadcast created: {bid}")

    stream_id = args.stream_id or api.get_default_stream_id()
    log(f"Binding to stream {stream_id}...")
    api.bind_stream(bid, stream_id)
    log(f"Bound. Broadcast {bid} ready (auto-start={not args.no_auto_start})")
    print(json.dumps({"broadcast_id": bid, "stream_id": stream_id}, indent=2))


def cmd_complete(api: YouTubeAPI, args: argparse.Namespace) -> None:
    bid = args.broadcast_id
    if not bid:
        broadcasts = api.list_broadcasts("active")
        if not broadcasts:
            log("No active broadcast to complete")
            return
        bid = broadcasts[0]["id"]
        log(f"Auto-selected active broadcast: {bid}")

    log(f"Transitioning {bid} → complete")
    result = api.transition(bid, "complete")
    status = result.get("status", {}).get("lifeCycleStatus", "?")
    log(f"Broadcast {bid} → {status}")


def cmd_rotate(api: YouTubeAPI, args: argparse.Namespace) -> None:
    """Complete current + create new — for 24/7 VOD cycling.
    Briefly restarts ffmpeg (via systemd) so YouTube detects a fresh push
    and triggers auto-start on the new broadcast.
    """
    broadcasts = api.list_broadcasts("active")
    if broadcasts:
        old_id = broadcasts[0]["id"]
        old_title = broadcasts[0].get("snippet", {}).get("title", "")
        log(f"Completing current: {old_id} ({old_title})")
        try:
            api.transition(old_id, "complete")
            log(f"Completed {old_id}")
        except urllib.error.HTTPError:
            log(f"Warning: Could not complete {old_id}, creating new anyway")
    else:
        log("No active broadcast to complete")

    title = args.title or f"AgentReel Live — {ts()}"
    log(f"Creating new broadcast: {title}")
    broadcast = api.create_broadcast(title)
    bid = broadcast["id"]
    stream_id = args.stream_id or api.get_default_stream_id()
    api.bind_stream(bid, stream_id)
    log(f"New broadcast {bid} bound to stream {stream_id}, auto-start enabled")

    restart_delay = int(os.environ.get("ROTATE_RESTART_DELAY", "5"))
    log(f"Restarting stream service ({restart_delay}s pause for YouTube auto-start detection)...")
    import subprocess
    try:
        subprocess.run(["sudo", "systemctl", "restart", "agentreel-stream"],
                       timeout=30, check=False)
        log("Stream service restarted — YouTube should auto-start the new broadcast")
    except Exception as e:
        log(f"Warning: Could not restart stream service: {e}")
        log("Manually restart: sudo systemctl restart agentreel-stream")

    print(json.dumps({"broadcast_id": bid, "stream_id": stream_id}, indent=2))


def cmd_title(api: YouTubeAPI, args: argparse.Namespace) -> None:
    bid = args.broadcast_id
    if not bid:
        broadcasts = api.list_broadcasts("active")
        if not broadcasts:
            log("No active broadcast to update")
            return
        bid = broadcasts[0]["id"]

    log(f"Updating title of {bid} → {args.title}")
    api.update_title(bid, args.title, args.description)
    log("Title updated")


def cmd_status(api: YouTubeAPI, _args: argparse.Namespace) -> None:
    log("=== Streams ===")
    for s in api.list_streams():
        sid = s["id"]
        name = s["snippet"]["title"]
        health = s.get("status", {}).get("streamStatus", "?")
        print(f"  {sid}  [{health}]  {name}")

    log("=== Active Broadcasts ===")
    for b in api.list_broadcasts("active"):
        print(fmt_broadcast(b))

    log("=== Upcoming Broadcasts ===")
    for b in api.list_broadcasts("upcoming"):
        print(fmt_broadcast(b))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="YouTube Live Broadcast Manager for AgentReel 24/7 streaming",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_list = sub.add_parser("list", help="List broadcasts")
    p_list.add_argument("--status", default="active,upcoming",
                        help="Comma-separated: active, all, completed, upcoming")

    p_create = sub.add_parser("create", help="Create broadcast with auto-start")
    p_create.add_argument("--title", help="Broadcast title")
    p_create.add_argument("--description", help="Broadcast description", default="")
    p_create.add_argument("--stream-id", help="Bind to specific stream ID")
    p_create.add_argument("--no-auto-start", action="store_true")

    p_complete = sub.add_parser("complete", help="Complete (end) a broadcast → VOD")
    p_complete.add_argument("--broadcast-id", help="Specific broadcast ID (default: active)")

    p_rotate = sub.add_parser("rotate", help="Complete current + create new (VOD cycling)")
    p_rotate.add_argument("--title", help="New broadcast title")
    p_rotate.add_argument("--stream-id", help="Bind to specific stream ID")

    p_title = sub.add_parser("title", help="Update broadcast title")
    p_title.add_argument("title", help="New title")
    p_title.add_argument("--broadcast-id", help="Specific broadcast ID (default: active)")
    p_title.add_argument("--description", help="New description")

    sub.add_parser("status", help="Quick health check")

    args = parser.parse_args()
    api = YouTubeAPI()

    commands = {
        "list": cmd_list,
        "create": cmd_create,
        "complete": cmd_complete,
        "rotate": cmd_rotate,
        "title": cmd_title,
        "status": cmd_status,
    }
    commands[args.command](api, args)


if __name__ == "__main__":
    main()
