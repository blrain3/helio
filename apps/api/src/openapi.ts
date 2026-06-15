import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Helio API')
    .setDescription('Helio 太阳能能源监控平台 API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config, {
    // 客户端以 /api 作为可配置基地址，契约中的路径保持相对。
    ignoreGlobalPrefix: true,
  });
}

export function setupOpenApi(app: INestApplication): void {
  const document = createOpenApiDocument(app);
  SwaggerModule.setup('api/docs', app, document);
}
