#!/usr/bin/env bash

set -euo pipefail

# Ensure HOME is set
if [ -z "$HOME " ]; then
  echo >&2 "Aborting: 'HOME' environment variable is not set.";
  exit 1;
fi
# Ensure INPUT_SSH_KEY is set
if [ -z "$INPUT_SSH_KEY" ]; then
  echo >&2 "Aborting: 'INPUT_SSH_KEY' environment variable is not set.";
  exit 1;
fi
# Ensure INPUT_ is set
if [ -z "$INPUT_SSH_KEY_FORMAT" ]; then
  echo >&2 "Aborting: 'INPUT_SSH_KEY_FORMAT' environment variable is not set.";
  exit 1;
fi


echo "Configure ssh to allow builtins.fetchGit and related to work"

mkdir -p "$HOME/.ssh"
ssh-keyscan github.com >> "$HOME/.ssh/known_hosts"

touch "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT"
chmod 600 "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT"
echo "$INPUT_SSH_KEY" > "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT"
ssh-keygen -f "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT" -y > "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT.pub"

if [ -n "$INPUT_SSH_AUTH_SOCK" ]; then
  SSH_AUTH_SOCK="$INPUT_SSH_AUTH_SOCK"
fi

nohup ssh-agent -D > .ssh-agent-out &
eval "$( (tail -f .ssh-agent-out &) | sed '/echo Agent pid/ q')"

echo "SSH_AUTH_SOCK='$SSH_AUTH_SOCK'" > "$GITHUB_ENV"
