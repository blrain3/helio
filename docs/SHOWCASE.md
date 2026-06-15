# 展示与交付证据

## 本地可访问入口

| 项目 | 地址 |
| --- | --- |
| Web 控制台 | http://localhost:8080 |
| Swagger | http://localhost:3000/api/docs |
| API readiness | http://localhost:3000/api/health/ready |

公开部署需要授权的托管与 DNS/镜像仓库凭据。当前没有可核验的公网端点，因此本文件不提供占位链接。

## 截图与视频复现

运行 [DEMO.md](DEMO.md) 中的 Compose 与 Playwright 命令后，将真实浏览器产物保存为以下路径：

| 场景 | 路径 |
| --- | --- |
| 桌面控制台 | `docs/assets/dashboard-desktop.png` |
| 移动控制台 | `docs/assets/dashboard-mobile.png` |
| Mock 支付结算 | `docs/assets/payment-completed.png` |

本次交付环境的 Docker 引擎不可用，因而没有提交无法核验的截图或视频。Docker 恢复后，按演示流程生成上述文件，再将链接加入本页。
