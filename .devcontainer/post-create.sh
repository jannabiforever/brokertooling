#!/bin/sh
# ponytail: a script instead of an inline postCreateCommand string. Zed's dev
# container runner joins a lifecycle command's argv with spaces into `sh -c`,
# so only the first word of an inline command survives. One word = this file.
set -e

# single-user nix lives in ~/.nix-profile and is only wired into ~/.bashrc,
# which this non-login sh never reads
. ~/.nix-profile/etc/profile.d/nix.sh

mkdir -p ~/.config/nix
echo 'experimental-features = nix-command flakes' > ~/.config/nix/nix.conf

# the flake is the single toolchain definition; direnv loads it in every shell
nix profile install nixpkgs#direnv
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
direnv allow
nix develop --command pnpm install --frozen-lockfile
