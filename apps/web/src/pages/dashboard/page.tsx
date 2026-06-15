import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sun, Zap, AlertTriangle, Cpu } from 'lucide-react';
import { api, queryKeys } from '../../lib/api';
import { fenToYuan, formatDateTime } from '../../lib/format';
import { PageHeader, StatCard, DataTable, EmptyState, StatusBadge } from '../../components/ui';
import { EnergyTrendChart } from '../../components/charts/EnergyTrendChart';
import { QueryFeedback } from '../../components/feedback/QueryFeedback';

export function Component() {
  const plants = useQuery({ queryKey: ['plants'], queryFn: api.listPlants });
  const bills = useQuery({ queryKey: ['bills'], queryFn: api.listBills });
  const anomalies = useQuery({ queryKey: ['anomalies'], queryFn: api.listAnomalies });
  const devices = useQuery({ queryKey: ['devices'], queryFn: api.listDevices });
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const { start, end } = getTrendRange();
  const activePlantId = selectedPlantId || plants.data?.[0]?.id;
  const dailyEnergy = useQuery({
    queryKey: queryKeys.dailyEnergy(activePlantId ?? 'none', start, end),
    queryFn: () => api.listDailyEnergy(activePlantId!, start, end),
    enabled: Boolean(activePlantId),
  });

  const primaryLoading = plants.isLoading || bills.isLoading || anomalies.isLoading || devices.isLoading;
  const primaryError = plants.error ?? bills.error ?? anomalies.error ?? devices.error;

  const totalCapacity = (plants.data ?? []).reduce((s, p) => s + p.capacityKw, 0);
  const totalBilled = (bills.data ?? []).reduce((s, b) => s + b.amount, 0);
  const openAnomalies = (anomalies.data ?? []).filter((a) => a.status === 'OPEN').length;
  const onlineDevices = (devices.data ?? []).filter((d) => d.status === 'ONLINE').length;

  function retryPrimaryQueries() {
    void Promise.all([plants.refetch(), bills.refetch(), anomalies.refetch(), devices.refetch()]);
  }

  return (
    <div>
      <PageHeader title="运营看板" description="电站运行与账单全局概览。" />

      <QueryFeedback isLoading={primaryLoading} error={primaryError} onRetry={retryPrimaryQueries}>
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
        </div>

        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-slate-700">发电趋势</h2>
              <p className="mt-1 text-xs text-slate-500">近 7 日按日电量汇总。</p>
            </div>
            <label className="sr-only" htmlFor="trend-plant">
              趋势电站
            </label>
            <select
              id="trend-plant"
              value={activePlantId ?? ''}
              onChange={(event) => setSelectedPlantId(event.target.value)}
              className="min-w-44 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
            >
              {(plants.data ?? []).map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </select>
          </div>
          {!activePlantId ? (
            <EmptyState message="创建电站后即可查看发电趋势" />
          ) : (
            <QueryFeedback
              isLoading={dailyEnergy.isLoading}
              error={dailyEnergy.error}
              onRetry={() => void dailyEnergy.refetch()}
            >
              <EnergyTrendChart data={dailyEnergy.data ?? []} />
            </QueryFeedback>
          )}
        </section>
      </QueryFeedback>
    </div>
  );
}

function getTrendRange(now = new Date()): { start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
  return { start: start.toISOString(), end: end.toISOString() };
}
