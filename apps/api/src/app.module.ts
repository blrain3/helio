import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(),
    // 业务模块将在 M1–M5 里程碑中逐步接入：
    // AuthModule, UserModule, EnergyModule, BillingModule,
    // OrderModule, PaymentModule, SettlementModule, AnomalyModule
  ],
})
export class AppModule {}
