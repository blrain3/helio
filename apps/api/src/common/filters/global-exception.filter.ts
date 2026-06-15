import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { DomainError } from '../../modules/auth/domain/errors';

/**
 * 全局异常过滤器：将领域异常与 HTTP 异常统一映射为标准响应体。
 *
 * 响应结构统一为 { statusCode, code, message, timestamp }，
 * 便于前端与 api-client 一致处理。
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = '服务器内部错误';

    if (exception instanceof DomainError) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = this.codeFromStatus(statusCode);
      const res = exception.getResponse();
      message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message?.toString() ?? exception.message;
    } else if (this.isFastifyError(exception)) {
      // Fastify 框架层错误（如空 JSON body、非法 content-type 等），
      // 本质是 4xx 客户端错误，不应映射为 500。
      statusCode = exception.statusCode ?? HttpStatus.BAD_REQUEST;
      code = this.codeFromStatus(statusCode);
      message = exception.message;
    } else if (exception instanceof Error) {
      // 兜底：记录原始错误信息，避免丢失排查线索（但仍返回通用 500）。
      // eslint-disable-next-line no-console
      console.error('[UnhandledException]', exception);
      message = exception.message || message;
    }

    reply.status(statusCode).send({
      statusCode,
      code,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /** 判断是否为 Fastify 抛出的框架错误（带 statusCode 与 code 属性）。 */
  private isFastifyError(err: unknown): err is { statusCode?: number; code: string; message: string } {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      typeof (err as { code?: unknown }).code === 'string' &&
      (err as { code?: string }).code!.startsWith('FST_')
    );
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
    };
    return map[status] ?? 'HTTP_ERROR';
  }
}
