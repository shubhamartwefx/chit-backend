import { normalizeAadhaar } from '../../common/crypto';
import { env } from '../../config/env';
import { IVerifiedAadhaarProfile, MOCK_AADHAAR_DEMOGRAPHICS } from './types';

export interface AadhaarKycProvider {
  requestLinkedMobile(aadhaarNumber: string): Promise<{ maskedPhone: string }>;
  deliverOtp(maskedPhone: string, otp: string): Promise<void>;
  fetchDemographics(aadhaarLast4: string): Promise<IVerifiedAadhaarProfile>;
}

export class MockAadhaarKycProvider implements AadhaarKycProvider {
  async requestLinkedMobile(
    aadhaarNumber: string
  ): Promise<{ maskedPhone: string }> {
    const last4 = normalizeAadhaar(aadhaarNumber).slice(-4);
    return { maskedPhone: `XXXXXX${last4}` };
  }

  async deliverOtp(maskedPhone: string, otp: string): Promise<void> {
    console.log(
      `[MOCK AADHAAR OTP] Aadhaar-linked ${maskedPhone} → OTP: ${otp} (expires in ${env.OTP_EXPIRY_MINUTES}m)`
    );
  }

  async fetchDemographics(
    aadhaarLast4: string
  ): Promise<IVerifiedAadhaarProfile> {
    return {
      ...MOCK_AADHAAR_DEMOGRAPHICS,
      aadhaarLast4,
    };
  }
}

export function createAadhaarKycProvider(): AadhaarKycProvider {
  return new MockAadhaarKycProvider();
}

export { MOCK_AADHAAR_DEMOGRAPHICS };
