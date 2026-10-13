# effect-v4-template

pnpm workspace for Effect 4 services: a contract package (`@personalos/api`) and an HttpApi server (`@personalos/server`).

## Setup

```sh
direnv allow     # nix dev shell: node 24, pnpm
pnpm install
pnpm dev         # http://localhost:3000/health · /openapi.json
```

Or open in a devcontainer: `.devcontainer/` installs nix + direnv and runs `pnpm install` from the flake.

See [CLAUDE.md](CLAUDE.md) for the layout, commands and conventions.

## Rename

Replace `@personalos/` with your scope in `package.json` files, `CLAUDE.md` and `apps/server/src/*.ts`.
