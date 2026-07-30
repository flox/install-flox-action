#!/usr/bin/env bash
# Reproduce the persistent-runner failures from issue #191 locally.
#
# GitHub-hosted runners start every job on a fresh VM, which is why these
# failures never appear in this repository's CI. A self-hosted runner keeps its
# filesystem between jobs. This script stands in for one: a single container
# stays alive while the action runs in it twice, so the second run sees what the
# first left behind.
#
#   ./verification/persistent-runner.sh          # run against the working tree
#   ./verification/persistent-runner.sh main     # run against origin/main
#
# Against origin/main the second run reports "Nix found at /usr/bin/nix" and
# fails fetching the flake with HTTP 401. Against the working tree it reports
# that flox is already installed and rewrites the expired token.
set -euo pipefail

REF="${1:-worktree}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="install-flox-action-repro"
IMAGE="node:24-bookworm"

# Stands in for the token GitHub grants a job. The first run records it; by the
# second run the real thing would have expired with the job that owned it.
FIRST_TOKEN="ghs_firstjob00000000000000000000000000"
SECOND_TOKEN="ghs_secondjob0000000000000000000000000"

say() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup

# The bundle reads the install script from dist/scripts/, or from ../scripts/
# on older refs. Stage both so any ref works.
STAGE="$(mktemp -d)"
mkdir -p "$STAGE/dist/scripts" "$STAGE/scripts"
if [ "$REF" = "worktree" ]; then
  cp "$REPO_ROOT/dist/index.js" "$STAGE/dist/index.js"
  cp "$REPO_ROOT/scripts/install-flox.sh" "$STAGE/scripts/install-flox.sh"
else
  git -C "$REPO_ROOT" show "origin/$REF:dist/index.js" > "$STAGE/dist/index.js"
  git -C "$REPO_ROOT" show "origin/$REF:scripts/install-flox.sh" \
    > "$STAGE/scripts/install-flox.sh"
fi
cp "$STAGE/scripts/install-flox.sh" "$STAGE/dist/scripts/install-flox.sh"
chmod +x "$STAGE/scripts/install-flox.sh" "$STAGE/dist/scripts/install-flox.sh"

say "Starting a container that outlives both runs ($REF)"
docker run -d --name "$CONTAINER" \
  -v "$STAGE:/work:ro" \
  "$IMAGE" sleep infinity >/dev/null

docker exec "$CONTAINER" bash -c \
  'apt-get update -qq && apt-get install -y -qq sudo curl >/dev/null 2>&1'

# GitHub passes inputs as INPUT_<NAME>; @actions/core reads them verbatim,
# hyphens included. GITHUB_STATE is the file core.saveState writes to, and the
# runner turns its contents into STATE_* for that step's post phase, so each run
# gets its own file here and the post phase below is handed it the same way.
run_action() {
  local token="$1" state="$2" label="$3"
  say "$label"
  # core.saveState appends to this file and throws if it is not already there.
  docker exec "$CONTAINER" touch "$state"
  docker exec \
    -e "INPUT_CHANNEL=stable" \
    -e "INPUT_DISABLE-METRICS=true" \
    -e "INPUT_DISABLE-UPGRADE-NOTIFICATIONS=false" \
    -e "INPUT_GITHUB-TOKEN=$token" \
    -e "INPUT_USE-CACHE=false" \
    -e "GITHUB_STATE=$state" \
    -e "RUNNER_DEBUG=0" \
    "$CONTAINER" node /work/dist/index.js 2>&1 || echo "[action exited non-zero]"
}

# Reads a value back out of a GITHUB_STATE file, which core.saveState writes as
# a heredoc: name<<delimiter, then the value, then the delimiter.
state_value() {
  docker exec "$CONTAINER" bash -c \
    "grep -A1 '^$2<<' '$1' 2>/dev/null | tail -1" | tr -d '\r'
}

# Post steps run in reverse order, each seeing only its own step's state.
run_post() {
  local state="$1" label="$2"
  say "$label"
  docker exec \
    -e "STATE_isPost=true" \
    -e "STATE_confName=$(state_value "$state" confName)" \
    "$CONTAINER" node /work/dist/index.js 2>&1 || true
}

run_action "$FIRST_TOKEN" /tmp/state-1 "First run: a job on a clean machine"

say "What the first run left behind"
docker exec "$CONTAINER" bash -c '
  printf "flox:  %s\n" "$(command -v flox || echo "not on PATH")"
  printf "nix:   %s\n" "$(command -v nix || echo "not on PATH")"
  printf "owner of /usr/bin/nix: %s\n" "$(dpkg -S /usr/bin/nix 2>/dev/null || echo unknown)"
  echo "--- access-tokens on disk ---"
  grep -rn "access-tokens" /etc/nix/ 2>/dev/null || echo "(none)"
'

run_action "$SECOND_TOKEN" /tmp/state-2 "Second run: another job on the same machine"

run_post /tmp/state-2 "Post step of the second run"
run_post /tmp/state-1 "Post step of the first run"

say "What the second run left behind"
docker exec "$CONTAINER" bash -c '
  echo "--- access-tokens on disk ---"
  grep -rn "access-tokens" /etc/nix/ 2>/dev/null || echo "(none)"
  echo "--- nix.conf ---"
  cat /etc/nix/nix.conf 2>/dev/null || echo "(missing)"
'

say "Done"
