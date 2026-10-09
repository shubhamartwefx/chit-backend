import { Types } from 'mongoose';
import { accessDenied, AppError, notFound } from '../../common/errors';
import { canRevealSensitiveData } from '../../config/rbac';
import { USER_ROLES, USER_STATUS } from '../../config/roles';
import { User } from '../users/user.model';
import {
  REVEAL_OUTCOMES,
  RevealOutcome,
  SensitiveDataAccessLog,
  USER_AGENT_MAX_LENGTH,
} from './access-log.model';
import { REVEALABLE_FIELDS, RevealableField } from './revealable-fields';

export interface RevealRequest {
  actorId: string;
  targetUserId: string;
  field: RevealableField;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RevealResult {
  field: RevealableField;
  value: string;
  revealedAt: string;
}

export class SensitiveDataService {
  async reveal(request: RevealRequest): Promise<RevealResult> {
    // Permissions in the JWT can be stale; re-check so revocations apply immediately.
    const actor = await User.findById(request.actorId)
      .select('role status permissions')
      .lean();
    const isActorAllowed =
      actor?.role === USER_ROLES.SUPER_ADMIN &&
      actor.status === USER_STATUS.ACTIVE &&
      canRevealSensitiveData(actor.permissions ?? []);
    if (!isActorAllowed) {
      await this.recordAccess(request, REVEAL_OUTCOMES.DENIED);
      throw accessDenied('You do not have permission to reveal this data');
    }

    const definition = REVEALABLE_FIELDS[request.field];
    const target = await User.findById(request.targetUserId).select(
      definition.select
    );
    if (!target || !definition.roles.includes(target.role)) {
      throw notFound('User not found');
    }

    const value = this.resolveValue(request, () => definition.resolve(target));
    if (!value) {
      await this.recordAccess(request, REVEAL_OUTCOMES.NOT_ON_FILE);
      throw AppError.fromStatusKey('SENSITIVE_DATA_NOT_ON_FILE');
    }

    // Audit must persist before the value leaves the server.
    await this.recordAccess(request, REVEAL_OUTCOMES.REVEALED);
    return {
      field: request.field,
      value,
      revealedAt: new Date().toISOString(),
    };
  }

  private resolveValue(
    request: RevealRequest,
    resolve: () => string | null
  ): string | null {
    try {
      return resolve();
    } catch (err) {
      console.error('Failed to decrypt sensitive field', {
        targetUserId: request.targetUserId,
        field: request.field,
        error: err instanceof Error ? err.message : String(err),
      });
      throw AppError.fromStatusKey(
        'INTERNAL_ERROR',
        'Unable to reveal this value right now'
      );
    }
  }

  private async recordAccess(
    request: RevealRequest,
    outcome: RevealOutcome
  ): Promise<void> {
    await SensitiveDataAccessLog.create({
      actorId: new Types.ObjectId(request.actorId),
      targetUserId: new Types.ObjectId(request.targetUserId),
      field: request.field,
      outcome,
      ip: request.ip ?? null,
      userAgent: request.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    });
  }
}

export const sensitiveDataService = new SensitiveDataService();
