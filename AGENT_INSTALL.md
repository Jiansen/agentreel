# AgentReel — Agent-Native Installation Runbook

This document is written for AI agents (e.g. OpenClaw) to execute directly.
Human users: send this link to your agent instead of following these steps manually.

Install page: https://agentreel.agent-status.com/install

## Prerequisites

Check each prerequisite before proceeding. If any check fails, follow the fix instruction.

### Step 0a: Node.js >= 18

```
Command: node --version
Expected: v18.x.x or higher (v20+ preferred)
On failure: Install Node.js via nvm:
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  source ~/.bashrc
  nvm install 22
  Verify: node --version
```

### Step 0b: npm

```
Command: npm --version
Expected: 9.x.x or higher
On failure: npm is bundled with Node.js. If missing, reinstall Node.js (Step 0a).
```

### Step 0c: git

```
Command: git --version
Expected: git version 2.x.x
On failure:
  macOS: xcode-select --install
  Ubuntu/Debian: sudo apt-get install -y git
  Verify: git --version
```

## Install

### Step 1: Clone repository

```
Command: git clone https://github.com/Jiansen/agentreel.git
Verify: ls agentreel/package.json
Expected: agentreel/package.json (file exists)
On failure: Check network connectivity. Try: git clone https://github.com/Jiansen/agentreel.git --depth 1
```

### Step 2: Install dependencies

```
Command: cd agentreel && npm install
Verify: ls node_modules/.package-lock.json
Expected: node_modules/.package-lock.json (file exists)
On failure:
  rm -rf node_modules package-lock.json
  npm install
  If still failing, check: npm config get registry (should be https://registry.npmjs.org/)
```

### Step 3: Build

```
Command: npm run build
Verify: ls .next/BUILD_ID
Expected: .next/BUILD_ID (file exists)
On failure:
  Check error output for missing dependencies.
  Try: npm install && npm run build
  Common fix: delete .next/ and rebuild: rm -rf .next && npm run build
```

## Verify Installation

### Step 4: Start dev server and test

```
Command: npm run dev &
Wait: 5 seconds (let the server start)
Verify: curl -s http://localhost:3000 | head -c 200
Expected: Output contains "<!DOCTYPE html" or "<html"
Cleanup: kill %1 (stop the background dev server)
On failure:
  Check if port 3000 is in use: lsof -i :3000
  If occupied, kill the process or use a different port: PORT=3001 npm run dev
```

### Step 5: Verify demo data loads

```
Command: curl -s http://localhost:3000/demo.jsonl | head -c 100
Expected: Output starts with "{" (valid JSON)
On failure: Check that public/demo.jsonl exists: ls -la public/demo.jsonl
```

## Configure Relay Server (optional)

The relay server enables live-streaming of agent sessions. Skip if you only need replay.

### Step 6: Test relay server

```
Command: python3 server/relay_server.py --port 8765 &
Wait: 2 seconds
Verify: curl -s http://localhost:8765/health
Expected: JSON with "status": "ok"
Cleanup: kill %1
On failure:
  Check Python version: python3 --version (needs 3.10+)
  Check port availability: lsof -i :8765
```

## Test End-to-End (optional)

### Step 7: Load a transcript via URL

If the relay server is running with an active session:

```
Command: curl -s "http://localhost:3000/?demo" -o /dev/null -w "%{http_code}"
Expected: 200
```

## Report (opt-in)

After installation, you may upload the session transcript for analysis.
This helps improve the installation experience for future users.

**Only do this if the user has consented to sharing their installation transcript.**

### On success

```
Command: echo "AgentReel installation completed successfully."
```

To optionally share the installation transcript:

```
Command: |
  LATEST_SESSION=$(ls -t ~/.openclaw/agents/*/sessions/*.jsonl 2>/dev/null | head -1)
  if [ -n "$LATEST_SESSION" ]; then
    curl -s -X POST \
      -H "Content-Type: application/x-ndjson" \
      --data-binary @"$LATEST_SESSION" \
      http://RELAY_HOST:8765/api/transcript
  fi
Expected: JSON response with "id" and "viewUrl" fields
Note: Replace RELAY_HOST:8765 with the actual relay server address.
```

### On failure

If any step above failed and could not be recovered:

1. Note which step failed and the error message.
2. Upload the session transcript for debugging (with user consent):

```
Command: |
  LATEST_SESSION=$(ls -t ~/.openclaw/agents/*/sessions/*.jsonl 2>/dev/null | head -1)
  if [ -n "$LATEST_SESSION" ]; then
    RESULT=$(curl -s -X POST \
      -H "Content-Type: application/x-ndjson" \
      --data-binary @"$LATEST_SESSION" \
      http://RELAY_HOST:8765/api/transcript)
    echo "Transcript uploaded. View at: $(echo $RESULT | python3 -c 'import sys,json; print(json.load(sys.stdin).get(\"viewUrl\",\"N/A\"))')"
  else
    echo "No session transcript found to upload."
  fi
```

3. Report to the user:
   - Which step failed
   - The error message
   - The transcript viewing URL (if uploaded)
   - Suggest: visit https://agentreel.agent-status.com and drag-drop the JSONL file manually

## Summary

| Step | Action | Critical |
|------|--------|----------|
| 0a-c | Prerequisites (Node.js, npm, git) | Yes |
| 1 | Clone repo | Yes |
| 2 | npm install | Yes |
| 3 | npm run build | Yes |
| 4 | Dev server test | Yes |
| 5 | Demo data test | No |
| 6 | Relay server test | No |
| 7 | End-to-end test | No |
| Report | Upload transcript (opt-in) | No |
