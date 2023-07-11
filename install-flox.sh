#!/usr/bin/env bash
set -euo pipefail

if ! type -p nix &>/dev/null ; then
  printf '%s' "Aborting: Nix is not installed, please configure nix using "  \
              "https://github.com/marketplace/actions/install-nix"
  exit
fi

# GitHub command to put the following log messages into a group which is
# collapsed by default
echo "::group::Installing Flox"

: "${FLOXPKGS_URI:=github:flox/floxpkgs}"
: "${FLOX_INSTALLABLE_URI:=$FLOXPKGS_URI#flox.fromCatalog}"

nix profile install --impure \
      --experimental-features "nix-command flakes" \
      --accept-flake-config \
      "$FLOX_INSTALLABLE_URI"

# Check it runs
"$HOME/.nix-profile/bin/flox" --version

# This might already be set e.g. if Nix was installed using install-nix-action.
# If Nix was already installed through other means (e.g. on a hosted runner)
# this path might be missing, so we include it to be safe.
echo "$HOME/.nix-profile/bin" >> "$GITHUB_PATH"

# Close the log message group which was opened above
echo "::endgroup::"

