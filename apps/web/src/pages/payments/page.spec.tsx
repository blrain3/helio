// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Component as PaymentsPage } from './page';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PaymentsPage', () => {
  it('creates a Mock payment for an order waiting for payment', async () => {
    vi.spyOn(api, 'listPayments').mockResolvedValue([]);
    vi.spyOn(api, 'listOrders').mockResolvedValue([
      {
        id: 'order-1',
        billId: 'bill-1',
        amount: 24480,
        status: 'PENDING_PAYMENT',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ]);
    const createPayment = vi.spyOn(api, 'createPayment').mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      provider: 'mock',
      providerTransactionId: 'MOCK-1',
      amount: 24480,
      refundedAmount: 0,
      status: 'PENDING',
      createdAt: '2026-09-04T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PaymentsPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '新建模拟支付' }));
    await user.selectOptions(screen.getByLabelText('关联订单'), 'order-1');
    await user.click(screen.getByRole('button', { name: '创建模拟支付' }));

    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(1));
    expect(createPayment).toHaveBeenCalledWith({ orderId: 'order-1', provider: 'mock' });
    expect(screen.getByRole('status').textContent).toContain('模拟支付已创建');
  });

  it('completes a pending Mock payment from its row action', async () => {
    vi.spyOn(api, 'listOrders').mockResolvedValue([]);
    vi.spyOn(api, 'listPayments').mockResolvedValue([
      {
        id: 'payment-1',
        orderId: 'order-1',
        provider: 'mock',
        providerTransactionId: 'MOCK-1',
        amount: 24480,
        refundedAmount: 0,
        status: 'PENDING',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ]);
    const completeMockPayment = vi.spyOn(api, 'completeMockPayment').mockResolvedValue({ ack: 'ok' });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PaymentsPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '完成模拟支付 payment-1' }));

    await waitFor(() => expect(completeMockPayment).toHaveBeenCalledWith('payment-1'));
    expect(screen.getByRole('status').textContent).toContain('模拟支付回调已处理');
  });

  it('requires confirmation before closing a pending payment', async () => {
    vi.spyOn(api, 'listOrders').mockResolvedValue([]);
    vi.spyOn(api, 'listPayments').mockResolvedValue([
      {
        id: 'payment-1',
        orderId: 'order-1',
        provider: 'mock',
        providerTransactionId: 'MOCK-1',
        amount: 24480,
        refundedAmount: 0,
        status: 'PENDING',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ]);
    const closePayment = vi.spyOn(api, 'closePayment').mockResolvedValue({
      id: 'payment-1',
      orderId: 'order-1',
      provider: 'mock',
      providerTransactionId: 'MOCK-1',
      amount: 24480,
      refundedAmount: 0,
      status: 'CLOSED',
      createdAt: '2026-09-04T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PaymentsPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '关闭支付 payment-1' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '确认关闭' }));

    await waitFor(() => expect(closePayment).toHaveBeenCalledWith('payment-1'));
    expect(screen.getByRole('status').textContent).toContain('支付已关闭');
  });

  it('refunds only the remaining amount of a successful payment', async () => {
    vi.spyOn(api, 'listOrders').mockResolvedValue([]);
    vi.spyOn(api, 'listPayments').mockResolvedValue([
      {
        id: 'payment-1',
        orderId: 'order-1',
        provider: 'mock',
        providerTransactionId: 'MOCK-1',
        amount: 24480,
        refundedAmount: 4400,
        status: 'SUCCESS',
        createdAt: '2026-09-04T00:00:00.000Z',
      },
    ]);
    const refundPayment = vi.spyOn(api, 'refundPayment').mockResolvedValue({ id: 'refund-1' });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PaymentsPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '退款 payment-1' }));
    expect(screen.getByText('可退金额 ¥200.80')).toBeTruthy();
    await user.clear(screen.getByLabelText('退款金额 (元)'));
    await user.type(screen.getByLabelText('退款金额 (元)'), '100.5');
    await user.click(screen.getByRole('button', { name: '确认退款' }));

    await waitFor(() => expect(refundPayment).toHaveBeenCalledWith('payment-1', 10050));
    expect(screen.getByRole('status').textContent).toContain('退款已发起');
  });

  it('shows a retryable error when the payment query fails', async () => {
    const listPayments = vi.spyOn(api, 'listPayments').mockRejectedValue(new Error('支付服务暂不可用'));
    vi.spyOn(api, 'listOrders').mockResolvedValue([]);
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PaymentsPage />
      </QueryClientProvider>,
    );

    expect((await screen.findByRole('alert')).textContent).toContain('支付服务暂不可用');
    await user.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(listPayments).toHaveBeenCalledTimes(2));
  });
});
