#!/usr/bin/env bash
set -euo pipefail

function badly_fix_perms() {
	sudo chown -R "$(id -u):$(id -g)" "$1" || :
	chown -R "$(id -u):$(id -g)" "$1" || :
	sudo chmod -R ugo+rwX "$1" || :
	chmod -R ugo+rwX "$1" || :
}

P="${RUNNER_TEMP:-/tmp}/built-paths"

badly_fix_perms "$P"

echo "Deduplicating $(wc -l < "$P") built derivations"
LINES=$(cat "$P")
echo "$LINES" | sort | uniq | sed '/^$/d' > "$P"

echo "Using these built paths:"
cat "$P"

mkdir -p "/tmp/nixcache"

badly_fix_perms "/tmp/nixcache"
echo "Starting copy"
nix copy --to "file:///tmp/nixcache?priority=10" $(tr '\n' ' ' < "$P")
badly_fix_perms "/tmp/nixcache"

