import { Link } from 'react-router';
import {
  LayoutDashboard,
  Sun,
  Cpu,
  Receipt,
  ShoppingCart,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { PageHeader } from '../../components/ui';

interface Entry {
  to: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const ENTRIES: Entry[] = [
  { to: '/dashboard', label: '运营看板', description: '发电量与能耗总览', icon: LayoutDashboard },
  { to: '/plants', label: '电站管理', description: '管理光伏电站', icon: Sun },
  { to: '/devices', label: '设备管理', description: '逆变器、电表与储能', icon: Cpu },
  { to: '/bills', label: '账单', description: '月度电费账单', icon: Receipt },
  { to: '/orders', label: '订单', description: '缴费订单', icon: ShoppingCart },
  { to: '/payments', label: '支付退款', description: '支付流水与退款', icon: CreditCard },
  { to: '/anomalies', label: '异常告警', description: '设备与数据告警', icon: AlertTriangle },
];

export function Component() {
  return (
    <div>
      <PageHeader
        title="欢迎使用 Helio"
        description="太阳能能源监控平台 — 集中管理电站、设备、账单、支付与告警。"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ENTRIES.map(({ to, label, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-yellow-300 hover:shadow"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 group-hover:bg-yellow-400 group-hover:text-slate-900">
                <Icon className="h-5 w-5" />
              </span>
              <span className="font-medium text-slate-900">{label}</span>
            </div>
            <p className="mt-3 text-sm text-slate-500">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
