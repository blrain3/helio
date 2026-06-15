import { useState, type FormEvent } from 'react';
import type { Plant } from '../../lib/types';
import { Button } from '../button';

export interface BillFormValues {
  plantId: string;
  consumedKwh: number;
  periodStart: string;
  periodEnd: string;
}

interface BillFormProps {
  plants: Plant[];
  isSubmitting?: boolean;
  onSubmit: (values: BillFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function BillForm({ plants, isSubmitting = false, onSubmit, onCancel }: BillFormProps) {
  const [plantId, setPlantId] = useState('');
  const [consumedKwh, setConsumedKwh] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedKwh = Number(consumedKwh);

    if (
      !plantId ||
      !Number.isFinite(normalizedKwh) ||
      normalizedKwh < 0 ||
      !periodStart ||
      !periodEnd ||
      periodStart >= periodEnd
    ) {
      return;
    }

    await onSubmit({
      plantId,
      consumedKwh: normalizedKwh,
      periodStart: `${periodStart}T00:00:00.000Z`,
      periodEnd: `${periodEnd}T23:59:59.999Z`,
    });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="bill-plant">
          所属电站
        </label>
        <select
          id="bill-plant"
          required
          value={plantId}
          onChange={(event) => setPlantId(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
        >
          <option value="" disabled>
            选择电站
          </option>
          {plants.map((plant) => (
            <option key={plant.id} value={plant.id}>
              {plant.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="bill-energy">
          电量 (kWh)
        </label>
        <input
          id="bill-energy"
          required
          min="0"
          step="any"
          type="number"
          value={consumedKwh}
          onChange={(event) => setConsumedKwh(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="bill-period-start">
            开始日期
          </label>
          <input
            id="bill-period-start"
            required
            type="date"
            value={periodStart}
            onChange={(event) => setPeriodStart(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="bill-period-end">
            结束日期
          </label>
          <input
            id="bill-period-end"
            required
            type="date"
            value={periodEnd}
            onChange={(event) => setPeriodEnd(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '生成中...' : '生成'}
        </Button>
      </div>
    </form>
  );
}
