#!/usr/bin/env bash

set -exuo pipefail

# Ensure FLOX_SUBSTITUTER is set
if [ -z "$FLOX_SUBSTITUTER" ]; then
  echo >&2 "Aborting: 'FLOX_SUBSTITUTER' environment variable is not set.";
  exit 1;
fi

# Allow pushing to fail.

# copy the outputs of drv-paths
# https://www.haskellforall.com/2022/10/how-to-correctly-cache-build-time.html

if [ -f /tmp/drv-paths ]; then
	cat /tmp/drv-paths | xargs nix-store --query --requisites --include-outputs > /tmp/dependency-paths-outputs ||:;
	cat /tmp/drv-paths | xargs nix-store --query --requisites  > /tmp/dependency-paths ||:;
	# only copy the binary portions of the build-time dependencies
	awk 'NR==FNR{a[$0]=1;next}!a[$0]' /tmp/dependency-paths /tmp/dependency-paths-outputs | xargs nix copy --extra-experimental-features nix-command --to "$FLOX_SUBSTITUTER" ||:;
fi
