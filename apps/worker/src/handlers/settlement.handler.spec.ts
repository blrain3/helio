import { describe, expect, it } from 'vitest';
import { handleSettlement } from './settlement.handler';

describe('handleSettlement', () => {
  it('completes a paid order and marks its issued bill as paid', async () => {
    const state = {
      order: { id: 'order-1', billId: 'bill-1', status: 'PAID' },
      billStatus: 'ISSUED',
    };
    const prisma = {
      order: {
        findUnique: async () => ({ ...state.order }),
        update: async ({ data }: { data: { status: string } }) => {
          state.order.status = data.status;
          return { ...state.order };
        },
      },
      bill: {
        updateMany: async ({ data }: { data: { status: string } }) => {
          state.billStatus = data.status;
          return { count: 1 };
        },
      },
    };

    await handleSettlement({ orderId: 'order-1' }, prisma as never);

    expect(state).toEqual({
      order: { id: 'order-1', billId: 'bill-1', status: 'COMPLETED' },
      billStatus: 'PAID',
    });
  });

  it('leaves an order pending when the payment callback has not marked it paid', async () => {
    const state = { order: { id: 'order-1', billId: 'bill-1', status: 'PENDING_PAYMENT' } };
    const prisma = {
      order: {
        findUnique: async () => ({ ...state.order }),
        update: async () => {
          state.order.status = 'COMPLETED';
        },
      },
      bill: { updateMany: async () => ({ count: 1 }) },
    };

    await handleSettlement({ orderId: 'order-1' }, prisma as never);

    expect(state.order.status).toBe('PENDING_PAYMENT');
  });
});
