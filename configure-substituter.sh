#!/usr/bin/env bash

set -euo pipefail

echo "::group::Setting up substituter ${INPUT_SUBSTITUTER}"

echo "${INPUT_SUBSTITUTER_KEY}" >/tmp/secret-key

echo "Populating the environment with the substituter's URL and options, and AWS's credentials"
{
	echo "FLOX_SUBSTITUTER=${INPUT_SUBSTITUTER}${INPUT_SUBSTITUTER_OPTIONS}"
	echo "AWS_ACCESS_KEY_ID=${INPUT_AWS_ACCESS_KEY_ID}"
	echo "AWS_SECRET_ACCESS_KEY=${INPUT_AWS_SECRET_ACCESS_KEY}"
} >>"${GITHUB_ENV}"

echo "Making the Nix daemon aware of the substituter"
{
	EXTRA_TRUSTED_PUBLIC_KEY=$(echo "${INPUT_SUBSTITUTER_KEY}" | nix key convert-secret-to-public)
	echo "extra-trusted-public-keys = ${EXTRA_TRUSTED_PUBLIC_KEY}"
	echo "extra-substituters = ${INPUT_SUBSTITUTER}"
} | sudo tee -a /etc/nix/nix.conf >/dev/null

echo "Making the Nix daemon aware of the AWS credentials"

sudo mkdir -p /etc/systemd/system/nix-daemon.service.d
printf "%s\n" \
	'[Service]' \
	"Environment=AWS_ACCESS_KEY_ID=${INPUT_AWS_ACCESS_KEY_ID}" \
	"Environment=AWS_SECRET_ACCESS_KEY=${INPUT_AWS_SECRET_ACCESS_KEY}" |
	sudo tee -a /etc/systemd/system/nix-daemon.service.d/aws-credentials.conf >/dev/null

echo "Restarting the Nix daemon"

if [[ "$RUNNER_OS" == "Linux" ]]; then
	sudo systemctl daemon-reload
	sudo systemctl restart nix-daemon.service
elif [[ "$RUNNER_OS" == "macOS" ]]; then
	sudo launchctl kickstart -k system/org.nixos.nix-daemon
else
	echo "Unsupported OS: $RUNNER_OS"
	exit 1
fi

echo "::endgroup::"
