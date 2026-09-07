export const API_STATUS = {
  OK: {
    httpStatus: 200,
    code: 'OK',
    message: 'Request completed successfully',
  },
  CREATED: {
    httpStatus: 201,
    code: 'CREATED',
    message: 'Resource created successfully',
  },
  BAD_REQUEST: {
    httpStatus: 400,
    code: 'BAD_REQUEST',
    message: 'The request could not be processed',
  },
  UNAUTHORIZED: {
    httpStatus: 401,
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
  },
  ACCESS_DENIED: {
    httpStatus: 403,
    code: 'ACCESS_DENIED',
    message: 'Access denied',
  },
  INSUFFICIENT_PERMISSIONS: {
    httpStatus: 403,
    code: 'INSUFFICIENT_PERMISSIONS',
    message: 'Insufficient permissions for this action',
  },
  NOT_FOUND: {
    httpStatus: 404,
    code: 'NOT_FOUND',
    message: 'Resource not found',
  },
  CONFLICT: {
    httpStatus: 409,
    code: 'CONFLICT',
    message: 'Resource conflict',
  },
  RATE_LIMITED: {
    httpStatus: 429,
    code: 'RATE_LIMITED',
    message: 'Too many requests. Try again later.',
  },
  INTERNAL_ERROR: {
    httpStatus: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  },
} as const;

export type ApiStatusKey = keyof typeof API_STATUS;
export type ApiStatusCode = (typeof API_STATUS)[ApiStatusKey]['code'];

export type StatusDefinition = (typeof API_STATUS)[ApiStatusKey];

export const API_MESSAGES = {
  HEALTH_OK: 'Service is healthy',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS:
    'Logged out successfully. Discard access and refresh tokens on the client.',
  LOGOUT_ALL_SUCCESS:
    'All sessions revoked. Discard tokens on every device and log in again.',
  TOKEN_REFRESHED: 'Access token refreshed successfully',
  OTP_SENT: 'OTP sent to registered phone number',
  AADHAAR_VERIFIED: 'Aadhaar verified successfully',
  DIGILOCKER_STARTED: 'DigiLocker authorization started',
  BIDDER_REGISTERED: 'Bidder registered successfully',
  AGENT_REGISTERED: 'Agent registered successfully',
  TWO_FA_SETUP: '2FA setup started. Confirm with a code from your authenticator app.',
  TWO_FA_ENABLED: '2FA enabled successfully',
  TWO_FA_DISABLED: '2FA disabled successfully',
  SECURITY_UPDATED: 'Security settings updated',
  SCREEN_LOCK_UPDATED: 'Screen lock settings updated',
  SCREEN_UNLOCKED: 'Screen unlocked successfully',
  BIOMETRIC_UPDATED: 'Biometric settings updated',
  BRANCH_STORE_CREATED: 'Branch store user created successfully',
  AGENT_CREATED: 'Agent created successfully',
  BIDDER_CREATED: 'Bidder created successfully',
  STAFF_CREATED: 'Super admin staff created successfully',
  ROUTE_NOT_FOUND: 'Route not found',
} as const;

export type ApiMessageKey = keyof typeof API_MESSAGES;

const statusByCode = Object.values(API_STATUS).reduce(
  (acc, status) => {
    acc[status.code] = status;
    return acc;
  },
  {} as Record<ApiStatusCode, StatusDefinition>
);

export function getStatusByKey(key: ApiStatusKey): StatusDefinition {
  return API_STATUS[key];
}

export function getStatusByCode(code: string): StatusDefinition | undefined {
  return statusByCode[code as ApiStatusCode];
}

export function resolveMessage(
  key: ApiStatusKey,
  override?: string
): string {
  return override ?? API_STATUS[key].message;
}
