import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './src/app.module';
import { createOpenApiDocument } from './src/openapi';

export async function exportOpenApi(
  outputPath = resolve(process.cwd(), 'openapi.json'),
): Promise<void> {
  // 文档导出不会开始监听端口；这些只满足构造 JWT service 的 fail-fast 校验。
  process.env.JWT_ACCESS_SECRET ??= 'openapi-contract-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'openapi-contract-refresh-secret';

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false },
  );

  try {
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    const document = createOpenApiDocument(app);
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void exportOpenApi().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('OpenAPI 文档导出失败', error);
  process.exitCode = 1;
});
