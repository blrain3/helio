import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { Order } from '../../lib/types';
import { fenToYuan, formatDateTime } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge } from '../../components/ui';
import { Button } from '../../components/button';
import { OrderForm } from '../../components/forms/OrderForm';
import { Modal } from '../../components/forms/Modal';
import { OperationNotice } from '../../components/feedback/OperationNotice';
import { QueryFeedback } from '../../components/feedback/QueryFeedback';

export function Component() {
  const orders = useQuery({ queryKey: ['orders'], queryFn: api.listOrders });
  const bills = useQuery({ queryKey: ['bills'], queryFn: api.listBills });
  const createOrder = useMutation({
    mutationFn: (values: { billId: string; amount: number }) => api.createOrder(values),
  });
  const submitPayment = useMutation({ mutationFn: (id: string) => api.submitOrderPayment(id) });
  const completeOrder = useMutation({ mutationFn: (id: string) => api.completeOrder(id) });
  const closeOrder = useMutation({ mutationFn: (id: string) => api.closeOrder(id) });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [closingOrder, setClosingOrder] = useState<Order | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const issuedBills = (bills.data ?? []).filter((bill) => bill.status === 'ISSUED');

  async function create(values: { billId: string; amount: number }) {
    try {
      await createOrder.mutateAsync(values);
      setCreateOpen(false);
      setNotice({ tone: 'success', message: '订单已创建' });
      await orders.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function submit(id: string) {
    try {
      await submitPayment.mutateAsync(id);
      setNotice({ tone: 'success', message: '订单已提交支付' });
      await orders.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function complete(id: string) {
    try {
      await completeOrder.mutateAsync(id);
      setNotice({ tone: 'success', message: '订单已完成' });
      await orders.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function close() {
    if (!closingOrder) {
      return;
    }

    try {
      await closeOrder.mutateAsync(closingOrder.id);
      setClosingOrder(null);
      setNotice({ tone: 'success', message: '订单已关闭' });
      await orders.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  return (
    <div>
      <PageHeader
        title="订单"
        description="缴费订单及其状态流转。"
        actions={<Button onClick={() => setCreateOpen(true)} disabled={issuedBills.length === 0}>新建订单</Button>}
      />
      {notice && <OperationNotice tone={notice.tone}>{notice.message}</OperationNotice>}
      <QueryFeedback
        isLoading={orders.isLoading || bills.isLoading}
        error={orders.error ?? bills.error}
        onRetry={() => {
          void orders.refetch();
          void bills.refetch();
        }}
      >
        <DataTable
          columns={[
            { key: 'id', header: '订单号', render: (o) => <span className="font-mono text-xs">{o.id}</span> },
            { key: 'billId', header: '关联账单', render: (o) => o.billId },
            { key: 'amount', header: '金额', render: (o) => <span className="font-medium">{fenToYuan(o.amount)}</span> },
            { key: 'status', header: '状态', render: (o) => <StatusBadge status={o.status} /> },
            { key: 'createdAt', header: '创建时间', render: (o) => formatDateTime(o.createdAt) },
            {
              key: 'actions',
              header: '操作',
              render: (o) => <OrderActions order={o} onSubmit={submit} onComplete={complete} onClose={setClosingOrder} />,
            },
          ]}
          rows={orders.data ?? []}
          emptyMessage="暂无订单"
        />
      </QueryFeedback>
      <Modal
        open={isCreateOpen}
        title="新建订单"
        description="订单金额与选中账单一致，由系统锁定。"
        onClose={() => setCreateOpen(false)}
      >
        <OrderForm
          bills={issuedBills}
          isSubmitting={createOrder.isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={create}
        />
      </Modal>
      <Modal
        open={closingOrder !== null}
        title="关闭订单"
        description={closingOrder ? `确认关闭订单“${closingOrder.id}”？该操作不可撤销。` : undefined}
        onClose={() => setClosingOrder(null)}
      >
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setClosingOrder(null)} disabled={closeOrder.isPending}>
            取消
          </Button>
          <Button type="button" onClick={() => void close()} disabled={closeOrder.isPending} className="bg-rose-600 text-white hover:bg-rose-700">
            {closeOrder.isPending ? '关闭中...' : '确认关闭'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function OrderActions({
  order,
  onSubmit,
  onComplete,
  onClose,
}: {
  order: Order;
  onSubmit: (id: string) => void;
  onComplete: (id: string) => void;
  onClose: (order: Order) => void;
}) {
  if (order.status === 'CREATED') {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`提交支付 ${order.id}`}
          title="提交支付"
          onClick={() => onSubmit(order.id)}
          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-yellow-50 hover:text-yellow-700"
        >
          <CreditCard className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`关闭订单 ${order.id}`}
          title="关闭订单"
          onClick={() => onClose(order)}
          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (order.status === 'PENDING_PAYMENT') {
    return (
      <button
        type="button"
        aria-label={`关闭订单 ${order.id}`}
        title="关闭订单"
        onClick={() => onClose(order)}
        className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
      >
        <XCircle className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  if (order.status === 'PAID') {
    return (
      <button
        type="button"
        aria-label={`完成订单 ${order.id}`}
        title="完成订单"
        onClick={() => onComplete(order.id)}
        className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return <span className="text-xs text-slate-400">—</span>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作未能完成，请重试';
}
