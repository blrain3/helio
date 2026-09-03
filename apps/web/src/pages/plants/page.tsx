import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge, LoadingState } from '../../components/ui';
import { Button } from '../../components/button';

export function Component() {
  const { data, isLoading } = useQuery({ queryKey: ['plants'], queryFn: api.listPlants });

  return (
    <div>
      <PageHeader
        title="电站管理"
        description="管理光伏电站与装机容量。"
        actions={<Button>新建电站</Button>}
      />
      {isLoading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={[
            { key: 'name', header: '电站名称', render: (p) => <span className="font-medium">{p.name}</span> },
            { key: 'location', header: '位置', render: (p) => p.location },
            { key: 'capacity', header: '容量 (kW)', render: (p) => p.capacityKw.toLocaleString('zh-CN') },
            { key: 'status', header: '状态', render: (p) => <StatusBadge status={p.status} /> },
            { key: 'createdAt', header: '接入时间', render: (p) => formatDateTime(p.createdAt) },
          ]}
          rows={data ?? []}
          emptyMessage="暂无电站，点击「新建电站」开始添加"
        />
      )}
    </div>
  );
}
