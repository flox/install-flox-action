#!/usr/bin/env bash
set -euo pipefail

if ! type -p nix &>/dev/null ; then
  echo "Aborting: Nix is not installed, please configure nix using https://github.com/marketplace/actions/install-nix"
  exit
fi

# GitHub command to put the following log messages into a group which is collapsed by default
echo "::group::Installing Flox"

nix profile install --impure \
      --experimental-features "nix-command flakes" \
      --accept-flake-config \
      'github:flox/floxpkgs#flox.fromCatalog'

# Check it runs
$HOME/.nix-profile/bin/flox --version

# This may not already be included if Nix didn't come from install-nix-action
echo "$HOME/.nix-profile/bin" >> "$GITHUB_PATH"

# Close the log message group which was opened above
echo "::endgroup::"

