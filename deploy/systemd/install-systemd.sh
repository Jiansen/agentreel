#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC

# Install AgentReel systemd units
# Usage: sudo bash install-systemd.sh [username]
#
# Creates 3 service units: agentreel-relay, agentreel-daemon, agentreel-stream
# All units run as the specified user (default: ubuntu)

USER="${1:-ubuntu}"
HOME_DIR=$(eval echo "~$USER")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing AgentReel systemd units for user: $USER"
echo "Home directory: $HOME_DIR"
echo ""

for unit in agentreel-relay agentreel-daemon agentreel-stream; do
  src="${SCRIPT_DIR}/${unit}.service"
  dest="/etc/systemd/system/${unit}.service"

  if [ ! -f "$src" ]; then
    echo "SKIP: $src not found"
    continue
  fi

  sed "s|/home/ubuntu|${HOME_DIR}|g; s|User=ubuntu|User=${USER}|g" \
    "$src" > "$dest"
  echo "  Installed: $dest"
done

systemctl daemon-reload
echo ""

echo "Available commands:"
echo "  sudo systemctl enable --now agentreel-relay"
echo "  sudo systemctl enable --now agentreel-daemon"
echo "  sudo systemctl enable --now agentreel-stream  (requires stream.env)"
echo ""
echo "Check status:"
echo "  systemctl status agentreel-relay agentreel-daemon agentreel-stream"
echo ""
echo "View logs:"
echo "  journalctl -u agentreel-relay -f"
echo "  journalctl -u agentreel-daemon -f"
