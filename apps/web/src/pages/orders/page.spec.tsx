// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Component as OrdersPage } from './page';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('OrdersPage', () => {
  it('creates an order using the immutable amount from an issued bill', async () => {
    vi.spyOn(api, 'listOrders').mockResolvedValue([]);
    vi.spyOn(api, 'listBills').mockResolvedValue([
      {
        id: 'bill-1',
        plantId: 'plant-1',
        period: '2026-09',
        amount: 24480,
        energyKwh: 680,
        status: 'ISSUED',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ]);
    const createOrder = vi.spyOn(api, 'createOrder').mockResolvedValue({
      id: 'order-1',
      billId: 'bill-1',
      amount: 24480,
      status: 'CREATED',
      createdAt: '2026-09-04T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OrdersPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '新建订单' }));
    await user.selectOptions(screen.getByLabelText('关联账单'), 'bill-1');
    expect(screen.getByText('¥244.80')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '创建订单' }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    expect(createOrder.mock.calls[0]?.[0]).toEqual({ billId: 'bill-1', amount: 24480 });
    expect(screen.getByRole('status').textContent).toContain('订单已创建');
  });

  it('exposes only valid order state transitions', async () => {
    vi.spyOn(api, 'listBills').mockResolvedValue([]);
    vi.spyOn(api, 'listOrders').mockResolvedValue([
      {
        id: 'order-created',
        billId: 'bill-1',
        amount: 24480,
        status: 'CREATED',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
      {
        id: 'order-paid',
        billId: 'bill-2',
        amount: 12800,
        status: 'PAID',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ]);
    const submitPayment = vi.spyOn(api, 'submitOrderPayment').mockResolvedValue({
      id: 'order-created',
      billId: 'bill-1',
      amount: 24480,
      status: 'PENDING_PAYMENT',
      createdAt: '2026-09-04T00:00:00.000Z',
    });
    const closeOrder = vi.spyOn(api, 'closeOrder').mockResolvedValue({
      id: 'order-created',
      billId: 'bill-1',
      amount: 24480,
      status: 'CLOSED',
      createdAt: '2026-09-04T00:00:00.000Z',
    });
    const completeOrder = vi.spyOn(api, 'completeOrder').mockResolvedValue({
      id: 'order-paid',
      billId: 'bill-2',
      amount: 12800,
      status: 'COMPLETED',
      createdAt: '2026-09-04T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OrdersPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '提交支付 order-created' }));
    await user.click(screen.getByRole('button', { name: '关闭订单 order-created' }));
    await user.click(screen.getByRole('button', { name: '确认关闭' }));
    await user.click(screen.getByRole('button', { name: '完成订单 order-paid' }));

    await waitFor(() => expect(submitPayment).toHaveBeenCalledWith('order-created'));
    await waitFor(() => expect(closeOrder).toHaveBeenCalledWith('order-created'));
    await waitFor(() => expect(completeOrder).toHaveBeenCalledWith('order-paid'));
  });
});
