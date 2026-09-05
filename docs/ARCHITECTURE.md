# 架构说明

Helio 使用模块化单体：API 保持业务规则和授权边界，Web 只负责会话展示与交互，worker 独立消费异步领域事件。

```text
React Web -> /api proxy -> NestJS API -> PostgreSQL
                           |       \
                           |        -> Redis/BullMQ -> worker -> PostgreSQL
                           -> OpenAPI -> @helio/api-client
```

## 业务模块

- `auth` 与 `user`：JWT access/refresh token、设备会话、角色与当前用户。
- `energy`：电站、设备、时序能耗记录、统计与异常规则。
- `billing` 与 `order`：计费费率、账单、订单状态机。
- `payment`：支付流水、Mock 回调、退款、对账差异和内部 worker 请求。

## 数据与异步边界

Prisma 管理业务表；PostgreSQL migration 创建分区 `energy_record` 与每日发电物化视图。API 在支付成功后写入订单状态并向 `settlement` 队列发布事件。worker 仅在订单为 `PAID` 时将其更新为 `COMPLETED`，并同步账单状态。

## 安全边界

资源读取与状态变更都在 API 应用服务层验证所有权；只有被允许的操作员或管理员可进行特权操作。worker 的内部 HTTP 调用使用短期 HMAC、请求体哈希和 Redis nonce 重放保护。浏览器不能提交 Mock 回调内容，服务端根据已存储的支付记录生成签名回调。

## 运行拓扑

Docker Compose 将 API、worker、PostgreSQL、Redis 与 Nginx Web 放到同一网络。容器使用 `postgres`、`redis` 和 `api` 服务名，不依赖容器内 `localhost`。详情见 [部署手册](DEPLOYMENT.md)。
