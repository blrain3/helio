import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fenToYuan, formatDateTime } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge, LoadingState } from '../../components/ui';

const PROVIDER_LABELS: Record<string, string> = {
  mock: '模拟',
  wechat: '微信支付',
  alipay: '支付宝',
};

export function Component() {
  const { data, isLoading } = useQuery({ queryKey: ['payments'], queryFn: api.listPayments });

  return (
    <div>
      <PageHeader title="支付退款" description="支付流水与退款记录。" />
      {isLoading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={[
            { key: 'id', header: '流水号', render: (p) => <span className="font-mono text-xs">{p.id}</span> },
            { key: 'orderId', header: '关联订单', render: (p) => p.orderId },
            { key: 'provider', header: '渠道', render: (p) => PROVIDER_LABELS[p.provider] ?? p.provider },
            {
              key: 'txn',
              header: '渠道交易号',
              render: (p) => (p.providerTransactionId ? <span className="font-mono text-xs">{p.providerTransactionId}</span> : '—'),
            },
            { key: 'amount', header: '金额', render: (p) => <span className="font-medium">{fenToYuan(p.amount)}</span> },
            { key: 'status', header: '状态', render: (p) => <StatusBadge status={p.status} /> },
            { key: 'createdAt', header: '时间', render: (p) => formatDateTime(p.createdAt) },
          ]}
          rows={data ?? []}
          emptyMessage="暂无支付流水"
        />
      )}
    </div>
  );
}
