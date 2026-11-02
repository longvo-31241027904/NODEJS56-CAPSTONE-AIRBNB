import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const body = error instanceof HttpException ? error.getResponse() : null;
    const message =
      status >= 500
        ? status === 503
          ? 'Service unavailable'
          : 'Internal server error'
        : typeof body === 'string'
          ? body
          : ((body as { message?: unknown } | null)?.message ?? 'Request failed');
    host
      .switchToHttp()
      .getResponse()
      .status(status)
      .json({ status: 'error', statusCode: status, message });
  }
}
