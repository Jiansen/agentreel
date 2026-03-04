#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# AgentReel Server Setup
# Installs everything needed to run AgentReel live streaming on a fresh Ubuntu 24.04 VPS.
#
# What this installs:
#   - Node.js 22 LTS + OpenClaw
#   - XFCE4 desktop + VNC server (for screen capture/streaming)
#   - ffmpeg (for RTMP streaming to YouTube/Twitch)
#   - Docker (optional, for sandboxed agent execution)
#   - Firefox + wmctrl (for desktop layout)
#
# Usage:
#   ssh user@your-server 'bash -s' < deploy/setup_server.sh
#
# After setup:
#   1. Set VNC password:  vncpasswd
#   2. Configure OpenClaw: openclaw configure
#   3. Start streaming:   ~/go_live.sh

echo "=== AgentReel Server Setup ==="
echo "Started: $(date +"%Y-%m-%dT%H:%M:%SZ")"

export DEBIAN_FRONTEND=noninteractive

apt-get update && apt-get upgrade -y

# --- Node.js 22 LTS ---
echo "[1/7] Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g npm@latest

# --- OpenClaw ---
echo "[2/7] Installing OpenClaw..."
npm install -g openclaw@latest
echo "OpenClaw version: $(openclaw --version 2>/dev/null || echo 'install pending')"

# --- Desktop environment (XFCE4) ---
echo "[3/7] Installing XFCE4 desktop..."
apt-get install -y xfce4 xfce4-goodies dbus-x11

# --- VNC server ---
echo "[4/7] Installing VNC server..."
apt-get install -y tigervnc-standalone-server tigervnc-common
mkdir -p ~/.vnc
cat > ~/.vnc/xstartup << 'XEOF'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
exec startxfce4
XEOF
chmod +x ~/.vnc/xstartup

# --- Browser + window manager tools ---
echo "[5/7] Installing Firefox + wmctrl..."
apt-get install -y firefox wmctrl

# --- Recording + streaming tools ---
echo "[6/8] Installing ffmpeg and tools..."
apt-get install -y ffmpeg git curl wget unzip build-essential python3 python3-pip

# --- Cua CLI (optional, for VNC protocol-level recording) ---
echo "[7/8] Installing Cua CLI (optional)..."
pip3 install --break-system-packages cua-cli==0.1.5 2>/dev/null \
  && echo "  Cua CLI installed: $(cua --version 2>/dev/null || echo 'v0.1.5')" \
  || echo "  Cua CLI install skipped (optional, install manually: pip install cua-cli==0.1.5)"

# --- Docker (optional) ---
echo "[8/8] Installing Docker..."
apt-get install -y ca-certificates gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# --- VNC helper ---
cat > ~/start-vnc.sh << 'VNCEOF'
#!/usr/bin/env bash
vncserver -kill :1 2>/dev/null || true
vncserver :1 -geometry 1920x1080 -depth 24
echo "VNC running on port 5901"
VNCEOF
chmod +x ~/start-vnc.sh

# --- Firewall ---
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp
  ufw allow 5901/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 8765/tcp
  ufw --force enable
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Versions:"
echo "  Node.js:  $(node --version 2>/dev/null)"
echo "  OpenClaw: $(openclaw --version 2>/dev/null)"
echo "  Docker:   $(docker --version 2>/dev/null)"
echo "  ffmpeg:   $(ffmpeg -version 2>/dev/null | head -1)"
echo "  Cua CLI:  $(cua --version 2>/dev/null || echo 'not installed (optional)')"
echo "  Firefox:  $(firefox --version 2>/dev/null)"
echo ""
echo "Next steps:"
echo "  1. Set VNC password:      vncpasswd"
echo "  2. Start VNC:             ~/start-vnc.sh"
echo "  3. Configure OpenClaw:    openclaw configure"
echo "  4. Copy AgentReel deploy scripts to ~/"
echo "  5. Start live streaming:  ~/go_live.sh"
echo ""
echo "Finished: $(date +"%Y-%m-%dT%H:%M:%SZ")"
