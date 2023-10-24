#!/usr/bin/env bash

set -euo pipefail

# Ensure ssh-keyscan is available
command -v ssh-keyscan >/dev/null 2>&1 || {
  echo >&2 "Aborting: 'ssh-keyscan' is not installed.";
  exit 1;
}
# Ensure ssh-keygen is available
command -v ssh-keygen >/dev/null 2>&1 || {
  echo >&2 "Aborting: 'ssh-keygen' is not installed.";
  exit 1;
}
# Ensure HOME is set
if [ -z "$HOME " ]; then
  echo >&2 "Aborting: 'HOME' environment variable is not set.";
  exit 1;
fi
# Ensure INPUT_SSH_KEY_FORMAT is set
if [ -z "$INPUT_SSH_KEY_FORMAT" ]; then
  echo >&2 "Aborting: 'INPUT_SSH_KEY_FORMAT' environment variable is not set.";
  exit 1;
fi


echo "Configure ssh to allow builtins.fetchGit and related to work"


mkdir -p "$HOME/.ssh"
ssh-keyscan github.com >> "$HOME/.ssh/known_hosts"


if [ -z "$INPUT_SSH_KEY" ]; then
  ssh-keygen -q -N '' -t "$INPUT_SSH_KEY_FORMAT" -f "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT"
else
  touch "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT"
  chmod 600 "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT"
  echo "$INPUT_SSH_KEY" > "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT"
  ssh-keygen -f "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT" -y > "$HOME/.ssh/id_$INPUT_SSH_KEY_FORMAT.pub"
fi

if [ -n "$INPUT_SSH_AUTH_SOCK" ]; then
  SSH_AUTH_SOCK="$INPUT_SSH_AUTH_SOCK"
fi

nohup ssh-agent -D > .ssh-agent-out &
eval "$( (tail -f .ssh-agent-out &) | sed '/echo Agent pid/ q')"

echo "SSH_AUTH_SOCK='$SSH_AUTH_SOCK'" > "$GITHUB_ENV"
