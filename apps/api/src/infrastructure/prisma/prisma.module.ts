import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * 全局 Prisma 模块：向全应用提供单一的 PrismaService 实例，
 * 并在模块销毁时优雅关闭数据库连接。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
