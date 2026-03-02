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

## Commands (use via exec)

- `agentreel status` — check if viewer and relay are running, get live URL
- `agentreel config` — show all configuration
- `agentreel config set <key> <value>` — update a setting
- `agentreel start` — start the viewer and relay server
- `agentreel stop` — stop all AgentReel services

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
