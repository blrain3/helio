import { Module } from '@nestjs/common';
import { BillingController } from './presentation/billing.controller';
import { BillingService } from './application/billing.service';
import { BillRepository } from './infrastructure/bill.repository';
import { AmountCalculator } from './domain/amount-calculator';
import { EnergyModule } from '../energy/energy.module';

/**
 * 计费模块（M3）：账单生成与金额计算。
 *
 * 依赖 EnergyModule 提供的 TariffRepository / PlantRepository
 * （跨模块通过 exports + DI 注入，符合架构约定的模块间通信规则）。
 */
@Module({
  imports: [EnergyModule],
  controllers: [BillingController],
  providers: [BillingService, BillRepository, AmountCalculator],
  exports: [BillingService, BillRepository],
})
export class BillingModule {}
