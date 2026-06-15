import { NavLink, Outlet } from 'react-router';
import { clsx } from 'clsx';
import {
  Home,
  LayoutDashboard,
  Sun,
  Cpu,
  Receipt,
  ShoppingCart,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import type { ComponentType } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/dashboard', label: '运营看板', icon: LayoutDashboard },
  { to: '/plants', label: '电站管理', icon: Sun },
  { to: '/devices', label: '设备管理', icon: Cpu },
  { to: '/bills', label: '账单', icon: Receipt },
  { to: '/orders', label: '订单', icon: ShoppingCart },
  { to: '/payments', label: '支付退款', icon: CreditCard },
  { to: '/anomalies', label: '异常告警', icon: AlertTriangle },
];

/** 应用外壳：左侧导航 + 顶部栏 + 内容区。 */
export function AppShell() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* 侧边导航 */}
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400 text-sm font-bold text-slate-900">
            H
          </span>
          <span className="text-lg font-semibold">Helio</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-yellow-50 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-400">
          太阳能能源监控平台
        </div>
      </aside>

      {/* 内容区 */}
      <div className="ml-60 flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur">
          <div className="text-sm text-slate-500">Helio 控制台</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
              管
            </span>
            <span className="text-slate-700">管理员</span>
          </div>
        </header>
        <main className="flex-1 px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
