// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Component as AnomaliesPage } from './page';

const anomaly = {
  id: 'anomaly-1',
  plantId: 'plant-1',
  type: 'DEVICE_OFFLINE',
  message: '东港逆变器离线',
  severity: 'HIGH' as const,
  status: 'OPEN' as const,
  createdAt: '2026-09-04T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AnomaliesPage', () => {
  it('retries a failed anomaly query and renders the recovered alerts', async () => {
    const listAnomalies = vi
      .spyOn(api, 'listAnomalies')
      .mockRejectedValueOnce(new Error('告警服务暂不可用'))
      .mockResolvedValueOnce([anomaly]);
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AnomaliesPage />
      </QueryClientProvider>,
    );

    expect((await screen.findByRole('alert')).textContent).toContain('告警服务暂不可用');
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByText('东港逆变器离线')).toBeTruthy();
    await waitFor(() => expect(listAnomalies).toHaveBeenCalledTimes(2));
  });

  it('refreshes anomaly data without exposing a mutation action', async () => {
    const listAnomalies = vi
      .spyOn(api, 'listAnomalies')
      .mockResolvedValueOnce([anomaly])
      .mockResolvedValueOnce([{ ...anomaly, message: '东港逆变器已恢复连接' }]);
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AnomaliesPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('东港逆变器离线')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '刷新异常告警' }));

    expect(await screen.findByText('东港逆变器已恢复连接')).toBeTruthy();
    await waitFor(() => expect(listAnomalies).toHaveBeenCalledTimes(2));
  });
});
