import crypto from 'crypto';
import { AppError } from '../../../common/errors';

export type EncryptedPidBlock = {
  encryptedSessionKeyB64: string;
  encryptedPidB64: string;
  encryptedHmacB64: string;
  ci: string;
};

/**
 * UIDAI Auth/eKYC PID encryption (AES-256 session key + RSA-OAEP/PKCS1 for skey).
 * Session key exists only in memory for this call and is zeroed afterwards.
 */
export function encryptPidBlock(input: {
  pidXml: string;
  uidaiPublicCertPem: string;
  ci: string;
}): EncryptedPidBlock {
  const sessionKey = crypto.randomBytes(32);
  try {
    const pidBuf = Buffer.from(input.pidXml, 'utf8');

    // AES-256-ECB/PKCS7 — common UIDAI sandbox PID mode for OTP factor.
    const cipher = crypto.createCipheriv('aes-256-ecb', sessionKey, null);
    cipher.setAutoPadding(true);
    const encryptedPid = Buffer.concat([cipher.update(pidBuf), cipher.final()]);

    const pidHash = crypto.createHash('sha256').update(pidBuf).digest();
    const hmacCipher = crypto.createCipheriv('aes-256-ecb', sessionKey, null);
    hmacCipher.setAutoPadding(true);
    const encryptedHmac = Buffer.concat([
      hmacCipher.update(pidHash),
      hmacCipher.final(),
    ]);

    let encryptedSessionKey: Buffer;
    try {
      encryptedSessionKey = crypto.publicEncrypt(
        {
          key: input.uidaiPublicCertPem,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        sessionKey
      );
    } catch {
      throw new AppError(
        'Failed to encrypt session key with UIDAI public certificate',
        502,
        'AADHAAR_CRYPTO_ERROR'
      );
    }

    return {
      encryptedSessionKeyB64: encryptedSessionKey.toString('base64'),
      encryptedPidB64: encryptedPid.toString('base64'),
      encryptedHmacB64: encryptedHmac.toString('base64'),
      ci: input.ci,
    };
  } finally {
    sessionKey.fill(0);
  }
}

/**
 * Decrypt eKYC response payload when UIDAI returns AES-encrypted KYC XML
 * using the same session-key pattern (response may be plaintext XML in some sandboxes).
 */
export function tryDecryptAesEcbBase64(
  cipherB64: string,
  sessionKey: Buffer
): string | null {
  try {
    const encrypted = Buffer.from(cipherB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-ecb', sessionKey, null);
    decipher.setAutoPadding(true);
    const plain = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return null;
  }
}
