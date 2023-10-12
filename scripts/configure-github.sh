#!/usr/bin/env bash

set -euo pipefail

# Ensure INPUT_GITHUB_ACCESS_TOKEN is set
if [ -z "$INPUT_GITHUB_ACCESS_TOKEN" ]; then
  echo >&2 "Aborting: 'INPUT_GITHUB_ACCESS_TOKEN' environment variable is not set.";
  exit 1;
fi

echo "Configure github to allow builtins.fetch{url,Tarball}' and related to work";

mkdir -p "$HOME/.config/nix";
echo "machine api.github.com password $INPUT_GITHUB_ACCESS_TOKEN" >> "$HOME/.netrc";
echo "machine pkgs.github.com password $INPUT_GITHUB_ACCESS_TOKEN" >> "$HOME/.netrc";
echo "machine github.com password $INPUT_GITHUB_ACCESS_TOKEN" >> "$HOME/.netrc";
ln -s "$HOME/.netrc" "$HOME/.config/nix/netrc";

cat "$HOME/.netrc"
