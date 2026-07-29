# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A GitHub Action that installs [flox](https://github.com/flox/flox) on GitHub Actions runners. Supports Linux (deb/rpm) and macOS (pkg) on both x64 and arm64.

## Development Commands

```bash
# Enter development environment (uses flox with Node.js 20)
flox activate

# Install dependencies (required before running checks)
npm install

# Run all checks (format, test, package)
npm run all

# Individual commands
npm run format:check      # Check formatting
npm run format:write      # Fix formatting
npm run ci-test           # Run tests only
npm run test              # Run tests + generate coverage badge
npm run package           # Bundle with ncc to dist/
```

## Architecture

The action is a JavaScript GitHub Action (node24 runtime) that:

1. **Entry**: `src/index.js`, which runs `main.run()` or, in the job's post step, `cleanup.run()`
2. **Core logic**: `src/main.js`
   - `getDownloadUrl()` - Determines platform-specific download URL based on OS, arch, and package manager (dpkg vs rpm)
   - `run()` - Main entry: decides how flox gets installed, configures Nix and flox, emits outputs
3. **Nix config**: `src/nixconf.js` - Paths, the legacy-block stripper, and the root-owned reads and writes shared with the post step
4. **Post step**: `src/cleanup.js` - Removes the config file holding the job's token
5. **Installation**: `scripts/install-flox.sh` - Bash script handling download (curl with retries) and platform-specific installation (rpm/dpkg/installer)

**Key behaviors**:
- Installation is chosen by looking for `flox` first, then `nix`. Already present means skip, unless `force-reinstall` or a mismatched `version` pin says otherwise; a foreign Nix with no flox means `nix profile install`; neither means the platform package
- Nix settings go in a per-job file under `/etc/nix/`, named for the run and pulled in by a matching `!include` line, so repeated runs on one machine stay correct and concurrent jobs do not delete each other's tokens
- Config file writes go over stdin, never in a command line: `@actions/exec` echoes commands into the job log, and `nix.conf` may hold a token the action did not write and cannot mask
- Supports channels: `stable`, `qa`, `nightly`, or commit hash
- Download and installation retries are configurable via `retries` input
- Sets `FLOX_DISABLE_METRICS` env var and configures flox accordingly

## Where CI cannot help

A green CI run does not cover three things, so treat it as insufficient evidence
whenever a change touches them:

- **Behavior on a machine that already ran the action.** Every hosted-runner job
  starts on a fresh VM, so anything involving state left behind by a previous run
  is invisible to CI.
- **rpm.** The matrix is Ubuntu and macOS; the rpm branch of
  `scripts/install-flox.sh` is never executed there.
- **Real job tokens across jobs.** The token GitHub grants a job dies with it, and
  CI cannot show what a later job on the same machine inherits.

`verification/` holds by-hand checks for exactly these, with a README explaining
what each answers and what it needs. Reach for them rather than assuming; the
rpm flags in `install-flox.sh` were once wrong in a way that passed review twice
and could only be settled by running it.

## Testing

Tests are in `src/index.test.js` using Jest. The action is also tested end-to-end in CI across Ubuntu/macOS with stable/nightly channels.

## Bundling

The action must be bundled before committing changes:
```bash
npm run package  # Outputs to dist/index.js
```

The `dist/` folder is checked into git (required for GitHub Actions).
