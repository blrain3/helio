import { describe, expect, it } from 'vitest';
import { createApi } from './api';

describe('createApi', () => {
  it('loads plants through the API transport instead of returning demo records', async () => {
    const requestedPaths: string[] = [];
    const api = createApi({
      request: async <T>(path: string): Promise<T> => {
        requestedPaths.push(path);
        if (path !== '/plants') {
          throw new Error(`unexpected path: ${path}`);
        }

        return [
          {
            id: 'plant-1',
            name: '南站',
            capacity: 600,
            location: null,
            userId: 'user-1',
            createdAt: '2026-09-04T08:00:00.000Z',
            updatedAt: '2026-09-04T08:00:00.000Z',
          },
        ] as T;
      },
    });

    await expect(api.listPlants()).resolves.toEqual([
      {
        id: 'plant-1',
        name: '南站',
        capacityKw: 600,
        location: '未填写',
        status: 'UNKNOWN',
        createdAt: '2026-09-04T08:00:00.000Z',
      },
    ]);
    expect(requestedPaths).toEqual(['/plants']);
  });
});
