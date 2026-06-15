import type {
  Plant,
  Device,
  Bill,
  Order,
  Payment,
  Anomaly,
} from './types';

/**
 * 演示数据（接入后端后由 api.ts 的 fetch 实现替换）。
 * 金额单位为「分」，时间以 ISO 字符串给出。
 */

export const PLANTS: Plant[] = [
  { id: 'plt-001', name: '西北光伏电站 A', location: '甘肃 · 敦煌', capacityKw: 5000, status: 'ONLINE', createdAt: '2026-01-12T08:00:00Z' },
  { id: 'plt-002', name: '分布式屋顶电站 B', location: '广东 · 深圳', capacityKw: 1200, status: 'ONLINE', createdAt: '2026-02-03T08:00:00Z' },
  { id: 'plt-003', name: '农光互补电站 C', location: '山东 · 潍坊', capacityKw: 8000, status: 'FAULT', createdAt: '2026-03-18T08:00:00Z' },
  { id: 'plt-004', name: '工商业屋顶电站 D', location: '江苏 · 苏州', capacityKw: 2600, status: 'OFFLINE', createdAt: '2026-05-09T08:00:00Z' },
];

export const DEVICES: Device[] = [
  { id: 'dev-001', plantId: 'plt-001', name: '逆变器 #1', type: 'INVERTER', serialNo: 'INV-2026-0001', status: 'ONLINE' },
  { id: 'dev-002', plantId: 'plt-001', name: '智能电表 #1', type: 'METER', serialNo: 'MTR-2026-0001', status: 'ONLINE' },
  { id: 'dev-003', plantId: 'plt-002', name: '逆变器 #1', type: 'INVERTER', serialNo: 'INV-2026-0002', status: 'ONLINE' },
  { id: 'dev-004', plantId: 'plt-003', name: '储能电池 #1', type: 'BATTERY', serialNo: 'BAT-2026-0001', status: 'FAULT' },
  { id: 'dev-005', plantId: 'plt-004', name: '光伏组件阵列', type: 'PANEL', serialNo: 'PNL-2026-0001', status: 'OFFLINE' },
];

export const BILLS: Bill[] = [
  { id: 'bill-001', plantId: 'plt-001', period: '2026-08', amount: 1285000, energyKwh: 84200, status: 'PAID', createdAt: '2026-09-01T02:00:00Z' },
  { id: 'bill-002', plantId: 'plt-002', period: '2026-08', amount: 305200, energyKwh: 19600, status: 'ISSUED', createdAt: '2026-09-01T02:00:00Z' },
  { id: 'bill-003', plantId: 'plt-003', period: '2026-08', amount: 2104000, energyKwh: 130500, status: 'OVERDUE', createdAt: '2026-09-01T02:00:00Z' },
  { id: 'bill-004', plantId: 'plt-004', period: '2026-08', amount: 660000, energyKwh: 41200, status: 'DRAFT', createdAt: '2026-09-01T02:00:00Z' },
];

export const ORDERS: Order[] = [
  { id: 'ord-001', billId: 'bill-001', amount: 1285000, status: 'PAID', createdAt: '2026-09-01T03:00:00Z' },
  { id: 'ord-002', billId: 'bill-002', amount: 305200, status: 'PENDING', createdAt: '2026-09-01T03:00:00Z' },
  { id: 'ord-003', billId: 'bill-003', amount: 2104000, status: 'CREATED', createdAt: '2026-09-01T03:00:00Z' },
];

export const PAYMENTS: Payment[] = [
  { id: 'pay-001', orderId: 'ord-001', provider: 'wechat', providerTransactionId: 'WX4200001', amount: 1285000, refundedAmount: 0, status: 'SUCCESS', createdAt: '2026-09-01T03:05:00Z' },
  { id: 'pay-002', orderId: 'ord-002', provider: 'alipay', providerTransactionId: 'ALI20260901', amount: 305200, refundedAmount: 0, status: 'PENDING', createdAt: '2026-09-01T03:05:00Z' },
  { id: 'pay-003', orderId: 'ord-001', provider: 'wechat', providerTransactionId: 'WX4200002', amount: 50000, refundedAmount: 50000, status: 'REFUNDED', createdAt: '2026-09-02T09:00:00Z' },
];

export const ANOMALIES: Anomaly[] = [
  { id: 'anm-001', plantId: 'plt-003', type: 'DEVICE_OFFLINE', message: '储能电池 #1 离线超过 30 分钟', severity: 'HIGH', status: 'OPEN', createdAt: '2026-09-02T14:30:00Z' },
  { id: 'anm-002', plantId: 'plt-001', type: 'ENERGY_SPIKE', message: '发电功率出现异常尖峰', severity: 'MEDIUM', status: 'OPEN', createdAt: '2026-09-02T11:20:00Z' },
  { id: 'anm-003', plantId: null, type: 'MISSING_DATA', message: '昨日 23:00-24:00 数据缺失', severity: 'LOW', status: 'RESOLVED', createdAt: '2026-09-01T09:00:00Z' },
];
