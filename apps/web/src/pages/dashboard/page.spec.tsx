// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Component as DashboardPage } from './page';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DashboardPage', () => {
  it('retries the primary overview queries after an error and renders recovered data', async () => {
    const listPlants = vi
      .spyOn(api, 'listPlants')
      .mockRejectedValueOnce(new Error('电站数据暂不可用'))
      .mockResolvedValueOnce([
        {
          id: 'plant-1',
          name: '东港光伏',
          capacityKw: 320.5,
          location: '上海市临港',
          status: 'UNKNOWN',
          createdAt: '2026-09-04T00:00:00.000Z',
        },
      ]);
    vi.spyOn(api, 'listBills').mockResolvedValue([]);
    vi.spyOn(api, 'listDevices').mockResolvedValue([]);
    vi.spyOn(api, 'listAnomalies').mockResolvedValue([]);
    vi.spyOn(api, 'listDailyEnergy').mockResolvedValue([]);
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>,
    );

    expect((await screen.findByRole('alert')).textContent).toContain('电站数据暂不可用');
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect((await screen.findAllByText('东港光伏')).length).toBeGreaterThan(0);
    await waitFor(() => expect(listPlants).toHaveBeenCalledTimes(2));
  });

  it('loads the default plant daily energy series into the trend chart', async () => {
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
    vi.spyOn(api, 'listBills').mockResolvedValue([]);
    vi.spyOn(api, 'listDevices').mockResolvedValue([]);
    vi.spyOn(api, 'listAnomalies').mockResolvedValue([]);
    const listDailyEnergy = vi.spyOn(api, 'listDailyEnergy').mockResolvedValue([
      {
        day: '2026-09-01T00:00:00.000Z',
        totalKwh: 18.5,
        recordCount: 2,
      },
      {
        day: '2026-09-02T00:00:00.000Z',
        totalKwh: 22.4,
        recordCount: 3,
      },
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('img', { name: '近 7 日发电量趋势' })).toBeTruthy();
    expect(screen.getAllByText('9月1日')).toHaveLength(2);
    await waitFor(() =>
      expect(listDailyEnergy).toHaveBeenCalledWith('plant-1', expect.any(String), expect.any(String)),
    );
  });

  it('shows a retryable error when the daily energy series cannot load', async () => {
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
    vi.spyOn(api, 'listBills').mockResolvedValue([]);
    vi.spyOn(api, 'listDevices').mockResolvedValue([]);
    vi.spyOn(api, 'listAnomalies').mockResolvedValue([]);
    const listDailyEnergy = vi
      .spyOn(api, 'listDailyEnergy')
      .mockRejectedValueOnce(new Error('趋势数据暂不可用'))
      .mockResolvedValueOnce([
        {
          day: '2026-09-01T00:00:00.000Z',
          totalKwh: 18.5,
          recordCount: 2,
        },
      ]);
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>,
    );

    expect((await screen.findByRole('alert')).textContent).toContain('趋势数据暂不可用');
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByRole('img', { name: '近 7 日发电量趋势' })).toBeTruthy();
    await waitFor(() => expect(listDailyEnergy).toHaveBeenCalledTimes(2));
  });
});
