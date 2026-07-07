FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types ./packages/types
COPY packages/dashboard ./packages/dashboard

RUN pnpm install --frozen-lockfile --ignore-scripts

RUN pnpm --filter @sentira/dashboard build

EXPOSE 3000
CMD ["pnpm", "--filter", "@sentira/dashboard", "start"]
