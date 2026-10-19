import fs from 'fs';
import path from 'path';
import { AppError } from '../../../common/errors';
import { env } from '../../../config/env';

export type UidaiRuntimeConfig = {
  otpBaseUrl: string;
  authBaseUrl: string;
  ekycBaseUrl: string;
  auaCode: string;
  subAuaCode: string;
  asaCode: string;
  licenseKey: string;
  ci: string;
  publicCertPem: string;
  signingCertPem: string;
  signingKeyPem: string;
};

let cached: UidaiRuntimeConfig | null = null;

function readPem(filePath: string, label: string): string {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new AppError(
      `Missing UIDAI ${label}. Configure the path in environment variables.`,
      502,
      'AADHAAR_CONFIG_ERROR'
    );
  }
  const pem = fs.readFileSync(resolved, 'utf8').trim();
  if (!pem.includes('BEGIN')) {
    throw new AppError(
      `Invalid UIDAI ${label} file contents.`,
      502,
      'AADHAAR_CONFIG_ERROR'
    );
  }
  return pem;
}

/**
 * Load UIDAI secrets from env/file paths. Never log license keys or PEM contents.
 * Call only when AADHAAR_KYC_PROVIDER=uidai.
 */
export function getUidaiConfig(): UidaiRuntimeConfig {
  if (cached) return cached;

  const licenseKey = env.UIDAI_LICENSE_KEY?.trim() ?? '';
  if (!licenseKey) {
    throw new AppError(
      'UIDAI_LICENSE_KEY is required when AADHAAR_KYC_PROVIDER=uidai',
      502,
      'AADHAAR_CONFIG_ERROR'
    );
  }
  if (!env.UIDAI_PUBLIC_CERT_PATH?.trim()) {
    throw new AppError(
      'UIDAI_PUBLIC_CERT_PATH is required when AADHAAR_KYC_PROVIDER=uidai',
      502,
      'AADHAAR_CONFIG_ERROR'
    );
  }
  if (!env.UIDAI_AUA_SIGNING_CERT_PATH?.trim()) {
    throw new AppError(
      'UIDAI_AUA_SIGNING_CERT_PATH is required when AADHAAR_KYC_PROVIDER=uidai',
      502,
      'AADHAAR_CONFIG_ERROR'
    );
  }
  if (!env.UIDAI_AUA_SIGNING_KEY_PATH?.trim()) {
    throw new AppError(
      'UIDAI_AUA_SIGNING_KEY_PATH is required when AADHAAR_KYC_PROVIDER=uidai',
      502,
      'AADHAAR_CONFIG_ERROR'
    );
  }

  cached = {
    otpBaseUrl: env.UIDAI_OTP_BASE_URL,
    authBaseUrl: env.UIDAI_AUTH_BASE_URL,
    ekycBaseUrl: env.UIDAI_EKYC_BASE_URL,
    auaCode: env.UIDAI_AUA_CODE,
    subAuaCode: env.UIDAI_SUB_AUA_CODE,
    asaCode: env.UIDAI_ASA_CODE,
    licenseKey,
    ci: env.UIDAI_CI,
    publicCertPem: readPem(env.UIDAI_PUBLIC_CERT_PATH, 'public certificate'),
    signingCertPem: readPem(
      env.UIDAI_AUA_SIGNING_CERT_PATH,
      'AUA signing certificate'
    ),
    signingKeyPem: readPem(
      env.UIDAI_AUA_SIGNING_KEY_PATH,
      'AUA signing private key'
    ),
  };

  return cached;
}

/** Test helper — clears cached secrets. */
export function clearUidaiConfigCache(): void {
  cached = null;
}
