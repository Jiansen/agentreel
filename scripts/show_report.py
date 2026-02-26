#!/usr/bin/env python3
"""
show_report.py — Display the agent's final report in Chromium so ffmpeg captures it.

Reads a JSONL transcript, extracts the last substantial assistant message,
generates a styled HTML page, and opens it in the running Chromium instance
via Chrome DevTools Protocol (CDP).

Usage:
    python3 show_report.py --jsonl /path/to/session.jsonl [--port 18801] [--hold 10]

Requirements:
    - Chromium running with --remote-debugging-port (default 18801)
    - Python 3.8+ (stdlib only)
"""

import argparse
import json
import html
import http.client
import sys
import time
from pathlib import Path


def extract_report(jsonl_path: str) -> str | None:
    """Find the last assistant message with > 200 chars of text content."""
    best = None
    with open(jsonl_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                evt = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg = evt.get("message", {})
            if not isinstance(msg, dict):
                continue

            if msg.get("role") != "assistant":
                continue

            content = msg.get("content", [])
            if isinstance(content, str):
                text = content
            elif isinstance(content, list):
                parts = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        parts.append(block.get("text", ""))
                text = "\n\n".join(parts)
            else:
                continue

            if len(text) > 200:
                best = text

    return best


def build_html(report_text: str) -> str:
    """Build a dark-themed HTML page displaying the report."""
    escaped = html.escape(report_text)
    lines = escaped.split("\n")
    html_body = []
    for line in lines:
        if line.startswith("## "):
            html_body.append(f'<h2 style="color:#60a5fa;margin:18px 0 8px 0;font-size:18px">{line[3:]}</h2>')
        elif line.startswith("### "):
            html_body.append(f'<h3 style="color:#818cf8;margin:14px 0 6px 0;font-size:15px">{line[4:]}</h3>')
        elif line.startswith("# "):
            html_body.append(f'<h1 style="color:#f0f0f0;margin:20px 0 10px 0;font-size:22px">{line[2:]}</h1>')
        elif line.startswith("- **"):
            html_body.append(f'<div style="margin:4px 0 4px 16px;color:#d1d5db">{line}</div>')
        elif line.startswith("---"):
            html_body.append('<hr style="border-color:#374151;margin:12px 0">')
        elif line.strip() == "":
            html_body.append('<div style="height:8px"></div>')
        else:
            html_body.append(f'<div style="color:#d1d5db;margin:2px 0">{line}</div>')

    body_html = "\n".join(html_body)

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Agent Report</title></head>
<body style="margin:0;padding:32px 48px;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;color:#e2e8f0;line-height:1.6;overflow-y:auto">
<div style="max-width:900px;margin:0 auto">
<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #1e293b">
  <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px">▶</div>
  <span style="font-size:15px;font-weight:600">Agent<span style="color:#3b82f6">Reel</span></span>
  <span style="color:#64748b;font-size:13px">· Task Report</span>
  <span style="margin-left:auto;font-size:11px;padding:3px 10px;border-radius:6px;background:rgba(34,197,94,0.15);color:#22c55e">Task Complete</span>
</div>
{body_html}
</div>
</body>
</html>"""


def open_in_chromium(html_content: str, cdp_port: int = 18801) -> bool:
    """Navigate the first Chromium tab to a data URL with the report."""
    try:
        conn = http.client.HTTPConnection("127.0.0.1", cdp_port, timeout=5)
        conn.request("GET", "/json")
        resp = conn.getresponse()
        tabs = json.loads(resp.read())
        conn.close()

        page_tabs = [t for t in tabs if t.get("type") == "page"]
        if not page_tabs:
            print("No browser tabs found", file=sys.stderr)
            return False

        ws_url = page_tabs[0].get("webSocketDebuggerUrl")
        if not ws_url:
            print("No WebSocket URL found", file=sys.stderr)
            return False

        import base64
        data_url = "data:text/html;base64," + base64.b64encode(html_content.encode()).decode()

        conn2 = http.client.HTTPConnection("127.0.0.1", cdp_port, timeout=5)
        target_id = page_tabs[0]["id"]
        nav_cmd = json.dumps({
            "id": 1,
            "method": "Page.navigate",
            "params": {"url": data_url}
        })
        conn2.request("PUT", f"/json/navigate/{target_id}?url=" + data_url[:100])
        conn2.close()

        conn3 = http.client.HTTPConnection("127.0.0.1", cdp_port, timeout=5)
        activate_url = f"/json/activate/{target_id}"
        conn3.request("GET", activate_url)
        conn3.close()

        print(f"Report displayed in Chromium tab {target_id}")
        return True

    except Exception as e:
        print(f"CDP connection failed: {e}", file=sys.stderr)
        return False


def fallback_file(html_content: str) -> str:
    """Write report to a temp file and return the path."""
    path = Path("/tmp/agentreel-report.html")
    path.write_text(html_content, encoding="utf-8")
    return str(path)


def main():
    parser = argparse.ArgumentParser(description="Display agent report in Chromium for video capture")
    parser.add_argument("--jsonl", required=True, help="Path to session JSONL file")
    parser.add_argument("--port", type=int, default=18801, help="Chromium CDP port (default 18801)")
    parser.add_argument("--hold", type=int, default=10, help="Seconds to hold the report on screen (default 10)")
    args = parser.parse_args()

    report = extract_report(args.jsonl)
    if not report:
        print("No report found in JSONL (no assistant message > 200 chars)")
        sys.exit(1)

    print(f"Report extracted: {len(report)} chars")
    page_html = build_html(report)

    if not open_in_chromium(page_html, args.port):
        html_path = fallback_file(page_html)
        print(f"Fallback: report written to {html_path}")
        print(f"Open manually: chromium {html_path}")

    print(f"Holding for {args.hold}s (ffmpeg captures report screen)...")
    time.sleep(args.hold)
    print("Done.")


if __name__ == "__main__":
    main()
