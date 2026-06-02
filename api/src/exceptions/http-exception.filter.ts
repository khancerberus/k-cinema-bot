import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorMessage = 'Internal server error';

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const message = (exceptionResponse as { message?: unknown }).message;
        if (Array.isArray(message)) {
          errorMessage = message.join(', ');
        } else if (typeof message === 'string' && message.trim()) {
          errorMessage = message;
        } else {
          errorMessage = exception.message;
        }
      } else if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
      } else {
        errorMessage = exception.message;
      }
    } else if (exception instanceof Error && exception.message.trim()) {
      errorMessage = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
