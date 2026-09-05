# Helio Worker 镜像（与 api 共用代码，独立进程入口）
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @helio/api prisma:generate
RUN pnpm --filter @helio/worker build

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app/apps/worker
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/worker/node_modules ./node_modules
COPY --from=builder /app/apps/worker/dist ./dist
CMD ["node", "dist/main.js"]
