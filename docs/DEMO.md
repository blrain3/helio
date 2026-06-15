# 演示流程

## 本地准备

启动 Compose 后创建演示用户和费率。以下 PowerShell 命令只使用本地 Mock 环境：

```powershell
docker compose up --build -d
$registration = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/register -ContentType 'application/json' -Body (@{ email = 'admin@helio.io'; password = 'admin123456'; deviceId = 'showcase-browser' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($registration.tokens.accessToken)" }
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/tariffs -Headers $headers -ContentType 'application/json' -Body (@{ unitPrice = 65; effectiveAt = '2026-01-01T00:00:00.000Z'; currency = 'CNY'; billingUnit = 'kWh' } | ConvertTo-Json)
```

打开 http://localhost:8080，以 `admin@helio.io` / `admin123456` 登录。

## 浏览器演示

1. 在电站页创建一个电站。
2. 在账单页为该电站生成并发出账单。
3. 在订单页创建订单并提交支付。
4. 在支付页创建模拟支付并点击完成模拟支付。
5. 返回订单页，状态显示为 `COMPLETED`。

Mock 回调只在 Compose 的本地演示默认值下开启。它不连接真实微信或支付宝渠道。

## 录屏与产物

在已启动的 Compose 栈和已创建演示用户的前提下，以下命令以 Playwright 录制完整流程：

```powershell
$env:E2E_BASE_URL = 'http://localhost:8080'
pnpm exec playwright test --config e2e/playwright.config.ts --video=on
```

视频、trace 和失败截图写入 `output/playwright/`。可将录制的视频上传到项目演示页；仓库只保存可复现命令和经过确认的静态截图。
