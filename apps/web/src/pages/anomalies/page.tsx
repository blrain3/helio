import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api, queryKeys } from '../../lib/api';
import { formatDateTime, statusLabel } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge } from '../../components/ui';
import { Button } from '../../components/button';
import { QueryFeedback } from '../../components/feedback/QueryFeedback';

export function Component() {
  const anomalies = useQuery({ queryKey: queryKeys.anomalies, queryFn: api.listAnomalies });

  return (
    <div>
      <PageHeader
        title="异常告警"
        description="设备离线、数据缺失与发电异常。"
        actions={
          <Button
            type="button"
            variant="secondary"
            className="h-9 w-9 px-0"
            aria-label="刷新异常告警"
            title="刷新异常告警"
            disabled={anomalies.isFetching}
            onClick={() => void anomalies.refetch()}
          >
            <RefreshCw
              className={anomalies.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
              aria-hidden="true"
            />
          </Button>
        }
      />
      <QueryFeedback
        isLoading={anomalies.isLoading}
        error={anomalies.error}
        onRetry={() => void anomalies.refetch()}
      >
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
          rows={anomalies.data ?? []}
          emptyMessage="暂无异常告警"
        />
      </QueryFeedback>
    </div>
  );
}
