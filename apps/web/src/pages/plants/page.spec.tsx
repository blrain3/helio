// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Component as PlantsPage } from './page';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PlantsPage', () => {
  it('creates a plant from the console and confirms the completed action', async () => {
    const listPlants = vi.spyOn(api, 'listPlants').mockResolvedValue([]);
    const createPlant = vi.spyOn(api, 'createPlant').mockResolvedValue({
      id: 'plant-1',
      name: '东港光伏',
      capacity: 320.5,
      location: '上海市临港',
      createdAt: '2026-09-04T00:00:00.000Z',
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PlantsPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '新建电站' }));
    await user.type(screen.getByLabelText('电站名称'), '东港光伏');
    await user.clear(screen.getByLabelText('装机容量 (kW)'));
    await user.type(screen.getByLabelText('装机容量 (kW)'), '320.5');
    await user.type(screen.getByLabelText('位置'), '上海市临港');
    await user.click(screen.getByRole('button', { name: '保存电站' }));

    await waitFor(() => expect(createPlant).toHaveBeenCalledTimes(1));
    expect(createPlant.mock.calls[0]?.[0]).toEqual(
      {
        name: '东港光伏',
        capacity: 320.5,
        location: '上海市临港',
      },
    );
    await waitFor(() => expect(listPlants).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('status').textContent).toContain('电站已创建');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('edits and deletes a plant through row actions', async () => {
    const plant = {
      id: 'plant-1',
      name: '东港光伏',
      capacityKw: 320.5,
      location: '上海市临港',
      status: 'UNKNOWN' as const,
      createdAt: '2026-09-04T00:00:00.000Z',
    };
    vi.spyOn(api, 'listPlants').mockResolvedValue([plant]);
    const updatePlant = vi.spyOn(api, 'updatePlant').mockResolvedValue({
      id: plant.id,
      name: '东港二期',
      capacity: 400,
      location: plant.location,
      createdAt: plant.createdAt,
    });
    const removePlant = vi.spyOn(api, 'removePlant').mockResolvedValue(undefined);
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PlantsPage />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '编辑 东港光伏' }));
    await user.clear(screen.getByLabelText('电站名称'));
    await user.type(screen.getByLabelText('电站名称'), '东港二期');
    await user.clear(screen.getByLabelText('装机容量 (kW)'));
    await user.type(screen.getByLabelText('装机容量 (kW)'), '400');
    await user.click(screen.getByRole('button', { name: '保存更改' }));

    await waitFor(() => expect(updatePlant).toHaveBeenCalledTimes(1));
    expect(updatePlant.mock.calls[0]?.[0]).toBe('plant-1');
    expect(updatePlant.mock.calls[0]?.[1]).toEqual({
      name: '东港二期',
      capacity: 400,
      location: '上海市临港',
    });

    await user.click(screen.getByRole('button', { name: '删除 东港光伏' }));
    await user.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => expect(removePlant).toHaveBeenCalledTimes(1));
    expect(removePlant.mock.calls[0]?.[0]).toBe('plant-1');
  });
});
