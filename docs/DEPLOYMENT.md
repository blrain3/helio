# 部署手册

## 本地 Compose 演示

从仓库根目录执行：

```bash
docker compose up --build -d
docker compose ps
```

Compose 启动 PostgreSQL、Redis、API、worker 与 Web。API 容器在监听前执行全部 Prisma migration，包括分区时序表和物化视图。默认环境用于本地 Mock 支付展示：`NODE_ENV=development`、`PAYMENT_PROVIDER=mock` 与 `MOCK_PAYMENT_DEMO_ENABLED=true`。

| 服务 | 地址 | 用途 |
| --- | --- | --- |
| Web | http://localhost:8080 | React 控制台，`/api` 反向代理到 API |
| API | http://localhost:3000/api | API 根路径 |
| Swagger | http://localhost:3000/api/docs | OpenAPI UI |
| Liveness | http://localhost:3000/api/health | API 进程检查 |
| Readiness | http://localhost:3000/api/health/ready | API + PostgreSQL 检查 |

停止服务并保留卷：

```bash
docker compose down
```

清除本地演示数据：

```bash
docker compose down --volumes
```

## 公网部署前置条件

当前仓库没有已授权的托管账号、DNS、镜像仓库或可访问的公网目标，因此没有填写公共 URL。先在部署平台的密钥管理中提供以下值：

- `JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`INTERNAL_REQUEST_SECRET`：强随机且互不复用。
- PostgreSQL 连接信息与持久化存储。
- `PAYMENT_PROVIDER` 的真实渠道凭据，仅在完成渠道接入验收后设置。

公网环境至少覆盖本地演示默认值：

```bash
$env:NODE_ENV = 'production'
$env:MOCK_PAYMENT_DEMO_ENABLED = 'false'
$env:JWT_ACCESS_SECRET = '<strong-random-secret>'
$env:JWT_REFRESH_SECRET = '<strong-random-secret>'
$env:INTERNAL_REQUEST_SECRET = '<strong-random-secret>'
docker compose up --build -d
```

Web Nginx 使用 Compose 网络中的 `api:3000` 代理 `/api/`。部署到其他编排平台时，保持该服务发现关系，或在 Web 构建时通过 `VITE_API_BASE_URL` 指向实际 API 网关。

## 可选镜像发布

`.github/workflows/publish-images.yml` 只允许手动触发。它先检查镜像仓库变量与密钥，缺失时跳过发布；具备以下值后才会登录并发布 API、worker、Web 镜像：

- Actions variables: `HELIO_REGISTRY`、`HELIO_IMAGE_PREFIX`
- Actions secrets: `HELIO_REGISTRY_USERNAME`、`HELIO_REGISTRY_PASSWORD`

镜像发布不等同于部署。发布后，在已授权的目标环境执行 Compose，并验证：

```bash
curl -fsS https://<api-host>/api/health
curl -fsS https://<api-host>/api/health/ready
curl -fsS https://<api-host>/api/docs
curl -fsS https://<web-host>/
```

只有四个端点均可访问后，才将实际 URL 写入 README 和 `docs/SHOWCASE.md`。
