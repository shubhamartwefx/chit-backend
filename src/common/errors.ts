import {
  API_STATUS,
  ApiStatusKey,
  getStatusByKey,
  resolveMessage,
} from './status';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = API_STATUS.INTERNAL_ERROR.httpStatus,
    code: string = API_STATUS.INTERNAL_ERROR.code,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static fromStatusKey(
    key: ApiStatusKey,
    message?: string,
    details?: unknown
  ): AppError {
    const status = getStatusByKey(key);
    return new AppError(
      resolveMessage(key, message),
      status.httpStatus,
      status.code,
      details
    );
  }
}

export function badRequest(message?: string, details?: unknown): AppError {
  return AppError.fromStatusKey('BAD_REQUEST', message, details);
}

export function unauthorized(message?: string): AppError {
  return AppError.fromStatusKey('UNAUTHORIZED', message);
}

export function accessDenied(message?: string): AppError {
  return AppError.fromStatusKey('ACCESS_DENIED', message);
}

export function accountBlocked(reason: string): AppError {
  const message = `Account blocked. Reason: ${reason}`;
  return new AppError(
    message,
    API_STATUS.ACCOUNT_BLOCKED.httpStatus,
    API_STATUS.ACCOUNT_BLOCKED.code,
    { reason }
  );
}

export function insufficientPermissions(message?: string): AppError {
  return AppError.fromStatusKey('INSUFFICIENT_PERMISSIONS', message);
}

export function notFound(message?: string): AppError {
  return AppError.fromStatusKey('NOT_FOUND', message);
}

export function conflict(message?: string): AppError {
  return AppError.fromStatusKey('CONFLICT', message);
}
