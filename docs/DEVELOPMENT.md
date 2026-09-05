# 本地开发

## 前置条件

- Node.js 20 或更高版本
- pnpm 9
- Docker Desktop，用于 PostgreSQL、Redis 和完整 Compose 演示

## 安装与环境

```bash
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
docker compose up postgres redis -d
pnpm --filter @helio/api prisma:generate
pnpm --filter @helio/api db:migrate
```

`apps/api/.env` 只供宿主机开发使用，不能提交。Compose 会自行注入服务名连接地址，因此完整 Compose 演示不需要该文件。

## 启动进程

在不同终端中运行：

```bash
pnpm --filter @helio/api dev
pnpm --filter @helio/worker dev
pnpm --filter @helio/web dev
```

Web 通过 `VITE_API_BASE_URL` 指向 API；默认开发地址为 `http://localhost:3000/api`。API 变更后运行 `pnpm contracts:generate` 更新 OpenAPI 类型，再运行 `pnpm contracts:check` 确认生成物已提交。

## 数据库与排障

```bash
pnpm --filter @helio/api db:seed
pwsh -File scripts/verify-compose.ps1
docker compose config --quiet
```

健康检查位于 `/api/health` 与 `/api/health/ready`。不要在本地 `.env`、文档或测试快照中记录真实支付密钥。
