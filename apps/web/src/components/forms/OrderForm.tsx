import { useState, type FormEvent } from 'react';
import type { Bill } from '../../lib/types';
import { fenToYuan } from '../../lib/format';
import { Button } from '../button';

interface OrderFormProps {
  bills: Bill[];
  isSubmitting?: boolean;
  onSubmit: (values: { billId: string; amount: number }) => void | Promise<void>;
  onCancel: () => void;
}

export function OrderForm({ bills, isSubmitting = false, onSubmit, onCancel }: OrderFormProps) {
  const [billId, setBillId] = useState('');
  const bill = bills.find((candidate) => candidate.id === billId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bill) {
      return;
    }

    await onSubmit({ billId: bill.id, amount: bill.amount });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="order-bill">
          关联账单
        </label>
        <select
          id="order-bill"
          required
          value={billId}
          onChange={(event) => setBillId(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
        >
          <option value="" disabled>
            选择已发出账单
          </option>
          {bills.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.period} · {candidate.id}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="text-xs text-slate-500">订单金额</div>
        <div className="mt-1 text-lg font-semibold text-slate-900">{bill ? fenToYuan(bill.amount) : '—'}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting || !bill}>
          {isSubmitting ? '创建中...' : '创建订单'}
        </Button>
      </div>
    </form>
  );
}
