import { accessDenied } from '../../common/errors';
import { USER_ROLES, UserRole } from '../../config/roles';

export const SECURITY_METHODS = {
  TOTP: 'totp',
  SCREEN_LOCK: 'screen_lock',
  BIOMETRIC: 'biometric',
} as const;

export type SecurityMethod =
  (typeof SECURITY_METHODS)[keyof typeof SECURITY_METHODS];

export const UNLOCK_METHODS = {
  PIN: 'pin',
  TOTP: 'totp',
  BIOMETRIC: 'biometric',
} as const;

export type UnlockMethod =
  (typeof UNLOCK_METHODS)[keyof typeof UNLOCK_METHODS];

export const TWO_FA_ELIGIBLE_ROLES: readonly UserRole[] = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.BRANCH_STORE,
  USER_ROLES.AGENT,
] as const;

export function isTwoFaAllowedForRole(role: UserRole): boolean {
  return (TWO_FA_ELIGIBLE_ROLES as readonly string[]).includes(role);
}

export function usesTotpLogin(user: {
  role: UserRole;
  totpEnabled?: boolean;
}): boolean {
  return Boolean(user.totpEnabled) && isTwoFaAllowedForRole(user.role);
}

/** screen_lock + biometric: all roles; totp: not bidder */
export function isSecurityMethodAllowed(
  role: UserRole,
  method: SecurityMethod
): boolean {
  if (method === SECURITY_METHODS.TOTP) {
    return isTwoFaAllowedForRole(role);
  }
  if (
    method === SECURITY_METHODS.SCREEN_LOCK ||
    method === SECURITY_METHODS.BIOMETRIC
  ) {
    return true;
  }
  return false;
}

export function assertSecurityMethodAllowed(
  role: UserRole,
  method: SecurityMethod
): void {
  if (!isSecurityMethodAllowed(role, method)) {
    throw accessDenied('This security method is not available for your role');
  }
}

export function unlockMethodsForUser(user: {
  role: UserRole;
  screenLockEnabled?: boolean;
  totpEnabled?: boolean;
  biometricEnabled?: boolean;
  pinHash?: string | null;
}): UnlockMethod[] {
  const methods: UnlockMethod[] = [];
  // Demo client: lock screen unlocks with TOTP when 2FA is on (no separate screen-lock enable).
  if (isTwoFaAllowedForRole(user.role) && user.totpEnabled) {
    methods.push(UNLOCK_METHODS.TOTP);
  }
  if (user.screenLockEnabled && user.pinHash) {
    methods.push(UNLOCK_METHODS.PIN);
  }
  if (user.biometricEnabled) methods.push(UNLOCK_METHODS.BIOMETRIC);
  return methods;
}
