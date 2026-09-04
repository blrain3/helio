// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Component as BillsPage } from './page';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('BillsPage', () => {
  it('generates a bill from a plant and selected billing period', async () => {
    vi.spyOn(api, 'listBills').mockResolvedValue([]);
    vi.spyOn(api, 'listPlants').mockResolvedValue([
      {
        id: 'plant-1',
        name: '东港光伏',
        capacityKw: 320.5,
        location: '上海市临港',
        status: 'UNKNOWN',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ]);
    const generateBill = vi.spyOn(api, 'generateBill').mockResolvedValue({
      id: 'bill-1',
      plantId: 'plant-1',
      consumedKwh: 680,
      totalAmount: 24480,
      periodStart: '2026-09-01T00:00:00.000Z',
      status: 'DRAFT',
      createdAt: '2026-09-04T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BillsPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '生成账单' }));
    await user.selectOptions(screen.getByLabelText('所属电站'), 'plant-1');
    await user.clear(screen.getByLabelText('电量 (kWh)'));
    await user.type(screen.getByLabelText('电量 (kWh)'), '680');
    await user.type(screen.getByLabelText('开始日期'), '2026-09-01');
    await user.type(screen.getByLabelText('结束日期'), '2026-09-30');
    await user.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => expect(generateBill).toHaveBeenCalledTimes(1));
    expect(generateBill.mock.calls[0]?.[0]).toEqual({
      plantId: 'plant-1',
      consumedKwh: 680,
      periodStart: '2026-09-01T00:00:00.000Z',
      periodEnd: '2026-09-30T23:59:59.999Z',
    });
    expect(screen.getByRole('status').textContent).toContain('账单已生成');
  });

  it('issues a pending bill from its row action', async () => {
    vi.spyOn(api, 'listPlants').mockResolvedValue([]);
    vi.spyOn(api, 'listBills').mockResolvedValue([
      {
        id: 'bill-1',
        plantId: 'plant-1',
        period: '2026-09',
        amount: 24480,
        energyKwh: 680,
        status: 'PENDING',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ]);
    const issueBill = vi.spyOn(api, 'issueBill').mockResolvedValue({
      id: 'bill-1',
      plantId: 'plant-1',
      consumedKwh: 680,
      totalAmount: 24480,
      periodStart: '2026-09-01T00:00:00.000Z',
      status: 'ISSUED',
      createdAt: '2026-09-04T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <BillsPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '发出 bill-1' }));

    await waitFor(() => expect(issueBill).toHaveBeenCalledTimes(1));
    expect(issueBill.mock.calls[0]?.[0]).toBe('bill-1');
    expect(screen.getByRole('status').textContent).toContain('账单已发出');
  });
});
