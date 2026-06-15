/**
 * 能源域领域实体与输入类型。
 *
 * 与 auth 域一致，使用接口描述领域实体，避免与 Prisma 生成类型耦合，
 * 由 infrastructure 层负责 Prisma 模型到领域实体的映射。
 */

/** 电站（发电场站）。 */
export interface PlantEntity {
  id: string;
  name: string;
  /** 装机容量（kW）。 */
  capacity: number;
  /** 安装地址（可选）。 */
  location: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建电站的输入。 */
export interface CreatePlantInput {
  name: string;
  capacity: number;
  location?: string | null;
  userId: string;
}

/** 更新电站的输入（仅允许修改名称/容量/地址）。 */
export interface UpdatePlantInput {
  name?: string;
  capacity?: number;
  location?: string | null;
}

/** 设备类型（逆变器/电表/传感器等）。 */
export type DeviceType = 'INVERTER' | 'METER' | 'SENSOR' | 'BATTERY' | 'OTHER';

/** 设备。 */
export interface DeviceEntity {
  id: string;
  serialNo: string;
  name: string;
  type: DeviceType;
  plantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建设备的输入。 */
export interface CreateDeviceInput {
  serialNo: string;
  name?: string;
  type?: DeviceType;
  plantId: string;
}

/** 更新设备的输入。 */
export interface UpdateDeviceInput {
  name?: string;
  type?: DeviceType;
}

/** 费率。 */
export interface TariffEntity {
  id: string;
  /** 单价（分 / billingUnit）。 */
  unitPrice: number;
  /** 币种。 */
  currency: string;
  /** 计费单位。 */
  billingUnit: string;
  /** 生效时间。 */
  effectiveAt: Date;
  createdAt: Date;
}

/** 创建费率的输入。 */
export interface CreateTariffInput {
  unitPrice: number;
  currency?: string;
  billingUnit?: string;
  effectiveAt: Date;
}

/** 发电记录（时序，写入 energy_record 分区表）。 */
export interface CreateEnergyRecordInput {
  deviceId: string;
  plantId: string;
  /** 发电量（kWh）。 */
  generationKwh: number;
  /** 计量时间戳。 */
  timestamp: Date;
}

/** 发电记录（时序，从 energy_record 读取）。 */
export interface EnergyRecordEntity {
  id: number;
  deviceId: string;
  plantId: string;
  generationKwh: number;
  timestamp: Date;
}
