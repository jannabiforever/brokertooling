# CLAUDE.md

pnpm workspace, TypeScript 7 (tsgo), Effect 4.

## Map

```
apps/          deployables
  server/      @template/server   Effect HttpApi server for @template/api
  client/      @template/client   SvelteKit SPA, adapter-static + ssr off (own tsconfig, svelte-check; dev proxy → server)
packages/      libraries, consumed from src/ (no build step)
  api/         @template/api      contract: schemas, errors, HttpApiGroups
```

Dependency direction: `server → api`. Nothing in `packages/` imports from `apps/`.

## Commands (repo root)

```sh
pnpm install
pnpm lint          # oxlint, type-aware, effecttsgo plugin
pnpm format        # prettier
pnpm typecheck     # tsc (tsgo)
pnpm test          # vitest + @effect/vitest
pnpm dev           # server with --watch
pnpm dev:client    # vite dev server, proxies API routes to :3000
```

## Conventions

- One `effect` version via the pnpm catalog (`pnpm-workspace.yaml`).
- Root `tsconfig.json` covers every `src/`; `@effect/language-service` enforces deterministic service/error keys.
- Tests co-located as `*.test.ts`, written with `it.effect` from `@effect/vitest`.
- New API domain = `packages/api/src/<d>.ts` + `apps/server/src/<d>.ts` + barrel line in `packages/api/src/index.ts` + entry in the `Layer.provide` tuple in `apps/server/src/index.ts`.
- Run `pnpm typecheck && pnpm lint` before calling a task done (the Stop hook enforces it).
