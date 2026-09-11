import bcrypt from 'bcryptjs';
import {
  accessDenied,
  badRequest,
  unauthorized,
} from '../../common/errors';
import { env } from '../../config/env';
import { USER_ROLES } from '../../config/roles';
import { User } from '../users/user.model';
import { isTwoFaAllowedForRole } from './security-policy';
import {
  buildOtpauthUri,
  buildTotpQrDataUrl,
  generateTotpSecret,
  verifyTotpCode,
} from './totp.util';

export class TwoFaService {
  async status(userId: string) {
    const user = await User.findById(userId).select(
      'role totpEnabled totpVerifiedAt'
    );
    if (!user) throw unauthorized('User not found');

    return {
      enabled: Boolean(user.totpEnabled),
      allowedForRole: isTwoFaAllowedForRole(user.role),
      verifiedAt: user.totpVerifiedAt?.toISOString() ?? null,
    };
  }

  async setup(userId: string) {
    const user = await User.findById(userId).select(
      '+totpSecret +totpPendingSecret role phone name totpEnabled'
    );
    if (!user) throw unauthorized('User not found');
    if (!isTwoFaAllowedForRole(user.role)) {
      throw accessDenied('2FA is not available for this role');
    }
    if (user.totpEnabled) {
      throw badRequest('2FA is already enabled. Disable it before re-enrolling.');
    }

    const secret = generateTotpSecret();
    user.totpPendingSecret = secret;
    await user.save();

    const accountLabel = `${user.phone} (${user.role})`;
    const otpauthUri = buildOtpauthUri(secret, accountLabel);
    const qrCodeDataUrl = await buildTotpQrDataUrl(otpauthUri);

    return {
      otpauthUri,
      qrCodeDataUrl,
      ...(env.NODE_ENV === 'development' ? { secret } : {}),
      message:
        'Scan the QR code with an authenticator app, then confirm with a 6-digit code',
    };
  }

  async confirm(userId: string, totp: string) {
    const user = await User.findById(userId).select(
      '+totpSecret +totpPendingSecret role totpEnabled'
    );
    if (!user) throw unauthorized('User not found');
    if (!isTwoFaAllowedForRole(user.role)) {
      throw accessDenied('2FA is not available for this role');
    }
    if (!user.totpPendingSecret) {
      throw badRequest('No pending 2FA setup. Call setup first.');
    }
    if (!verifyTotpCode(user.totpPendingSecret, totp)) {
      throw unauthorized('Invalid authenticator code');
    }

    user.totpSecret = user.totpPendingSecret;
    user.totpPendingSecret = null;
    user.totpEnabled = true;
    user.totpVerifiedAt = new Date();
    await user.save();

    return { enabled: true };
  }

  async disable(userId: string, totp: string) {
    const user = await User.findById(userId).select(
      '+totpSecret role totpEnabled'
    );
    if (!user) throw unauthorized('User not found');
    if (!isTwoFaAllowedForRole(user.role)) {
      throw accessDenied('2FA is not available for this role');
    }
    if (!user.totpEnabled || !user.totpSecret) {
      throw badRequest('2FA is not enabled');
    }
    if (!verifyTotpCode(user.totpSecret, totp)) {
      throw unauthorized('Invalid authenticator code');
    }

    user.totpEnabled = false;
    user.totpSecret = null;
    user.totpPendingSecret = null;
    user.totpVerifiedAt = null;
    await user.save();

    return { enabled: false };
  }
}

export class ScreenLockService {
  async status(userId: string) {
    const user = await User.findById(userId).select(
      '+pinHash role screenLockEnabled totpEnabled'
    );
    if (!user) throw unauthorized('User not found');

    return {
      enabled: Boolean(user.screenLockEnabled),
      hasPin: Boolean(user.pinHash),
      totpAvailable:
        isTwoFaAllowedForRole(user.role) && Boolean(user.totpEnabled),
      inactivityMinutes: env.SCREEN_LOCK_INACTIVITY_MINUTES,
    };
  }

  async setPin(
    userId: string,
    input: { pin: string; currentPin?: string; totp?: string }
  ) {
    if (!/^\d{6}$/.test(input.pin)) {
      throw badRequest('PIN must be exactly 6 digits');
    }

    const user = await User.findById(userId).select(
      '+pinHash +totpSecret role totpEnabled screenLockEnabled'
    );
    if (!user) throw unauthorized('User not found');

    if (user.pinHash) {
      const okPin =
        input.currentPin &&
        (await bcrypt.compare(input.currentPin, user.pinHash));
      const okTotp =
        user.totpEnabled &&
        user.totpSecret &&
        input.totp &&
        verifyTotpCode(user.totpSecret, input.totp);
      if (!okPin && !okTotp) {
        throw unauthorized(
          'Provide current PIN or a valid 2FA code to change PIN'
        );
      }
    }

    user.pinHash = await bcrypt.hash(input.pin, 10);
    await user.save();

    return { hasPin: true };
  }

  async enable(userId: string, enabled: boolean) {
    const user = await User.findById(userId).select('+pinHash');
    if (!user) throw unauthorized('User not found');

    if (enabled && !user.pinHash) {
      throw badRequest('Set a PIN before enabling screen lock');
    }

    user.screenLockEnabled = enabled;
    await user.save();

    return { enabled: user.screenLockEnabled };
  }

  async unlock(
    userId: string,
    input: { method: 'pin' | 'totp'; pin?: string; totp?: string }
  ) {
    const user = await User.findById(userId).select(
      '+pinHash +totpSecret role totpEnabled screenLockEnabled'
    );
    if (!user) throw unauthorized('User not found');

    if (input.method === 'totp') {
      if (user.role === USER_ROLES.BIDDER) {
        throw accessDenied('2FA unlock is not available for this role');
      }
      if (!user.totpEnabled || !user.totpSecret || !input.totp) {
        throw unauthorized('Invalid authenticator code');
      }
      if (!verifyTotpCode(user.totpSecret, input.totp)) {
        throw unauthorized('Invalid authenticator code');
      }
      return { unlocked: true, method: 'totp' as const };
    }

    if (input.method === 'pin') {
      if (!user.screenLockEnabled) {
        throw badRequest('Screen lock PIN is not enabled');
      }
      if (!input.pin || !user.pinHash) {
        throw unauthorized('Invalid PIN');
      }
      const ok = await bcrypt.compare(input.pin, user.pinHash);
      if (!ok) throw unauthorized('Invalid PIN');
      return { unlocked: true, method: 'pin' as const };
    }

    throw badRequest('Unsupported unlock method');
  }
}

export const twoFaService = new TwoFaService();
export const screenLockService = new ScreenLockService();
