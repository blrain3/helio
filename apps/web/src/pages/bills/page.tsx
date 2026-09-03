import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fenToYuan, formatDateTime } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge, LoadingState } from '../../components/ui';

export function Component() {
  const { data, isLoading } = useQuery({ queryKey: ['bills'], queryFn: api.listBills });

  return (
    <div>
      <PageHeader title="账单" description="按月生成的用电 / 发电账单。" />
      {isLoading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={[
            { key: 'id', header: '账单号', render: (b) => <span className="font-mono text-xs">{b.id}</span> },
            { key: 'period', header: '账期', render: (b) => b.period },
            { key: 'plantId', header: '电站', render: (b) => b.plantId },
            { key: 'energy', header: '电量 (kWh)', render: (b) => b.energyKwh.toLocaleString('zh-CN') },
            { key: 'amount', header: '金额', render: (b) => <span className="font-medium">{fenToYuan(b.amount)}</span> },
            { key: 'status', header: '状态', render: (b) => <StatusBadge status={b.status} /> },
            { key: 'createdAt', header: '生成时间', render: (b) => formatDateTime(b.createdAt) },
          ]}
          rows={data ?? []}
          emptyMessage="暂无账单"
        />
      )}
    </div>
  );
}
