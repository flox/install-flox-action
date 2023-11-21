#!/usr/bin/env bash

set -euo pipefail

echo "Restarting the Nix daemon..."

if [[ "$RUNNER_OS" == "Linux" ]]; then
  sudo systemctl daemon-reload
  sudo systemctl restart nix-daemon.service
elif [[ "$RUNNER_OS" == "macOS" ]]; then
  sudo launchctl unload /Library/LaunchDaemons/org.nixos.nix-daemon.plist
  sudo launchctl load /Library/LaunchDaemons/org.nixos.nix-daemon.plist
  # for some reason running this twice restarts the service
  sudo launchctl kickstart -k -p system/org.nixos.nix-daemon
  sudo launchctl kickstart -k -p system/org.nixos.nix-daemon
else
  echo "Unsupported OS: $RUNNER_OS"
  exit 1
fi
