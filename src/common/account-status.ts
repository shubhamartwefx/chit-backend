import { USER_ROLES, USER_STATUS, UserRole, UserStatus } from '../config/constants';
import { accessDenied, accountBlocked } from './errors';

const FALLBACK_BLOCK_REASON = 'Account blocked by administrator.';

export interface AccountStatusCheck {
  status: UserStatus;
  statusReason?: string | null;
  /** When present, blocked bidders may still obtain a session (locked dashboard). */
  role?: UserRole | string;
}

/**
 * Reject inactive accounts at login/refresh.
 * Blocked bidders may sign in so the FE can show a locked home with support details.
 * Other roles stay locked out at login when blocked.
 */
export function assertAccountCanAuthenticate(
  account: AccountStatusCheck
): void {
  if (account.status === USER_STATUS.BLOCKED) {
    if (account.role === USER_ROLES.BIDDER) {
      return;
    }
    throw accountBlocked(
      account.statusReason?.trim() || FALLBACK_BLOCK_REASON
    );
  }
  if (account.status !== USER_STATUS.ACTIVE) {
    throw accessDenied('Your account is inactive. Contact support.');
  }
}

/**
 * Reject inactive accounts; allow blocked through bearer auth so /me can
 * return status. Use assertNotBlocked on mutating routes.
 */
export function assertAccountActiveOrBlocked(
  account: AccountStatusCheck
): void {
  if (account.status === USER_STATUS.BLOCKED) {
    return;
  }
  if (account.status !== USER_STATUS.ACTIVE) {
    throw accessDenied('Your account is inactive. Contact support.');
  }
}

/** Reject blocked accounts on write operations. */
export function assertNotBlocked(account: AccountStatusCheck): void {
  if (account.status === USER_STATUS.BLOCKED) {
    throw accountBlocked(
      account.statusReason?.trim() || FALLBACK_BLOCK_REASON
    );
  }
}
