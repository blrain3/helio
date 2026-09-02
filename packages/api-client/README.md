# @helio/api-client

本包由后端 OpenAPI spec 自动生成，是前后端 API 契约的单一来源。

## 生成流程

1. 后端启动后，OpenAPI spec 暴露于 `http://localhost:3000/api/docs-json`
2. 导出 spec 到本包同级目录：`apps/api/openapi.json`
3. 运行生成命令：

```bash
pnpm --filter @helio/api-client generate
```

## 版本策略

- 本包版本跟随后端 API 版本（如 `api-client@1.2.3` 对应 API v1.2.3）
- 前端通过 `pnpm update @helio/api-client` 手动同步，避免每次后端提交都触发前端重构建
- 后端 API 遵循语义化版本：minor 向后兼容，major 允许破坏性变更并提前通知

## 注意

- `src/schema.d.ts` 为生成产物，勿手改
- 不要在此手写业务逻辑，仅作为类型契约层
