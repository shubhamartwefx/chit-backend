import { USER_ROLES, UserRole } from '../../config/roles';

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
