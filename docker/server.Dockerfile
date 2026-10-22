# syntax=docker/dockerfile:1
FROM node:24-slim

RUN npm install -g pnpm@12.9.0
# Korean fallback font for figure rasterization (Latin serif is bundled in apps/server/fonts)
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-nanum \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# manifests first so the dependency layer caches across source changes;
# pnpm needs every workspace manifest to validate the frozen lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
COPY packages/api/package.json packages/api/
# --ignore-scripts: the root prepare hook (effect-tsgo patch) only matters for lint/typecheck
RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter @personalos/server...

# no build step: the server runs straight from TS source (Node 24 type stripping),
# and @personalos/api is consumed from src/ via the workspace symlink
COPY packages/api packages/api
COPY apps/server apps/server

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /repo/apps/server
CMD ["node", "src/index.ts"]
