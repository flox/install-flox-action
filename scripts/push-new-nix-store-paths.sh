#!/usr/bin/env bash

set -exuo pipefail

# Ensure FLOX_SUBSTITUTER is set
if [ -z "$FLOX_SUBSTITUTER" ]; then
  echo >&2 "Aborting: 'FLOX_SUBSTITUTER' environment variable is not set.";
  exit 1;
fi

# Allow pushing to fail.
cat /tmp/drv-paths | xargs -I{} -r nix copy --extra-experimental-features nix-command --to "$FLOX_SUBSTITUTER" {}^* -vv||:;

# Kill the ssh-agent and tailscale
sudo kill $(ps aux | awk '/ssh-agent/{print $2}') || true
sudo kill $(ps aux | awk '/tailscale/{print $2}') || true
sudo tailscale down || true
sudo tailscaled --cleanup || true
