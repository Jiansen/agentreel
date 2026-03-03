---
name: agentreel
description: Monitor, replay, and share AI agent sessions with AgentReel
metadata: { "openclaw": { "requires": { "bins": ["agentreel"] }, "homepage": "https://github.com/Jiansen/agentreel", "emoji": "🎬" } }
---

AgentReel is installed on this machine. It records your sessions and makes them
viewable as live streams or replays.

## Key Information

- **Project**: https://github.com/Jiansen/agentreel
- **Online viewer**: https://agentreel.agent-status.com
- **Live demo**: https://agentreel.agent-status.com/live
- **Local viewer**: Run `agentreel status` to get the local URL (usually http://localhost:3000)

When a user asks "where can I watch the livestream" or "AgentReel 直播在哪看",
answer with the links above. Run `agentreel status` first to confirm the local
viewer is running, then share both the local URL and the online viewer URL.

## Pending Install Result

At the START of every new conversation, check if there is a pending install
result that was not yet reported to the user:

```bash
cat ~/.agentreel/.install-result 2>/dev/null
```

If the file exists and contains `result=SUCCESS` or `result=FAILED`, report the
result to the user and then delete it:

```bash
rm ~/.agentreel/.install-result
```

This handles the case where a previous installation completed but the report
could not be sent (e.g. due to API rate limiting).

## Commands (use via exec)

- `agentreel start` — start the viewer and relay server
- `agentreel stop` — stop all AgentReel services
- `agentreel status` — check if viewer and relay are running, get live URL
- `agentreel doctor` — full health check (viewer, relay, sessions, ports, OpenClaw)
- `agentreel doctor --report` — run health check and submit results to GitHub Issues
- `agentreel config` — show all configuration
- `agentreel config set <key> <value>` — update a setting
- `agentreel update` — pull latest code and rebuild

## Troubleshooting

When something isn't working, follow this sequence:

1. Run `agentreel doctor` — it checks 8 areas and gives specific fix suggestions
2. Follow the suggestions in the doctor output to fix issues
3. If fixes don't work, run `agentreel doctor --report` to submit a diagnostic report
4. Common issues:
   - **Viewer not running**: `agentreel start`
   - **Port conflict**: `agentreel config set port 3001` then `agentreel start`
   - **No sessions visible**: check the watch directory exists: `ls ~/.openclaw/agents/main/sessions/`
   - **Relay not starting**: ensure Python 3.10+ is installed: `python3 --version`

## Format Tags

Your output is displayed in the AgentReel live viewer. Use these tags to make
your work more visible and structured for viewers:

- `[PLAN] 1. First  2. Second  3. Third` — rendered as an interactive todo list
- `[STEP 1/3 BEGIN] Description` — starts a step timer
- `[STEP 1/3 COMPLETE]` — completes the step
- `[THINKING] analysis text` — shown as a thinking card
- `[DISCOVERY] finding` — highlighted as a discovery
- `[CHALLENGE] problem` — shown as a challenge indicator
- `[OUTPUT] result` — displays task output
- `[SUMMARY] summary text` — completion summary card

### Example

```
[PLAN] 1. Search trending repos  2. Analyze top 5  3. Write report

[STEP 1/3 BEGIN] Searching GitHub Trending
[DISCOVERY] New AI framework: 5000 stars in 3 days
[STEP 1/3 COMPLETE]

[STEP 2/3 BEGIN] Analyzing top repos
[THINKING] This framework uses a novel agent memory approach
[CHALLENGE] GitHub API rate limited, using cached data
[STEP 2/3 COMPLETE]

[STEP 3/3 BEGIN] Writing report
[OUTPUT] Top 5 trending repos: ...
[STEP 3/3 COMPLETE]

[SUMMARY] Analyzed GitHub trending: 5 notable repos, 2 AI-related
```

Always use format tags when working on tasks — they are the primary way viewers
understand what you are doing.
