import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { createOpenApiDocument } from './openapi';

describe('createOpenApiDocument', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'openapi-test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'openapi-test-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: async () => undefined,
        $disconnect: async () => undefined,
      })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('exports client-facing paths without the deployment prefix', () => {
    const document = createOpenApiDocument(app);

    expect(document.info).toMatchObject({
      title: 'Helio API',
      version: '1.0.0',
    });
    expect(document.paths).toHaveProperty('/plants');
    expect(document.paths).not.toHaveProperty('/api/plants');
  });
});
