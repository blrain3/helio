import { expect, test } from '@playwright/test';

test('admin completes a Mock payment from plant creation to settlement', async ({ page }) => {
  const plantName = `E2E Plant ${Date.now()}`;

  await page.goto('/auth/login');
  await page.locator('input[type="email"]').fill('admin@helio.io');
  await page.locator('input[type="password"]').fill('admin123456');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/plants');
  await page.getByRole('button', { name: '新建电站' }).click();
  await page.locator('#plant-name').fill(plantName);
  await page.locator('#plant-capacity').fill('12');
  await page.locator('#plant-location').fill('E2E Lab');
  await page.getByRole('button', { name: '保存电站' }).click();
  await expect(page.getByRole('status')).toContainText('电站已创建');

  await page.goto('/bills');
  await page.getByRole('button', { name: '生成账单' }).click();
  await page.locator('#bill-plant').selectOption({ label: plantName });
  await page.locator('#bill-energy').fill('10');
  await page.locator('#bill-period-start').fill('2026-09-01');
  await page.locator('#bill-period-end').fill('2026-09-30');
  await page.getByRole('button', { name: '生成', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('账单已生成');
  await page.getByRole('button', { name: /^发出 / }).click();
  await expect(page.getByRole('status')).toContainText('账单已发出');

  await page.goto('/orders');
  await page.getByRole('button', { name: '新建订单' }).click();
  await page.locator('#order-bill').selectOption({ index: 1 });
  await page.getByRole('button', { name: '创建订单' }).click();
  await expect(page.getByRole('status')).toContainText('订单已创建');
  await page.getByRole('button', { name: /^提交支付 / }).click();
  await expect(page.getByRole('status')).toContainText('订单已提交支付');

  await page.goto('/payments');
  await page.getByRole('button', { name: '新建模拟支付' }).click();
  await page.locator('#payment-order').selectOption({ index: 1 });
  await page.getByRole('button', { name: '创建模拟支付' }).click();
  await expect(page.getByRole('status')).toContainText('模拟支付已创建');
  await page.getByRole('button', { name: /^完成模拟支付 / }).click();
  await expect(page.getByRole('status')).toContainText('模拟支付回调已处理');

  await page.goto('/orders');
  await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible({ timeout: 15_000 });
});
