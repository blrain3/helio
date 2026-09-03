/**
 * 前端领域类型（与后端 API 契约对齐，金额统一为「分」）。
 */

export type PlantStatus = 'ONLINE' | 'OFFLINE' | 'FAULT';

export interface Plant {
  id: string;
  name: string;
  location: string;
  /** 装机容量（kW） */
  capacityKw: number;
  status: PlantStatus;
  createdAt: string;
}

export type DeviceType = 'INVERTER' | 'PANEL' | 'METER' | 'BATTERY';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'FAULT';

export interface Device {
  id: string;
  plantId: string;
  name: string;
  type: DeviceType;
  serialNo: string;
  status: DeviceStatus;
}

export type BillStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE';

export interface Bill {
  id: string;
  plantId: string;
  /** 账期，如 2026-08 */
  period: string;
  /** 金额（分） */
  amount: number;
  /** 用电/发电量（kWh） */
  energyKwh: number;
  status: BillStatus;
  createdAt: string;
}

export type OrderStatus = 'CREATED' | 'PENDING' | 'PAID' | 'CLOSED' | 'REFUNDED';

export interface Order {
  id: string;
  billId: string;
  /** 金额（分） */
  amount: number;
  status: OrderStatus;
  createdAt: string;
}

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CLOSED'
  | 'REFUNDED';

export type PaymentProvider = 'mock' | 'wechat' | 'alipay';

export interface Payment {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  providerTransactionId: string | null;
  /** 金额（分） */
  amount: number;
  status: PaymentStatus;
  createdAt: string;
}

export type AnomalyType = 'MISSING_DATA' | 'ENERGY_SPIKE' | 'DEVICE_OFFLINE';

export type AnomalyStatus = 'OPEN' | 'RESOLVED';

export interface Anomaly {
  id: string;
  plantId: string | null;
  type: AnomalyType;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: AnomalyStatus;
  createdAt: string;
}
