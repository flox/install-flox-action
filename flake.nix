{
  description = "Installs flox on GitHub Actions for the supported platforms: GNU/Linux and macOS.";

  nixConfig.extra-substituters = [
    "https://cache.flox.dev"
  ];
  nixConfig.extra-trusted-public-keys = [
    "flox-store-public-0:8c/B+kjIaQ+BloCmNkRUKwaVPFWkriSAd0JJvuDu4F0="
  ];

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem
      (system: let
         pkgs = nixpkgs.legacyPackages.${system};
       in
       {
         devShells.default = pkgs.mkShell {
           name = "install-flox-action";
           packages = with pkgs; [
             nodejs_20
           ];
         };
       }
      );
}
