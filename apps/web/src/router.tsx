import { createBrowserRouter, redirect, type LoaderFunctionArgs } from 'react-router';
import { AppShell } from './components/AppShell';
import { browserSessionStore } from './lib/session';

function requireSession({ request }: LoaderFunctionArgs) {
  if (browserSessionStore.getSession()) {
    return null;
  }

  const url = new URL(request.url);
  const redirectTo = `${url.pathname}${url.search}`;
  throw redirect(`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`);
}

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
    loader: requireSession,
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
