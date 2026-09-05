# Helio

Helio 是一个太阳能电站运营控制台。它覆盖电站与设备管理、计量计费、订单支付、异步结算、异常检测和对账，并将浏览器操作连接到 NestJS API、PostgreSQL、Redis 与 BullMQ worker。

## 已验证能力

- JWT 登录、刷新令牌轮换和按用户归属的资源访问控制。
- 电站、设备、账单、订单、支付、退款与异常处理的控制台交互。
- 受控 Mock 支付演示：支付回调经 API 验签、入队并由 worker 将订单结算为 `COMPLETED`。
- PostgreSQL 分区时序表、Redis 队列、OpenAPI 生成的 TypeScript API client。
- Vitest 单元测试、PostgreSQL/Redis Testcontainers 集成测试、Playwright 浏览器流程和 GitHub Actions 质量门禁。

微信和支付宝适配器保留在支付网关边界，但本仓库没有宣称或演示真实渠道结算；自动化和本地展示只使用 Mock 支付。

## 快速开始

```bash
pnpm install
docker compose up --build -d
```

等待 API ready 后打开以下本地地址：

| 服务 | 地址 |
| --- | --- |
| Web 控制台 | http://localhost:8080 |
| Swagger | http://localhost:3000/api/docs |
| API liveness | http://localhost:3000/api/health |
| API readiness | http://localhost:3000/api/health/ready |

本地 Compose 默认开启受控 Mock 演示。部署到公网前，必须设置强随机 JWT 与内部请求密钥，并显式设置 `NODE_ENV=production` 和 `MOCK_PAYMENT_DEMO_ENABLED=false`。详见 [部署手册](docs/DEPLOYMENT.md)。

## 质量命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

## 文档

- [展示与交付证据](docs/SHOWCASE.md)
- [演示流程与录屏命令](docs/DEMO.md)
- [架构说明](docs/ARCHITECTURE.md)
- [本地开发](docs/DEVELOPMENT.md)
- [测试计划](docs/TEST-PLAN.md)
- [部署手册](docs/DEPLOYMENT.md)

## 技术栈

pnpm + Turborepo、React 19、TypeScript strict、NestJS + Fastify、Prisma + PostgreSQL、Redis + BullMQ、OpenAPI、Vitest、Testcontainers、Playwright、Docker Compose 和 GitHub Actions。
