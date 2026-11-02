# OpenLet API and worker (same image; the worker runs a different command).
FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter @openlet/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @openlet/shared build && pnpm --filter @openlet/api build

FROM base AS deps
RUN pnpm install --prod --frozen-lockfile --filter @openlet/api...

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app ./
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
WORKDIR /app/apps/api
EXPOSE 8130
# Apply database migrations, then start the API. The worker service overrides this command.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
