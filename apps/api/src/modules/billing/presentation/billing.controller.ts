import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from '../application/billing.service';
import { GenerateBillDto } from '../application/dto/billing.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../auth/domain/user.entity';
import { BillEntity } from '../domain/bill.entity';

/** 计费控制器：账单生成、查询、状态流转。 */
@ApiTags('billing')
@ApiBearerAuth()
@Controller('bills')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @ApiOperation({ summary: '查询当前用户账单列表' })
  @ApiResponse({ status: 200, description: '账单列表' })
  async list(@CurrentUser() user: AuthUser): Promise<BillEntity[]> {
    return this.billing.listByUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: '按 id 查询账单' })
  @ApiResponse({ status: 200, description: '账单信息' })
  async findById(@Param('id') id: string): Promise<BillEntity> {
    return this.billing.findById(id);
  }

  @Get('plant/:plantId')
  @ApiOperation({ summary: '查询电站账单列表' })
  @ApiResponse({ status: 200, description: '账单列表' })
  async listByPlant(@Param('plantId') plantId: string): Promise<BillEntity[]> {
    return this.billing.listByPlant(plantId);
  }

  @Post()
  @ApiOperation({ summary: '生成账单（按周期生效费率计算金额）' })
  @ApiResponse({ status: 201, description: '账单已生成' })
  async generate(
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateBillDto,
  ): Promise<BillEntity> {
    return this.billing.generate(
      {
        plantId: dto.plantId,
        consumedKwh: dto.consumedKwh,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
      },
      user.sub,
    );
  }

  @Patch(':id/issue')
  @ApiOperation({ summary: '发出账单（PENDING → ISSUED）' })
  @ApiResponse({ status: 200, description: '账单已发出' })
  async issue(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<BillEntity> {
    return this.billing.issue(id, user.sub);
  }
}
