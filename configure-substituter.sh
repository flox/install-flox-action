#!/usr/bin/env bash

set -euo pipefail

echo "${INPUT_SUBSTITUTER_KEY}" >/tmp/secret-key

# Populate GitHub's environment with the substituter's URL and options, and AWS's credentials.
{
	echo "SUBSTITUTER=${INPUT_SUBSTITUTER}${INPUT_SUBSTITUTER_OPTIONS}"
	echo "${INPUT_AWS_ACCESS_KEY_ID}"
	echo "${INPUT_AWS_SECRET_ACCESS_KEY}"
} >>"${GITHUB_ENV}"

# Configure Nix to use the substituter.
{
	EXTRA_TRUSTED_PUBLIC_KEY=$(echo "${INPUT_SUBSTITUTER_KEY}" | nix key convert-secret-to-public)
	echo "extra-trusted-public-keys = ${EXTRA_TRUSTED_PUBLIC_KEY}"
	echo "extra-substituters = ${INPUT_SUBSTITUTER}"
} | sudo tee -a /etc/nix/nix.conf >/dev/null

sudo mkdir -p /etc/systemd/system/nix-daemon.service.d

printf "%s\n" \
	'[Service]' \
	"Environment=AWS_ACCESS_KEY_ID=${INPUT_AWS_ACCESS_KEY_ID}" \
	"Environment=AWS_SECRET_ACCESS_KEY=${INPUT_AWS_SECRET_ACCESS_KEY}" |
	sudo tee -a /etc/systemd/system/nix-daemon.service.d/aws-credentials.conf >/dev/null

sudo systemctl daemon-reload
sudo systemctl restart nix-daemon.service
