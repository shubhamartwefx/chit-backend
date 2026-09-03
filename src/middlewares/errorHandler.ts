import { NextFunction, Request, Response } from 'express';
import { AppError } from '../common/errors';
import { sendError, sendErrorWithKey } from '../common/response';
import { API_MESSAGES, API_STATUS } from '../common/status';
import { env } from '../config/env';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.code, err.details);
    return;
  }

  console.error(err);
  const message =
    env.NODE_ENV === 'production'
      ? API_STATUS.INTERNAL_ERROR.message
      : String(err);
  sendErrorWithKey(res, 'INTERNAL_ERROR', message);
}

export function notFoundHandler(req: Request, res: Response): void {
  sendErrorWithKey(
    res,
    'NOT_FOUND',
    `${API_MESSAGES.ROUTE_NOT_FOUND}: ${req.method} ${req.originalUrl}`
  );
}
