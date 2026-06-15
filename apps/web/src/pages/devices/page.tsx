import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { Device } from '../../lib/types';
import { PageHeader, DataTable, StatusBadge } from '../../components/ui';
import { Button } from '../../components/button';
import { DeviceForm } from '../../components/forms/DeviceForm';
import { Modal } from '../../components/forms/Modal';
import { OperationNotice } from '../../components/feedback/OperationNotice';
import { QueryFeedback } from '../../components/feedback/QueryFeedback';

const TYPE_LABELS: Record<string, string> = {
  INVERTER: '逆变器',
  PANEL: '光伏组件',
  METER: '智能电表',
  BATTERY: '储能电池',
};

export function Component() {
  const devices = useQuery({ queryKey: ['devices'], queryFn: api.listDevices });
  const plants = useQuery({ queryKey: ['plants'], queryFn: api.listPlants });
  const createDevice = useMutation({ mutationFn: api.createDevice });
  const updateDevice = useMutation({
    mutationFn: ({ id, name, type }: { id: string; name: string; type: string }) =>
      api.updateDevice(id, { name, type }),
  });
  const removeDevice = useMutation({ mutationFn: api.removeDevice });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function create(values: { plantId: string; serialNo: string; name: string; type: string }) {
    try {
      await createDevice.mutateAsync(values);
      setCreateOpen(false);
      setNotice({ tone: 'success', message: '设备已创建' });
      await devices.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function update(values: { name: string; type: string }) {
    if (!editingDevice) {
      return;
    }

    try {
      await updateDevice.mutateAsync({ id: editingDevice.id, ...values });
      setEditingDevice(null);
      setNotice({ tone: 'success', message: '设备已更新' });
      await devices.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function remove() {
    if (!deletingDevice) {
      return;
    }

    try {
      await removeDevice.mutateAsync(deletingDevice.id);
      setDeletingDevice(null);
      setNotice({ tone: 'success', message: '设备已删除' });
      await devices.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  return (
    <div>
      <PageHeader
        title="设备管理"
        description="逆变器、智能电表与储能设备。"
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={(plants.data?.length ?? 0) === 0}>
            新建设备
          </Button>
        }
      />
      {notice && <OperationNotice tone={notice.tone}>{notice.message}</OperationNotice>}
      <QueryFeedback
        isLoading={devices.isLoading || plants.isLoading}
        error={devices.error ?? plants.error}
        onRetry={() => {
          void devices.refetch();
          void plants.refetch();
        }}
      >
        <DataTable
          columns={[
            { key: 'name', header: '设备名称', render: (d) => <span className="font-medium">{d.name}</span> },
            { key: 'type', header: '类型', render: (d) => TYPE_LABELS[d.type] ?? d.type },
            { key: 'serialNo', header: '序列号', render: (d) => <span className="font-mono text-xs">{d.serialNo}</span> },
            { key: 'plantId', header: '所属电站', render: (d) => d.plantId },
            { key: 'status', header: '状态', render: (d) => <StatusBadge status={d.status} /> },
            {
              key: 'actions',
              header: '操作',
              render: (d) => (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`编辑 ${d.name}`}
                    title="编辑设备"
                    onClick={() => setEditingDevice(d)}
                    className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除 ${d.name}`}
                    title="删除设备"
                    onClick={() => setDeletingDevice(d)}
                    className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={devices.data ?? []}
          emptyMessage="暂无设备"
        />
      </QueryFeedback>
      <Modal
        open={isCreateOpen || editingDevice !== null}
        title={editingDevice ? '编辑设备' : '新建设备'}
        description={editingDevice ? '仅支持修改设备名称和类型。' : '设备必须挂接到一个已存在的电站。'}
        onClose={() => {
          setCreateOpen(false);
          setEditingDevice(null);
        }}
      >
        <DeviceForm
          key={editingDevice?.id ?? 'new'}
          plants={plants.data ?? []}
          initialValue={
            editingDevice
              ? {
                  plantId: editingDevice.plantId,
                  serialNo: editingDevice.serialNo,
                  name: editingDevice.name,
                  type: editingDevice.type,
                }
              : undefined
          }
          isSubmitting={createDevice.isPending || updateDevice.isPending}
          readOnlyAssociation={editingDevice !== null}
          submitLabel={editingDevice ? '保存更改' : '保存设备'}
          onCancel={() => {
            setCreateOpen(false);
            setEditingDevice(null);
          }}
          onSubmit={(values) =>
            editingDevice ? update({ name: values.name, type: values.type }) : create(values)
          }
        />
      </Modal>
      <Modal
        open={deletingDevice !== null}
        title="删除设备"
        description={deletingDevice ? `将删除“${deletingDevice.name}”。` : undefined}
        onClose={() => setDeletingDevice(null)}
      >
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setDeletingDevice(null)} disabled={removeDevice.isPending}>
            取消
          </Button>
          <Button type="button" onClick={() => void remove()} disabled={removeDevice.isPending} className="bg-rose-600 text-white hover:bg-rose-700">
            {removeDevice.isPending ? '删除中...' : '确认删除'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作未能完成，请重试';
}
