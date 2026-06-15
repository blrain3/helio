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
import { AnomalyService } from '../application/anomaly.service';
import {
  CreateAnomalyRuleDto,
  UpdateAnomalyRuleDto,
  DetectDto,
} from '../application/dto/anomaly.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../auth/domain/user.entity';
import { AnomalyRuleEntity, AnomalyEventEntity } from '../domain/anomaly.entity';

/**
 * 异常检测控制器。
 *
 * 权限模型：
 * - 规则 CRUD：OPERATOR/ADMIN；
 * - 触发检测：OPERATOR/ADMIN；
 * - 查询电站异常事件：普通登录用户（仅限本人电站）。
 */
@ApiTags('anomaly')
@ApiBearerAuth()
@Controller()
export class AnomalyController {
  constructor(private readonly anomaly: AnomalyService) {}

  // ===================== 规则管理（OPERATOR/ADMIN） =====================

  @Get('anomaly-rules')
  @Roles('OPERATOR', 'ADMIN')
  @ApiOperation({ summary: '查询检测规则' })
  @ApiResponse({ status: 200, description: '规则列表' })
  async listRules(
    @Query('enabledOnly') enabledOnly?: string,
  ): Promise<AnomalyRuleEntity[]> {
    return this.anomaly.listRules(enabledOnly === 'true');
  }

  @Post('anomaly-rules')
  @Roles('OPERATOR', 'ADMIN')
  @ApiOperation({ summary: '创建检测规则' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createRule(@Body() dto: CreateAnomalyRuleDto): Promise<AnomalyRuleEntity> {
    return this.anomaly.createRule({
      name: dto.name,
      condition: dto.condition as never,
      severity: dto.severity,
      enabled: dto.enabled,
    });
  }

  @Patch('anomaly-rules/:id')
  @Roles('OPERATOR', 'ADMIN')
  @ApiOperation({ summary: '更新检测规则（版本 +1）' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateAnomalyRuleDto,
  ): Promise<AnomalyRuleEntity> {
    return this.anomaly.updateRule(id, {
      name: dto.name,
      condition: dto.condition as never,
      severity: dto.severity,
      enabled: dto.enabled,
    });
  }

  @Delete('anomaly-rules/:id')
  @Roles('OPERATOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除检测规则' })
  @ApiResponse({ status: 204, description: '删除成功' })
  async removeRule(@Param('id') id: string): Promise<void> {
    await this.anomaly.removeRule(id);
  }

  // ===================== 检测执行（OPERATOR/ADMIN） =====================

  @Post('anomaly/detect')
  @Roles('OPERATOR', 'ADMIN')
  @ApiOperation({ summary: '触发即时异常检测' })
  @ApiResponse({ status: 201, description: '命中的告警（已落库）' })
  async detect(@Body() dto: DetectDto): Promise<AnomalyEventEntity[]> {
    return this.anomaly.detect(
      dto.plantId,
      {
        value: dto.value,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      },
      dto.windowHours ?? 24,
    );
  }

  // ===================== 事件查询（登录用户） =====================

  @Get('anomalies')
  @ApiOperation({ summary: '查询当前用户异常事件' })
  @ApiResponse({ status: 200, description: '异常事件列表' })
  async listUserEvents(@CurrentUser() user: AuthUser): Promise<AnomalyEventEntity[]> {
    return this.anomaly.listEventsByUser(user.sub);
  }

  @Get('plants/:plantId/anomaly-events')
  @ApiOperation({ summary: '查询电站异常事件' })
  @ApiResponse({ status: 200, description: '异常事件列表' })
  async listEvents(
    @Param('plantId') plantId: string,
    @CurrentUser() user: AuthUser,
    @Query('start') start: string,
    @Query('end') end: string,
  ): Promise<AnomalyEventEntity[]> {
    return this.anomaly.listEvents(
      plantId,
      user.sub,
      new Date(start),
      new Date(end),
    );
  }
}
