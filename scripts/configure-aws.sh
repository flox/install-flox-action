#!/usr/bin/env bash

set -euo pipefail

# Ensure INPUT_AWS_ACCESS_KEY_ID is set
if [ -z "$INPUT_AWS_ACCESS_KEY_ID" ]; then
  echo >&2 "Aborting: 'INPUT_AWS_ACCESS_KEY_ID' environment variable is not set.";
  exit 1;
fi
# Ensure INPUT_AWS_SECRET_ACCESS_KEY is set
if [ -z "$INPUT_AWS_SECRET_ACCESS_KEY" ]; then
  echo >&2 "Aborting: 'INPUT_AWS_SECRET_ACCESS_KEY' environment variable is not set.";
  exit 1;
fi


echo "Populating the environment with AWS's credentials..."
{
  echo "AWS_ACCESS_KEY_ID=${INPUT_AWS_ACCESS_KEY_ID}"
  echo "AWS_SECRET_ACCESS_KEY=${INPUT_AWS_SECRET_ACCESS_KEY}"
} >>"${GITHUB_ENV}"


echo "Making the Nix daemon aware of the AWS credentials..."

if [[ "$RUNNER_OS" == "Linux" ]]; then
  sudo mkdir -p /etc/systemd/system/nix-daemon.service.d
  printf "%s\n" \
    '[Service]' \
    "Environment=AWS_ACCESS_KEY_ID=${INPUT_AWS_ACCESS_KEY_ID}" \
    "Environment=AWS_SECRET_ACCESS_KEY=${INPUT_AWS_SECRET_ACCESS_KEY}" |
    sudo tee -a /etc/systemd/system/nix-daemon.service.d/aws-credentials.conf >/dev/null
elif [[ "$RUNNER_OS" == "macOS" ]]; then
  sudo plutil \
    -insert EnvironmentVariables.AWS_SECRET_ACCESS_KEY \
    -string "$INPUT_AWS_SECRET_ACCESS_KEY" \
      /Library/LaunchDaemons/org.nixos.nix-daemon.plist
  sudo plutil \
    -insert EnvironmentVariables.AWS_ACCESS_KEY_ID \
    -string "$INPUT_AWS_ACCESS_KEY_ID" \
      /Library/LaunchDaemons/org.nixos.nix-daemon.plist
fi


echo "Restarting the Nix daemon..."

if [[ "$RUNNER_OS" == "Linux" ]]; then
  sudo systemctl daemon-reload
  sudo systemctl restart nix-daemon.service
elif [[ "$RUNNER_OS" == "macOS" ]]; then
  sudo launchctl kickstart -k system/org.nixos.nix-daemon
else
  echo "Unsupported OS: $RUNNER_OS"
  exit 1
fi
