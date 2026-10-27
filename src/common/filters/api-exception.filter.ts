import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

type RequestWithContext = Request & {
  requestId?: string;
};

interface ApiErrorBody {
  success: false;
  errorCode: string;
  message: string;
  details?: string[];
  requestId: string;
}

const ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    if (response.headersSent) {
      return;
    }

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.requestId ?? randomUUID();
    const errorBody = this.createErrorBody(exception, statusCode, requestId);
    const errorName =
      exception instanceof Error ? exception.name : 'UnknownError';

    this.logger.error(
      JSON.stringify({
        event: 'http_exception',
        requestId,
        method: request.method,
        endpoint: this.endpoint(request),
        statusCode,
        error: errorName,
      }),
    );
    response.status(statusCode).json(errorBody);
  }

  private createErrorBody(
    exception: unknown,
    statusCode: number,
    requestId: string,
  ): ApiErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        requestId,
      };
    }

    const exceptionResponse = exception.getResponse();
    const responseObject =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : undefined;
    const rawMessage = responseObject?.message ?? exceptionResponse;
    const details =
      Array.isArray(rawMessage) &&
      rawMessage.every((detail) => typeof detail === 'string')
        ? rawMessage
        : undefined;
    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : (details?.[0] ??
          (statusCode >= 500 ? 'Service unavailable' : exception.message));

    return {
      success: false,
      errorCode: this.errorCode(statusCode, details),
      message: statusCode >= 500 ? 'An unexpected error occurred' : message,
      ...(details ? { details } : {}),
      requestId,
    };
  }

  private errorCode(statusCode: number, details?: string[]): string {
    if (statusCode === HttpStatus.BAD_REQUEST && details) {
      return 'VALIDATION_ERROR';
    }
    return ERROR_CODES[statusCode] ?? `HTTP_${statusCode}`;
  }

  private endpoint(request: RequestWithContext): string {
    const routePath = request.route?.path;
    return routePath
      ? `${request.baseUrl ?? ''}${routePath}`
      : (request.originalUrl?.split('?')[0] ?? request.path);
  }
}
