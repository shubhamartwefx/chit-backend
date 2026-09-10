import crypto from 'crypto';
import {
  fingerprintAadhaar,
  hashOtp,
  isValidAadhaar,
  isValidIndianPhone,
  normalizeAadhaar,
  normalizePhone,
  verifyOtpHash,
} from '../../common/crypto';
import {
  badRequest,
  conflict,
  notFound,
  unauthorized,
} from '../../common/errors';
import { env } from '../../config/env';
import {
  BIDDER_DEFAULT,
  USER_ROLES,
  USER_STATUS,
} from '../../config/roles';
import { TokenPairMeta, tokenService } from '../auth/token.service';
import { signupPaymentService } from '../signup-payment/signup-payment.service';
import {
  User,
  VERIFICATION_METHODS,
} from '../users/user.model';
import {
  createAadhaarKycProvider,
  type AadhaarKycProvider,
} from '../kyc-providers/aadhaar-kyc.provider';
import {
  createDigiLockerProvider,
  type DigiLockerProvider,
} from '../kyc-providers/digilocker.provider';
import type { IVerifiedAadhaarProfile } from '../kyc-providers/types';
import {
  BidderSignupSession,
  IBidderSignupSessionDocument,
  SIGNUP_METHODS,
  SIGNUP_STATUS,
} from './bidder-signup.model';
import {
  CompleteRegistrationInput,
  DigilockerCallbackQuery,
  RequestAadhaarOtpInput,
  VerifyAadhaarOtpInput,
} from './bidder-signup.validation';

function newSessionId(): string {
  return crypto.randomBytes(24).toString('hex');
}

function newOAuthState(): string {
  return crypto.randomBytes(24).toString('hex');
}

function sessionExpiresAt(): Date {
  return new Date(
    Date.now() + env.SIGNUP_SESSION_TTL_MINUTES * 60 * 1000
  );
}

/** Deterministic 12-digit synthetic Aadhaar scoped to a DigiLocker session. */
function syntheticAadhaarFromSession(sessionId: string): string {
  const hash = crypto.createHash('sha256').update(sessionId).digest('hex');
  let digits = '';
  for (const c of hash) {
    if (digits.length >= 12) break;
    digits += String(parseInt(c, 16) % 10);
  }
  return digits.padEnd(12, '0').slice(0, 12);
}

function formatSealedProfile(profile: IVerifiedAadhaarProfile) {
  return {
    fullName: profile.fullName,
    gender: profile.gender,
    dateOfBirth: profile.dateOfBirth,
    aadhaarAddress: { ...profile.aadhaarAddress },
    aadhaarLast4: profile.aadhaarLast4,
  };
}

export class BidderSignupService {
  constructor(
    private readonly aadhaarKyc: AadhaarKycProvider = createAadhaarKycProvider(
      'bidder'
    ),
    private readonly digiLocker: DigiLockerProvider = createDigiLockerProvider(
      'bidder'
    )
  ) {}

  private async assertNoExistingBidderByFingerprint(
    aadhaarFingerprint: string
  ): Promise<void> {
    const existing = await User.findOne({
      aadhaarFingerprint,
      role: USER_ROLES.BIDDER,
    });
    if (existing) {
      throw conflict('A bidder account already exists for this Aadhaar number');
    }
  }

  private async assertNoExistingBidderByPhone(phone: string): Promise<void> {
    const existing = await User.findOne({
      phone,
      role: USER_ROLES.BIDDER,
    });
    if (existing) {
      throw conflict('A bidder account already exists for this phone number');
    }
  }

  private async getActiveSession(
    sessionId: string
  ): Promise<IBidderSignupSessionDocument> {
    const session = await BidderSignupSession.findOne({ sessionId });
    if (!session) {
      throw notFound('Signup session not found');
    }
    if (
      session.status === SIGNUP_STATUS.EXPIRED ||
      session.expiresAt.getTime() < Date.now()
    ) {
      session.status = SIGNUP_STATUS.EXPIRED;
      await session.save();
      throw unauthorized('Signup session has expired. Start again.');
    }
    if (session.status === SIGNUP_STATUS.COMPLETED) {
      throw conflict('Signup session already completed');
    }
    return session;
  }

  async requestAadhaarOtp(input: RequestAadhaarOtpInput) {
    if (!isValidAadhaar(input.aadhaarNumber)) {
      throw badRequest('Enter a valid 12-digit Aadhaar number');
    }

    const aadhaar = normalizeAadhaar(input.aadhaarNumber);
    const aadhaarFingerprint = fingerprintAadhaar(aadhaar, env.JWT_SECRET);
    await this.assertNoExistingBidderByFingerprint(aadhaarFingerprint);

    const { maskedPhone } = await this.aadhaarKyc.requestLinkedMobile(aadhaar);
    const otp = env.MOCK_OTP;
    const otpHash = await hashOtp(otp);
    const otpExpiresAt = new Date(
      Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000
    );

    const sessionId = newSessionId();
    await BidderSignupSession.create({
      sessionId,
      method: SIGNUP_METHODS.MANUAL,
      status: SIGNUP_STATUS.PENDING_OTP,
      aadhaarFingerprint,
      aadhaarLast4: aadhaar.slice(-4),
      maskedPhone,
      otpHash,
      attempts: 0,
      otpExpiresAt,
      expiresAt: sessionExpiresAt(),
    });

    await this.aadhaarKyc.deliverOtp(maskedPhone, otp);

    return {
      sessionId,
      maskedPhone,
      expiresInMinutes: env.OTP_EXPIRY_MINUTES,
      message: 'OTP sent to Aadhaar-linked mobile number',
      ...(env.NODE_ENV === 'development'
        ? { mockOtpHint: env.MOCK_OTP }
        : {}),
    };
  }

  async resendAadhaarOtp(sessionId: string) {
    const session = await this.getActiveSession(sessionId);

    if (session.method !== SIGNUP_METHODS.MANUAL) {
      throw badRequest('OTP resend is only available for manual Aadhaar verification');
    }
    if (session.status !== SIGNUP_STATUS.PENDING_OTP) {
      throw badRequest('OTP has already been verified for this session');
    }
    if (!session.maskedPhone) {
      throw badRequest('Signup session is missing linked mobile details');
    }

    const otp = env.MOCK_OTP;
    session.otpHash = await hashOtp(otp);
    session.attempts = 0;
    session.otpExpiresAt = new Date(
      Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000
    );
    session.expiresAt = sessionExpiresAt();
    await session.save();

    await this.aadhaarKyc.deliverOtp(session.maskedPhone, otp);

    return {
      sessionId: session.sessionId,
      maskedPhone: session.maskedPhone,
      expiresInMinutes: env.OTP_EXPIRY_MINUTES,
      message: 'OTP resent to Aadhaar-linked mobile number',
      ...(env.NODE_ENV === 'development'
        ? { mockOtpHint: env.MOCK_OTP }
        : {}),
    };
  }

  async verifyAadhaarOtp(input: VerifyAadhaarOtpInput) {
    const session = await this.getActiveSession(input.sessionId);

    if (session.method !== SIGNUP_METHODS.MANUAL) {
      throw badRequest('OTP verify is only available for manual Aadhaar verification');
    }
    if (session.status !== SIGNUP_STATUS.PENDING_OTP) {
      throw badRequest('OTP has already been verified for this session');
    }
    if (!session.otpHash || !session.otpExpiresAt || !session.aadhaarLast4) {
      throw badRequest('Invalid OTP session state');
    }

    if (session.otpExpiresAt.getTime() < Date.now()) {
      throw unauthorized('OTP has expired. Request a new OTP.');
    }

    if (session.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw unauthorized('Too many invalid OTP attempts. Request a new OTP.');
    }

    const valid = await verifyOtpHash(input.otp, session.otpHash);
    if (!valid) {
      session.attempts += 1;
      await session.save();
      throw unauthorized('Invalid OTP');
    }

    const profile = await this.aadhaarKyc.fetchDemographics(
      session.aadhaarLast4
    );

    session.verifiedProfile = profile;
    session.status = SIGNUP_STATUS.VERIFIED;
    session.otpHash = null;
    session.expiresAt = sessionExpiresAt();
    await session.save();

    return {
      sessionId: session.sessionId,
      status: session.status,
      maskedPhone: session.maskedPhone,
      profile: formatSealedProfile(profile),
    };
  }

  async startDigiLocker() {
    const sessionId = newSessionId();
    const digilockerState = newOAuthState();

    await BidderSignupSession.create({
      sessionId,
      method: SIGNUP_METHODS.DIGILOCKER,
      status: SIGNUP_STATUS.DIGILOCKER_PENDING,
      digilockerState,
      expiresAt: sessionExpiresAt(),
    });

    const authorizationUrl = this.digiLocker.buildAuthorizationUrl(
      digilockerState,
      env.DIGILOCKER_REDIRECT_URI
    );

    return {
      sessionId,
      authorizationUrl,
      message: 'Redirect the user to DigiLocker to complete Aadhaar verification',
      ...(env.NODE_ENV === 'development'
        ? {
            mockHint:
              'Mock DigiLocker: open authorizationUrl or GET the callback with code=mock-digilocker-code and the returned state',
          }
        : {}),
    };
  }

  async digilockerCallback(query: DigilockerCallbackQuery) {
    const session = await BidderSignupSession.findOne({
      digilockerState: query.state,
      method: SIGNUP_METHODS.DIGILOCKER,
    });

    if (!session) {
      throw notFound('DigiLocker signup session not found for this state');
    }

    if (
      session.status === SIGNUP_STATUS.EXPIRED ||
      session.expiresAt.getTime() < Date.now()
    ) {
      session.status = SIGNUP_STATUS.EXPIRED;
      await session.save();
      throw unauthorized('Signup session has expired. Start again.');
    }

    if (session.status === SIGNUP_STATUS.COMPLETED) {
      throw conflict('Signup session already completed');
    }

    if (session.status === SIGNUP_STATUS.VERIFIED && session.verifiedProfile) {
      return {
        sessionId: session.sessionId,
        status: session.status,
        profile: formatSealedProfile(session.verifiedProfile),
      };
    }

    if (session.status !== SIGNUP_STATUS.DIGILOCKER_PENDING) {
      throw badRequest('Invalid DigiLocker session state');
    }

    const syntheticAadhaar = syntheticAadhaarFromSession(session.sessionId);
    const aadhaarFingerprint = fingerprintAadhaar(
      syntheticAadhaar,
      env.JWT_SECRET
    );
    await this.assertNoExistingBidderByFingerprint(aadhaarFingerprint);

    const profile = await this.digiLocker.exchangeAndFetchProfile(
      query.code,
      syntheticAadhaar.slice(-4)
    );

    session.aadhaarFingerprint = aadhaarFingerprint;
    session.aadhaarLast4 = profile.aadhaarLast4;
    session.maskedPhone = `XXXXXX${profile.aadhaarLast4}`;
    session.verifiedProfile = profile;
    session.status = SIGNUP_STATUS.VERIFIED;
    session.digilockerState = null;
    session.expiresAt = sessionExpiresAt();
    await session.save();

    return {
      sessionId: session.sessionId,
      status: session.status,
      maskedPhone: session.maskedPhone,
      profile: formatSealedProfile(profile),
    };
  }

  async getSession(sessionId: string) {
    const session = await BidderSignupSession.findOne({ sessionId });
    if (!session) {
      throw notFound('Signup session not found');
    }

    const expired =
      session.status === SIGNUP_STATUS.EXPIRED ||
      (session.status !== SIGNUP_STATUS.COMPLETED &&
        session.expiresAt.getTime() < Date.now());

    return {
      sessionId: session.sessionId,
      method: session.method,
      status: expired ? SIGNUP_STATUS.EXPIRED : session.status,
      maskedPhone: session.maskedPhone ?? undefined,
      profile:
        session.status === SIGNUP_STATUS.VERIFIED ||
        session.status === SIGNUP_STATUS.COMPLETED
          ? session.verifiedProfile
            ? formatSealedProfile(session.verifiedProfile)
            : undefined
          : undefined,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async completeRegistration(
    input: CompleteRegistrationInput,
    meta: TokenPairMeta = {}
  ) {
    const session = await this.getActiveSession(input.sessionId);

    if (session.status !== SIGNUP_STATUS.VERIFIED) {
      throw badRequest(
        'Complete Aadhaar verification before finishing registration'
      );
    }

    if (!session.verifiedProfile || !session.aadhaarFingerprint) {
      throw badRequest('Verified Aadhaar profile is missing on this session');
    }

    const phone = normalizePhone(input.phone);
    if (!isValidIndianPhone(phone)) {
      throw badRequest('Enter a valid 10-digit Indian mobile number');
    }

    await this.assertNoExistingBidderByFingerprint(session.aadhaarFingerprint);
    await this.assertNoExistingBidderByPhone(phone);

    await signupPaymentService.consumePaidOrder({
      role: 'bidder',
      sessionId: input.sessionId,
      paymentId: input.paymentId,
    });

    const profile = session.verifiedProfile;
    const verificationMethod =
      session.method === SIGNUP_METHODS.DIGILOCKER
        ? VERIFICATION_METHODS.DIGILOCKER
        : VERIFICATION_METHODS.MANUAL;

    let user;
    try {
      user = await User.create({
        name: profile.fullName,
        countryCode: input.countryCode,
        phone,
        aadhaarFingerprint: session.aadhaarFingerprint,
        role: USER_ROLES.BIDDER,
        permissions: [...BIDDER_DEFAULT],
        status: USER_STATUS.ACTIVE,
        createdBy: null,
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth,
        aadhaarAddress: { ...profile.aadhaarAddress },
        currentAddress: input.currentAddress?.trim() || null,
        aadhaarLast4: profile.aadhaarLast4,
        aadhaarVerifiedAt: new Date(),
        verificationMethod,
        lastLoginAt: new Date(),
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: number }).code === 11000
      ) {
        throw conflict(
          'A bidder account already exists for this phone or Aadhaar number'
        );
      }
      throw err;
    }

    session.status = SIGNUP_STATUS.COMPLETED;
    session.completedUserId = user._id;
    await session.save();

    const tokens = await tokenService.issueTokenPair(user, meta);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn,
      user: {
        ...tokens.user,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        aadhaarAddress: user.aadhaarAddress,
        currentAddress: user.currentAddress,
        aadhaarLast4: user.aadhaarLast4,
        verificationMethod: user.verificationMethod,
      },
      redirectTo: tokens.redirectTo,
    };
  }
}
export const bidderSignupService = new BidderSignupService();
