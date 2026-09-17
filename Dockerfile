# syntax=docker/dockerfile:1.7
#
# Sawubona datahub image  →  ghcr.io/p-322/datahub
#
# Builds ONE app from this npm-workspaces/turbo monorepo (default: researcher)
# and ships Next.js standalone output: server.js + only the traced node_modules,
# ~200 MB instead of the full workspace install.
#
# Runtime config (SEARCH_ENDPOINT_URL, DATABASE_URL, CLERK_SECRET_KEY, NANOPUB_*)
# is injected by the host at `docker run`; nothing environment-specific is baked
# in EXCEPT NEXT_PUBLIC_* values, which Next.js inlines into the browser bundle
# at build time and therefore must be passed as build args.
#
#   docker build -t datahub \
#     --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... .
#   docker run --rm -p 3000:3000 --env-file datahub.env datahub
#   bash scripts/verify-image.sh datahub      # what CI runs before pushing

ARG NODE_VERSION=22
ARG APP=researcher

# ── 1. Install ───────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
# The whole tree is needed for a workspaces `npm ci` (every workspace's
# package.json participates in the lockfile). .dockerignore keeps it small.
COPY . .
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ── 2. Build ─────────────────────────────────────────────────────────────────
FROM deps AS builder
ARG APP
# Public, build-time values (inlined into the client bundle by Next.js).
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
ARG NEXT_PUBLIC_COMMUNITY_ENRICHMENT_LICENSE="https://creativecommons.org/licenses/by/4.0/"
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL=${NEXT_PUBLIC_CLERK_SIGN_IN_URL} \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=${NEXT_PUBLIC_CLERK_SIGN_UP_URL} \
    NEXT_PUBLIC_COMMUNITY_ENRICHMENT_LICENSE=${NEXT_PUBLIC_COMMUNITY_ENRICHMENT_LICENSE} \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
# BUILD-TIME PLACEHOLDERS for server-side config. `next build` imports every
# page and route module while "collecting page data", and many of them
# construct Zod-validated clients at module load (lib/*-instance.ts, api/*
# routes). Without values the build fails; with these it passes. They are NOT
# baked into the image: server code reads process.env when the container
# starts, so the real values from the host (Enterprise: /etc/enterprise/
# datahub.env + /run/datahub.env from 1Password) take effect at runtime. This
# stage's ENV does not carry over to the runner stage.
ENV SEARCH_ENDPOINT_URL=http://build-placeholder.invalid/search \
    SPARQL_ENDPOINT_URL=http://build-placeholder.invalid/sparql \
    NANOPUB_SPARQL_ENDPOINT_URL=http://build-placeholder.invalid/sparql \
    NANOPUB_WRITE_ENDPOINT_URL=http://build-placeholder.invalid/ \
    NANOPUB_WRITE_PROXY_ENDPOINT_URL=http://build-placeholder.invalid/ \
    DATASET_BROWSER_URL=http://build-placeholder.invalid/ \
    GEONAMES_USERNAME=build-placeholder \
    DATABASE_URL=mysql://build:placeholder@build-placeholder.invalid:3306/build \
    CLERK_SECRET_KEY=sk_test_build-placeholder
# Build only the target app and the workspace packages it depends on.
RUN npx turbo run build --filter=${APP}...

# ── 3. Run ───────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runner
ARG APP
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone output mirrors the monorepo layout: /app/apps/<APP>/server.js
# plus a pruned /app/node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/${APP}/public ./apps/${APP}/public

# ARG values are not available in CMD at runtime; resolve the path via a symlink.
RUN ln -s /app/apps/${APP} /app/current

USER nextjs
EXPOSE 3000
CMD ["node", "/app/current/server.js"]
