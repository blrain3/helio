import type {
  Plant,
  Device,
  Bill,
  Order,
  Payment,
  Anomaly,
} from './types';
import { PLANTS, DEVICES, BILLS, ORDERS, PAYMENTS, ANOMALIES } from './data';

/**
 * 数据访问层（供 TanStack Query 使用）。
 *
 * 当前返回演示数据（模拟网络延迟）。接入后端后，将各函数替换为对
 * `import.meta.env.VITE_API_BASE_URL` 的 fetch 调用并携带 JWT，
 * 保持返回类型不变即可无缝切换。示例：
 *
 *   const res = await fetch(`${API_BASE}/plants`, { headers: authHeaders() });
 *   return res.json() as Promise<Plant[]>;
 */

function delay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export const api = {
  listPlants: (): Promise<Plant[]> => delay(PLANTS),
  listDevices: (): Promise<Device[]> => delay(DEVICES),
  listBills: (): Promise<Bill[]> => delay(BILLS),
  listOrders: (): Promise<Order[]> => delay(ORDERS),
  listPayments: (): Promise<Payment[]> => delay(PAYMENTS),
  listAnomalies: (): Promise<Anomaly[]> => delay(ANOMALIES),
};
