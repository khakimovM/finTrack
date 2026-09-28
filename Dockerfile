# One image, one process: the API also serves the built web app, so the site and the API share
# one origin (first-party cookies, no CORS) and Railway runs a single service.

FROM node:22-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ---------------------------------------------------------------------------
# build: all dependencies, then shared → api → web
# ---------------------------------------------------------------------------
FROM base AS build
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# The root "prepare" script installs git hooks (husky); there is no git repository here.
RUN npm pkg delete scripts.prepare && npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm --workspace=api run db:generate \
 && npm --workspace=@fintrack/shared run build \
 && npm --workspace=api run build \
 && npm --workspace=web run build

# ---------------------------------------------------------------------------
# deps: production dependencies of the API and the shared package only
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/api/prisma apps/api/prisma
RUN npm pkg delete scripts.prepare \
 && npm ci --omit=dev --workspace=api --workspace=@fintrack/shared \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && mkdir -p apps/api/node_modules packages/shared/node_modules \
 && npm cache clean --force

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM base AS runtime
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production \
    PORT=5000 \
    WEB_DIST_DIR=/app/apps/web/dist

COPY --from=deps --chown=node:node /app/package.json ./package.json
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps --chown=node:node /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist

USER node
EXPOSE 5000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/api/dist/main.js"]
