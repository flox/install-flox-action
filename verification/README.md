# Verification

Checks that are run by hand, because CI cannot run them.

Everything here is a developer tool. Nothing in this directory ships with the
action or is executed by it at runtime; that is `scripts/install-flox.sh`, which
stays where the bundle can find it.

These exist because the CI matrix has three standing blind spots, none of which
belong to any one bug:

- **A filesystem that survives the job.** Every job on a GitHub-hosted runner
  starts on a fresh VM, so nothing about behavior on a machine that has already
  run the action can be observed there.
- **rpm.** The matrix is Ubuntu and macOS, so the rpm branch of
  `scripts/install-flox.sh` is never executed anywhere.
- **A real self-hosted runner.** The nearest CI gets is running the action twice
  inside one job, which shares a filesystem but not a job token.

| Tool | Answers | Needs |
|---|---|---|
| `persistent-runner.sh` | How does a given revision behave when run twice against a filesystem it already wrote to? | Docker |
| `rpm-reinstall.sh` | Can the rpm command in `scripts/install-flox.sh` install over a flox that is already present, and move between versions? | Docker |
| `self-hosted-runner.sh` | Anything the above cannot: a genuine runner, real job tokens, nothing simulated | Docker, a scratch repo, a registration token |
| `self-hosted-compare.yml` | The workflow to dispatch against that runner: two refs, twice each, state printed throughout | the above |
| `benchmark.sh` | How does installation time compare against the DeterminateSystems and Cachix installers? | Docker, optionally `act` |

## persistent-runner.sh

```
./verification/persistent-runner.sh          # the working tree
./verification/persistent-runner.sh main     # origin/main
```

One container stays alive while the action runs in it twice, which is what a
persistent runner amounts to for most purposes. It takes a git ref, so two
revisions can be compared: run it against a ref that misbehaves and against one
that should not, and read the difference.

It fabricates the between-runs conditions rather than waiting for them, which is
what makes it fast and repeatable. That also means it demonstrates a mechanism
rather than reproducing a failure exactly; for the latter, use the runner below.

## rpm-reinstall.sh

```
./verification/rpm-reinstall.sh
```

Covers a fresh install, a reinstall at the same version, a downgrade to a pinned
older version, and an upgrade back. rpm is stricter here than dpkg: `-i` and `-U`
both refuse a package at the version already installed, and `-U` alone refuses
to go backwards, so the flags matter and are easy to get wrong.

The command under test is read out of `scripts/install-flox.sh` rather than
repeated, so this cannot drift from what the action actually runs. Before
trusting a pass, change the command to something wrong and confirm it fails.

## self-hosted-runner.sh

```
GITHUB_REPOSITORY=owner/scratch-repo \
RUNNER_TOKEN=$(gh api -X POST \
  repos/owner/scratch-repo/actions/runners/registration-token --jq .token) \
  ./verification/self-hosted-runner.sh
```

Registers a real GitHub Actions runner and leaves it listening, so jobs land on
one machine in sequence. Nothing is simulated: state accumulates the way it does
on a customer's runner, and each job gets its own token, so a token recorded by
one job is genuinely dead by the next.

Use a scratch repository, not this one. The runner accepts any job that
repository schedules, and a registration token is a credential.

Then dispatch `self-hosted-compare.yml` (copy it into the scratch repository as
`.github/workflows/self-hosted-compare.yml`). It runs two refs twice each,
chained with `needs` so they stay in order on the one machine, and prints the
machine's state before and after every run. It deliberately asserts almost
nothing beyond "flox still works", because what counts as correct depends on
what is being investigated; add assertions to a copy once you know what you are
looking for.

## benchmark.sh

```
./verification/benchmark.sh              # all, via act
./verification/benchmark.sh docker       # raw containers instead
```

Predates the rest and answers a different question; it lives here because it is
the same kind of thing, a tool a developer runs deliberately rather than
something CI executes.
