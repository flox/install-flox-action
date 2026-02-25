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

Installs [flox][flox-github] on GitHub Actions for the supported platforms:
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

    - name: Install flox
      uses: flox/install-flox-action@v2.2.0

    - name: Build
      run: flox build
```

## ⚙️ Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `version` | Select a specific version from a channel | `""` |
| `channel` | One of: `stable`, `qa`, `nightly`, or a commit hash | `"stable"` |
| `disable-metrics` | Disable sending anonymous usage statistics to flox | `"false"` |
| `retries` | Number of retries for downloading and installing Flox | `"3"` |
| `use-cache` | Cache the downloaded flox package to speed up subsequent runs | `"true"` |
| `github-token` | GitHub token for Nix flake rate limiting | `${{ github.token }}` |
| `trusted-environments` | Comma-separated FloxHub envs to trust (e.g. `owner/env1,owner/env2`) | `""` |
| `extra-nix-config` | Additional lines to append to `/etc/nix/nix.conf` | `""` |
| `extra-substituters` | Space-separated Nix binary cache URLs | `""` |
| `extra-substituter-keys` | Space-separated public keys for extra substituters | `""` |
| `proxy` | HTTP/HTTPS/SOCKS5 proxy URL for network requests | `""` |
| `disable-upgrade-notifications` | Suppress flox upgrade notifications in CI output | `"true"` |
| `extra-flox-config` | Key=value pairs for `flox config --set`, one per line | `""` |

## 📤 Outputs

| Output | Description |
|--------|-------------|
| `flox-version` | The installed flox version string |
| `flox-path` | Absolute path to the flox binary |
| `nix-detected` | Whether Nix was pre-installed (`true`/`false`) |

### Example with custom inputs

```yml
- name: Install flox
  uses: flox/install-flox-action@v2.2.0
  with:
    channel: nightly
    retries: "5"
```

### Example with extra substituters

```yml
- name: Install flox
  uses: flox/install-flox-action@v2.2.0
  with:
    extra-substituters: "https://my-cache.example.com"
    extra-substituter-keys: "my-cache.example.com-1:abc123..."
```

## 🔧 Pre-installed Nix

When Nix is already present on the runner (e.g. from [cachix/install-nix-action][cachix-nix] or [DeterminateSystems/nix-installer-action][detsys-nix]), this action installs Flox via `nix profile install` instead of downloading a platform package. The `nix-detected` output will be `true` in this case.

## 🚀 Package Download Caching

The downloaded flox installer package (`.deb`/`.rpm`/`.pkg`) is cached by default to speed up subsequent workflow runs. The actual package installation still runs every time -- caching only skips the download step.

To disable caching:

```yml
- name: Install flox
  uses: flox/install-flox-action@v2.2.0
  with:
    use-cache: "false"
```

**How cache keys work:**
- **Pinned version** (e.g., `version: "1.3.2"`): The cache key is immutable and lives until evicted by GitHub's LRU policy.
- **Unpinned/floating version** (default): The cache key includes today's date, so a fresh download happens once per day and is cached within that day.

> **Note:** GitHub Actions caches are scoped to the branch, with fallback to the default branch. The repository-level cache limit is 10 GB with LRU eviction.

## 🔄 Binary Caching

Most packages from Nixpkgs are available via the [Flox Catalog][flox-catalog]. These are pre-built and downloaded from the Flox binary cache, except for packages that cannot be redistributed in binary format.

For custom packages, use `flox build` and `flox publish` to get binary caching out of the box with a [FloxHub][floxhub] account.

> **Note:** If you're familiar with Nix and prefer managing your own infrastructure, see [flox/configure-nix-action][configure-nix-action] for setting up a custom binary cache. This is significantly more complex and not recommended for most users.

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
