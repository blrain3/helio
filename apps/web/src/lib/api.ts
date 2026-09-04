import type {
  Plant,
  Device,
  Bill,
  Order,
  Payment,
  Anomaly,
  DailyEnergyPoint,
} from './types';
import type { HelioRequestOptions } from '@helio/api-client';
import { authenticatedClient } from './api-client';

export interface ApiTransport {
  request<T>(path: string, options?: HelioRequestOptions): Promise<T>;
}

interface PlantResponse {
  id: string;
  name: string;
  capacity: number;
  location: string | null;
  createdAt: string;
}

interface DeviceResponse {
  id: string;
  plantId: string;
  name: string;
  serialNo: string;
  type: Device['type'];
}

interface BillResponse {
  id: string;
  plantId: string;
  consumedKwh: number;
  totalAmount: number;
  periodStart: string;
  status: Bill['status'];
  createdAt: string;
}

interface OrderResponse {
  id: string;
  billId: string | null;
  amount: number;
  status: Order['status'];
  createdAt: string;
}

interface PaymentResponse {
  id: string;
  orderId: string;
  provider: Payment['provider'];
  providerTransactionId: string | null;
  amount: number;
  refundedAmount: number;
  status: Payment['status'];
  createdAt: string;
}

interface AnomalyResponse {
  id: string;
  plantId: string;
  ruleId: string;
  severity: 'NORMAL' | 'WARNING' | 'CRITICAL';
  actualValue: number;
  detectedAt: string;
}

export const queryKeys = {
  plants: ['plants'] as const,
  devices: ['devices'] as const,
  bills: ['bills'] as const,
  orders: ['orders'] as const,
  payments: ['payments'] as const,
  anomalies: ['anomalies'] as const,
  dailyEnergy: (plantId: string, start: string, end: string) =>
    ['daily-energy', plantId, start, end] as const,
};

type QueryKey = readonly unknown[];
type MutationInvalidator = (keys: QueryKey[]) => void | Promise<void>;

export interface CreateApiOptions {
  invalidate?: MutationInvalidator;
}

/**
 * Authenticated resource adapter used by TanStack Query and future console
 * mutations. It keeps the existing display models while using the shared
 * generated HTTP client underneath.
 */

export function createApi(client: ApiTransport, options: CreateApiOptions = {}) {
  const mutate = async <T>(
    path: string,
    requestOptions: HelioRequestOptions,
    keys: QueryKey[],
  ): Promise<T> => {
    const result = await client.request<T>(path, requestOptions);
    await options.invalidate?.(keys);
    return result;
  };

  return {
    listPlants: async (): Promise<Plant[]> => {
      const plants = await client.request<PlantResponse[]>('/plants');
      return plants.map((plant) => ({
        id: plant.id,
        name: plant.name,
        capacityKw: plant.capacity,
        location: plant.location ?? '未填写',
        status: 'UNKNOWN',
        createdAt: plant.createdAt,
      }));
    },
    listDevices: async (): Promise<Device[]> => {
      const devices = await client.request<DeviceResponse[]>('/devices');
      return devices.map((device) => ({ ...device, status: 'UNKNOWN' }));
    },
    listBills: async (): Promise<Bill[]> => {
      const bills = await client.request<BillResponse[]>('/bills');
      return bills.map((bill) => ({
        id: bill.id,
        plantId: bill.plantId,
        period: bill.periodStart.slice(0, 7),
        amount: bill.totalAmount,
        energyKwh: bill.consumedKwh,
        status: bill.status,
        createdAt: bill.createdAt,
      }));
    },
    listOrders: async (): Promise<Order[]> => client.request<OrderResponse[]>('/orders'),
    listPayments: async (): Promise<Payment[]> => client.request<PaymentResponse[]>('/payments'),
    listAnomalies: async (): Promise<Anomaly[]> => {
      const events = await client.request<AnomalyResponse[]>('/anomalies');
      return events.map((event) => ({
        id: event.id,
        plantId: event.plantId,
        type: event.ruleId,
        message: `检测值 ${event.actualValue}`,
        severity: anomalySeverity(event.severity),
        status: 'OPEN',
        createdAt: event.detectedAt,
      }));
    },
    listDailyEnergy: (plantId: string, start: string, end: string): Promise<DailyEnergyPoint[]> => {
      const search = new URLSearchParams({ start, end });
      return client.request<DailyEnergyPoint[]>(`/plants/${plantId}/energy/daily?${search.toString()}`);
    },
    createPlant: (body: { name: string; capacity: number; location?: string }) =>
      mutate<PlantResponse>('/plants', { method: 'POST', body }, [queryKeys.plants]),
    updatePlant: (id: string, body: { name?: string; capacity?: number; location?: string }) =>
      mutate<PlantResponse>(`/plants/${id}`, { method: 'PATCH', body }, [queryKeys.plants]),
    removePlant: (id: string) =>
      mutate<void>(`/plants/${id}`, { method: 'DELETE' }, [
        queryKeys.plants,
        queryKeys.devices,
        queryKeys.bills,
        queryKeys.anomalies,
      ]),
    createDevice: (body: { plantId: string; serialNo: string; name?: string; type?: string }) =>
      mutate<DeviceResponse>('/devices', { method: 'POST', body }, [queryKeys.devices]),
    updateDevice: (id: string, body: { name?: string; type?: string }) =>
      mutate<DeviceResponse>(`/devices/${id}`, { method: 'PATCH', body }, [queryKeys.devices]),
    removeDevice: (id: string) =>
      mutate<void>(`/devices/${id}`, { method: 'DELETE' }, [queryKeys.devices]),
    generateBill: (body: {
      plantId: string;
      consumedKwh: number;
      periodStart: string;
      periodEnd: string;
    }) => mutate<BillResponse>('/bills', { method: 'POST', body }, [queryKeys.bills]),
    issueBill: (id: string) =>
      mutate<BillResponse>(`/bills/${id}/issue`, { method: 'PATCH' }, [queryKeys.bills]),
    createOrder: (body: { billId: string; amount: number }) =>
      mutate<OrderResponse>('/orders', { method: 'POST', body }, [queryKeys.orders, queryKeys.bills]),
    submitOrderPayment: (id: string) =>
      mutate<OrderResponse>(`/orders/${id}/submit-payment`, { method: 'PATCH' }, [queryKeys.orders]),
    completeOrder: (id: string) =>
      mutate<OrderResponse>(`/orders/${id}/complete`, { method: 'PATCH' }, [queryKeys.orders]),
    closeOrder: (id: string) =>
      mutate<OrderResponse>(`/orders/${id}/close`, { method: 'PATCH' }, [queryKeys.orders]),
    createPayment: (body: { orderId: string; provider?: Payment['provider']; notifyUrl?: string }) =>
      mutate<PaymentResponse>('/payments', { method: 'POST', body }, [queryKeys.payments, queryKeys.orders]),
    completeMockPayment: (id: string) =>
      mutate<{ ack: string }>(`/payments/${id}/mock-complete`, { method: 'POST' }, [
        queryKeys.payments,
        queryKeys.orders,
        queryKeys.bills,
      ]),
    closePayment: (id: string) =>
      mutate<PaymentResponse>(`/payments/${id}/close`, { method: 'PATCH' }, [queryKeys.payments]),
    refundPayment: (id: string, amount: number) =>
      mutate<unknown>(`/payments/${id}/refund`, { method: 'POST', body: { amount } }, [queryKeys.payments]),
  };

}

function anomalySeverity(severity: AnomalyResponse['severity']): Anomaly['severity'] {
  if (severity === 'CRITICAL') return 'HIGH';
  if (severity === 'WARNING') return 'MEDIUM';
  return 'LOW';
}

let invalidate: MutationInvalidator | undefined;

export function configureApiInvalidation(next: MutationInvalidator): void {
  invalidate = next;
}

export const api = createApi(authenticatedClient, {
  invalidate: (keys) => invalidate?.(keys),
});
