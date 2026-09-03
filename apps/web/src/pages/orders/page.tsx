import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fenToYuan, formatDateTime } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge, LoadingState } from '../../components/ui';

export function Component() {
  const { data, isLoading } = useQuery({ queryKey: ['orders'], queryFn: api.listOrders });

  return (
    <div>
      <PageHeader title="订单" description="缴费订单及其状态流转。" />
      {isLoading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={[
            { key: 'id', header: '订单号', render: (o) => <span className="font-mono text-xs">{o.id}</span> },
            { key: 'billId', header: '关联账单', render: (o) => o.billId },
            { key: 'amount', header: '金额', render: (o) => <span className="font-medium">{fenToYuan(o.amount)}</span> },
            { key: 'status', header: '状态', render: (o) => <StatusBadge status={o.status} /> },
            { key: 'createdAt', header: '创建时间', render: (o) => formatDateTime(o.createdAt) },
          ]}
          rows={data ?? []}
          emptyMessage="暂无订单"
        />
      )}
    </div>
  );
}
