import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns liveness without querying external dependencies', () => {
    const queryRaw = vi.fn();
    const controller = new HealthController({ $queryRaw: queryRaw } as never);

    expect(controller.liveness()).toEqual({ status: 'ok' });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns ready after the database query succeeds', async () => {
    const controller = new HealthController({
      $queryRaw: vi.fn(async () => [{ result: 1 }]),
    } as never);

    await expect(controller.readiness()).resolves.toEqual({ status: 'ready' });
  });

  it('returns 503 when the database is unavailable', async () => {
    const controller = new HealthController({
      $queryRaw: vi.fn(async () => {
        throw new Error('database unavailable');
      }),
    } as never);

    await expect(controller.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
