import { Types } from 'mongoose';
import {
  fingerprintAadhaar,
  isValidAadhaar,
  isValidIndianPhone,
  normalizePhone,
} from '../../common/crypto';
import { badRequest, conflict, notFound } from '../../common/errors';
import { env } from '../../config/env';
import {
  BIDDER_DEFAULT,
  USER_ROLES,
  USER_STATUS,
  UserRole,
} from '../../config/roles';
import { tokenService } from '../auth/token.service';
import { Chit, CHIT_STATUS } from '../chits/chit.model';
import { User } from '../users/user.model';
import {
  CreateOperatorBidderInput,
  ListOperatorBiddersQueryInput,
  OperatorBidderStatusActionInput,
} from './operator-bidder.validation';

function assertIdentity(phone: string, aadhaarNumber: string): string {
  if (!isValidIndianPhone(phone)) {
    throw badRequest('Enter a valid 10-digit Indian mobile number');
  }
  if (!isValidAadhaar(aadhaarNumber)) {
    throw badRequest('Enter a valid 12-digit Aadhaar number');
  }
  return fingerprintAadhaar(aadhaarNumber, env.JWT_SECRET);
}

function formatBidder(user: {
  _id: { toString(): string };
  name: string;
  phone: string;
  countryCode: string;
  role: UserRole;
  permissions: string[];
  status: string;
  statusReason?: string | null;
  createdBy?: { toString(): string } | null;
  createdAt: Date;
  lastLoginAt?: Date | null;
  statusChangedAt?: Date | null;
  statusChangedBy?: { toString(): string } | null;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    phone: user.phone,
    countryCode: user.countryCode,
    role: user.role,
    permissions: user.permissions,
    status: user.status,
    statusReason: user.statusReason ?? null,
    statusChangedAt: user.statusChangedAt ?? null,
    statusChangedBy: user.statusChangedBy?.toString() ?? null,
    createdBy: user.createdBy?.toString() ?? null,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

/**
 * Peer-operator bidder APIs shared by branch_store and agent.
 * List = bidders created by the operator OR members of the operator's chits.
 * Block/unblock = only bidders the operator created (createdBy).
 */
export class OperatorBidderService {
  async create(operatorId: string, input: CreateOperatorBidderInput) {
    const phone = normalizePhone(input.phone);
    const aadhaarFingerprint = assertIdentity(phone, input.aadhaarNumber);

    const existing = await User.findOne({
      $or: [
        { phone, role: USER_ROLES.BIDDER },
        { aadhaarFingerprint, role: USER_ROLES.BIDDER },
      ],
    });

    if (existing) {
      throw conflict('A bidder with this phone or Aadhaar already exists');
    }

    const user = await User.create({
      name: input.name,
      countryCode: input.countryCode,
      phone,
      aadhaarFingerprint,
      role: USER_ROLES.BIDDER,
      permissions: [...BIDDER_DEFAULT],
      status: USER_STATUS.ACTIVE,
      createdBy: new Types.ObjectId(operatorId),
      verificationMethod: 'admin_provisioned',
    });

    return formatBidder(user);
  }

  async list(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    query: ListOperatorBiddersQueryInput
  ) {
    const operatorOid = new Types.ObjectId(operatorId);

    const chitOwnerFilter =
      operatorRole === USER_ROLES.AGENT
        ? { agentId: operatorOid }
        : { branchStoreId: operatorOid };

    const ownedChits = await Chit.find({
      ...chitOwnerFilter,
      status: { $ne: CHIT_STATUS.DELETED },
    })
      .select('members.bidderId')
      .lean();

    const memberIds = new Set<string>();
    for (const chit of ownedChits) {
      for (const member of chit.members ?? []) {
        memberIds.add(member.bidderId.toString());
      }
    }

    const memberObjectIds = [...memberIds].map((id) => new Types.ObjectId(id));

    const filter: Record<string, unknown> = {
      role: USER_ROLES.BIDDER,
      $or: [
        { createdBy: operatorOid },
        ...(memberObjectIds.length > 0
          ? [{ _id: { $in: memberObjectIds } }]
          : []),
      ],
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      filter.$and = [
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { phone: { $regex: q.replace(/\D/g, ''), $options: 'i' } },
          ],
        },
      ];
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-aadhaarFingerprint -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return {
      items: users.map(formatBidder),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  private async loadOwnedBidder(operatorId: string, bidderId: string) {
    const user = await User.findById(bidderId);
    if (!user || user.role !== USER_ROLES.BIDDER) {
      throw notFound('Bidder not found');
    }
    if (!user.createdBy || user.createdBy.toString() !== operatorId) {
      throw badRequest(
        'You can only block or unblock bidders you created'
      );
    }
    return user;
  }

  async blockBidder(
    operatorId: string,
    bidderId: string,
    input: OperatorBidderStatusActionInput
  ) {
    const user = await this.loadOwnedBidder(operatorId, bidderId);

    if (user.status === USER_STATUS.BLOCKED) {
      throw conflict('Bidder is already blocked');
    }

    user.status = USER_STATUS.BLOCKED;
    user.statusReason = input.reason.trim();
    user.statusChangedAt = new Date();
    user.statusChangedBy = new Types.ObjectId(operatorId);
    await user.save();

    const revokedSessions =
      await tokenService.revokeAllSessionsForUser(bidderId);

    return {
      ...formatBidder(user),
      revokedSessions,
    };
  }

  async unblockBidder(
    operatorId: string,
    bidderId: string,
    input: OperatorBidderStatusActionInput
  ) {
    const user = await this.loadOwnedBidder(operatorId, bidderId);

    if (user.status !== USER_STATUS.BLOCKED) {
      throw conflict('Bidder is not blocked');
    }

    user.status = USER_STATUS.ACTIVE;
    user.statusReason = input.reason.trim();
    user.statusChangedAt = new Date();
    user.statusChangedBy = new Types.ObjectId(operatorId);
    await user.save();

    return formatBidder(user);
  }
}

export const operatorBidderService = new OperatorBidderService();
