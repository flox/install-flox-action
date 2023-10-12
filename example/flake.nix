{
  description = "Example flake";

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
         packages.default = pkgs.writeShellScriptBin "example" ''
           echo "Hello example!"
         '';
       }
      );
}
