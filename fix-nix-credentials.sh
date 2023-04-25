#!/usr/bin/env bash
set -euo pipefail

# GitHub command to put the following log messages into a group which is collapsed by default
echo "::group::Fixing Nix credential issues"

# Allows `builtins.fetchGit' and related to work.
mkdir -p "$HOME/.ssh"
ssh-keyscan github.com >> "$HOME/.ssh/known_hosts"

if [ -z "$INPUTS_SSH_KEY" ]; then
  ssh-keygen -q -N '' -t "$INPUTS_SSH_KEY_FORMAT" -f "$HOME/.ssh/id_$INPUTS_SSH_KEY_FORMAT"
else
  touch "$HOME/.ssh/id_$INPUTS_SSH_KEY_FORMAT"
  chmod 600 "$HOME/.ssh/id_$INPUTS_SSH_KEY_FORMAT"
  echo "$INPUTS_SSH_KEY" > "$HOME/.ssh/id_$INPUTS_SSH_KEY_FORMAT"
  ssh-keygen -f "$HOME/.ssh/id_$INPUTS_SSH_KEY_FORMAT" -y > "$HOME/.ssh/id_$INPUTS_SSH_KEY_FORMAT.pub"
fi

if [ -n "$INPUTS_SSH_AUTH_SOCK" ]; then
  SSH_AUTH_SOCK="$INPUTS_SSH_AUTH_SOCK"
fi

eval "$(ssh-agent)"
echo "SSH_AUTH_SOCK='$SSH_AUTH_SOCK'" > "$GITHUB_ENV"
echo "SSH_AGENT_PID='$SSH_AGENT_PID'" > "$GITHUB_ENV"

git config --global user.email || git config --global user.email "floxuser@example.invalid"
git config --global user.name || git config --global user.name "flox User"

# Allows `builtins.fetch{url,Tarball}' and related to work:
mkdir -p "$HOME/.config/nix";
echo "machine api.github.com password $INPUTS_GITHUB_ACCESS_TOKEN" > "$HOME/.config/nix/netrc"
echo "machine pkgs.github.com password $INPUTS_GITHUB_ACCESS_TOKEN" >> "$HOME/.config/nix/netrc"
echo "machine github.com password $INPUTS_GITHUB_ACCESS_TOKEN" >> "$HOME/.config/nix/netrc"

# Close the log message group which was opened above
echo "::endgroup::"
