import { AppError } from '../../../common/errors';
import type { ApiStatusKey } from '../../../config/constants/status-codes';
import { API_STATUS } from '../../../config/constants/status-codes';

export type UidaiPhase = 'otp' | 'ekyc' | 'auth';

type Mapped = {
  key: ApiStatusKey;
  message: string;
};

const ERR_MAP: Record<string, Mapped> = {
  '998': {
    key: 'AADHAAR_INVALID',
    message: 'Enter a valid Aadhaar number',
  },
  '995': {
    key: 'AADHAAR_NOT_ACTIVE',
    message: 'This Aadhaar cannot be used for verification',
  },
  '996': {
    key: 'AADHAAR_NOT_ACTIVE',
    message: 'This Aadhaar cannot be used for verification',
  },
  '997': {
    key: 'AADHAAR_NOT_ACTIVE',
    message: 'This Aadhaar cannot be used for verification',
  },
  '400': {
    key: 'AADHAAR_OTP_INVALID',
    message: 'Invalid OTP',
  },
  '402': {
    key: 'AADHAAR_TXN_MISMATCH',
    message: 'OTP session mismatch. Request a new OTP.',
  },
  '561': {
    key: 'AADHAAR_TS_INVALID',
    message: 'Aadhaar request timestamp is invalid. Try again.',
  },
  '562': {
    key: 'AADHAAR_TS_INVALID',
    message: 'Aadhaar request timestamp is invalid. Try again.',
  },
  '563': {
    key: 'AADHAAR_DUPLICATE_REQUEST',
    message: 'Duplicate Aadhaar request. Request a new OTP.',
  },
  '565': {
    key: 'AADHAAR_LICENSE_ERROR',
    message: 'Aadhaar license configuration error',
  },
  '566': {
    key: 'AADHAAR_LICENSE_ERROR',
    message: 'Aadhaar license configuration error',
  },
  '500': {
    key: 'AADHAAR_CRYPTO_ERROR',
    message: 'Aadhaar encryption error',
  },
  '501': {
    key: 'AADHAAR_CRYPTO_ERROR',
    message: 'Aadhaar encryption error',
  },
  '502': {
    key: 'AADHAAR_CRYPTO_ERROR',
    message: 'Aadhaar encryption error',
  },
  '503': {
    key: 'AADHAAR_CRYPTO_ERROR',
    message: 'Aadhaar encryption error',
  },
  '564': {
    key: 'AADHAAR_CRYPTO_ERROR',
    message: 'Aadhaar encryption error',
  },
  '542': {
    key: 'AADHAAR_CHANNEL_UNAUTHORIZED',
    message: 'Aadhaar channel is not authorized',
  },
  '543': {
    key: 'AADHAAR_CHANNEL_UNAUTHORIZED',
    message: 'Aadhaar channel is not authorized',
  },
  '940': {
    key: 'AADHAAR_CHANNEL_UNAUTHORIZED',
    message: 'Aadhaar channel is not authorized',
  },
  '941': {
    key: 'AADHAAR_CHANNEL_UNAUTHORIZED',
    message: 'Aadhaar channel is not authorized',
  },
  '569': {
    key: 'AADHAAR_SIGNATURE_FAILED',
    message: 'Aadhaar request signature failed',
  },
  '570': {
    key: 'AADHAAR_SIGNATURE_FAILED',
    message: 'Aadhaar request signature failed',
  },
  '579': {
    key: 'AADHAAR_OTP_NOT_LICENSED',
    message: 'OTP verification is not allowed for this license',
  },
  '950': {
    key: 'AADHAAR_UPSTREAM_ERROR',
    message: 'Aadhaar verification failed. Try again later.',
  },
  '999': {
    key: 'AADHAAR_UPSTREAM_ERROR',
    message: 'Aadhaar verification failed. Try again later.',
  },
};

function isTechnicalRange(err: string): boolean {
  const n = Number(err);
  return Number.isFinite(n) && n >= 930 && n <= 939;
}

/**
 * Map UIDAI err attribute to AppError.
 * Logs only safe fields (err code, phase, txn) — never license keys, OTP, Aadhaar, or XML bodies.
 */
export function mapUidaiErr(
  err: string | undefined | null,
  phase: UidaiPhase,
  txn?: string
): AppError {
  const code = (err ?? '').trim() || 'unknown';
  const mapped = ERR_MAP[code];
  const key: ApiStatusKey = mapped?.key
    ? mapped.key
    : isTechnicalRange(code)
      ? 'AADHAAR_UPSTREAM_ERROR'
      : 'AADHAAR_UPSTREAM_ERROR';
  const message =
    mapped?.message ?? 'Aadhaar verification failed. Try again later.';
  const status = API_STATUS[key];

  console.error('[UIDAI]', {
    phase,
    uidaiErr: code,
    txn: txn ?? null,
    apiCode: status.code,
  });

  return new AppError(message, status.httpStatus, status.code, {
    uidaiErr: code,
    phase,
  });
}

export function isInvalidOtpErr(err: unknown): boolean {
  if (!(err instanceof AppError)) return false;
  return err.code === 'AADHAAR_OTP_INVALID';
}
