import { Types } from 'mongoose';
import { conflict, notFound } from '../../common/errors';
import { USER_STATUS } from '../../config/roles';
import { tokenService } from '../auth/token.service';
import { invalidateAccountStatus } from './account-status-cache';
import { User } from './user.model';

export const RUNAWAY_BLOCK_REASON =
  'Account blocked due to report: Amount take and Runaway. Contact support or your agent to unblock.';

export type BlockUserAccountResult = {
  blocked: boolean;
  alreadyBlocked: boolean;
  revokedSessions: number;
};

/**
 * Set a user to blocked and revoke all refresh sessions.
 * Idempotent when already blocked (no second revoke storm required).
 */
export async function blockUserAccount(input: {
  userId: string;
  actorId: string;
  reason: string;
}): Promise<BlockUserAccountResult> {
  const user = await User.findById(input.userId);
  if (!user) {
    throw notFound('User not found');
  }

  if (user.status === USER_STATUS.BLOCKED) {
    return { blocked: true, alreadyBlocked: true, revokedSessions: 0 };
  }

  user.status = USER_STATUS.BLOCKED;
  user.statusReason = input.reason.trim();
  user.statusChangedAt = new Date();
  user.statusChangedBy = new Types.ObjectId(input.actorId);
  await user.save();
  invalidateAccountStatus(input.userId);

  const revokedSessions = await tokenService.revokeAllSessionsForUser(
    input.userId
  );

  return { blocked: true, alreadyBlocked: false, revokedSessions };
}

/** Used by Super Admin explicit block — throws if already blocked. */
export async function blockUserAccountOrConflict(input: {
  userId: string;
  actorId: string;
  reason: string;
}): Promise<BlockUserAccountResult> {
  const user = await User.findById(input.userId);
  if (!user) {
    throw notFound('User not found');
  }
  if (user.status === USER_STATUS.BLOCKED) {
    throw conflict('User is already blocked');
  }
  return blockUserAccount(input);
}
