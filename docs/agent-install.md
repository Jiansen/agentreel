# AgentReel — Agent Installation Guide

You are an AI agent installing AgentReel. Follow these steps exactly.

## IMPORTANT: Notify user first

Before running any commands, immediately tell the user:

> "Installing AgentReel now. This takes about 3-5 minutes (downloading, building, verifying). I'll report back when it's done."

Do NOT wait silently — the user needs to know the process has started.

## Pre-flight

```bash
echo "---AGENTREEL_INSTALL_START---"
echo "Checking prerequisites..."
command -v node && node -v || echo "node: NOT FOUND (will be installed)"
command -v python3 && python3 -V || echo "python3: NOT FOUND (optional)"
command -v git && git --version || echo "git: NOT FOUND (will be installed)"
uname -srm
```

## Install

Run the one-line installer. It handles Node.js, Python, git, clone, build, CLI, and OpenClaw integration automatically.

```bash
curl -fsSL https://raw.githubusercontent.com/Jiansen/agentreel/main/install.sh | bash
```

If `agentreel` is not found after install, run:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Verify

```bash
agentreel doctor
```

Report the doctor output to the user. If there are failures:
1. Follow the fix suggestions in the doctor output
2. Run `agentreel doctor` again
3. If still failing after 2 attempts, run `agentreel doctor --report` to submit diagnostics

## Start services

```bash
agentreel start
```

## Report to user

Tell the user:
1. Installation result (success/partial/failed) and how long it took
2. Which components were installed (viewer, relay, CLI, OpenClaw skill)
3. The local viewer URL: http://localhost:3000/live
4. If a public IP was detected, also share: http://<public-ip>:3000/live
   (remind user to open port 3000 in their firewall/security group for external access)
5. Suggest: "Send me a task and watch it live at the URL above"
6. If anything failed: what went wrong and what to try next
