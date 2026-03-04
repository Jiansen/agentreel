# AgentReel QA Checklist — For AI Agents

> This document is designed for AI agents (e.g. OpenClaw) to perform structured quality assurance on an AgentReel deployment. Follow each section in order. Report results using the structured format at the bottom.

## Prerequisites

Before starting QA, verify you have the required tools:

```bash
# Infrastructure checks
agentreel doctor --agent

# Visual checks require:
# 1. browser tool (OpenClaw built-in) — for screenshots
# 2. image tool (OpenClaw built-in) — for visual analysis
# If you don't have a vision model, skip Section 2 and note it in your report.
```

---

## Section 1: Infrastructure (automated)

Run `agentreel doctor --agent` and parse the JSON output. This covers:

| Check ID | Component | What it verifies |
|----------|-----------|-----------------|
| `build` | Next.js build | `.next/BUILD_ID` exists |
| `viewer` | Viewer process | PID alive + HTTP 200 on configured port |
| `relay` | Relay server | PID alive + `/health` responds |
| `sessions` | Session files | Watch directory has `.jsonl` files |
| `openclaw` | OpenClaw | Installed + gateway running |
| `ports` | Network | Viewer and relay ports accessible |
| `skill` | Agent skill | `SKILL.md` deployed to OpenClaw |
| `config` | Config file | `.agentreel-config.json` present |
| `xvfb_agent` | Xvfb (agent) | Virtual display running |
| `xvfb_broadcast` | Xvfb (broadcast) | Broadcast display running |
| `agent_chrome` | Agent Chrome | CDP responds + tab count |
| `browser_profile` | Browser profile | OpenClaw default = "visible" |
| `x11vnc` | VNC server | Capturing agent display |
| `websockify` | WebSocket bridge | VNC-to-WebSocket proxy running |
| `ffmpeg` | Stream encoder | Correct instance count + display + bitrate |
| `kiosk` | Kiosk Chrome | Running on broadcast display |

If any check returns `FAIL`, fix it before proceeding to visual checks.

---

## Section 2: Visual QA (requires vision model)

### How to perform visual checks

1. **Take a screenshot** of the target page using the `browser` tool:
   ```
   browser action=open url="http://localhost:3000/live"
   browser action=screenshot fullPage=true
   ```

2. **Analyze the screenshot** using the `image` tool:
   ```
   image prompt="<check-specific prompt>" image="<screenshot_path>"
   ```

3. **Record findings** in the structured format (Section 4).

### Check 2.1: Live Page — Overall Layout

**URL**: `http://localhost:{AGENTREEL_PORT}/live`

**Screenshot prompt for image tool**:
> Analyze this screenshot of a livestream broadcast page. Check the following and report each as PASS/WARN/FAIL:
> 1. Is there a clear left/right split layout? (left ~70%, right ~30%)
> 2. Is there a VNC/browser view area in the upper-left showing a real browser window (not blank, not "about:blank", not an error)?
> 3. Is there a terminal/log area in the lower-left with text content?
> 4. Is there a sidebar on the right with task information?
> 5. Is there a watermark overlay visible (semi-transparent text)?
> 6. Are all text elements readable (not clipped, not overlapping)?

**Expected**: ClassicSplit layout with all 4 zones populated.

### Check 2.2: VNC Area

**What to verify**:
- Shows actual browser content (a real webpage, not `about:blank`)
- No "Restore pages?" dialog
- No connection error messages
- Fills the designated area without black bars

**Prompt for image tool**:
> Look at the upper-left area of this broadcast page. Is it showing a real web browser with actual webpage content? Report FAIL if it shows: a blank page, "about:blank", a "Restore pages" dialog, a connection error, or is completely empty/black.

### Check 2.3: Terminal Area

**What to verify**:
- Shows colored terminal output with agent activity
- Text is readable (not too small, not truncated)
- Recent activity visible (not stale/empty)

**Prompt for image tool**:
> Look at the lower-left terminal area. Does it contain readable text that looks like agent activity logs? Check: (1) text is present, (2) text appears to be recent activity, (3) text is readable size. Report FAIL if empty or shows an error.

### Check 2.4: Sidebar — Mission Bar

**What to verify**:
- Shows a task/mission name
- Shows elapsed time or status indicator
- "Live" indicator if actively streaming

**Prompt for image tool**:
> Look at the top of the right sidebar. Is there a mission/task bar showing: a task name, elapsed time, and a live status indicator?

### Check 2.5: Sidebar — Todo/Plan List

**What to verify**:
- Shows numbered steps with completion status
- Progress bar or step indicators
- At least some steps showing complete or in-progress

### Check 2.6: Sidebar — Tab Content (Stream/History/Messages)

**What to verify**:
- Tab labels visible and one is active
- Active tab has content (not empty)
- If Messages tab: shows user/agent conversation pairs
- If Stream tab: shows event cards with timestamps
- If History tab: shows past sessions with status

### Check 2.7: QR Code Footer

**What to verify**:
- QR code visible in lower-right corner
- URL text readable next to the QR code

### Check 2.8: Watermark

**What to verify**:
- Semi-transparent watermark text visible
- Text readable but not obstructing main content
- Positioned correctly (not clipped at edges)

---

## Section 3: Functional QA

These checks verify behavior, not just appearance.

### Check 3.1: SSE Data Flow

```bash
# Verify relay is streaming events
curl -N -s "http://localhost:{RELAY_PORT}/api/stream" --max-time 5
```

**Expected**: Receives at least one SSE `data:` line within 5 seconds if a task is active.

### Check 3.2: Relay Health

```bash
curl -s "http://localhost:{RELAY_PORT}/health"
```

**Expected**: `{"status": "ok", "events": N, "active": true/false, ...}`

### Check 3.3: Relay History

```bash
curl -s "http://localhost:{RELAY_PORT}/api/history"
```

**Expected**: JSON array of past sessions with `name`, `status`, `events`, `timestamp`.

### Check 3.4: VNC Availability (self-hosted only)

```bash
curl -s "http://localhost:{VIEWER_PORT}/api/vnc-status"
```

**Expected**: `{"available": true, "port": 6080, "proxyPath": "/vnc-ws"}` if VNC is configured.

### Check 3.5: Task Daemon Status

```bash
# Check if daemon is running
pgrep -f "task_daemon.sh.*daemon" && echo "RUNNING" || echo "STOPPED"

# Check last task log
tail -20 ~/task_queue/daemon.log 2>/dev/null
```

**Expected**: Daemon running; log shows recent task completions without errors.

### Check 3.6: Stream Encoding

```bash
# Check ffmpeg process
ps aux | grep "[f]fmpeg" | head -3
```

**Expected**: Exactly 1 ffmpeg process, capturing the broadcast display, with `maxrate` matching configured bitrate.

---

## Section 4: Report Format

Use this exact format so reports are machine-parseable and comparable:

```
[QA REPORT]
timestamp: YYYY-MM-DDTHH:MM:SSZ
agent: <your agent name/model>
server: <hostname or IP>
vision_model: <model name or "none">

## Infrastructure (from agentreel doctor --agent)
<paste JSON output>

## Visual Checks
| Check | Status | Detail |
|-------|--------|--------|
| 2.1 Overall Layout | PASS/WARN/FAIL | <one-line description> |
| 2.2 VNC Area | PASS/WARN/FAIL | <one-line description> |
| 2.3 Terminal | PASS/WARN/FAIL | <one-line description> |
| 2.4 Mission Bar | PASS/WARN/FAIL | <one-line description> |
| 2.5 Todo List | PASS/WARN/FAIL | <one-line description> |
| 2.6 Tab Content | PASS/WARN/FAIL | <one-line description> |
| 2.7 QR Footer | PASS/WARN/FAIL | <one-line description> |
| 2.8 Watermark | PASS/WARN/FAIL | <one-line description> |

## Functional Checks
| Check | Status | Detail |
|-------|--------|--------|
| 3.1 SSE Data Flow | PASS/WARN/FAIL | <one-line description> |
| 3.2 Relay Health | PASS/WARN/FAIL | <one-line description> |
| 3.3 Relay History | PASS/WARN/FAIL | <one-line description> |
| 3.4 VNC Availability | PASS/WARN/FAIL | <one-line description> |
| 3.5 Task Daemon | PASS/WARN/FAIL | <one-line description> |
| 3.6 Stream Encoding | PASS/WARN/FAIL | <one-line description> |

## Summary
total: <N>, pass: <N>, warn: <N>, fail: <N>
blocking_issues: <list of FAIL items that prevent normal operation>
recommendations: <list of suggested fixes>
[/QA REPORT]
```

---

## Section 5: Common Issues and Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| VNC shows `about:blank` | Task just completed, tabs cleaned | Normal between tasks; check back during next task |
| VNC shows "Restore pages?" | Chrome crash recovery dialog | Restart: `pkill -f "chromium.*18802"` (daemon auto-restarts) |
| Terminal area empty | Relay not connected to session dir | Check relay `--watch-dir` matches `AGENTREEL_WATCH_DIR` |
| Right sidebar empty | No active SSE events | Verify relay health; check if any task is running |
| ffmpeg not running | Stream not started | Run `agentreel install stream` then configure stream keys |
| Multiple ffmpeg instances | Watchdog restart bug | `killall -9 ffmpeg` then restart via `stream_dual.sh` |
| Relay /health fails | Relay process died | Check `~/agentreel/logs/relay.log`; restart via `agentreel start` |
| CDP port not responding | Chrome crashed between tasks | `ensure_agent_chrome` in task_daemon handles this automatically |

---

## Automation Notes

- **Periodic QA**: Run Section 1 + Section 3 every hour via cron or agent schedule
- **Visual QA**: Run Section 2 after deployments or when issues are reported
- **Full QA**: Run all sections before going live or after major changes
- **Comparison**: Save reports as `qa-report-YYYY-MM-DD-HHMMSS.md` to track trends
