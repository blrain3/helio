import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../../common/guards/jwt-auth.guard';
import { ForbiddenError } from '../../auth/domain/errors';
import { MockGateway } from '../infrastructure/mock.gateway';
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
      {} as never,
    );

    await expect(controller.completeMockPayment('payment-1', user)).resolves.toEqual({ ack: 'ok' });

    expect(complete).toHaveBeenCalledWith('payment-1', user);
  });

  it.each(['SUCCESS', 'FAILED'] as const)(
    'rejects a signed Mock %s callback before payment handling',
    async (status) => {
      const handleCallback = vi.fn().mockResolvedValue({ ack: 'ok' });
      const controller = new PaymentController(
        { handleCallback } as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const gateway = new MockGateway({} as never);
      const providerTransactionId = 'MOCK-1';
      const merchantOrderId = 'ORD-1';
      const amount = 1250;

      await expect(
        controller.callback({
          provider: 'mock',
          providerTransactionId,
          merchantOrderId,
          amount,
          status,
          signature: gateway.sign(merchantOrderId, providerTransactionId, amount),
          rawPayload: { source: 'attacker' },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);

      expect(handleCallback).not.toHaveBeenCalled();
    },
  );

  it('forwards a legitimate non-Mock provider callback', async () => {
    const handleCallback = vi.fn().mockResolvedValue({ ack: 'ok' });
    const controller = new PaymentController(
      { handleCallback } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const callback = {
      provider: 'wechat' as const,
      providerTransactionId: 'WX-1',
      merchantOrderId: 'ORD-1',
      amount: 1250,
      status: 'SUCCESS' as const,
      signature: 'wechat-signature',
      rawPayload: { source: 'wechat' },
    };

    await expect(controller.callback(callback)).resolves.toEqual({ ack: 'ok' });

    expect(handleCallback).toHaveBeenCalledWith(callback);
  });
});
