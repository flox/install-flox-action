#!/usr/bin/env bash
set -euo pipefail

# We want to save flox itself always, and ensure the file exists
echo "$(readlink -f "$(which flox)")" >> /tmp/built-derivations

echo "Deduplicating built derivations"
LINES="$(cat /tmp/built-derivations)"
echo "$LINES" | sort | uniq | sed '/^$/d' > /tmp/built-derivations

echo "Using these built paths:"
cat /tmp/built-derivations

echo "Collecting dependencies..."

ALL_PATHS=()

while read -r BUILT_OUT_PATH; do
    ALL_PATHS+=("$BUILT_OUT_PATH")
    while read DEP_PATH; do
        ALL_PATHS+=("$DEP_PATH")
    done < <(nix-store -qR "$BUILT_OUT_PATH")
done < /tmp/built-derivations

echo "Saving these paths to the cache:"
echo "${ALL_PATHS[@]}"

nix-store --export "${ALL_PATHS[@]}" > /tmp/nixcache
