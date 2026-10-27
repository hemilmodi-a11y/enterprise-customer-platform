import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type AuthenticatedRequest = Request & {
  requestId?: string;
  user?: { userId?: number | string };
};

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
  ): void {
    const requestId = randomUUID();
    const startedAt = performance.now();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    response.once('finish', () => {
      const statusCode = response.statusCode;
      this.logger.log(
        JSON.stringify({
          event: statusCode >= 400 ? 'http_request_failed' : 'http_request',
          requestId,
          userId: request.user?.userId ?? null,
          method: request.method,
          endpoint: this.endpoint(request),
          statusCode,
          executionTimeMs: Math.max(
            0,
            Number((performance.now() - startedAt).toFixed(2)),
          ),
          ...(statusCode >= 400
            ? {
                error: statusCode >= 500 ? 'RequestFailed' : 'HttpError',
              }
            : {}),
        }),
      );
    });

    next();
  }

  private endpoint(request: AuthenticatedRequest): string {
    const routePath = request.route?.path;
    return routePath
      ? `${request.baseUrl ?? ''}${routePath}`
      : (request.originalUrl?.split('?')[0] ?? request.path);
  }
}
