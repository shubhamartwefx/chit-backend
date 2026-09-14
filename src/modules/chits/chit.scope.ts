import { FilterQuery, Types } from 'mongoose';
import { USER_ROLES, UserRole } from '../../config/constants';
import { CHIT_STATUS, IChitDocument } from './chit.model';

export interface ChitActor {
  sub: string;
  role: UserRole;
}

/**
 * Build a Mongo filter that enforces tenant isolation for chit queries.
 * Soft-deleted chits are excluded unless includeDeleted is true (super_admin only).
 */
export function buildChitScopeFilter(
  actor: ChitActor,
  options?: { includeDeleted?: boolean }
): FilterQuery<IChitDocument> {
  const filter: FilterQuery<IChitDocument> = {};

  const includeDeleted =
    options?.includeDeleted === true && actor.role === USER_ROLES.SUPER_ADMIN;

  if (!includeDeleted) {
    filter.status = { $ne: CHIT_STATUS.DELETED };
  }

  switch (actor.role) {
    case USER_ROLES.AGENT:
      filter.agentId = new Types.ObjectId(actor.sub);
      break;
    case USER_ROLES.BRANCH_STORE:
      filter.branchStoreId = new Types.ObjectId(actor.sub);
      break;
    case USER_ROLES.SUPER_ADMIN:
      break;
    case USER_ROLES.BIDDER:
      filter['members.bidderId'] = new Types.ObjectId(actor.sub);
      break;
    default:
      filter._id = new Types.ObjectId('000000000000000000000000');
      break;
  }

  return filter;
}

/** Combine a document id lookup with the actor's scope filter. */
export function buildScopedChitByIdFilter(
  actor: ChitActor,
  chitId: string,
  options?: { includeDeleted?: boolean }
): FilterQuery<IChitDocument> {
  return {
    ...buildChitScopeFilter(actor, options),
    _id: new Types.ObjectId(chitId),
  };
}
