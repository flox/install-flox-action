#!/usr/bin/env bash
# Stand up a genuine GitHub Actions self-hosted runner whose filesystem
# survives between jobs, which is the condition issue #191 needs and the one
# thing neither CI nor the other checks here can produce.
#
# The other checks approximate a persistent runner: they keep a container alive
# and expire the recorded token by hand. This does not approximate anything.
# Jobs land on one machine in sequence, the broken state is created by whatever
# release the workflow installs, and the job token expires the way GitHub
# expires it, when the job that owned it finishes.
#
#   GITHUB_REPOSITORY=owner/scratch-repo \
#   RUNNER_TOKEN=$(gh api -X POST \
#     repos/owner/scratch-repo/actions/runners/registration-token --jq .token) \
#     ./verification/self-hosted-runner.sh
#
# Use a SCRATCH repository. The runner accepts any job that repository
# schedules, and a registration token is a credential: it is short-lived, but
# while it lives it can register a runner against that repository.
#
# The script registers the runner and then blocks, printing its log. Push
# workflow runs at the scratch repository from another terminal, then stop this
# with Ctrl-C when finished; the container and its registration are removed on
# exit.
#
# The sequence worth running, each as its own job so that each gets its own
# job token:
#
#   1. a released version on the clean machine        -> should succeed
#   2. the same released version again                -> should fail, if that
#                                                        release has the bug
#   3. the candidate against that inherited state     -> should heal it
#   4. the candidate again                            -> should repeat cleanly
#
# A workflow is not committed for this, because which revisions are being
# compared changes with every investigation. Point steps 1 and 2 at a release
# tag and steps 3 and 4 at the branch under test.
set -euo pipefail

: "${GITHUB_REPOSITORY:?set to owner/repo of a scratch repository}"
: "${RUNNER_TOKEN:?set to a runner registration token}"

CONTAINER="${CONTAINER:-install-flox-action-self-hosted}"
IMAGE="${IMAGE:-ghcr.io/actions/actions-runner:latest}"
LABELS="${LABELS:-self-hosted,persistent-check}"

cleanup() {
  echo
  echo "Removing the runner and its registration..."
  # `remove` needs a token too; without it the runner is left listed as
  # offline at the repository and has to be deleted by hand.
  docker exec "$CONTAINER" ./config.sh remove --token "$RUNNER_TOKEN" \
    >/dev/null 2>&1 || true
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo "Registering a runner at $GITHUB_REPOSITORY with labels: $LABELS"
docker run -d --name "$CONTAINER" --entrypoint sleep "$IMAGE" infinity >/dev/null

# The runner image ships without sudo, xz, or a package manager path to them,
# and the flox packages pre-depend on both. A hosted image would already carry
# them; provision them here so the first job does not fail on a missing
# dependency and retry until it gives up.
docker exec -u root "$CONTAINER" bash -c \
  'apt-get update -qq && apt-get install -y -qq sudo xz-utils curl >/dev/null'
docker exec -u root "$CONTAINER" bash -c \
  'echo "runner ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/runner'

docker exec "$CONTAINER" ./config.sh \
  --url "https://github.com/${GITHUB_REPOSITORY}" \
  --token "$RUNNER_TOKEN" \
  --labels "$LABELS" \
  --name "$CONTAINER" \
  --unattended \
  --replace

cat <<EOF

Runner is registered and about to start listening.

  runs-on: [$(echo "$LABELS" | tr ',' ' ' | sed 's/ /, /g')]

Trigger jobs at $GITHUB_REPOSITORY from another terminal. Between jobs the
filesystem persists, so inspect state with:

  docker exec $CONTAINER cat /etc/nix/nix.conf
  docker exec $CONTAINER ls -la /etc/nix/
  docker exec $CONTAINER bash -c 'command -v flox nix'

Ctrl-C to stop and deregister.

EOF

docker exec "$CONTAINER" ./run.sh
