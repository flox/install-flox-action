#!/usr/bin/env bash

set -euo pipefail

# Ensure STORE_PATHS_FILE is set
if [ -z "$STORE_PATHS_FILE" ]; then
  echo >&2 "Aborting: 'STORE_PATHS_FILE' environment variable is not set.";
  exit 1;
fi
# Ensure FLOX_SUBSTITUTER is set
if [ -z "$FLOX_SUBSTITUTER" ]; then
  echo >&2 "Aborting: 'FLOX_SUBSTITUTER' environment variable is not set.";
  exit 1;
fi

STORE_PATHS_FILE2="$( mktemp; )";
find "$NIX_STORE_DIR" -maxdepth 1 -mindepth 1 -type d -o -type l | sort > "$STORE_PATHS_FILE2";

NEW_STORE_PATHS_FILE="$( mktemp; )";
comm -13 "$STORE_PATHS_FILE" "$STORE_PATHS_FILE2" > "$NEW_STORE_PATHS_FILE";
if [[ "$RUNNER_OS" == "Linux" ]]; then
  NEW_STORE_PATHS_FILE_COUNT="$(wc -l "$NEW_STORE_PATHS_FILE"|cut -d' ' -f1)";
elif [[ "$RUNNER_OS" == "macOS" ]]; then
  NEW_STORE_PATHS_FILE_COUNT="$(wc -l "$NEW_STORE_PATHS_FILE"|cut -w -f2)";
fi
echo "$NEW_STORE_PATHS_FILE_COUNT new paths will be pushed";

echo "\n\n"
echo "========================================================================"
echo "========================================================================"
echo "========================================================================"
echo "\n\n"

cat "#NEW_STORE_PATHS_FILE"

echo "\n\n"
echo "========================================================================"
echo "========================================================================"
echo "========================================================================"
echo "\n\n"

# Allow pushing to fail.
cat "$NEW_STORE_PATHS_FILE" | nix copy --extra-experimental-features nix-command --to "$FLOX_SUBSTITUTER" --no-recursive --stdin -vv ||:;
