import { useState, type FormEvent } from 'react';
import { Button } from '../button';

export interface PlantFormValues {
  name: string;
  capacity: number;
  location?: string;
}

interface PlantFormProps {
  initialValue?: PlantFormValues;
  isSubmitting?: boolean;
  submitLabel?: string;
  onSubmit: (value: PlantFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function PlantForm({
  initialValue,
  isSubmitting = false,
  submitLabel = '保存电站',
  onSubmit,
  onCancel,
}: PlantFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [capacity, setCapacity] = useState(String(initialValue?.capacity ?? ''));
  const [location, setLocation] = useState(initialValue?.location ?? '');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedCapacity = Number(capacity);

    if (!normalizedName || !Number.isFinite(normalizedCapacity) || normalizedCapacity < 0) {
      return;
    }

    await onSubmit({
      name: normalizedName,
      capacity: normalizedCapacity,
      location: location.trim() || undefined,
    });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="plant-name">
          电站名称
        </label>
        <input
          id="plant-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="plant-capacity">
          装机容量 (kW)
        </label>
        <input
          id="plant-capacity"
          required
          min="0"
          step="any"
          type="number"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="plant-location">
          位置
        </label>
        <input
          id="plant-location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '保存中...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
