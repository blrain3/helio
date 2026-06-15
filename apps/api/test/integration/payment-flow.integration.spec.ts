import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIntegrationHarness, type IntegrationHarness } from './harness';

describe('payment workflow integration', () => {
  let harness: IntegrationHarness;

  beforeAll(async () => {
    harness = await createIntegrationHarness();
  }, 120_000);

  afterAll(async () => {
    await harness?.close();
  });

  it('completes a Mock payment through PostgreSQL, Redis, and the settlement worker', async () => {
    const registered = await harness.request<{
      tokens: { accessToken: string };
    }>('POST', '/auth/register', {
      email: 'integration@helio.test',
      password: 'Str0ng!Pass',
      deviceId: 'integration-device',
    });
    expect(registered.status).toBe(201);

    const authorization = `Bearer ${registered.body.tokens.accessToken}`;
    const tariff = await harness.request<{ id: string }>('POST', '/tariffs', {
      authorization,
      unitPrice: 65,
      effectiveAt: '2026-01-01T00:00:00.000Z',
      currency: 'CNY',
      billingUnit: 'kWh',
    });
    expect(tariff.status).toBe(201);

    const plant = await harness.request<{ id: string }>('POST', '/plants', {
      authorization,
      name: 'Integration Plant',
      capacity: 12,
      location: 'Test Lab',
    });
    expect(plant.status).toBe(201);

    const bill = await harness.request<{ id: string; totalAmount: number }>('POST', '/bills', {
      authorization,
      plantId: plant.body.id,
      consumedKwh: 10,
      periodStart: '2026-09-01T00:00:00.000Z',
      periodEnd: '2026-09-30T23:59:59.000Z',
    });
    expect(bill.status).toBe(201);

    const issued = await harness.request<{ status: string }>('PATCH', `/bills/${bill.body.id}/issue`, {
      authorization,
    });
    expect(issued.body.status).toBe('ISSUED');

    const order = await harness.request<{ id: string; status: string }>('POST', '/orders', {
      authorization,
      billId: bill.body.id,
      amount: bill.body.totalAmount,
    });
    expect(order.status).toBe(201);

    const submitted = await harness.request<{ status: string }>(
      'PATCH',
      `/orders/${order.body.id}/submit-payment`,
      { authorization },
    );
    expect(submitted.body.status).toBe('PENDING_PAYMENT');

    const payment = await harness.request<{ id: string; status: string }>('POST', '/payments', {
      authorization,
      orderId: order.body.id,
      provider: 'mock',
    });
    expect(payment.status).toBe(201);

    const completed = await harness.request<{ ack: string }>(
      'POST',
      `/payments/${payment.body.id}/mock-complete`,
      { authorization },
    );
    expect(completed.body).toEqual({ ack: 'ok' });

    await expect
      .poll(
        async () => {
          const result = await harness.request<{ status: string }>('GET', `/orders/${order.body.id}`, {
            authorization,
          });
          return result.body.status;
        },
        { timeout: 15_000 },
      )
      .toBe('COMPLETED');
  });
});
