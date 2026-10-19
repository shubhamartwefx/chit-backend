import type { AadhaarKycProvider } from '../aadhaar-kyc.provider';
import type { IVerifiedAadhaarProfile } from '../types';
import { getUidaiConfig } from './uidai-config';
import { verifyUidaiOtpViaEkyc } from './uidai-ekyc.client';
import { requestUidaiOtp } from './uidai-otp.client';

export class UidaiAadhaarKycProvider implements AadhaarKycProvider {
  async requestOtp(
    aadhaarNumber: string
  ): Promise<{ txn: string; maskedPhone?: string }> {
    const config = getUidaiConfig();
    const result = await requestUidaiOtp({ aadhaarNumber, config });
    // UIDAI OTP response does not reliably return masked phone.
    return { txn: result.txn };
  }

  async resendOtp(
    aadhaarNumber: string,
    _previousTxn?: string
  ): Promise<{ txn: string; maskedPhone?: string }> {
    // Always generate a fresh txn for resend (previous OTP/txn becomes invalid).
    return this.requestOtp(aadhaarNumber);
  }

  async verifyOtpAndFetchKyc(input: {
    aadhaarNumber: string;
    txn: string;
    otp: string;
  }): Promise<IVerifiedAadhaarProfile> {
    const config = getUidaiConfig();
    return verifyUidaiOtpViaEkyc({
      aadhaarNumber: input.aadhaarNumber,
      txn: input.txn,
      otp: input.otp,
      config,
    });
  }
}
