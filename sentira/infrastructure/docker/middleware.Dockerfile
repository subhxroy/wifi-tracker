FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types ./packages/types
COPY packages/middleware ./packages/middleware

RUN pnpm install --frozen-lockfile --only-built-dependencies

EXPOSE 4400
CMD ["pnpm", "--filter", "@sentira/middleware", "start"]
