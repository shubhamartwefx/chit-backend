import {
  generateSecret,
  generateURI,
  verifySync,
} from 'otplib';
import QRCode from 'qrcode';
import { env } from '../../config/env';

export function generateTotpSecret(): string {
  return generateSecret();
}

export function buildOtpauthUri(
  secret: string,
  accountLabel: string
): string {
  return generateURI({
    issuer: env.TOTP_ISSUER,
    label: accountLabel,
    secret,
  });
}

export async function buildTotpQrDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri);
}

export function verifyTotpCode(secret: string, token: string): boolean {
  const result = verifySync({ secret, token, epochTolerance: 30 });
  return Boolean(result.valid);
}
