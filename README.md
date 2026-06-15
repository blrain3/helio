# Helio — 太阳能能源监控平台

Helio 是一个太阳能能源监控与管理平台，提供实时发电监控、数据分析、账单管理与支付功能。

## 核心特性

- **实时能源监控**：采集并展示发电数据、系统效率与历史趋势
- **数据分析**：聚合统计与智能异常检测（规则引擎 + 滚动统计 + z-score）
- **计费与账单**：计量 → 计费 → 订单 → 支付的完整闭环
- **多渠道支付**：接入微信支付 / 支付宝，含回调验签、幂等处理与日对账
- **多语言与主题**：i18n 国际化 + 深色/浅色主题

## 技术栈

| 层 | 技术 |
|---|---|
| 仓库形态 | pnpm + Turborepo Monorepo |
| 后端 | NestJS + Fastify Adapter |
| 前端 | React 19 + TypeScript strict + Vite + Tailwind 4 + shadcn/ui |
| 数据库 | PostgreSQL（原生分区 + 物化视图） |
| ORM | Prisma（业务数据）+ Raw SQL（时序/聚合） |
| 缓存 / 任务 | Redis + BullMQ |
| 认证 | JWT 双令牌 + Refresh Token Rotation + RBAC |
| 支付 | PaymentGateway + Mock / 微信 / 支付宝 |
| API 契约 | OpenAPI → 自动生成 TypeScript Client |
| 质量与交付 | Vitest + Testcontainers + Playwright + Docker Compose + GitHub Actions |

## 架构

Helio 采用**模块化单体（Modular Monolith）**架构：单一代码库内按业务域划分为多个模块，模块间通过公开接口通信，核心链路以领域事件 + BullMQ 异步解耦。

```
apps/
├── api/       # 后端 API（NestJS + Fastify Adapter）
├── web/       # 前端（React 19 + Vite）
└── worker/    # 异步任务进程（BullMQ 消费者）
packages/
├── api-client/  # OpenAPI 生成的 TypeScript Client
├── ui/          # 共享 UI 组件
└── config/      # 共享配置（TypeScript / ESLint）
```

后端按业务域划分为 7 个模块：`auth`、`user`、`energy`、`billing`、`order`、`payment`、`anomaly`（对账/结算属 `payment` 域，由 worker 定时任务触发）。

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 启动完整本地演示栈（PostgreSQL、Redis、API、worker、Web）
docker compose up --build
```

Web 位于 http://localhost:8080，Swagger 位于 http://localhost:3000/api/docs。
更多部署与健康检查说明见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 环境要求

- Node.js ≥ 20
- pnpm ≥ 9
- Docker（本地 PostgreSQL / Redis）

## License

见 LICENSE 文件。
