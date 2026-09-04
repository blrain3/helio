import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PlantService } from '../application/plant.service';
import { DeviceService } from '../application/device.service';
import { TariffService } from '../application/tariff.service';
import { EnergyRecordService } from '../application/energy-record.service';
import {
  CreatePlantDto,
  UpdatePlantDto,
  CreateDeviceDto,
  UpdateDeviceDto,
  CreateTariffDto,
  CreateEnergyRecordDto,
} from '../application/dto/energy.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../auth/domain/user.entity';
import {
  PlantEntity,
  DeviceEntity,
  TariffEntity,
  EnergyRecordEntity,
} from '../domain/energy.entity';

/**
 * 能源数据控制器：电站、设备、费率、发电记录四组端点。
 * 除费率查询外均要求登录（默认 Bearer）；资源归属由 service 层校验。
 */
@ApiTags('energy')
@ApiBearerAuth()
@Controller()
export class EnergyController {
  constructor(
    private readonly plants: PlantService,
    private readonly devices: DeviceService,
    private readonly tariffs: TariffService,
    private readonly records: EnergyRecordService,
  ) {}

  // ===================== 电站 Plant =====================

  @Get('plants')
  @ApiOperation({ summary: '查询当前用户名下电站' })
  @ApiResponse({ status: 200, description: '电站列表' })
  async listPlants(@CurrentUser() user: AuthUser): Promise<PlantEntity[]> {
    return this.plants.listByUser(user.sub);
  }

  @Get('plants/:id')
  @ApiOperation({ summary: '按 id 查询电站' })
  @ApiResponse({ status: 200, description: '电站信息' })
  async getPlant(@Param('id') id: string): Promise<PlantEntity> {
    return this.plants.findById(id);
  }

  @Post('plants')
  @ApiOperation({ summary: '创建电站' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createPlant(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePlantDto,
  ): Promise<PlantEntity> {
    return this.plants.create(dto.name, dto.capacity, dto.location, user.sub);
  }

  @Patch('plants/:id')
  @ApiOperation({ summary: '更新电站' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updatePlant(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePlantDto,
  ): Promise<PlantEntity> {
    return this.plants.update(id, user.sub, dto);
  }

  @Delete('plants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除电站' })
  @ApiResponse({ status: 204, description: '删除成功' })
  async removePlant(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.plants.remove(id, user.sub);
  }

  // ===================== 设备 Device =====================

  @Get('devices')
  @ApiOperation({ summary: '查询当前用户名下设备' })
  @ApiResponse({ status: 200, description: '设备列表' })
  async listUserDevices(@CurrentUser() user: AuthUser): Promise<DeviceEntity[]> {
    return this.devices.listByUser(user.sub);
  }

  @Get('plants/:plantId/devices')
  @ApiOperation({ summary: '查询电站下设备列表' })
  @ApiResponse({ status: 200, description: '设备列表' })
  async listDevices(@Param('plantId') plantId: string): Promise<DeviceEntity[]> {
    return this.devices.listByPlant(plantId);
  }

  @Get('devices/:id')
  @ApiOperation({ summary: '按 id 查询设备' })
  @ApiResponse({ status: 200, description: '设备信息' })
  async getDevice(@Param('id') id: string): Promise<DeviceEntity> {
    return this.devices.findById(id);
  }

  @Post('devices')
  @ApiOperation({ summary: '创建设备（挂靠在电站下）' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createDevice(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDeviceDto,
  ): Promise<DeviceEntity> {
    return this.devices.create(
      dto.serialNo,
      dto.plantId,
      dto.name,
      dto.type,
      user.sub,
    );
  }

  @Patch('devices/:id')
  @ApiOperation({ summary: '更新设备' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateDevice(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDeviceDto,
  ): Promise<DeviceEntity> {
    return this.devices.update(id, user.sub, dto);
  }

  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除设备' })
  @ApiResponse({ status: 204, description: '删除成功' })
  async removeDevice(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.devices.remove(id, user.sub);
  }

  // ===================== 费率 Tariff =====================

  @Get('tariffs')
  @ApiOperation({ summary: '查询全部费率（按生效时间倒序）' })
  @ApiResponse({ status: 200, description: '费率列表' })
  async listTariffs(): Promise<TariffEntity[]> {
    return this.tariffs.listAll();
  }

  @Post('tariffs')
  @ApiOperation({ summary: '创建费率' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createTariff(@Body() dto: CreateTariffDto): Promise<TariffEntity> {
    return this.tariffs.create(
      dto.unitPrice,
      new Date(dto.effectiveAt),
      dto.currency,
      dto.billingUnit,
    );
  }

  @Delete('tariffs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除费率' })
  @ApiResponse({ status: 204, description: '删除成功' })
  async removeTariff(@Param('id') id: string): Promise<void> {
    await this.tariffs.remove(id);
  }

  // ===================== 发电记录 EnergyRecord =====================

  @Post('energy-records')
  @ApiOperation({ summary: '写入发电记录（自动建分区）' })
  @ApiResponse({ status: 201, description: '写入成功' })
  async recordEnergy(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateEnergyRecordDto,
  ): Promise<{ status: string }> {
    await this.records.record(
      {
        deviceId: dto.deviceId,
        plantId: dto.plantId,
        generationKwh: dto.generationKwh,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      },
      user.sub,
    );
    return { status: 'recorded' };
  }

  @Get('plants/:plantId/energy-records')
  @ApiOperation({ summary: '查询电站发电记录（区间）' })
  @ApiResponse({ status: 200, description: '发电记录列表' })
  async listEnergyRecords(
    @Param('plantId') plantId: string,
    @CurrentUser() user: AuthUser,
    @Query('start') start: string,
    @Query('end') end: string,
  ): Promise<EnergyRecordEntity[]> {
    return this.records.listByPlant(
      plantId,
      user.sub,
      new Date(start),
      new Date(end),
    );
  }

  @Get('plants/:plantId/energy/daily')
  @ApiOperation({ summary: '电站日发电聚合' })
  @ApiResponse({ status: 200, description: '按天聚合结果' })
  async dailyAggregate(
    @Param('plantId') plantId: string,
    @CurrentUser() user: AuthUser,
    @Query('start') start: string,
    @Query('end') end: string,
  ): Promise<Array<{ day: Date; totalKwh: number; recordCount: number }>> {
    return this.records.dailyAggregate(
      plantId,
      user.sub,
      new Date(start),
      new Date(end),
    );
  }

  @Get('plants/:plantId/energy/total')
  @ApiOperation({ summary: '电站区间总发电量' })
  @ApiResponse({ status: 200, description: '总发电量汇总' })
  async totalAggregate(
    @Param('plantId') plantId: string,
    @CurrentUser() user: AuthUser,
    @Query('start') start: string,
    @Query('end') end: string,
  ): Promise<{ totalKwh: number; recordCount: number }> {
    return this.records.totalAggregate(
      plantId,
      user.sub,
      new Date(start),
      new Date(end),
    );
  }
}
