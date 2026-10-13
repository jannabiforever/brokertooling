# syntax=docker/dockerfile:1
FROM node:24-slim AS build

RUN npm install -g pnpm@12.9.0
WORKDIR /repo

# manifests first so the dependency layer caches across source changes;
# pnpm needs every workspace manifest to validate the frozen lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
COPY packages/api/package.json packages/api/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @personalos/client...

COPY packages/api packages/api
COPY apps/client apps/client
# sync manually because --ignore-scripts skipped the client's prepare hook
RUN pnpm --filter @personalos/client exec svelte-kit sync && pnpm --filter @personalos/client build

# adapter-static output is a plain SPA: serve it with nginx, which also
# proxies the API routes to the server container (see nginx.conf)
FROM nginx:alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/client/build /usr/share/nginx/html

EXPOSE 80
