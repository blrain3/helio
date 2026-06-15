import { createBrowserRouter } from 'react-router';
import { AppShell } from './components/AppShell';

/**
 * 路由配置：业务页面挂载在 AppShell（含侧边导航）下，
 * 登录页独立于外壳。
 */
export const router = createBrowserRouter([
  {
    path: '/auth/login',
    lazy: () => import('./pages/auth/login'),
  },
  {
    element: <AppShell />,
    children: [
      {
        path: '/',
        lazy: () => import('./pages/home/page'),
      },
      {
        path: '/dashboard',
        lazy: () => import('./pages/dashboard/page'),
      },
      {
        path: '/plants',
        lazy: () => import('./pages/plants/page'),
      },
      {
        path: '/devices',
        lazy: () => import('./pages/devices/page'),
      },
      {
        path: '/bills',
        lazy: () => import('./pages/bills/page'),
      },
      {
        path: '/orders',
        lazy: () => import('./pages/orders/page'),
      },
      {
        path: '/payments',
        lazy: () => import('./pages/payments/page'),
      },
      {
        path: '/anomalies',
        lazy: () => import('./pages/anomalies/page'),
      },
    ],
  },
]);
