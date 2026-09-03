import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PageHeader, DataTable, StatusBadge, LoadingState } from '../../components/ui';

const TYPE_LABELS: Record<string, string> = {
  INVERTER: '逆变器',
  PANEL: '光伏组件',
  METER: '智能电表',
  BATTERY: '储能电池',
};

export function Component() {
  const { data, isLoading } = useQuery({ queryKey: ['devices'], queryFn: api.listDevices });

  return (
    <div>
      <PageHeader title="设备管理" description="逆变器、智能电表与储能设备。" />
      {isLoading ? (
        <LoadingState />
      ) : (
        <DataTable
          columns={[
            { key: 'name', header: '设备名称', render: (d) => <span className="font-medium">{d.name}</span> },
            { key: 'type', header: '类型', render: (d) => TYPE_LABELS[d.type] ?? d.type },
            { key: 'serialNo', header: '序列号', render: (d) => <span className="font-mono text-xs">{d.serialNo}</span> },
            { key: 'plantId', header: '所属电站', render: (d) => d.plantId },
            { key: 'status', header: '状态', render: (d) => <StatusBadge status={d.status} /> },
          ]}
          rows={data ?? []}
          emptyMessage="暂无设备"
        />
      )}
    </div>
  );
}
