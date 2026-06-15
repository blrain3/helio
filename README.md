# Helio 太阳能能源监控平台

Helio 是一个面向家庭和运营人员的太阳能电站监控与运营平台。项目覆盖电站和设备管理、能源数据、计量计费、订单支付、退款、异步结算、异常检测与对账，并通过 React 客户端连接 NestJS API、PostgreSQL、Redis 和 worker 服务。

## 项目亮点

- JWT 登录、刷新令牌轮换、RBAC 和基于资源归属的权限校验。
- 电站、设备、账单、订单、支付、退款与异常事件的完整管理流程。
- Mock 支付闭环：创建订单、发起支付、签名回调、异步结算并完成订单。
- PostgreSQL 时序数据表、Redis 队列、BullMQ worker 和 OpenAPI 生成的 TypeScript API Client。
- Vitest 单元测试、Testcontainers 集成测试、Playwright E2E 和 GitHub Actions 质量门禁。
- `/client-demo` 客户端展示页，包含 AeroShards 全屏背景、能源指标和响应式布局。

真实微信和支付宝适配器只保留在支付网关边界，当前自动化测试与演示使用受控 Mock 支付。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、React Router、TanStack Query |
| 后端 | NestJS、Fastify、Prisma、OpenAPI |
| 数据与任务 | PostgreSQL、Redis、BullMQ |
| 工程化 | pnpm、Turborepo、Vitest、Testcontainers、Playwright、Docker Compose |
| 交付 | GitHub Actions、Nginx、VPS 部署 |

## 快速开始

```bash
pnpm install
docker compose up --build -d
```

等待服务 ready 后打开以下地址：

| 服务 | 地址 |
| --- | --- |
| Web 控制台 | http://localhost:8080 |
| 客户端 Demo | http://localhost:8080/client-demo |
| Swagger | http://localhost:3000/api/docs |
| API liveness | http://localhost:3000/api/health |
| API readiness | http://localhost:3000/api/health/ready |

本地 Compose 默认开启受控 Mock 演示。部署到公网前，必须设置强随机 JWT 密钥、数据库密码和内部请求密钥，并显式设置 `NODE_ENV=production` 与 `MOCK_PAYMENT_DEMO_ENABLED=false`。详见 [部署手册](docs/DEPLOYMENT.md)。

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

## 线上演示

- 客户端 Demo：[https://helio.salix.eu.org/client-demo](https://helio.salix.eu.org/client-demo)
- Swagger：部署后通过 `/api/docs` 访问

## 仓库结构

```text
apps/api       NestJS API 和 Prisma 数据层
apps/web       React 客户端与运营控制台
apps/worker    异步结算与对账任务
packages/      API Client、共享配置和 UI 包
docs/          架构、开发、测试、部署和展示材料
```
