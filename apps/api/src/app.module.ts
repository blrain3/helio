import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { EnergyModule } from './modules/energy/energy.module';
import { BillingModule } from './modules/billing/billing.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AnomalyModule } from './modules/anomaly/anomaly.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(),
    PrismaModule,
    // M5a：BullMQ 队列（领域事件生产者侧）
    QueueModule,
    // M1：认证与用户模块
    AuthModule,
    UserModule,
    // M2：能源与数据模型
    EnergyModule,
    // M3：计费与订单
    BillingModule,
    OrderModule,
    // M4：支付系统
    PaymentModule,
    // M5b：异常检测引擎
    AnomalyModule,
  ],
  controllers: [HealthController],
  providers: [
    // 全局守卫：先鉴权（JWT），后授权（RBAC）。
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
