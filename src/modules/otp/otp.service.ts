import { Types } from 'mongoose';

import { hashOtp, verifyOtpHash } from '../../common/crypto';
import { accessDenied, unauthorized } from '../../common/errors';
import { env } from '../../config/env';
import { UserRole } from '../../config/roles';
import { OtpSession } from './otp.model';
import {
  SmsOtpProvider,
  TwoFactorOtpProvider,
} from './twofactor.provider';

export interface CreateOtpInput {
  phone: string;
  countryCode: string;
  aadhaarFingerprint: string;
  role: UserRole;
  userId: Types.ObjectId;
}

export type OtpProvider = SmsOtpProvider;

/** Dev/mock OTP — logs to console; fixed value from env. */
export class MockOtpProvider implements OtpProvider {
  generateOtp(): string {
    return env.MOCK_OTP;
  }

  async deliver(phone: string, countryCode: string, otp: string): Promise<void> {
    console.log(
      `[MOCK OTP] ${countryCode}${phone} → OTP: ${otp} (expires in ${env.OTP_EXPIRY_MINUTES}m)`
    );
  }
}

export function createOtpProvider(): OtpProvider {
  switch (env.SMS_PROVIDER) {
    case '2factor':
      return new TwoFactorOtpProvider();
    case 'mock':
    default:
      return new MockOtpProvider();
  }
}

export class OtpService {
  constructor(private readonly provider: OtpProvider = createOtpProvider()) {}

  get isMock(): boolean {
    return env.SMS_PROVIDER === 'mock';
  }

  async createAndSend(input: CreateOtpInput): Promise<{ expiresInMinutes: number }> {
    const otp = this.provider.generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    await OtpSession.updateMany(
      {
        phone: input.phone,
        role: input.role,
        consumed: false,
      },
      { $set: { consumed: true } }
    );

    await OtpSession.create({
      ...input,
      otpHash,
      expiresAt,
      attempts: 0,
      consumed: false,
    });

    await this.provider.deliver(input.phone, input.countryCode, otp);

    return { expiresInMinutes: env.OTP_EXPIRY_MINUTES };
  }

  async verify(params: {
    phone: string;
    role: UserRole;
    otp: string;
  }): Promise<{ userId: Types.ObjectId }> {
    const session = await OtpSession.findOne({
      phone: params.phone,
      role: params.role,
      consumed: false,
    }).sort({ createdAt: -1 });

    if (!session) {
      throw unauthorized('OTP session not found or expired. Request a new OTP.');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      session.consumed = true;
      await session.save();
      throw unauthorized('OTP has expired. Request a new OTP.');
    }

    if (session.attempts >= env.OTP_MAX_ATTEMPTS) {
      session.consumed = true;
      await session.save();
      throw accessDenied('Too many invalid OTP attempts. Request a new OTP.');
    }

    const valid = await verifyOtpHash(params.otp, session.otpHash);
    if (!valid) {
      session.attempts += 1;
      await session.save();
      throw unauthorized('Invalid OTP');
    }

    session.consumed = true;
    await session.save();

    return { userId: session.userId };
  }
}

export const otpService = new OtpService();
