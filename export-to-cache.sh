#!/usr/bin/env bash
set -euof pipefail

export IFS=' '

nix-store --export "$OUT_PATHS" > /tmp/nixcache
