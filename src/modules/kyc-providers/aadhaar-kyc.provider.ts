import {
  hashOtp,
  normalizeAadhaar,
  verifyOtpHash,
} from '../../common/crypto';
import { unauthorized } from '../../common/errors';
import { env } from '../../config/env';
import {
  buildMockAadhaarProfile,
  type IVerifiedAadhaarProfile,
  type MockAadhaarRole,
  MOCK_AADHAAR_DEMOGRAPHICS,
} from './types';
import { UidaiAadhaarKycProvider } from './uidai/uidai-aadhaar-kyc.provider';

export type AadhaarOtpChallenge = {
  txn: string;
  maskedPhone?: string;
  /** Present only for mock provider — hashed OTP for local verify. Never used with UIDAI. */
  mockOtpHash?: string;
};

export interface AadhaarKycProvider {
  requestOtp(aadhaarNumber: string): Promise<AadhaarOtpChallenge>;
  resendOtp(
    aadhaarNumber: string,
    previousTxn?: string
  ): Promise<AadhaarOtpChallenge>;
  verifyOtpAndFetchKyc(input: {
    aadhaarNumber: string;
    txn: string;
    otp: string;
    /** Mock-only: verify against stored hash instead of UIDAI. */
    mockOtpHash?: string | null;
  }): Promise<IVerifiedAadhaarProfile>;
}

export class MockAadhaarKycProvider implements AadhaarKycProvider {
  constructor(private readonly role: MockAadhaarRole = 'agent') {}

  async requestOtp(
    aadhaarNumber: string
  ): Promise<AadhaarOtpChallenge> {
    const last4 = normalizeAadhaar(aadhaarNumber).slice(-4);
    const otp = env.MOCK_OTP;
    const mockOtpHash = await hashOtp(otp);
    const txn = `MOCK-${Date.now().toString(36)}-${last4}`;
    console.log(
      `[MOCK AADHAAR OTP] Aadhaar-linked XXXXXX${last4} → OTP: ${otp} (expires in ${env.OTP_EXPIRY_MINUTES}m)`
    );
    return {
      txn,
      maskedPhone: `XXXXXX${last4}`,
      mockOtpHash,
    };
  }

  async resendOtp(
    aadhaarNumber: string,
    _previousTxn?: string
  ): Promise<AadhaarOtpChallenge> {
    return this.requestOtp(aadhaarNumber);
  }

  async verifyOtpAndFetchKyc(input: {
    aadhaarNumber: string;
    txn: string;
    otp: string;
    mockOtpHash?: string | null;
  }): Promise<IVerifiedAadhaarProfile> {
    if (!input.mockOtpHash) {
      throw unauthorized('Invalid OTP session state');
    }
    const valid = await verifyOtpHash(input.otp, input.mockOtpHash);
    if (!valid) {
      throw unauthorized('Invalid OTP');
    }
    const last4 = normalizeAadhaar(input.aadhaarNumber).slice(-4);
    return buildMockAadhaarProfile(last4, this.role);
  }
}

export function createAadhaarKycProvider(
  role: MockAadhaarRole = 'agent'
): AadhaarKycProvider {
  if (env.AADHAAR_KYC_PROVIDER === 'uidai') {
    return new UidaiAadhaarKycProvider();
  }
  return new MockAadhaarKycProvider(role);
}

export function isUidaiAadhaarProvider(): boolean {
  return env.AADHAAR_KYC_PROVIDER === 'uidai';
}

export { MOCK_AADHAAR_DEMOGRAPHICS };
