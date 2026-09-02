import { Module } from '@nestjs/common';
import { AnomalyController } from './presentation/anomaly.controller';
import { AnomalyService } from './application/anomaly.service';
import { AnomalyRepository } from './infrastructure/anomaly.repository';
import { EnergyModule } from '../energy/energy.module';

/**
 * 异常检测模块（M5b）。
 *
 * 复用 EnergyModule 导出的 EnergyRecordRepository（时序读取）与
 * PlantRepository（归属校验），避免重复实例化。
 * 规则引擎 + 滚动统计 + z-score 检测引擎位于 domain/detection.ts（纯函数），
 * AnomalyEvent 结果落库。
 */
@Module({
  imports: [EnergyModule],
  controllers: [AnomalyController],
  providers: [AnomalyService, AnomalyRepository],
  exports: [AnomalyService],
})
export class AnomalyModule {}
