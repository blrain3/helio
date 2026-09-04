import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../../common/guards/jwt-auth.guard';
import { PaymentController } from './payment.controller';

describe('PaymentController Mock callback endpoint', () => {
  it('does not mark the server-side Mock completion route public', () => {
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        PaymentController.prototype.completeMockPayment,
      ),
    ).toBeUndefined();
  });

  it('forwards the route payment ID and authenticated principal to the server-side orchestrator', async () => {
    const complete = vi.fn().mockResolvedValue({ ack: 'ok' });
    const user = {
      sub: 'user-1',
      email: 'owner@helio.dev',
      role: 'USER' as const,
    };
    const controller = new PaymentController(
      {} as never,
      {} as never,
      { complete } as never,
    );

    await expect(controller.completeMockPayment('payment-1', user)).resolves.toEqual({ ack: 'ok' });

    expect(complete).toHaveBeenCalledWith('payment-1', user);
  });
});
