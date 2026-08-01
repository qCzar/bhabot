FROM node:20-slim

WORKDIR /app/bot

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production

CMD ["pnpm", "start"]
