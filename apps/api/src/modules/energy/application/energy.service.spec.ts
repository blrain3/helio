import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlantService } from './plant.service';
import { DeviceService } from './device.service';
import { EnergyRecordService } from './energy-record.service';
import { TariffService } from './tariff.service';
import { NotFoundError, ForbiddenError, ConflictError } from '../../auth/domain/errors';

const plant = {
  id: 'plant-1',
  name: '屋顶电站 A',
  capacity: 10.5,
  location: null,
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PlantService', () => {
  const deps = { plants: { findById: vi.fn(), findByUserId: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
  let service: PlantService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlantService(deps.plants as never);
  });

  it('创建电站：携带当前用户 id', async () => {
    deps.plants.create.mockResolvedValue(plant);
    const result = await service.create('电站', 10, undefined, 'user-1');
    expect(deps.plants.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', name: '电站', capacity: 10 }),
    );
    expect(result.id).toBe('plant-1');
  });

  it('更新电站：非本人操作抛 ForbiddenError', async () => {
    deps.plants.findById.mockResolvedValue(plant);
    await expect(
      service.update('plant-1', 'other-user', { name: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('删除电站：不存在时抛 NotFoundError', async () => {
    deps.plants.findById.mockResolvedValue(null);
    await expect(service.remove('nope', 'user-1')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('DeviceService', () => {
  const device = {
    id: 'dev-1', serialNo: 'SN-1', name: '', type: 'INVERTER' as const,
    plantId: 'plant-1', createdAt: new Date(), updatedAt: new Date(),
  };
  const deps = {
    devices: { findById: vi.fn(), findBySerialNo: vi.fn(), findByPlantId: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
    plants: { findById: vi.fn() },
  };
  let service: DeviceService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeviceService(deps.devices as never, deps.plants as never);
  });

  it('创建设备：序列号重复抛 ConflictError', async () => {
    deps.plants.findById.mockResolvedValue(plant);
    deps.devices.findBySerialNo.mockResolvedValue(device);
    await expect(
      service.create('SN-1', 'plant-1', undefined, undefined, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('创建设备：电站归属他人抛 ForbiddenError', async () => {
    deps.plants.findById.mockResolvedValue({ ...plant, userId: 'other' });
    await expect(
      service.create('SN-2', 'plant-1', undefined, undefined, 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('创建设备：成功', async () => {
    deps.plants.findById.mockResolvedValue(plant);
    deps.devices.findBySerialNo.mockResolvedValue(null);
    deps.devices.create.mockResolvedValue(device);
    const result = await service.create('SN-1', 'plant-1', '逆变器', 'INVERTER', 'user-1');
    expect(result.serialNo).toBe('SN-1');
  });
});

describe('EnergyRecordService', () => {
  const deps = {
    records: { create: vi.fn(), findByPlantId: vi.fn(), aggregateDaily: vi.fn(), aggregateTotal: vi.fn() },
    devices: { findById: vi.fn() },
    plants: { findById: vi.fn() },
  };
  let service: EnergyRecordService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new EnergyRecordService(deps.records as never, deps.devices as never, deps.plants as never);
  });

  const input = { deviceId: 'dev-1', plantId: 'plant-1', generationKwh: 5.5, timestamp: new Date() };

  it('写入：设备不属于该电站抛 NotFoundError', async () => {
    deps.plants.findById.mockResolvedValue(plant);
    deps.devices.findById.mockResolvedValue({ ...device(), plantId: 'plant-2' });
    await expect(service.record(input, 'user-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('写入：成功时调用 records.create', async () => {
    deps.plants.findById.mockResolvedValue(plant);
    deps.devices.findById.mockResolvedValue({ ...device(), plantId: 'plant-1' });
    await service.record(input, 'user-1');
    expect(deps.records.create).toHaveBeenCalledWith(input);
  });

  it('聚合：非本人电站抛 ForbiddenError', async () => {
    deps.plants.findById.mockResolvedValue({ ...plant, userId: 'other' });
    await expect(
      service.totalAggregate('plant-1', 'user-1', new Date(), new Date()),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  function device() {
    return {
      id: 'dev-1', serialNo: 'SN-1', name: '', type: 'INVERTER' as const,
      plantId: 'plant-1', createdAt: new Date(), updatedAt: new Date(),
    };
  }
});

describe('TariffService', () => {
  const deps = { tariffs: { findById: vi.fn(), findEffectiveAt: vi.fn(), findAll: vi.fn(), create: vi.fn(), remove: vi.fn() } };
  let service: TariffService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new TariffService(deps.tariffs as never);
  });

  it('查询不存在费率抛 NotFoundError', async () => {
    deps.tariffs.findById.mockResolvedValue(null);
    await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('创建费率：默认币种与单位', async () => {
    deps.tariffs.create.mockResolvedValue({
      id: 't-1', unitPrice: 65, currency: 'CNY', billingUnit: 'kWh',
      effectiveAt: new Date(), createdAt: new Date(),
    });
    await service.create(65, new Date());
    expect(deps.tariffs.create).toHaveBeenCalledWith(
      expect.objectContaining({ unitPrice: 65 }),
    );
  });
});
