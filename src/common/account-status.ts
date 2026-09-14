import { USER_STATUS, UserStatus } from '../config/constants';
import { accessDenied, accountBlocked } from './errors';

const FALLBACK_BLOCK_REASON = 'Account blocked by administrator.';

export interface AccountStatusCheck {
  status: UserStatus;
  statusReason?: string | null;
}

/** Reject blocked/inactive accounts at login, refresh, and authenticated API access. */
export function assertAccountCanAuthenticate(
  account: AccountStatusCheck
): void {
  if (account.status === USER_STATUS.BLOCKED) {
    throw accountBlocked(
      account.statusReason?.trim() || FALLBACK_BLOCK_REASON
    );
  }
  if (account.status !== USER_STATUS.ACTIVE) {
    throw accessDenied('Your account is inactive. Contact support.');
  }
}
