#!/usr/bin/env bash
# Check that the rpm command in install-flox.sh can install over a flox that is
# already there, which is what a runner keeping its disk between jobs needs.
#
# There is no rpm runner in the CI matrix, so this is not covered there. It is
# worth running by hand when the rpm branch of install-flox.sh changes.
#
# rpm is stricter here than dpkg: `-i` and `-U` both refuse a package at the
# version already installed, and `-U` alone refuses to go backwards, so a
# reinstall needs --replacepkgs and a pinned older version needs --oldpackage.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="install-flox-action-rpm-check"
IMAGE="rockylinux:9"

# Taken from install-flox.sh rather than repeated, so this cannot drift from
# what the action actually runs.
RPM_COMMAND="$(
  grep -oE '\$SUDO rpm [^"]*' "$REPO_ROOT/scripts/install-flox.sh" |
    sed 's/\$SUDO //'
)"
if [ -z "$RPM_COMMAND" ]; then
  echo >&2 "Could not find the rpm command in scripts/install-flox.sh"
  exit 1
fi
echo "Command under test: $RPM_COMMAND <package>"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$CONTAINER" "$IMAGE" sleep infinity >/dev/null
docker exec "$CONTAINER" bash -c '
  dnf install -y -q sudo xz >/dev/null 2>&1
'

docker exec -e "RPM_COMMAND=$RPM_COMMAND" "$CONTAINER" bash -c '
  set -uo pipefail
  arch="$(uname -m)"
  base="https://downloads.flox.dev/by-env/stable/rpm"
  curl -fsSL -o /tmp/new.rpm "$base/flox.${arch}-linux.rpm"
  curl -fsSL -o /tmp/old.rpm "$base/flox-1.13.0.${arch}-linux.rpm" 2>/dev/null || true

  # Passed through the environment rather than written to /etc/nix/nix.conf,
  # because flox'"'"'s postinst only writes that file when it finds none: creating
  # one first costs the defaults it puts there, build-users-group included.
  # A container has no build users and cannot run Nix'"'"'s sandbox, neither of
  # which is what this check is about.
  export NIX_CONFIG="sandbox = false
filter-syscalls = false
build-users-group ="

  failed=0
  check() {
    local desc="$1" pkg="$2"
    if ! $RPM_COMMAND "$pkg" >/tmp/out 2>&1; then
      printf "  FAIL  %-26s exit %s\n" "$desc" "$?"
      grep -v NOKEY /tmp/out | sed "s/^/        /"
      failed=1
      return
    fi
    # `flox --version` would pass without the store being usable at all, which
    # is the whole risk with a version change: the package swap succeeds while
    # /nix is left in a state the installed flox cannot work against.
    if (cd "$(mktemp -d)" && flox init && flox install hello) >/tmp/use 2>&1; then
      printf "  ok    %-26s flox %s, store usable\n" "$desc" "$(flox --version)"
    else
      printf "  FAIL  %-26s flox %s installed but the store is unusable\n" \
        "$desc" "$(flox --version 2>/dev/null)"
      tail -6 /tmp/use | sed "s/^/        /"
      failed=1
    fi
  }

  check "fresh install" /tmp/new.rpm
  check "same-version reinstall" /tmp/new.rpm
  if [ -s /tmp/old.rpm ]; then
    # Downgrading flox in place is not supported, because it can leave a Nix
    # too old to read the store it inherits. The action refuses first; rpm
    # refusing as well is the backstop being checked here.
    if $RPM_COMMAND /tmp/old.rpm >/tmp/out 2>&1; then
      printf "  FAIL  %-26s rpm accepted a downgrade\n" "downgrade is refused"
      failed=1
    else
      printf "  ok    %-26s rpm refused it\n" "downgrade is refused"
    fi
    check "still usable afterwards" /tmp/new.rpm
  else
    echo "  skip  downgrade (no older package published)"
  fi

  exit "$failed"
'
echo "rpm reinstall paths are sound"
