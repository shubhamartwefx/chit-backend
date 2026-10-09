import { env } from '../config/env';
import { decryptSensitive, encryptSensitive, normalizeAadhaar } from './crypto';

export function encryptAadhaar(aadhaarNumber: string): string {
  return encryptSensitive(
    normalizeAadhaar(aadhaarNumber),
    env.SENSITIVE_DATA_ENCRYPTION_KEY
  );
}

export function decryptAadhaar(payload: string): string {
  return decryptSensitive(payload, env.SENSITIVE_DATA_ENCRYPTION_KEY);
}

/** Aadhaar fields persisted on a user at creation (masked digits + revealable ciphertext). */
export function aadhaarRevealFields(aadhaarNumber: string) {
  const normalized = normalizeAadhaar(aadhaarNumber);
  return {
    aadhaarLast4: normalized.slice(-4),
    aadhaarEncrypted: encryptAadhaar(normalized),
  };
}
