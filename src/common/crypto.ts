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

const SENSITIVE_CIPHER = 'aes-256-gcm';
const SENSITIVE_FORMAT_VERSION = 'v1';
const SENSITIVE_IV_BYTES = 12;
export const SENSITIVE_KEY_BYTES = 32;

function decodeSensitiveKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== SENSITIVE_KEY_BYTES) {
    throw new Error('Sensitive data encryption key must decode to 32 bytes');
  }
  return key;
}

/**
 * Reversible encryption for data that privileged staff may need to reveal
 * (e.g. full Aadhaar). Output: `v1:<iv>:<authTag>:<ciphertext>` (base64 parts).
 */
export function encryptSensitive(plaintext: string, keyBase64: string): string {
  const iv = crypto.randomBytes(SENSITIVE_IV_BYTES);
  const cipher = crypto.createCipheriv(SENSITIVE_CIPHER, decodeSensitiveKey(keyBase64), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    SENSITIVE_FORMAT_VERSION,
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/** Throws when the payload is malformed, tampered with, or encrypted with another key. */
export function decryptSensitive(payload: string, keyBase64: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(':');
  if (version !== SENSITIVE_FORMAT_VERSION || !ivPart || !tagPart || !dataPart) {
    throw new Error('Unsupported sensitive data payload');
  }
  const decipher = crypto.createDecipheriv(
    SENSITIVE_CIPHER,
    decodeSensitiveKey(keyBase64),
    Buffer.from(ivPart, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
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
