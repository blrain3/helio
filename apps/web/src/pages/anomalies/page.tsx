import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatDateTime, statusLabel } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge, LoadingState } from '../../components/ui';

export function Component() {
  const { data, isLoading } = useQuery({ queryKey: ['anomalies'], queryFn: api.listAnomalies });

  return (
    <div>
      <PageHeader title="异常告警" description="设备离线、数据缺失与发电异常。" />
      {isLoading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={[
            { key: 'id', header: '告警号', render: (a) => <span className="font-mono text-xs">{a.id}</span> },
            { key: 'type', header: '类型', render: (a) => statusLabel(a.type) },
            { key: 'message', header: '详情', render: (a) => <span className="text-slate-700">{a.message}</span> },
            { key: 'severity', header: '级别', render: (a) => <StatusBadge status={a.severity} /> },
            { key: 'plantId', header: '关联电站', render: (a) => a.plantId ?? '—' },
            { key: 'status', header: '状态', render: (a) => <StatusBadge status={a.status} /> },
            { key: 'createdAt', header: '时间', render: (a) => formatDateTime(a.createdAt) },
          ]}
          rows={data ?? []}
          emptyMessage="暂无异常告警"
        />
      )}
    </div>
  );
}
