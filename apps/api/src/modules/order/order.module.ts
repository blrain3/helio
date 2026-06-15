import { Module } from '@nestjs/common';
import { OrderController } from './presentation/order.controller';
import { OrderService } from './application/order.service';
import { OrderRepository } from './infrastructure/order.repository';
import { BillingModule } from '../billing/billing.module';
import { EnergyModule } from '../energy/energy.module';

/**
 * 订单模块（M3）：订单状态机与金额校验。
 *
 * 依赖 BillingModule 的 BillRepository（订单基于账单创建、联动账单状态）
 * 与 EnergyModule 的 PlantRepository（资源归属校验）。
 */
@Module({
  imports: [BillingModule, EnergyModule],
  controllers: [OrderController],
  providers: [OrderService, OrderRepository],
  exports: [OrderService, OrderRepository],
})
export class OrderModule {}
