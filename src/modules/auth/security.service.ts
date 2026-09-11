import bcrypt from 'bcryptjs';
import {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { badRequest, unauthorized } from '../../common/errors';
import { env } from '../../config/env';
import { User } from '../users/user.model';
import { biometricService } from './biometric.service';
import {
  assertSecurityMethodAllowed,
  isSecurityMethodAllowed,
  isTwoFaAllowedForRole,
  SECURITY_METHODS,
  SecurityMethod,
  UnlockMethod,
  unlockMethodsForUser,
} from './security-policy';
import { screenLockService, twoFaService } from './two-fa.service';
import { verifyTotpCode } from './totp.util';

export interface SecurityConfigureInput {
  method: SecurityMethod;
  enabled: boolean;
  pin?: string;
  currentPin?: string;
  totp?: string;
  webauthnResponse?: RegistrationResponseJSON | AuthenticationResponseJSON;
}

export interface SecurityUnlockInput {
  method: UnlockMethod;
  pin?: string;
  totp?: string;
  webauthnResponse?: AuthenticationResponseJSON;
}

function hasConfirmPayload(input: SecurityConfigureInput): boolean {
  if (input.method === SECURITY_METHODS.TOTP) {
    return Boolean(input.totp);
  }
  if (input.method === SECURITY_METHODS.SCREEN_LOCK) {
    return Boolean(input.pin);
  }
  if (input.method === SECURITY_METHODS.BIOMETRIC) {
    return Boolean(input.webauthnResponse);
  }
  return false;
}

export class SecurityService {
  async status(userId: string) {
    const user = await User.findById(userId).select(
      '+pinHash role totpEnabled screenLockEnabled biometricEnabled webauthnCredentials'
    );
    if (!user) throw unauthorized('User not found');

    const unlockMethods = unlockMethodsForUser({
      role: user.role,
      screenLockEnabled: user.screenLockEnabled,
      totpEnabled: user.totpEnabled,
      biometricEnabled: user.biometricEnabled,
      pinHash: user.pinHash,
    });

    return {
      inactivityMinutes: env.SCREEN_LOCK_INACTIVITY_MINUTES,
      methods: [
        {
          method: SECURITY_METHODS.TOTP,
          allowed: isSecurityMethodAllowed(user.role, SECURITY_METHODS.TOTP),
          enabled: Boolean(user.totpEnabled),
        },
        {
          method: SECURITY_METHODS.SCREEN_LOCK,
          allowed: isSecurityMethodAllowed(
            user.role,
            SECURITY_METHODS.SCREEN_LOCK
          ),
          enabled: Boolean(user.screenLockEnabled),
          hasPin: Boolean(user.pinHash),
          unlockMethods,
        },
        {
          method: SECURITY_METHODS.BIOMETRIC,
          allowed: isSecurityMethodAllowed(
            user.role,
            SECURITY_METHODS.BIOMETRIC
          ),
          enabled: Boolean(user.biometricEnabled),
          credentialCount: user.webauthnCredentials?.length ?? 0,
        },
      ],
    };
  }

  async configure(userId: string, input: SecurityConfigureInput) {
    const user = await User.findById(userId).select('role');
    if (!user) throw unauthorized('User not found');
    assertSecurityMethodAllowed(user.role, input.method);

    if (input.enabled) {
      if (!hasConfirmPayload(input)) {
        return this.startEnable(userId, input);
      }
      return this.finishEnable(userId, input);
    }

    return this.disable(userId, input);
  }

  private async startEnable(userId: string, input: SecurityConfigureInput) {
    if (input.method === SECURITY_METHODS.TOTP) {
      const setup = await twoFaService.setup(userId);
      return {
        method: SECURITY_METHODS.TOTP,
        enabled: false,
        step: 'confirm' as const,
        ...setup,
      };
    }

    if (input.method === SECURITY_METHODS.SCREEN_LOCK) {
      const user = await User.findById(userId).select('+pinHash');
      if (!user) throw unauthorized('User not found');

      if (!user.pinHash) {
        throw badRequest(
          'Provide pin when enabling screen_lock for the first time'
        );
      }

      return {
        method: SECURITY_METHODS.SCREEN_LOCK,
        enabled: Boolean(user.screenLockEnabled),
        step: 'confirm' as const,
        hasPin: true,
        message:
          'Call again with enabled:true and pin (or currentPin when changing) to finish enabling screen lock',
      };
    }

    if (input.method === SECURITY_METHODS.BIOMETRIC) {
      const options = await biometricService.registerOptions(userId);
      return {
        method: SECURITY_METHODS.BIOMETRIC,
        enabled: false,
        step: 'confirm' as const,
        webauthnOptions: options,
      };
    }

    throw badRequest('Unsupported security method');
  }

  private async finishEnable(userId: string, input: SecurityConfigureInput) {
    if (input.method === SECURITY_METHODS.TOTP) {
      if (!input.totp) throw badRequest('totp is required to confirm 2FA');
      await twoFaService.confirm(userId, input.totp);
      return { method: SECURITY_METHODS.TOTP, enabled: true };
    }

    if (input.method === SECURITY_METHODS.SCREEN_LOCK) {
      const user = await User.findById(userId).select(
        '+pinHash screenLockEnabled'
      );
      if (!user) throw unauthorized('User not found');

      if (!user.pinHash) {
        if (!input.pin) {
          throw badRequest('pin is required to enable screen lock');
        }
        await screenLockService.setPin(userId, { pin: input.pin });
      } else if (input.pin && input.currentPin) {
        await screenLockService.setPin(userId, {
          pin: input.pin,
          currentPin: input.currentPin,
          totp: input.totp,
        });
      } else if (input.pin && !input.currentPin) {
        // Re-enable with existing PIN: verify pin matches before enabling
        const ok = await bcrypt.compare(input.pin, user.pinHash);
        if (!ok) throw unauthorized('Invalid PIN');
      } else {
        throw badRequest('pin is required to enable screen lock');
      }

      await screenLockService.enable(userId, true);
      return {
        method: SECURITY_METHODS.SCREEN_LOCK,
        enabled: true,
        hasPin: true,
      };
    }

    if (input.method === SECURITY_METHODS.BIOMETRIC) {
      if (!input.webauthnResponse) {
        throw badRequest('webauthnResponse is required to confirm biometric');
      }
      const result = await biometricService.registerVerify(
        userId,
        input.webauthnResponse as RegistrationResponseJSON
      );
      return {
        method: SECURITY_METHODS.BIOMETRIC,
        enabled: true,
        credentialCount: result.credentialCount,
        deviceType: result.deviceType,
        backedUp: result.backedUp,
      };
    }

    throw badRequest('Unsupported security method');
  }

  private async disable(userId: string, input: SecurityConfigureInput) {
    if (input.method === SECURITY_METHODS.TOTP) {
      if (!input.totp) throw badRequest('totp is required to disable 2FA');
      await twoFaService.disable(userId, input.totp);
      return { method: SECURITY_METHODS.TOTP, enabled: false };
    }

    if (input.method === SECURITY_METHODS.SCREEN_LOCK) {
      const user = await User.findById(userId).select(
        '+pinHash +totpSecret role totpEnabled screenLockEnabled'
      );
      if (!user) throw unauthorized('User not found');
      if (!user.screenLockEnabled) {
        return { method: SECURITY_METHODS.SCREEN_LOCK, enabled: false };
      }

      const okPin =
        input.pin &&
        user.pinHash &&
        (await bcrypt.compare(input.pin, user.pinHash));
      const okTotp =
        isTwoFaAllowedForRole(user.role) &&
        user.totpEnabled &&
        user.totpSecret &&
        input.totp &&
        verifyTotpCode(user.totpSecret, input.totp);

      if (!okPin && !okTotp) {
        throw unauthorized(
          'Provide pin or a valid authenticator code to disable screen lock'
        );
      }

      await screenLockService.enable(userId, false);
      return {
        method: SECURITY_METHODS.SCREEN_LOCK,
        enabled: false,
        hasPin: Boolean(user.pinHash),
      };
    }

    if (input.method === SECURITY_METHODS.BIOMETRIC) {
      await biometricService.disable(userId);
      return {
        method: SECURITY_METHODS.BIOMETRIC,
        enabled: false,
        credentialCount: 0,
      };
    }

    throw badRequest('Unsupported security method');
  }

  async unlock(userId: string, input: SecurityUnlockInput) {
    const user = await User.findById(userId).select(
      '+pinHash role screenLockEnabled totpEnabled biometricEnabled'
    );
    if (!user) throw unauthorized('User not found');

    if (input.method === 'totp') {
      assertSecurityMethodAllowed(user.role, SECURITY_METHODS.TOTP);
      if (!user.totpEnabled) {
        throw badRequest('Enable Two-Factor Auth before unlocking with TOTP');
      }
      return screenLockService.unlock(userId, {
        method: 'totp',
        totp: input.totp,
      });
    }

    if (input.method === 'pin') {
      if (!user.screenLockEnabled) {
        throw badRequest('Screen lock PIN is not enabled');
      }
      return screenLockService.unlock(userId, {
        method: 'pin',
        pin: input.pin,
      });
    }

    if (input.method === 'biometric') {
      if (!user.biometricEnabled) {
        throw badRequest('Biometric is not enabled');
      }
      if (!input.webauthnResponse) {
        const options = await biometricService.authenticateOptions(userId);
        return {
          unlocked: false,
          step: 'confirm' as const,
          method: 'biometric' as const,
          webauthnOptions: options,
        };
      }
      const result = await biometricService.authenticateVerify(
        userId,
        input.webauthnResponse
      );
      return {
        unlocked: true,
        method: 'biometric' as const,
        verified: result.verified,
      };
    }

    throw badRequest('Unsupported unlock method');
  }
}

export const securityService = new SecurityService();
