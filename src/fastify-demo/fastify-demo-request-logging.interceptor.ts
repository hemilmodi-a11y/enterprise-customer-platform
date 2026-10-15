import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, finalize } from 'rxjs';

interface FastifyRequestMetadata {
  method: string;
  url: string;
}

interface FastifyResponseMetadata {
  statusCode: number;
  header(name: string, value: string): void;
}

@Injectable()
export class FastifyDemoRequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(
    FastifyDemoRequestLoggingInterceptor.name,
  );

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequestMetadata>();
    const response = context
      .switchToHttp()
      .getResponse<FastifyResponseMetadata>();
    const requestId = randomUUID();
    const startedAt = performance.now();

    response.header('X-Request-Id', requestId);

    return next.handle().pipe(
      finalize(() => {
        this.logger.log(
          JSON.stringify({
            requestId,
            method: request.method,
            path: request.url.split('?')[0],
            statusCode: response.statusCode,
            durationMs: Math.max(
              0,
              Number((performance.now() - startedAt).toFixed(2)),
            ),
          }),
        );
      }),
    );
  }
}
