#!/bin/sh

set -eu
set -f # disable globbing

P="${RUNNER_TEMP:-/tmp}/built-paths"

# Hack to avoid permissions issues for now
sudo chown "$(id -u):$(id -g)" "$P" || :
chown "$(id -u):$(id -g)" "$P" || :
sudo chmod 666 "$P" || :
chmod 666 "$P" || :

# Provided by Nix
if [ -n "${OUT_PATHS+1}" ]; then
	echo "$OUT_PATHS" | tr ' ' '\n' >> "$P"
fi

# In case we want to use it directly
for X in "$@"; do
	echo "$X" >> "$P"
done
