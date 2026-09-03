import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isValidIndianPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(phone));
}

export function isValidAadhaar(aadhaar: string): boolean {
  return /^\d{12}$/.test(aadhaar.replace(/\D/g, ''));
}

export function normalizeAadhaar(aadhaar: string): string {
  return aadhaar.replace(/\D/g, '');
}

/** One-way hash for Aadhaar at rest (lookup via same hash). */
export async function hashAadhaar(aadhaar: string): Promise<string> {
  const normalized = normalizeAadhaar(aadhaar);
  return bcrypt.hash(normalized, 10);
}

/**
 * Deterministic hash for equality lookups without storing plaintext.
 * Use HMAC so DB unique index can match phone+aadhaar without bcrypt compare loops.
 */
export function fingerprintAadhaar(aadhaar: string, secret: string): string {
  const normalized = normalizeAadhaar(aadhaar);
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

export function maskPhone(phone: string): string {
  const digits = normalizePhone(phone);
  if (digits.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}
