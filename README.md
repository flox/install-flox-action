<h1 align="center">
  <a href="https://floxdev.com" target="_blank">
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
   <a href="https://discourse.floxdev.com"><b>Discourse</b></a>
   &emsp; | &emsp; 
   <a href="https://floxdev.com/docs"><b>Documentation</b></a>
   &emsp; | &emsp; 
   <a href="https://floxdev.com/blog"><b>Blog</b></a>
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

[flox][flox-website] is a command line tool that helps you **manage your
environments**. flox builds on top of the powerful ideas of [Nix][nix-website]
as well as making them accessible to everybody.


## 🚀 Getting Started

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
      uses: flox/install-flox-action@v1.0.0

    - name: Build
      run: flox build
```

### Using substituters for caching

You can have this action configure the substitutes for you. This will allow you to push build artifacts to a remote Nix store, and have subsequent builds substitute paths using that same store.

See [nix help-stores] for more information on the supported URIs.

[nix help-stores]: https://nixos.org/manual/nix/unstable/command-ref/new-cli/nix3-help-stores.html

The following example configures a S3 substituter, builds a package, and pushes the artifact to the substituter. Subsequent runs of this workflow will use the substituted path, instead of building it again.

```yml
name: "Build, push and use substituters"

on:
  push:

jobs:
  substituter-build:
    runs-on: ubuntu-latest
    steps:

    - name: Checkout
      uses: actions/checkout@v3

    - name: Install flox
      uses: flox/install-flox-action@testing
      with:
        github-access-token: ${{ secrets.NIX_GIT_TOKEN }}
        substituter: s3://your-cache-here # see `nix help-stores` for supported uris
        substituter-key: ${{ secrets.FLOX_STORE_PUBLIC_NIX_SECRET_KEY }}
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

    - name: Build
      run: |
        flox nix build --json -L --print-out-paths nixpkgs#hello

    - name: Cache
      run: |
        flox nix copy --to "$FLOX_SUBSTITUTER" -v nixpkgs#hello
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
[flox-website]: https://floxdev.com
[new-issue]: https://github.com/flox/install-flox-action/issues/new/choose
[discourse]: https://discourse.floxdev.com
[twitter]: https://twitter.com/floxdevelopment
[matrix]: https://matrix.to/#/#flox:matrix.org
[discord]: https://discord.gg/5H7hN57eQR
[nix-website]: https://nixos.org
