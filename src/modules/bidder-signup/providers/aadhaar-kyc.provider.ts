import { normalizeAadhaar } from '../../../common/crypto';
import { env } from '../../../config/env';
import { IVerifiedAadhaarProfile } from '../bidder-signup.model';

export interface AadhaarKycProvider {
  /** Returns masked Aadhaar-linked mobile for OTP delivery. */
  requestLinkedMobile(aadhaarNumber: string): Promise<{ maskedPhone: string }>;
  /** Deliver OTP to the Aadhaar-linked mobile (mock logs to console). */
  deliverOtp(maskedPhone: string, otp: string): Promise<void>;
  /** Fetch demographics after OTP verification (uses last-4 only in mock). */
  fetchDemographics(aadhaarLast4: string): Promise<IVerifiedAadhaarProfile>;
}

/** Demo demographics aligned with FE register mock. */
export const MOCK_AADHAAR_DEMOGRAPHICS: Omit<
  IVerifiedAadhaarProfile,
  'aadhaarLast4'
> = {
  fullName: 'Rajesh Kumar',
  gender: 'Male',
  dateOfBirth: '15/08/1990',
  aadhaarAddress: {
    street: '42, MG Road, Koramangala',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560034',
    country: 'India',
  },
};

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
