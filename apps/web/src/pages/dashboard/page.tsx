import { useQuery } from '@tanstack/react-query';
import { Sun, Zap, AlertTriangle, Cpu } from 'lucide-react';
import { api } from '../../lib/api';
import { fenToYuan, formatDateTime } from '../../lib/format';
import { PageHeader, StatCard, DataTable, StatusBadge, LoadingState } from '../../components/ui';

export function Component() {
  const plants = useQuery({ queryKey: ['plants'], queryFn: api.listPlants });
  const bills = useQuery({ queryKey: ['bills'], queryFn: api.listBills });
  const anomalies = useQuery({ queryKey: ['anomalies'], queryFn: api.listAnomalies });
  const devices = useQuery({ queryKey: ['devices'], queryFn: api.listDevices });

  const loading = plants.isLoading || bills.isLoading || anomalies.isLoading || devices.isLoading;

  const totalCapacity = (plants.data ?? []).reduce((s, p) => s + p.capacityKw, 0);
  const totalBilled = (bills.data ?? []).reduce((s, b) => s + b.amount, 0);
  const openAnomalies = (anomalies.data ?? []).filter((a) => a.status === 'OPEN').length;
  const onlineDevices = (devices.data ?? []).filter((d) => d.status === 'ONLINE').length;

  return (
    <div>
      <PageHeader title="运营看板" description="电站运行与账单全局概览。" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="装机容量"
          value={`${totalCapacity.toLocaleString('zh-CN')} kW`}
          hint={`${plants.data?.length ?? 0} 个电站`}
          icon={<Sun className="h-5 w-5" />}
        />
        <StatCard
          label="本期账单总额"
          value={fenToYuan(totalBilled)}
          hint={`${bills.data?.length ?? 0} 张账单`}
          icon={<Zap className="h-5 w-5" />}
        />
        <StatCard
          label="在线设备"
          value={`${onlineDevices} / ${devices.data?.length ?? 0}`}
          icon={<Cpu className="h-5 w-5" />}
        />
        <StatCard
          label="未解决告警"
          value={String(openAnomalies)}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-slate-500">电站运行状态</h2>
        {loading ? (
          <LoadingState />
        ) : (
          <DataTable
            columns={[
              { key: 'name', header: '电站', render: (p) => <span className="font-medium">{p.name}</span> },
              { key: 'location', header: '位置', render: (p) => p.location },
              { key: 'capacity', header: '容量 (kW)', render: (p) => p.capacityKw.toLocaleString('zh-CN') },
              { key: 'status', header: '状态', render: (p) => <StatusBadge status={p.status} /> },
              { key: 'createdAt', header: '接入时间', render: (p) => formatDateTime(p.createdAt) },
            ]}
            rows={plants.data ?? []}
          />
        )}
      </div>
    </div>
  );
}
