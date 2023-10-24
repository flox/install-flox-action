#!/usr/bin/env bash

set -euo pipefail

# Ensure INPUT_SUBSTITUTER is set
if [ -z "$INPUT_SUBSTITUTER" ]; then
  echo >&2 "Aborting: 'INPUT_SUBSTITUTER' environment variable is not set.";
  exit 1;
fi
# Ensure INPUT_SUBSTITUTER_KEY is set
if [ -z "$INPUT_SUBSTITUTER_KEY" ]; then
  echo >&2 "Aborting: 'INPUT_SUBSTITUTER_KEY' environment variable is not set.";
  exit 1;
fi

echo "Setting up substituter ${INPUT_SUBSTITUTER}"
echo "${INPUT_SUBSTITUTER_KEY}" > /tmp/secret-key

echo "Populating the environment with the substituter's URL and options, and AWS's credentials"
{
  echo "FLOX_SUBSTITUTER=${INPUT_SUBSTITUTER}${INPUT_SUBSTITUTER_OPTIONS}"
} >>"${GITHUB_ENV}"

echo "Making the Nix daemon aware of the substituter"
{
  EXTRA_TRUSTED_PUBLIC_KEY=$(echo "${INPUT_SUBSTITUTER_KEY}" | nix key convert-secret-to-public --extra-experimental-features nix-command)
  echo "extra-trusted-public-keys = ${EXTRA_TRUSTED_PUBLIC_KEY}"
  echo "extra-substituters = ${INPUT_SUBSTITUTER}"
} | sudo tee -a /etc/nix/nix.conf >/dev/null
