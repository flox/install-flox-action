#!/usr/bin/env bash

set -exuo pipefail

# Ensure FLOX_SUBSTITUTER is set
if [ -z "$FLOX_SUBSTITUTER" ]; then
  echo >&2 "Aborting: 'FLOX_SUBSTITUTER' environment variable is not set.";
  exit 1;
fi

# Allow pushing to fail.

# copy the outputs of drv-paths
cat /tmp/drv-paths | xargs -I{} -r nix copy --extra-experimental-features nix-command --to "$FLOX_SUBSTITUTER" {}^* -vv||:;
cat /tmp/drv-paths | xargs -I{} -r nix copy --extra-experimental-features nix-command --to "$FLOX_SUBSTITUTER" {} -vv||:;
