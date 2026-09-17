import {
  fingerprintAadhaar,
  isValidAadhaar,
  isValidIndianPhone,
  normalizePhone,
} from '../../common/crypto';
import { assertAccountCanAuthenticate } from '../../common/account-status';
import { accessDenied, badRequest, unauthorized } from '../../common/errors';
import { API_MESSAGES } from '../../common/status';
import { env } from '../../config/env';
import {
  RoleUrlSlug,
  urlSlugToRole,
  USER_ROLES,
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
  Verify2faInput,
} from './auth.validation';
import { profileService } from './profile.service';
import { usesTotpLogin } from './security-policy';
import { TokenPairMeta, tokenService } from './token.service';
import { verifyTotpCode } from './totp.util';

function assertPhoneFormat(phone: string): void {
  if (!isValidIndianPhone(phone)) {
    throw badRequest('Enter a valid 10-digit Indian mobile number');
  }
}

function assertAadhaarFormat(aadhaar: string): void {
  if (!isValidAadhaar(aadhaar)) {
    throw badRequest('Enter a valid 12-digit Aadhaar number');
  }
}

export class AuthService {
  private async findActiveLoginUser(
    roleSlug: RoleUrlSlug,
    phone: string,
    aadhaarNumber: string | undefined,
    extraSelect = ''
  ) {
    assertPhoneFormat(phone);
    const role = urlSlugToRole(roleSlug);
    const allowPhoneOnly =
      role === USER_ROLES.AGENT && (!aadhaarNumber || aadhaarNumber.length === 0);

    if (!allowPhoneOnly) {
      if (!aadhaarNumber) {
        throw badRequest('Aadhaar number is required for this login portal');
      }
      assertAadhaarFormat(aadhaarNumber);
    }

    const selectFields = `${extraSelect} role permissions status statusReason statusChangedAt statusChangedBy aadhaarFingerprint`;

    let user;
    let aadhaarFingerprint: string;

    if (allowPhoneOnly) {
      user = await User.findOne({ phone, role }).select(selectFields);
      if (!user?.aadhaarFingerprint) {
        throw accessDenied(
          'Invalid credentials for this login portal, or account does not exist for this role'
        );
      }
      aadhaarFingerprint = user.aadhaarFingerprint;
    } else {
      aadhaarFingerprint = fingerprintAadhaar(
        aadhaarNumber!,
        env.JWT_SECRET
      );
      user = await User.findOne({
        phone,
        aadhaarFingerprint,
        role,
      }).select(selectFields);
    }

    if (!user) {
      throw accessDenied(
        'Invalid credentials for this login portal, or account does not exist for this role'
      );
    }

    assertAccountCanAuthenticate(user);

    if (!canLoginWithPermissions(user.role, user.permissions ?? [])) {
      throw accessDenied(
        'Your account has no valid permissions assigned. Contact support.'
      );
    }

    return { user, role, phone, aadhaarFingerprint };
  }

  async requestOtp(roleSlug: RoleUrlSlug, input: RequestOtpInput) {
    const phone = normalizePhone(input.phone);
    const { user, role, aadhaarFingerprint } = await this.findActiveLoginUser(
      roleSlug,
      phone,
      input.aadhaarNumber
    );

    if (usesTotpLogin(user)) {
      return {
        message: 'Enter the code from your authenticator app',
        authMethod: 'totp' as const,
        requires2fa: true,
        maskedPhone: `${'*'.repeat(6)}${phone.slice(-4)}`,
        role,
      };
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
      authMethod: 'otp' as const,
      requires2fa: false,
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
    const phone = normalizePhone(input.phone);
    const { user, role } = await this.findActiveLoginUser(
      roleSlug,
      phone,
      input.aadhaarNumber
    );

    if (usesTotpLogin(user)) {
      throw badRequest(
        '2FA is enabled for this account. Use verify-2fa instead of verify-otp.'
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

  async verify2fa(
    roleSlug: RoleUrlSlug,
    input: Verify2faInput,
    meta: TokenPairMeta = {}
  ) {
    const phone = normalizePhone(input.phone);
    const { user } = await this.findActiveLoginUser(
      roleSlug,
      phone,
      input.aadhaarNumber,
      '+totpSecret'
    );

    if (!usesTotpLogin(user) || !user.totpSecret) {
      throw badRequest(
        '2FA is not enabled for this account. Use verify-otp instead.'
      );
    }

    if (!verifyTotpCode(user.totpSecret, input.totp)) {
      throw unauthorized('Invalid authenticator code');
    }

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
    return profileService.formatProfile(userId);
  }
}

export const authService = new AuthService();
