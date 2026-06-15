import { useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { Payment } from '../../lib/types';
import { fenToYuan, formatDateTime } from '../../lib/format';
import { PageHeader, DataTable, StatusBadge } from '../../components/ui';
import { Button } from '../../components/button';
import { Modal } from '../../components/forms/Modal';
import { OperationNotice } from '../../components/feedback/OperationNotice';
import { QueryFeedback } from '../../components/feedback/QueryFeedback';

const PROVIDER_LABELS: Record<string, string> = {
  mock: '模拟',
  wechat: '微信支付',
  alipay: '支付宝',
};

export function Component() {
  const payments = useQuery({ queryKey: ['payments'], queryFn: api.listPayments });
  const orders = useQuery({ queryKey: ['orders'], queryFn: api.listOrders });
  const createPayment = useMutation({
    mutationFn: (values: { orderId: string; provider: 'mock' }) => api.createPayment(values),
  });
  const completeMockPayment = useMutation({ mutationFn: (id: string) => api.completeMockPayment(id) });
  const closePayment = useMutation({ mutationFn: (id: string) => api.closePayment(id) });
  const refundPayment = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.refundPayment(id, amount),
  });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [closingPayment, setClosingPayment] = useState<Payment | null>(null);
  const [refundingPayment, setRefundingPayment] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const paymentPendingOrders = (orders.data ?? []).filter((order) => order.status === 'PENDING_PAYMENT');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrderId) {
      return;
    }

    try {
      await createPayment.mutateAsync({ orderId: selectedOrderId, provider: 'mock' });
      setCreateOpen(false);
      setSelectedOrderId('');
      setNotice({ tone: 'success', message: '模拟支付已创建' });
      await payments.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function completeMock(id: string) {
    try {
      await completeMockPayment.mutateAsync(id);
      setNotice({ tone: 'success', message: '模拟支付回调已处理' });
      await Promise.all([payments.refetch(), orders.refetch()]);
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function close() {
    if (!closingPayment) {
      return;
    }

    try {
      await closePayment.mutateAsync(closingPayment.id);
      setClosingPayment(null);
      setNotice({ tone: 'success', message: '支付已关闭' });
      await payments.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  async function refund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refundingPayment) {
      return;
    }

    const amount = Math.round(Number(refundAmount) * 100);
    const available = getAvailableRefund(refundingPayment);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > available) {
      return;
    }

    try {
      await refundPayment.mutateAsync({ id: refundingPayment.id, amount });
      setRefundingPayment(null);
      setRefundAmount('');
      setNotice({ tone: 'success', message: '退款已发起' });
      await payments.refetch();
    } catch (error) {
      setNotice({ tone: 'error', message: getErrorMessage(error) });
    }
  }

  return (
    <div>
      <PageHeader
        title="支付退款"
        description="支付流水与退款记录。"
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={paymentPendingOrders.length === 0}>
            新建模拟支付
          </Button>
        }
      />
      {notice && <OperationNotice tone={notice.tone}>{notice.message}</OperationNotice>}
      <QueryFeedback
        isLoading={payments.isLoading || orders.isLoading}
        error={payments.error ?? orders.error}
        onRetry={() => {
          void payments.refetch();
          void orders.refetch();
        }}
      >
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
            { key: 'refunded', header: '已退款', render: (p) => fenToYuan(p.refundedAmount) },
            { key: 'status', header: '状态', render: (p) => <StatusBadge status={p.status} /> },
            { key: 'createdAt', header: '时间', render: (p) => formatDateTime(p.createdAt) },
            {
              key: 'actions',
              header: '操作',
              render: (p) =>
                p.status === 'PENDING' ? (
                  <div className="flex items-center gap-1">
                    {p.provider === 'mock' && (
                      <button
                        type="button"
                        aria-label={`完成模拟支付 ${p.id}`}
                        title="完成模拟支付"
                        disabled={completeMockPayment.isPending}
                        onClick={() => void completeMock(p.id)}
                        className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`关闭支付 ${p.id}`}
                      title="关闭支付"
                      disabled={closePayment.isPending}
                      onClick={() => setClosingPayment(p)}
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : p.status === 'SUCCESS' && getAvailableRefund(p) > 0 ? (
                  <button
                    type="button"
                    aria-label={`退款 ${p.id}`}
                    title="发起退款"
                    disabled={refundPayment.isPending}
                    onClick={() => {
                      setRefundingPayment(p);
                      setRefundAmount((getAvailableRefund(p) / 100).toFixed(2));
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                ),
            },
          ]}
          rows={payments.data ?? []}
          emptyMessage="暂无支付流水"
        />
      </QueryFeedback>
      <Modal
        open={isCreateOpen}
        title="新建模拟支付"
        description="仅为待支付订单创建本地演示用 Mock 支付流水。"
        onClose={() => setCreateOpen(false)}
      >
        <form className="space-y-4" onSubmit={create}>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="payment-order">
              关联订单
            </label>
            <select
              id="payment-order"
              required
              value={selectedOrderId}
              onChange={(event) => setSelectedOrderId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
            >
              <option value="" disabled>
                选择待支付订单
              </option>
              {paymentPendingOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.id} · {fenToYuan(order.amount)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={createPayment.isPending}>
              取消
            </Button>
            <Button type="submit" disabled={createPayment.isPending || !selectedOrderId}>
              {createPayment.isPending ? '创建中...' : '创建模拟支付'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={closingPayment !== null}
        title="关闭支付"
        description={closingPayment ? `确认关闭支付流水“${closingPayment.id}”？该操作不可撤销。` : undefined}
        onClose={() => setClosingPayment(null)}
      >
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setClosingPayment(null)} disabled={closePayment.isPending}>
            取消
          </Button>
          <Button
            type="button"
            onClick={() => void close()}
            disabled={closePayment.isPending}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {closePayment.isPending ? '关闭中...' : '确认关闭'}
          </Button>
        </div>
      </Modal>
      <Modal
        open={refundingPayment !== null}
        title="发起退款"
        description={refundingPayment ? `退款将退回原支付渠道，剩余额度为 ${fenToYuan(getAvailableRefund(refundingPayment))}。` : undefined}
        onClose={() => setRefundingPayment(null)}
      >
        <form className="space-y-4" onSubmit={refund}>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            可退金额 {refundingPayment ? fenToYuan(getAvailableRefund(refundingPayment)) : '—'}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="refund-amount">
              退款金额 (元)
            </label>
            <input
              id="refund-amount"
              required
              min="0.01"
              step="any"
              type="number"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="secondary" onClick={() => setRefundingPayment(null)} disabled={refundPayment.isPending}>
              取消
            </Button>
            <Button type="submit" disabled={refundPayment.isPending}>
              {refundPayment.isPending ? '提交中...' : '确认退款'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作未能完成，请重试';
}

function getAvailableRefund(payment: Payment): number {
  return Math.max(0, payment.amount - payment.refundedAmount);
}
