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

## VPS + Nginx

生产部署使用 `docker-compose.production.yml` 覆盖本地 Compose。该覆盖文件不发布 PostgreSQL、Redis 或 API 端口；Web 仅监听 VPS 的 `127.0.0.1:8080`，由宿主机 Nginx 提供唯一的公网 HTTPS 入口。需要 Docker Compose v2.24 或更高版本以支持 `!reset` 和 `!override` 端口覆盖。

在 VPS 的仓库目录执行：

```bash
git fetch origin codex/helio-delivery
git checkout -B codex/helio-delivery origin/codex/helio-delivery
cp .env.production.example .env.production
chmod 600 .env.production
```

编辑 `.env.production`，用 `openssl rand -hex 32` 为 `POSTGRES_PASSWORD`、`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET` 和 `INTERNAL_REQUEST_SECRET` 生成互不复用的值，并把两个 URL 改为实际 HTTPS 域名。示例文件中的值不能用于生产环境。

启动并仅在 VPS 本机验证：

```bash
sudo docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml up --build -d
sudo docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml ps
curl -fsS http://127.0.0.1:8080/api/health/ready
```

安装 Nginx 与 Certbot，将 `deploy/nginx.conf.example` 的域名替换为实际域名后安装为 `/etc/nginx/sites-available/helio`，禁用 Nginx 默认站点并启用 Helio 站点：

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo install -m 644 deploy/nginx.conf.example /etc/nginx/sites-available/helio
sudo sed -i 's/helio.example.com/<domain>/g' /etc/nginx/sites-available/helio
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/helio /etc/nginx/sites-enabled/helio
sudo nginx -t
sudo systemctl enable --now nginx
sudo certbot --nginx --redirect --non-interactive --agree-tos --email <ops-email> -d <domain>
```

证书签发后，把 `.env.production` 中的 `FRONTEND_URL` 与 `WEBHOOK_BASE_URL` 改为 `https://<domain>`，然后重新执行生产 Compose 的 `up -d`。验证：

```bash
curl -fsS https://<domain>/api/health/ready
curl -fsS https://<domain>/api/docs
```

Cloudflare DNS 的 A 记录需要先指向 VPS。签发完成后，将 Cloudflare SSL/TLS 加密模式设为 `Full (strict)`。若 HTTP-01 验证被 Cloudflare 规则拦截，临时将该记录切为 DNS only，完成签发后再恢复代理。防火墙与云安全组仅放行 SSH、HTTP 和 HTTPS。
