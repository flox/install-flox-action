#!/usr/bin/env bash

set -euo pipefail

# Ensure INPUT_BUILDERS is set
if [ -z "$INPUT_BUILDERS" ]; then
  echo >&2 "Aborting: 'INPUT_BUILDERS' environment variable is not set.";
  exit 1;
fi

echo "Making the Nix daemon aware of the builders"
echo "$INPUT_BUILDERS" | sudo tee /etc/nix/machines
{
  echo "builders = @/etc/nix/machines"
} | sudo tee -a /etc/nix/nix.conf >/dev/null
