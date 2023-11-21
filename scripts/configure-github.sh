#!/usr/bin/env bash

set -euo pipefail

# Ensure INPUT_GITHUB_ACCESS_TOKEN is set
if [ -z "$INPUT_GITHUB_ACCESS_TOKEN" ]; then
  echo >&2 "Aborting: 'INPUT_GITHUB_ACCESS_TOKEN' environment variable is not set.";
  exit 1;
fi

echo "Configure github to allow builtins.fetch{url,Tarball}' and related to work";
mkdir -p "$HOME/.config/nix";
{
  echo "machine api.github.com password $INPUT_GITHUB_ACCESS_TOKEN"
  echo "machine pkgs.github.com password $INPUT_GITHUB_ACCESS_TOKEN"
  echo "machine github.com password $INPUT_GITHUB_ACCESS_TOKEN"
} | sudo tee -a "$HOME/.netrc" >/dev/null
ln -s "$HOME/.netrc" "$HOME/.config/nix/netrc";


echo "Configure github token in nix.conf";
{
  echo "access-tokens = github.com=$INPUT_GITHUB_ACCESS_TOKEN"
} | sudo tee -a /etc/nix/nix.conf >/dev/null

cat "$HOME/.netrc"
