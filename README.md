<h1 align="center">
  <a href="https://flox.dev" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)"  srcset="img/flox_orange_small.png" />
      <source media="(prefers-color-scheme: light)" srcset="img/flox_blue_small.png" />
      <img src="img/flox_blue_small.png" alt="flox logo" />
    </picture>
  </a>
</h1>

<h2 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)"  srcset="img/harness_the_power_of_nix_dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="img/harness_the_power_of_nix_light.svg" />
    <img height="24" src="img/harness_the_power_of_nix_light.svg" alt="Harness the Power of Nix" />
  </picture>
</h2>

<!-- TODO: here comes the graphic
 show immediate value proposition
 a short demo of basics would be good for now
 a bold statement: Free yourself from container walls.
-->

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
  <a href="https://github.com/flox/install-flox-action/blog/main/LICENSE">
    <img alt="GitHub" src="https://img.shields.io/github/license/flox/install-flox-action?style=flat-square">
  </a>
  <a href="https://github.com/flox/install-flox-action/blog/main/CONTRIBUTING.md">
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
(nixpkgs)][post-nixpkgs] that contains **more than 80.000 packages**.


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
      uses: actions/checkout@v3

    - name: Install flox
      uses: flox/install-flox-action@v2

    - name: Build
      run: flox build
```

## 📫 Have a question? Want to chat? Ran into a problem?

We are happy to welcome you to our [Discourse forum][discourse] and answer your
questions! You can always reach out to us directly via the [flox twitter
account][twitter] or chat to us directly on [Matrix][matrix] or
[Discord][discord].


## 🤝 Found a bug? Missing a specific feature?

Feel free to [file a new issue][new-issue] with a respective title and
description on the the `flox/install-flox-action` repository. If you already
found a solution to your problem, we would love to review your pull request!


## 🪪 License

The install-flox-action is licensed under the MIT. See [LICENSE](./LICENSE).


[flox-github]: https://github.com/flox/flox 
[flox-website]: https://flox.dev
[new-issue]: https://github.com/flox/install-flox-action/issues/new/choose
[discourse]: https://discourse.flox.dev
[twitter]: https://twitter.com/floxdevelopment
[matrix]: https://matrix.to/#/#flox:matrix.org
[discord]: https://discord.gg/5H7hN57eQR
[nix-website]: https://nixos.org
[nix-help-stores]: https://nixos.org/manual/nix/unstable/command-ref/new-cli/nix3-help-stores.html
[post-nixpkgs]: https://flox.dev/blog/nixpkgs
