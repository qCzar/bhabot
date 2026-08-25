FROM node:20-slim AS base

WORKDIR /app/bot

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# 1. Install production dependencies only using BuildKit cache mount
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# 2. Lean runtime container
FROM base AS runner
WORKDIR /app/bot

COPY package.json ./
COPY --from=prod-deps /app/bot/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

CMD ["pnpm", "start"]
