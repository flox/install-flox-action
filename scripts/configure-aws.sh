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
  NIX_SSL_CERT_FILE="$(sudo plutil -extract EnvironmentVariables.NIX_SSL_CERT_FILE raw /Library/LaunchDaemons/org.nixos.nix-daemon.plist)"
  {
    echo "NIX_SSL_CERT_FILE=$NIX_SSL_CERT_FILE"
    echo "SSL_CERT_FILE=$NIX_SSL_CERT_FILE"
  } >>"${GITHUB_ENV}"
  sudo launchctl setenv AWS_SECRET_ACCESS_KEY "$INPUT_AWS_SECRET_ACCESS_KEY"
  sudo launchctl setenv AWS_ACCESS_KEY_ID     "$INPUT_AWS_ACCESS_KEY_ID"
  sudo launchctl setenv NIX_SSL_CERT_FILE     "$NIX_SSL_CERT_FILE"
  sudo launchctl setenv SSL_CERT_FILE         "$NIX_SSL_CERT_FILE"
fi


echo "Restarting the Nix daemon..."

if [[ "$RUNNER_OS" == "Linux" ]]; then
  sudo systemctl daemon-reload
  sudo systemctl restart nix-daemon.service
elif [[ "$RUNNER_OS" == "macOS" ]]; then
  sudo launchctl kickstart -k -p system/org.nixos.nix-daemon
  sudo launchctl kickstart -k -p system/org.nixos.nix-daemon
else
  echo "Unsupported OS: $RUNNER_OS"
  exit 1
fi
