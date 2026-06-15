# 测试计划

## 质量门禁

| 命令 | 覆盖范围 |
| --- | --- |
| `pnpm lint` | 全工作区与根级集成、E2E TypeScript 文件 |
| `pnpm typecheck` | 全工作区 strict TypeScript 与 API 测试配置 |
| `pnpm test` | API、worker、Web 和 API client 单元/组件测试 |
| `pnpm test:integration` | 临时 PostgreSQL 16、Redis 7、编译后 API 与 worker 的 Mock 支付结算 |
| `pnpm test:e2e` | Chromium 中登录、创建电站/账单/订单/支付并等待订单完成 |
| `pnpm build` | API、worker、Web 与共享包的生产构建 |

当前 `pnpm test` 包含 185 个测试用例：API 136、worker 3、Web 44、API client 2。其余两条独立流程分别覆盖一次真实容器支付链路和一次浏览器支付链路。

## CI

GitHub Actions 将质量门禁拆为 `quality`、`integration`、`e2e` 和 `build` 四个 job。`build` 依赖前三项；E2E 失败时上传 `output/playwright/` 中的 report、trace、截图和视频。

## 本地复现

集成与 E2E 测试使用 Testcontainers，因此需要可运行的 Docker 引擎。先执行 `docker desktop status`，再运行对应命令。若 Docker 引擎不可用，静态门禁仍可运行，但不能替代容器和浏览器验证。
