#!/usr/bin/env bash
set -euo pipefail

if [ -n "${{ inputs.cache-key }}" ]; then
    echo "post-build-hook = ${{ github.action_path }}/export-to-cache.sh" | sudo tee /etc/nix/nix.conf > /dev/null
fi
