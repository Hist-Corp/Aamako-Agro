import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Normalizes every error to the standard shape:
 *   { error: { code, message, details } }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as Record<string, any>;
      const code =
        typeof body === 'object' && body?.code ? body.code : this.codeFor(status);
      const message =
        typeof body === 'string'
          ? body
          : body?.message ?? exception.message;
      return res.status(status).json({
        error: {
          code,
          message: Array.isArray(message) ? message.join('; ') : message,
          details: typeof body === 'object' && body?.details ? body.details : undefined,
        },
      });
    }

    console.error(exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: undefined,
      },
    });
  }

  private codeFor(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 422: return 'UNPROCESSABLE_ENTITY';
      case 429: return 'RATE_LIMITED';
      default: return `HTTP_${status}`;
    }
  }
}
