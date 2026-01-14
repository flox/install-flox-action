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
Linux and macOS.

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
      uses: flox/install-flox-action@v2.1.0

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

### Example with custom inputs

```yml
- name: Install flox
  uses: flox/install-flox-action@v2.1.0
  with:
    channel: nightly
    retries: "5"
```

## 🚀 Caching

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
[new-issue]: https://github.com/flox/install-flox-action/issues/new/choose
[discourse]: https://discourse.flox.dev
[twitter]: https://twitter.com/floxdevelopment
[matrix]: https://matrix.to/#/#flox:matrix.org
[discord]: https://discord.gg/5H7hN57eQR
[post-nixpkgs]: https://flox.dev/blog/nixpkgs
[configure-nix-action]: https://github.com/flox/configure-nix-action
[flox-catalog]: https://flox.dev/docs/concepts/packages-and-catalog/
[floxhub]: https://hub.flox.dev
