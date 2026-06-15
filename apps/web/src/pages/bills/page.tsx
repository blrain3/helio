import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { api } from '../../lib/api';
import { fenToYuan, formatDateTime } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge } from '../../components/ui';
import { Button } from '../../components/button';
import { BillForm, type BillFormValues } from '../../components/forms/BillForm';
import { Modal } from '../../components/forms/Modal';
import { OperationNotice } from '../../components/feedback/OperationNotice';
import { QueryFeedback } from '../../components/feedback/QueryFeedback';

export function Component() {
  const bills = useQuery({ queryKey: ['bills'], queryFn: api.listBills });
  const plants = useQuery({ queryKey: ['plants'], queryFn: api.listPlants });
  const generateBill = useMutation({ mutationFn: api.generateBill });
  const issueBill = useMutation({ mutationFn: api.issueBill });
  const [isGenerateOpen, setGenerateOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function generate(values: BillFormValues) {
    try {
      await generateBill.mutateAsync(values);
      setGenerateOpen(false);
      setNotice({ tone: 'success', message: '账单已生成' });
      await bills.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function issue(id: string) {
    try {
      await issueBill.mutateAsync(id);
      setNotice({ tone: 'success', message: '账单已发出' });
      await bills.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  return (
    <div>
      <PageHeader
        title="账单"
        description="按月生成的用电 / 发电账单。"
        actions={
          <Button onClick={() => setGenerateOpen(true)} disabled={(plants.data?.length ?? 0) === 0}>
            生成账单
          </Button>
        }
      />
      {notice && <OperationNotice tone={notice.tone}>{notice.message}</OperationNotice>}
      <QueryFeedback
        isLoading={bills.isLoading || plants.isLoading}
        error={bills.error ?? plants.error}
        onRetry={() => {
          void bills.refetch();
          void plants.refetch();
        }}
      >
        <DataTable
          columns={[
            { key: 'id', header: '账单号', render: (b) => <span className="font-mono text-xs">{b.id}</span> },
            { key: 'period', header: '账期', render: (b) => b.period },
            { key: 'plantId', header: '电站', render: (b) => b.plantId },
            { key: 'energy', header: '电量 (kWh)', render: (b) => b.energyKwh.toLocaleString('zh-CN') },
            { key: 'amount', header: '金额', render: (b) => <span className="font-medium">{fenToYuan(b.amount)}</span> },
            { key: 'status', header: '状态', render: (b) => <StatusBadge status={b.status} /> },
            { key: 'createdAt', header: '生成时间', render: (b) => formatDateTime(b.createdAt) },
            {
              key: 'actions',
              header: '操作',
              render: (b) =>
                b.status === 'PENDING' ? (
                  <button
                    type="button"
                    aria-label={`发出 ${b.id}`}
                    title="发出账单"
                    disabled={issueBill.isPending}
                    onClick={() => void issue(b.id)}
                    className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-yellow-50 hover:text-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                ),
            },
          ]}
          rows={bills.data ?? []}
          emptyMessage="暂无账单"
        />
      </QueryFeedback>
      <Modal
        open={isGenerateOpen}
        title="生成账单"
        description="金额由服务端根据账期内生效费率自动计算。"
        onClose={() => setGenerateOpen(false)}
      >
        <BillForm
          plants={plants.data ?? []}
          isSubmitting={generateBill.isPending}
          onCancel={() => setGenerateOpen(false)}
          onSubmit={generate}
        />
      </Modal>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作未能完成，请重试';
}
