# Docker Compose 运行手册

## 本地演示栈

从仓库根目录运行：

```bash
docker compose up --build
```

Compose 会启动 PostgreSQL、Redis、API、worker 和 Web。API 容器在监听前执行全部 Prisma migration，其中包括分区时序表和物化视图。默认配置仅适用于本地 Mock 支付演示。

| 服务 | 地址 | 用途 |
| --- | --- | --- |
| Web | http://localhost:8080 | React 控制台，`/api` 反向代理到 API |
| API | http://localhost:3000/api | API 根路径 |
| Swagger | http://localhost:3000/api/docs | OpenAPI UI |
| Liveness | http://localhost:3000/api/health | API 进程检查 |
| Readiness | http://localhost:3000/api/health/ready | API + PostgreSQL 检查 |

停止服务并保留数据：

```bash
docker compose down
```

清除本地演示数据：

```bash
docker compose down --volumes
```

## 生产配置

生产环境必须在部署平台的密钥管理中设置 `JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET` 和 `RECONCILE_INTERNAL_TOKEN`，并替换 PostgreSQL 凭据。Compose 中的默认值只为本地开发提供无凭据启动路径，不能用于公网环境。

Web 镜像将 `/api/` 代理到 Compose 网络中的 `api:3000`。部署到其他编排平台时，应保留这一服务名网络关系，或在构建时通过 `VITE_API_BASE_URL` 指向实际 API 网关。
