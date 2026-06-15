import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * 本地开发种子数据：
 * 1. 管理员账号 admin@helio.io / admin123456
 * 2. 能源示例数据：一个示例电站 + 一台逆变器 + 一条费率
 * 仅用于本地开发，生产环境禁止运行。全部幂等，可重复执行。
 */
async function main() {
  // ---- 管理员账号 ----
  const adminEmail = 'admin@helio.io';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('admin123456', 10);
    await prisma.user.create({
      data: { email: adminEmail, passwordHash, role: Role.ADMIN },
    });
    // eslint-disable-next-line no-console
    console.log(`已创建管理员账号：${adminEmail} / admin123456`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`用户 ${adminEmail} 已存在，跳过。`);
  }

  // ---- 能源示例数据 ----
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) return;

  // 示例电站
  const plant = await prisma.plant.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: '示例屋顶电站',
      capacity: 10.5,
      location: '上海市浦东新区',
      userId: admin.id,
    },
  });
  // eslint-disable-next-line no-console
  console.log(`已确保示例电站：${plant.name}`);

  // 示例设备
  const device = await prisma.device.upsert({
    where: { serialNo: 'HELIO-SN-0001' },
    update: {},
    create: {
      serialNo: 'HELIO-SN-0001',
      name: '逆变器 #1',
      type: 'INVERTER',
      plantId: plant.id,
    },
  });
  // eslint-disable-next-line no-console
  console.log(`已确保示例设备：${device.serialNo}`);

  // 示例费率
  const tariff = await prisma.tariff.findFirst({
    where: { billingUnit: 'kWh' },
    orderBy: { effectiveAt: 'desc' },
  });
  if (!tariff) {
    await prisma.tariff.create({
      data: {
        unitPrice: 65,
        currency: 'CNY',
        billingUnit: 'kWh',
        effectiveAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
    // eslint-disable-next-line no-console
    console.log('已创建示例费率：65 分/kWh');
  } else {
    // eslint-disable-next-line no-console
    console.log('费率已存在，跳过。');
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
