// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Component as DevicesPage } from './page';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DevicesPage', () => {
  it('creates a device for a selected plant and confirms the action', async () => {
    vi.spyOn(api, 'listDevices').mockResolvedValue([]);
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
    const createDevice = vi.spyOn(api, 'createDevice').mockResolvedValue({
      id: 'device-1',
      plantId: 'plant-1',
      name: '东港逆变器',
      serialNo: 'INV-DG-001',
      type: 'INVERTER',
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DevicesPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '新建设备' }));
    await user.selectOptions(screen.getByLabelText('所属电站'), 'plant-1');
    await user.type(screen.getByLabelText('设备名称'), '东港逆变器');
    await user.type(screen.getByLabelText('设备序列号'), 'INV-DG-001');
    await user.selectOptions(screen.getByLabelText('设备类型'), 'INVERTER');
    await user.click(screen.getByRole('button', { name: '保存设备' }));

    await waitFor(() => expect(createDevice).toHaveBeenCalledTimes(1));
    expect(createDevice.mock.calls[0]?.[0]).toEqual({
      plantId: 'plant-1',
      name: '东港逆变器',
      serialNo: 'INV-DG-001',
      type: 'INVERTER',
    });
    expect(screen.getByRole('status').textContent).toContain('设备已创建');
  });

  it('updates supported device fields and requires confirmation before deletion', async () => {
    const device = {
      id: 'device-1',
      plantId: 'plant-1',
      name: '东港逆变器',
      serialNo: 'INV-DG-001',
      type: 'INVERTER' as const,
      status: 'UNKNOWN' as const,
    };
    vi.spyOn(api, 'listDevices').mockResolvedValue([device]);
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
    const updateDevice = vi.spyOn(api, 'updateDevice').mockResolvedValue({
      ...device,
      name: '东港逆变器 B',
      type: 'METER',
    });
    const removeDevice = vi.spyOn(api, 'removeDevice').mockResolvedValue(undefined);
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DevicesPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '编辑 东港逆变器' }));
    await user.clear(screen.getByLabelText('设备名称'));
    await user.type(screen.getByLabelText('设备名称'), '东港逆变器 B');
    await user.selectOptions(screen.getByLabelText('设备类型'), 'METER');
    await user.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(() => expect(updateDevice).toHaveBeenCalledTimes(1));
    expect(updateDevice.mock.calls[0]?.[0]).toBe('device-1');
    expect(updateDevice.mock.calls[0]?.[1]).toEqual({ name: '东港逆变器 B', type: 'METER' });

    await user.click(screen.getByRole('button', { name: '删除 东港逆变器' }));
    await user.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(removeDevice).toHaveBeenCalledTimes(1));
    expect(removeDevice.mock.calls[0]?.[0]).toBe('device-1');
  });
});
