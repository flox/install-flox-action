#!/usr/bin/env bash
set -euo pipefail

if ! type -p nix &>/dev/null ; then
  echo "Aborting: Nix is not installed, please configure nix using https://github.com/marketplace/actions/install-nix"
  exit
fi

# GitHub command to put the following log messages into a group which is collapsed by default
echo "::group::Installing Flox"

sudo -H nix \
    --extra-experimental-features "flakes nix-command" \
    --profile /nix/var/nix/profiles/default \
    --access-tokens "github.com=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" \ # [sic] Remove after closed beta
    profile install \
    "github:flox/floxpkgs#catalog.$(nix eval --expr  'builtins.currentSystem' --impure).stable.floxpkgs.flox"


# Close the log message group which was opened above
echo "::endgroup::"

flox --version
