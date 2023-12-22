{
  description = "Installs flox on GitHub Actions for the supported platforms: GNU/Linux and macOS.";

  nixConfig.extra-substituters = [
    "https://cache.flox.dev"
  ];
  nixConfig.extra-trusted-public-keys = [
    "flox-cache-public-1:7F4OyH7ZCnFhcze3fJdfyXYLQw/aV7GEed86nQ7IsOs="
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
