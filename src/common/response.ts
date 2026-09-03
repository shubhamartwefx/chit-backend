import { Response } from 'express';
import { API_STATUS, ApiStatusKey, resolveMessage } from './status';

export interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode?: number
): Response {
  const body: ApiSuccessBody<T> = {
    success: true,
    message: message ?? API_STATUS.OK.message,
    data,
  };
  return res.status(statusCode ?? API_STATUS.OK.httpStatus).json(body);
}

export function sendSuccessWithKey<T>(
  res: Response,
  data: T,
  statusKey: ApiStatusKey,
  message?: string
): Response {
  const status = API_STATUS[statusKey];
  return sendSuccess(res, data, message ?? status.message, status.httpStatus);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number,
  code: string,
  details?: unknown
): Response {
  const body: ApiErrorBody = { success: false, message, code };
  if (details !== undefined) {
    body.details = details;
  }
  return res.status(statusCode).json(body);
}

export function sendErrorWithKey(
  res: Response,
  statusKey: ApiStatusKey,
  message?: string,
  details?: unknown
): Response {
  const status = API_STATUS[statusKey];
  return sendError(
    res,
    resolveMessage(statusKey, message),
    status.httpStatus,
    status.code,
    details
  );
}
