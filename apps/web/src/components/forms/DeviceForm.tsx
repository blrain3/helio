import { useState, type FormEvent } from 'react';
import type { DeviceType, Plant } from '../../lib/types';
import { Button } from '../button';

const DEVICE_TYPES: Array<{ value: DeviceType; label: string }> = [
  { value: 'INVERTER', label: '逆变器' },
  { value: 'METER', label: '智能电表' },
  { value: 'SENSOR', label: '传感器' },
  { value: 'BATTERY', label: '储能电池' },
  { value: 'OTHER', label: '其他设备' },
];

export interface DeviceFormValues {
  plantId: string;
  serialNo: string;
  name: string;
  type: DeviceType;
}

interface DeviceFormProps {
  plants: Plant[];
  initialValue?: DeviceFormValues;
  isSubmitting?: boolean;
  readOnlyAssociation?: boolean;
  submitLabel?: string;
  onSubmit: (values: DeviceFormValues) => void | Promise<void>;
  onCancel: () => void;
}

export function DeviceForm({
  plants,
  initialValue,
  isSubmitting = false,
  readOnlyAssociation = false,
  submitLabel = '保存设备',
  onSubmit,
  onCancel,
}: DeviceFormProps) {
  const [plantId, setPlantId] = useState(initialValue?.plantId ?? '');
  const [serialNo, setSerialNo] = useState(initialValue?.serialNo ?? '');
  const [name, setName] = useState(initialValue?.name ?? '');
  const [type, setType] = useState<DeviceType>(initialValue?.type ?? 'INVERTER');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedSerialNo = serialNo.trim();

    if (!plantId || !normalizedName || !normalizedSerialNo) {
      return;
    }

    await onSubmit({ plantId, serialNo: normalizedSerialNo, name: normalizedName, type });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="device-plant">
          所属电站
        </label>
        <select
          id="device-plant"
          required
          value={plantId}
          disabled={readOnlyAssociation}
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
        <label className="block text-sm font-medium text-slate-700" htmlFor="device-name">
          设备名称
        </label>
        <input
          id="device-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="device-serial-no">
          设备序列号
        </label>
        <input
          id="device-serial-no"
          required
          value={serialNo}
          disabled={readOnlyAssociation}
          onChange={(event) => setSerialNo(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="device-type">
          设备类型
        </label>
        <select
          id="device-type"
          value={type}
          onChange={(event) => setType(event.target.value as DeviceType)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100"
        >
          {DEVICE_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
