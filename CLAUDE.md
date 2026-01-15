# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A GitHub Action that installs [flox](https://github.com/flox/flox) on GitHub Actions runners. Supports Linux (deb/rpm) and macOS (pkg) on both x64 and arm64.

## Development Commands

```bash
# Enter development environment (uses flox with Node.js 20)
flox activate

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

The action is a JavaScript GitHub Action (node20 runtime) that:

1. **Entry**: `src/index.js` → calls `main.run()`
2. **Core logic**: `src/main.js`
   - `getDownloadUrl()` - Determines platform-specific download URL based on OS, arch, and package manager (dpkg vs rpm)
   - `run()` - Main entry: checks for existing Nix (fails if found), then downloads/installs flox
3. **Installation**: `scripts/install-flox.sh` - Bash script handling download (curl with retries) and platform-specific installation (rpm/dpkg/installer)

**Key behaviors**:
- Fails if Nix is already installed (flox includes its own Nix)
- Supports channels: `stable`, `qa`, `nightly`, or commit hash
- Download and installation retries are configurable via `retries` input
- Sets `DISABLE_METRICS` env var and configures flox accordingly

## Testing

Tests are in `src/index.test.js` using Jest. The action is also tested end-to-end in CI across Ubuntu/macOS with stable/nightly channels.

## Bundling

The action must be bundled before committing changes:
```bash
npm run package  # Outputs to dist/index.js
```

The `dist/` folder is checked into git (required for GitHub Actions).
