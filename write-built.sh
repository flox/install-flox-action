#!/usr/bin/env bash
set -euo pipefail
set -f

export IFS=' '

for OUT_PATH in "$OUT_PATHS"; do
    echo "$OUT_PATH" >> /tmp/built-derivations
done
