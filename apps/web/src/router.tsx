import { createBrowserRouter } from 'react-router';

// 路由骨架：P0 页面（Dashboard/Analytics/账单/支付/登录）将在 M0–M4 实现
// P1（电站/设备/用户管理）在 M5–M6 补充，P2（设置/帮助）延后
export const router = createBrowserRouter([
  {
    path: '/',
    lazy: () => import('./pages/home/page'),
  },
  {
    path: '/dashboard',
    lazy: () => import('./pages/dashboard/page'),
  },
  {
    path: '/auth/login',
    lazy: () => import('./pages/auth/login'),
  },
]);
