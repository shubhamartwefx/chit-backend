import { normalizeAadhaar } from '../../common/crypto';
import { env } from '../../config/env';
import {
  buildMockAadhaarProfile,
  type IVerifiedAadhaarProfile,
  type MockAadhaarRole,
  MOCK_AADHAAR_DEMOGRAPHICS,
} from './types';

export interface AadhaarKycProvider {
  requestLinkedMobile(aadhaarNumber: string): Promise<{ maskedPhone: string }>;
  deliverOtp(maskedPhone: string, otp: string): Promise<void>;
  fetchDemographics(
    aadhaarLast4: string,
    role?: MockAadhaarRole
  ): Promise<IVerifiedAadhaarProfile>;
}

export class MockAadhaarKycProvider implements AadhaarKycProvider {
  constructor(private readonly role: MockAadhaarRole = 'agent') {}

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
    aadhaarLast4: string,
    role?: MockAadhaarRole
  ): Promise<IVerifiedAadhaarProfile> {
    return buildMockAadhaarProfile(aadhaarLast4, role ?? this.role);
  }
}

export function createAadhaarKycProvider(
  role: MockAadhaarRole = 'agent'
): AadhaarKycProvider {
  return new MockAadhaarKycProvider(role);
}

export { MOCK_AADHAAR_DEMOGRAPHICS };
