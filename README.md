<h1 align="center">
  <a href="https://flox.dev" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)"  srcset="img/flox-logo-white-on-black.png" />
      <source media="(prefers-color-scheme: light)" srcset="img/flox-logo-black-on-white.png" />
      <img src="img/flox-logo-black-on-white.png" alt="flox logo" />
    </picture>
  </a>
</h1>

<h2 align="center">
  Developer environments you can take with you
</h2>

<h3 align="center">
   &emsp;
   <a href="https://discourse.flox.dev"><b>Discourse</b></a>
   &emsp; | &emsp; 
   <a href="https://flox.dev/docs"><b>Documentation</b></a>
   &emsp; | &emsp; 
   <a href="https://flox.dev/blog"><b>Blog</b></a>
   &emsp; | &emsp;  
   <a href="https://twitter.com/floxdevelopment"><b>Twitter</b></a>
   &emsp;
</h3>

<p align="center">
  <a href="https://github.com/flox/install-flox-action/blob/main/LICENSE">
    <img alt="GitHub" src="https://img.shields.io/github/license/flox/install-flox-action?style=flat-square">
  </a>
  <a href="https://github.com/flox/flox/blob/main/CONTRIBUTING.md">
    <img alt="PRs Welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square"/>
  </a>
  <a href="https://github.com/flox/install-flox-action/releases">
    <img alt="GitHub tag (latest by date)" src="https://img.shields.io/github/v/tag/flox/install-flox-action?label=Version&style=flat-square">
  </a>
</p>

Installs [Flox][flox-github] on GitHub Actions for the supported platforms:
Linux and macOS. Available on the [GitHub Marketplace][marketplace].

[Flox][flox-website] is a virtual environment and package manager all in one. With Flox you 
create environments that layer and replace dependencies just where
it matters, making them portable across the full software lifecycle.

Install packages from [the biggest open source repository
(nixpkgs)][post-nixpkgs] that contains **more than 80,000 packages**.


## ⭐ Getting Started

Create `.github/workflows/ci.yml` in your repo with the following contents:

```yml
name: "CI"

on:
  pull_request:
  push:

jobs:
  tests:
    runs-on: ubuntu-latest
    steps:

      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Flox
        uses: flox/install-flox-action@v2

      - name: Build
        run: flox build
```

## ⚙️ Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `version` | Select a specific version from a channel | `""` |
| `channel` | One of: `stable`, `qa`, `nightly`, or a commit hash | `"stable"` |
| `disable-metrics` | Disable sending anonymous usage statistics to flox | `""` |
| `retries` | Number of retries for downloading and installing Flox | `"3"` |
| `use-cache` | Cache the downloaded flox package to speed up subsequent runs | `"true"` |
| `github-token` | GitHub token for Nix flake rate limiting | `${{ github.token }}` |
| `trusted-environments` | Comma-separated FloxHub envs to trust (e.g. `owner/env1,owner/env2`) | `""` |
| `extra-nix-config` | Additional Nix settings, one per line, written to the file this action owns | `""` |
| `extra-substituters` | Space-separated Nix binary cache URLs | `""` |
| `extra-substituter-keys` | Space-separated public keys for extra substituters | `""` |
| `proxy` | HTTP/HTTPS/SOCKS5 proxy URL for network requests | `""` |
| `disable-upgrade-notifications` | Suppress flox upgrade notifications in CI output | `"true"` |
| `write-summary` | Write a Flox installation summary to the job summary page | `"false"` |
| `extra-flox-config` | Key=value pairs for `flox config --set`, one per line | `""` |
| `force-reinstall` | Reinstall flox even when it is already present on the runner | `"false"` |

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `flox-version` | The installed flox version string |
| `flox-path` | Absolute path to the flox binary |
| `nix-detected` | Whether a Nix binary was found on `PATH` (`true`/`false`) |
| `flox-preinstalled` | Whether flox was already present and installation was skipped (`true`/`false`) |

### Example with custom inputs

```yml
- name: Install Flox
  uses: flox/install-flox-action@v2
  with:
    channel: nightly
    retries: "5"
```

### Example with extra substituters

```yml
- name: Install Flox
  uses: flox/install-flox-action@v2
  with:
    extra-substituters: "https://my-cache.example.com"
    extra-substituter-keys: "my-cache.example.com-1:abc123..."
```

## 🔧 Pre-installed Nix

When Nix is already present on the runner (e.g. from [cachix/install-nix-action][cachix-nix] or [DeterminateSystems/nix-installer-action][detsys-nix]), this action installs Flox via `nix profile install` instead of downloading a platform package. The `nix-detected` output will be `true` in this case.

> **Note:** The `use-cache` input has no effect in this path — there is no installer package to cache when installing via an existing Nix.

## 🖥️ Self-hosted and other persistent runners

GitHub-hosted runners start every job on a fresh machine. Self-hosted runners, and larger runners with a persistent disk, do not: whatever the previous job installed is still there when the next one starts. This action accounts for that in two ways.

**The runner needs `sudo` and `xz` present first.** Both are pre-dependencies of the flox `deb` and `rpm`, and `sudo` is needed regardless of how flox is installed, since this action uses it to write the Nix configuration. GitHub's hosted images carry both; a minimal self-hosted machine may not, in which case installation fails on the missing dependency and retries until it gives up. Install them as part of provisioning the runner.

**It looks for flox before it looks for Nix.** The flox packages ship their own Nix and symlink it into `/usr/bin`, so a runner that has already installed flox has a `nix` on `PATH` that this action put there. Checking for `flox` first tells the two situations apart. When flox is already present the installation is skipped, `flox-preinstalled` is set to `true`, and the run costs nothing beyond the configuration steps. Set `force-reinstall: true` to install the channel's current release on every run instead, or pin `version` to reinstall whenever the pinned version is newer than the one already installed.

**Downgrading in place fails with an error.** Flox brings its own Nix, and a Nix store cannot be read by a Nix older than the one that last wrote it, so installing an older flox over a newer one leaves a machine that breaks at first use rather than at install time. No package manager refuses the swap on those grounds, so the action checks before installing and stops. To move a runner back to an older version, remove flox and `/nix` from it and install again. A reference with no version ordering, a commit-hash channel for instance, cannot be checked this way; those are allowed through with a warning.

**It writes its Nix configuration fresh for every job.** The action writes its settings to a file under `/etc/nix/` named for the job that owns them, `install-flox-action-<run>-<attempt>-<id>.conf`, and adds one matching `!include` line to `/etc/nix/nix.conf`. A new file each job means the recorded `github-token` is never the expired one from a previous job, and it means a machine running several jobs at once gives each its own file: a shared one would let the first job to finish delete a token another job is still using. The post step removes this job's file and, with it, any include line whose file is gone, so a job killed before its post step ran does not leave litter behind. A stale token is worse than no token: Nix falls back to anonymous, rate-limited access when none is configured, but fails outright with `HTTP error 401` when it finds one that has expired.

When `nix.conf` already configures `access-tokens`, the job's token takes over the `github.com` entry and every other host is carried through unchanged. An expired token left on a persistent runner is indistinguishable from one you still rely on, and either way Nix fails with `HTTP error 401` rather than falling back to anonymous access, so the job's token wins and the log says when it did. To keep a `github.com` token of your own, set `github-token` to an empty string and the action writes none.

> **Note:** The token GitHub grants a job is written to a root-owned but world-readable file, because Nix has to be able to read it. A post-job step removes that file when the job ends. On a persistent runner, any job running in between can read it, so prefer a token scoped no wider than the job needs.

Versions before this one appended their settings directly into `nix.conf` beneath an `# Added by install-flox-action` comment. On the first run of a newer version that comment goes, along with the `access-tokens`, `extra-trusted-substituters`, and `extra-trusted-public-keys` lines below it, since those are the ones that go stale. Anything else in the old block came from your `extra-nix-config` and is left where it is.

Reinstalling installs the platform package, so on a runner that has both flox and an unrelated Nix, `force-reinstall` and a mismatched `version` pin both run the package installer rather than `nix profile install`. If that is not what you want on such a machine, leave both unset and the run will skip installation entirely.

## 🚀 Caching

This action involves two distinct caching layers.
### Installer package cache

The downloaded flox installer package (`.deb`/`.rpm`/`.pkg`) is cached by default using [GitHub Actions cache][gh-actions-cache]. This skips the download on subsequent runs — **the package is still installed every time**.

This only applies when Nix is _not_ pre-installed. See [Pre-installed Nix](#-pre-installed-nix) above.

To disable installer caching:

```yml
- name: Install Flox
  uses: flox/install-flox-action@v2
  with:
    use-cache: "false"
```

**Cache key format:** `install-flox/{channel}/{version}/{os}-{arch}-{ext}[/{date}]`

| Scenario | Key example | Behavior |
|----------|-------------|----------|
| Pinned version | `install-flox/stable/1.3.2/linux-x64-deb` | Immutable — cached once, reused until evicted |
| Floating version (default) | `install-flox/stable/latest/linux-x64-deb/2025-04-15` | Refreshed daily — one download per day per branch |

The cached file is stored in `$RUNNER_TEMP/flox-package-cache`. If you see unexpected cache misses, check the GHA logs for the `Attempting to restore cache with key:` line to confirm the key being used.

> **Note:** GitHub Actions caches are scoped to the branch, with fallback to the default branch. The repository-level cache limit is 10 GB with LRU eviction.

### Nix binary cache (package installation)

When you run `flox install` or `flox activate` in your workflow, Flox downloads pre-built packages from the [Flox Catalog][flox-catalog]. This is a separate cache layer from the installer cache above — it is always active and requires no configuration.

Packages that cannot be redistributed in binary form are built from source.

For custom packages, use `flox build` and `flox publish` to publish your own binaries to [FloxHub][floxhub].

> **Note:** If you're familiar with Nix and prefer managing your own binary cache infrastructure, see [flox/configure-nix-action][configure-nix-action]. This is significantly more complex and not recommended for most users.

## 📫 Questions?

Ask on [Discourse][discourse], [Matrix][matrix], [Discord][discord], or [Twitter][twitter].


## 🤝 Found a bug? Missing a specific feature?

[File an issue][new-issue] or open a pull request on the `flox/install-flox-action` repository.


## 🪪 License

MIT licensed. See [LICENSE](./LICENSE).


[flox-github]: https://github.com/flox/flox
[flox-website]: https://flox.dev
[marketplace]: https://github.com/marketplace/actions/install-flox
[new-issue]: https://github.com/flox/install-flox-action/issues/new/choose
[discourse]: https://discourse.flox.dev
[twitter]: https://twitter.com/floxdevelopment
[matrix]: https://matrix.to/#/#flox:matrix.org
[discord]: https://discord.gg/5H7hN57eQR
[post-nixpkgs]: https://flox.dev/blog/nixpkgs
[configure-nix-action]: https://github.com/flox/configure-nix-action
[flox-catalog]: https://flox.dev/docs/concepts/packages-and-catalog/
[floxhub]: https://hub.flox.dev
[cachix-nix]: https://github.com/cachix/install-nix-action
[detsys-nix]: https://github.com/DeterminateSystems/nix-installer-action
[gh-actions-cache]: https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows
