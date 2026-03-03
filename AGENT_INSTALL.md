# AgentReel — Agent Installation Guide

You are an AI agent installing AgentReel.
IMPORTANT: Do NOT stop between steps. Run pre-flight, then immediately run the installer in the SAME turn. Tell the user "Installing AgentReel now, will report when done" as your text response while executing.

## Step 1: Pre-flight + Install (run both in one go)

```bash
echo "---AGENTREEL_INSTALL_START---"
echo "Checking prerequisites..."
command -v node && node -v || echo "node: NOT FOUND (will be installed)"
command -v python3 && python3 -V || echo "python3: NOT FOUND (optional)"
command -v git && git --version || echo "git: NOT FOUND (will be installed)"
uname -srm
echo "Starting installation..."
curl -fsSL https://raw.githubusercontent.com/Jiansen/agentreel/main/install.sh | bash
```

If `agentreel` is not found after install, run:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Step 2: Verify

```bash
agentreel doctor
```

Report the doctor output to the user. If there are failures:
1. Follow the fix suggestions in the doctor output
2. Run `agentreel doctor` again
3. If still failing after 2 attempts, run `agentreel doctor --report` to submit diagnostics

## Step 3: Start services

```bash
agentreel start
```

## Step 4: Report to user

Tell the user:
1. Installation result (success/partial/failed) and how long it took
2. Which components were installed (viewer, relay, CLI, OpenClaw skill)
3. The local viewer URL: http://localhost:3000/live
4. If a public IP was detected, also share: http://<public-ip>:3000/live
   (remind user to open port 3000 in their firewall/security group for external access)
5. Suggest: "Send me a task and watch it live at the URL above"
6. If anything failed: what went wrong and what to try next
