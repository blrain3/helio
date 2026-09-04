import { useEffect, useRef, useState } from 'react';
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
  Menu,
  X,
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
  const [isMobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function closeMobileNavigation() {
    setMobileNavigationOpen(false);
    menuButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!isMobileNavigationOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileNavigation();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', dismissOnEscape);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [isMobileNavigationOpen]);

  return (
    <div className="flex min-h-screen min-w-0 overflow-x-hidden bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <Brand />
        <Navigation />
        <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-400">太阳能能源监控平台</div>
      </aside>

      {isMobileNavigationOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={closeMobileNavigation}
            className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden"
          />
          <aside
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="主导航菜单"
            className="fixed inset-y-0 left-0 z-40 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col border-r border-slate-200 bg-white shadow-xl lg:hidden"
          >
            <Brand
              closeButtonRef={closeButtonRef}
              onClose={closeMobileNavigation}
            />
            <Navigation onNavigate={closeMobileNavigation} />
            <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-400">太阳能能源监控平台</div>
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-60">
        <header className="sticky top-0 z-10 flex h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="打开导航菜单"
              aria-controls="mobile-navigation-drawer"
              aria-expanded={isMobileNavigationOpen}
              title="打开导航菜单"
              onClick={() => setMobileNavigationOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="truncate text-sm text-slate-500">Helio 控制台</div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
              管
            </span>
            <span className="hidden text-slate-700 sm:inline">管理员</span>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Brand({
  closeButtonRef,
  onClose,
}: {
  closeButtonRef?: React.RefObject<HTMLButtonElement | null>;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400 text-sm font-bold text-slate-900">H</span>
      <span className="text-lg font-semibold">Helio</span>
      {onClose && (
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="关闭导航菜单"
          title="关闭导航菜单"
          onClick={onClose}
          className="ml-auto grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="主导航" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => onNavigate?.()}
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
  );
}
