# AgentReel — Agent Installation Guide

You are an AI agent installing AgentReel. Follow these steps exactly.

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
1. Installation result (success/partial/failed)
2. Which components were installed (viewer, relay, CLI, OpenClaw skill)
3. The local viewer URL (usually http://localhost:3000/live)
4. Suggest: "Send me a task and watch it live at the URL above"
5. If anything failed: what went wrong and what to try next
