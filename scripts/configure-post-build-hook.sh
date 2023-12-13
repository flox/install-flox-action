#!/usr/bin/env bash

set -euo pipefail

echo "Configuring the post build hook"
cat <<'EOF' | sudo tee /tmp/post-build-hook
#!/bin/sh

set -eu
set -f # disable globbing
export IFS=' '

echo "OUT_PATHS:" $OUT_PATHS
echo "DRV_PATHS:" $DRV_PATH
echo $OUT_PATHS >> /tmp/out-paths
echo "$DRV_PATH" >> /tmp/drv-paths
EOF
sudo chmod +x /tmp/post-build-hook
{

  echo "post-build-hook = /tmp/post-build-hook"
} | sudo tee -a /etc/nix/nix.conf >/dev/null
