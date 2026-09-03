import {
  fingerprintAadhaar,
  isValidAadhaar,
  isValidIndianPhone,
  normalizePhone,
} from '../../common/crypto';
import { accessDenied, badRequest, unauthorized } from '../../common/errors';
import { API_MESSAGES } from '../../common/status';
import { env } from '../../config/env';
import {
  ROLE_DASHBOARD_PATH,
  RoleUrlSlug,
  toClientRole,
  urlSlugToRole,
  USER_ROLES,
  USER_STATUS,
} from '../../config/roles';
import {
  canLoginWithPermissions,
  resolveSuperAdminTier,
} from '../../config/rbac';
import { otpService } from '../otp/otp.service';
import { User } from '../users/user.model';
import {
  RequestOtpInput,
  VerifyOtpInput,
} from './auth.validation';
import { TokenPairMeta, tokenService } from './token.service';

function assertCredentialsFormat(phone: string, aadhaar: string): void {
  if (!isValidIndianPhone(phone)) {
    throw badRequest('Enter a valid 10-digit Indian mobile number');
  }
  if (!isValidAadhaar(aadhaar)) {
    throw badRequest('Enter a valid 12-digit Aadhaar number');
  }
}

export class AuthService {
  async requestOtp(roleSlug: RoleUrlSlug, input: RequestOtpInput) {
    const role = urlSlugToRole(roleSlug);
    const phone = normalizePhone(input.phone);
    assertCredentialsFormat(phone, input.aadhaarNumber);

    const aadhaarFingerprint = fingerprintAadhaar(
      input.aadhaarNumber,
      env.JWT_SECRET
    );

    const user = await User.findOne({
      phone,
      aadhaarFingerprint,
      role,
    });

    if (!user) {
      throw accessDenied(
        'Invalid credentials for this login portal, or account does not exist for this role'
      );
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      throw accessDenied('Your account is inactive or blocked. Contact support.');
    }

    if (!canLoginWithPermissions(user.role, user.permissions)) {
      throw accessDenied(
        'Your account has no valid permissions assigned. Contact support.'
      );
    }

    const { expiresInMinutes } = await otpService.createAndSend({
      phone,
      countryCode: input.countryCode,
      aadhaarFingerprint,
      role,
      userId: user._id,
    });

    return {
      message: API_MESSAGES.OTP_SENT,
      expiresInMinutes,
      maskedPhone: `${'*'.repeat(6)}${phone.slice(-4)}`,
      role,
      ...(env.NODE_ENV === 'development'
        ? { mockOtpHint: env.MOCK_OTP }
        : {}),
    };
  }

  async verifyOtp(
    roleSlug: RoleUrlSlug,
    input: VerifyOtpInput,
    meta: TokenPairMeta = {}
  ) {
    const role = urlSlugToRole(roleSlug);
    const phone = normalizePhone(input.phone);
    assertCredentialsFormat(phone, input.aadhaarNumber);

    const aadhaarFingerprint = fingerprintAadhaar(
      input.aadhaarNumber,
      env.JWT_SECRET
    );

    const user = await User.findOne({
      phone,
      aadhaarFingerprint,
      role,
    });

    if (!user) {
      throw accessDenied(
        'Invalid credentials for this login portal, or account does not exist for this role'
      );
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      throw accessDenied('Your account is inactive or blocked. Contact support.');
    }

    if (!canLoginWithPermissions(user.role, user.permissions)) {
      throw accessDenied(
        'Your account has no valid permissions assigned. Contact support.'
      );
    }

    await otpService.verify({ phone, role, otp: input.otp });

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await tokenService.issueTokenPair(user, meta);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn,
      user: {
        ...tokens.user,
        ...(user.role === USER_ROLES.SUPER_ADMIN
          ? { tier: resolveSuperAdminTier(user.permissions) }
          : {}),
      },
      redirectTo: tokens.redirectTo,
    };
  }

  async refresh(refreshToken: string, meta: TokenPairMeta = {}) {
    return tokenService.rotateRefreshToken(refreshToken, meta);
  }

  async logout(userId: string, sid: string | undefined) {
    if (sid) {
      await tokenService.revokeSessionBySid(sid, userId);
    }
    return { loggedOut: true };
  }

  async logoutAll(userId: string) {
    const revokedCount = await tokenService.revokeAllSessionsForUser(userId);
    return { loggedOut: true, revokedSessions: revokedCount };
  }

  async me(userId: string) {
    const user = await User.findById(userId).select(
      '-aadhaarFingerprint -__v'
    );
    if (!user) {
      throw unauthorized('User not found');
    }
    return {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      countryCode: user.countryCode,
      role: toClientRole(user.role),
      permissions: user.permissions,
      internalRole: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      redirectTo: ROLE_DASHBOARD_PATH[user.role],
      ...(user.role === USER_ROLES.SUPER_ADMIN
        ? { tier: resolveSuperAdminTier(user.permissions) }
        : {}),
    };
  }
}

export const authService = new AuthService();
