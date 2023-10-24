#!/usr/bin/env bash

set -euo pipefail

NIX_STORE_DIR="$(nix eval --extra-experimental-features nix-command --impure --raw --expr builtins.storeDir)";
echo "NIX_STORE_DIR=$NIX_STORE_DIR" >> "$GITHUB_ENV";
echo "Nix store is located at '$NIX_STORE_DIR'";


STORE_PATHS_FILE="$( mktemp; )";
echo "STORE_PATHS_FILE=$STORE_PATHS_FILE" >> "$GITHUB_ENV";
find "$NIX_STORE_DIR" -maxdepth 1 -mindepth 1 -type d -o -type l  \
  |sort > "$STORE_PATHS_FILE";

STORE_PATHS_FILE_COUNT="$(wc -l "$STORE_PATHS_FILE"|cut -w -f2)";
echo "Recorded $STORE_PATHS_FILE_COUNT paths";
