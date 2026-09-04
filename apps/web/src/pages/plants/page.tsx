import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import type { Plant } from '../../lib/types';
import { formatDateTime } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge } from '../../components/ui';
import { Button } from '../../components/button';
import { PlantForm, type PlantFormValues } from '../../components/forms/PlantForm';
import { Modal } from '../../components/forms/Modal';
import { OperationNotice } from '../../components/feedback/OperationNotice';
import { QueryFeedback } from '../../components/feedback/QueryFeedback';

interface Notice {
  tone: 'success' | 'error';
  message: string;
}

export function Component() {
  const plants = useQuery({ queryKey: ['plants'], queryFn: api.listPlants });
  const createPlant = useMutation({ mutationFn: api.createPlant });
  const updatePlant = useMutation({
    mutationFn: ({ id, values }: { id: string; values: PlantFormValues }) => api.updatePlant(id, values),
  });
  const removePlant = useMutation({ mutationFn: api.removePlant });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [deletingPlant, setDeletingPlant] = useState<Plant | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function create(values: { name: string; capacity: number; location?: string }) {
    try {
      await createPlant.mutateAsync(values);
      setCreateOpen(false);
      setNotice({ tone: 'success', message: '电站已创建' });
      await plants.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function update(id: string, values: PlantFormValues) {
    try {
      await updatePlant.mutateAsync({ id, values });
      setEditingPlant(null);
      setNotice({ tone: 'success', message: '电站已更新' });
      await plants.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function remove() {
    if (!deletingPlant) {
      return;
    }

    try {
      await removePlant.mutateAsync(deletingPlant.id);
      setDeletingPlant(null);
      setNotice({ tone: 'success', message: '电站已删除' });
      await plants.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  return (
    <div>
      <PageHeader
        title="电站管理"
        description="管理光伏电站与装机容量。"
        actions={<Button onClick={() => setCreateOpen(true)}>新建电站</Button>}
      />
      {notice && <OperationNotice tone={notice.tone}>{notice.message}</OperationNotice>}
      <QueryFeedback isLoading={plants.isLoading} error={plants.error} onRetry={() => void plants.refetch()}>
        <DataTable
          columns={[
            { key: 'name', header: '电站名称', render: (p) => <span className="font-medium">{p.name}</span> },
            { key: 'location', header: '位置', render: (p) => p.location },
            { key: 'capacity', header: '容量 (kW)', render: (p) => p.capacityKw.toLocaleString('zh-CN') },
            { key: 'status', header: '状态', render: (p) => <StatusBadge status={p.status} /> },
            { key: 'createdAt', header: '接入时间', render: (p) => formatDateTime(p.createdAt) },
            {
              key: 'actions',
              header: '操作',
              render: (p) => (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`编辑 ${p.name}`}
                    title="编辑电站"
                    onClick={() => setEditingPlant(p)}
                    className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除 ${p.name}`}
                    title="删除电站"
                    onClick={() => setDeletingPlant(p)}
                    className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ),
            },
          ]}
          rows={plants.data ?? []}
          emptyMessage="暂无电站，点击「新建电站」开始添加"
        />
      </QueryFeedback>
      <Modal
        open={isCreateOpen || editingPlant !== null}
        title={editingPlant ? '编辑电站' : '新建电站'}
        description={editingPlant ? '修改电站基础信息。' : '填写电站基础信息后即可开始接入设备和账单。'}
        onClose={() => {
          setCreateOpen(false);
          setEditingPlant(null);
        }}
      >
        <PlantForm
          key={editingPlant?.id ?? 'new'}
          initialValue={
            editingPlant
              ? {
                  name: editingPlant.name,
                  capacity: editingPlant.capacityKw,
                  location: editingPlant.location === '未填写' ? '' : editingPlant.location,
                }
              : undefined
          }
          isSubmitting={createPlant.isPending || updatePlant.isPending}
          submitLabel={editingPlant ? '保存更改' : '保存电站'}
          onCancel={() => {
            setCreateOpen(false);
            setEditingPlant(null);
          }}
          onSubmit={(values) => (editingPlant ? update(editingPlant.id, values) : create(values))}
        />
      </Modal>
      <Modal
        open={deletingPlant !== null}
        title="删除电站"
        description={deletingPlant ? `将删除“${deletingPlant.name}”及其关联业务数据。` : undefined}
        onClose={() => setDeletingPlant(null)}
      >
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setDeletingPlant(null)} disabled={removePlant.isPending}>
            取消
          </Button>
          <Button type="button" onClick={() => void remove()} disabled={removePlant.isPending} className="bg-rose-600 text-white hover:bg-rose-700">
            {removePlant.isPending ? '删除中...' : '确认删除'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作未能完成，请重试';
}
