#!/usr/bin/env bash

set -euo pipefail

# Ensure INPUT_GIT_EMAIL is set
if [ -z "$INPUT_GIT_EMAIL" ]; then
  echo >&2 "Aborting: 'INPUT_GIT_EMAIL' environment variable is not set.";
  exit 1;
fi
# Ensure INPUT_GIT_USER is set
if [ -z "$INPUT_GIT_USER" ]; then
  echo >&2 "Aborting: 'INPUT_GIT_USER' environment variable is not set.";
  exit 1;
fi

echo "Set user.name and user.email if not set already"

GIT_TRACE=1 git config --global user.name || GIT_TRACE=1 git config --global user.name "$INPUT_GIT_USER"
GIT_TRACE=1 git config --global user.email || GIT_TRACE=1 git config --global user.email "$INPUT_GIT_EMAIL"

echo "Set GIT_SSH to '$(which ssh)' to be explicit which ssh version is used"
# TODO: is this a bug? we should be using the system version of ssh
# https://github.com/NixOS/nixpkgs/issues/58132
echo "GIT_SSH=$(which ssh)" >> "$GITHUB_ENV"
