import { Module } from '@nestjs/common';
import { EnergyController } from './presentation/energy.controller';
import { PlantService } from './application/plant.service';
import { DeviceService } from './application/device.service';
import { TariffService } from './application/tariff.service';
import { EnergyRecordService } from './application/energy-record.service';
import { PlantRepository } from './infrastructure/plant.repository';
import { DeviceRepository } from './infrastructure/device.repository';
import { TariffRepository } from './infrastructure/tariff.repository';
import { EnergyRecordRepository } from './infrastructure/energy-record.repository';

/**
 * 能源数据模块（M2）：电站、设备、费率、发电记录。
 *
 * 业务数据（Plant/Device/Tariff）经 Prisma 访问；
 * 时序数据（energy_record 分区表）经 Raw SQL 访问。
 */
@Module({
  controllers: [EnergyController],
  providers: [
    PlantService,
    DeviceService,
    TariffService,
    EnergyRecordService,
    PlantRepository,
    DeviceRepository,
    TariffRepository,
    EnergyRecordRepository,
  ],
  exports: [
    PlantService,
    DeviceService,
    TariffService,
    EnergyRecordService,
    PlantRepository,
    DeviceRepository,
    TariffRepository,
    EnergyRecordRepository,
  ],
})
export class EnergyModule {}
