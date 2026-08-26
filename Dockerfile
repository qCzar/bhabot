FROM node:20-alpine AS base

WORKDIR /app/bot

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# 1. Build stage: Install all dependencies and compile TypeScript to JS
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# 2. Production dependencies stage
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

# 3. Minimal Alpine runtime container
FROM node:20-alpine AS runner
WORKDIR /app/bot

ENV NODE_ENV=production

COPY package.json ./
COPY --from=prod-deps /app/bot/node_modules ./node_modules
COPY --from=builder /app/bot/build ./build

CMD ["node", "build/Main.js"]
