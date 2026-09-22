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

function formatBidder(
  user: {
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
    aadhaarVerifiedAt?: Date | null;
    verificationMethod?: string | null;
  },
  extras?: {
    operatorId?: string;
    chitCount?: number;
    reportCount?: number;
    chitIds?: string[];
  }
) {
  const createdBy = user.createdBy?.toString() ?? null;
  const aadhaarVerified = Boolean(
    user.aadhaarVerifiedAt ||
      user.verificationMethod === 'admin_provisioned' ||
      user.verificationMethod === 'digilocker'
  );

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
    createdBy,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
    aadhaarVerified,
    aadhaarStatus: aadhaarVerified ? ('verified' as const) : ('pending' as const),
    canBlock: Boolean(
      (extras?.operatorId && createdBy === extras.operatorId) ||
        (extras?.chitCount != null && extras.chitCount > 0)
    ),
    chitCount: extras?.chitCount ?? 0,
    reportCount: extras?.reportCount ?? 0,
    chitIds: extras?.chitIds ?? [],
  };
}

async function loadBidderStatsForOperator(
  operatorId: string,
  operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
  bidderIds: string[]
): Promise<Map<string, { chitCount: number; reportCount: number; chitIds: string[] }>> {
  const map = new Map<
    string,
    { chitCount: number; reportCount: number; chitIds: string[] }
  >();
  for (const id of bidderIds) {
    map.set(id, { chitCount: 0, reportCount: 0, chitIds: [] });
  }
  if (bidderIds.length === 0) return map;

  const operatorOid = new Types.ObjectId(operatorId);
  const chitOwnerFilter =
    operatorRole === USER_ROLES.AGENT
      ? { agentId: operatorOid }
      : { branchStoreId: operatorOid };

  const chits = await Chit.find({
    ...chitOwnerFilter,
    status: { $ne: CHIT_STATUS.DELETED },
    'members.bidderId': {
      $in: bidderIds.map((id) => new Types.ObjectId(id)),
    },
  })
    .select('_id members.bidderId members.reports')
    .lean();

  for (const chit of chits) {
    const chitId = chit._id.toString();
    for (const member of chit.members ?? []) {
      const bidderId = member.bidderId.toString();
      const entry = map.get(bidderId);
      if (!entry) continue;
      entry.chitCount += 1;
      entry.chitIds.push(chitId);
      entry.reportCount += Array.isArray(member.reports)
        ? member.reports.length
        : 0;
    }
  }

  return map;
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

    return formatBidder(user, { operatorId });
  }

  async list(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    query: ListOperatorBiddersQueryInput
  ) {
    const operatorOid = new Types.ObjectId(operatorId);
    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const qRaw = query.q?.trim() ?? '';
    const qDigits = qRaw.replace(/\D/g, '');
    const isObjectId = /^[a-fA-F0-9]{24}$/.test(qRaw);
    const isExactPhone = qDigits.length === 10 && isValidIndianPhone(qDigits);

    /**
     * Exact phone / id lookup is global so an agent can enroll an existing
     * bidder created by another operator (create still enforces uniqueness).
     */
    if (qRaw && (isExactPhone || isObjectId)) {
      const lookupFilter: Record<string, unknown> = {
        role: USER_ROLES.BIDDER,
      };
      if (query.status) {
        lookupFilter.status = query.status;
      }
      if (isObjectId) {
        lookupFilter._id = new Types.ObjectId(qRaw);
      } else {
        lookupFilter.phone = normalizePhone(qDigits);
      }

      const [users, total] = await Promise.all([
        User.find(lookupFilter)
          .select('-aadhaarFingerprint -__v')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        User.countDocuments(lookupFilter),
      ]);

      const bidderIds = users.map((u) => u._id.toString());
      const stats = await loadBidderStatsForOperator(
        operatorId,
        operatorRole,
        bidderIds
      );

      return {
        items: users.map((user) => {
          const id = user._id.toString();
          const s = stats.get(id);
          return formatBidder(user, {
            operatorId,
            chitCount: s?.chitCount ?? 0,
            reportCount: s?.reportCount ?? 0,
            chitIds: s?.chitIds ?? [],
          });
        }),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
      };
    }

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

    if (qRaw) {
      filter.$and = [
        {
          $or: [
            { name: { $regex: qRaw, $options: 'i' } },
            ...(qDigits
              ? [{ phone: { $regex: qDigits, $options: 'i' } }]
              : []),
          ],
        },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-aadhaarFingerprint -__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    const bidderIds = users.map((u) => u._id.toString());
    const stats = await loadBidderStatsForOperator(
      operatorId,
      operatorRole,
      bidderIds
    );

    return {
      items: users.map((user) => {
        const id = user._id.toString();
        const s = stats.get(id);
        return formatBidder(user, {
          operatorId,
          chitCount: s?.chitCount ?? 0,
          reportCount: s?.reportCount ?? 0,
          chitIds: s?.chitIds ?? [],
        });
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /**
   * Bidder must be created by this operator OR enrolled in one of their chits.
   */
  private async loadScopedBidder(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    bidderId: string
  ) {
    const user = await User.findById(bidderId);
    if (!user || user.role !== USER_ROLES.BIDDER) {
      throw notFound('Bidder not found');
    }

    const createdByOperator =
      !!user.createdBy && user.createdBy.toString() === operatorId;
    if (createdByOperator) {
      return user;
    }

    const operatorOid = new Types.ObjectId(operatorId);
    const chitOwnerFilter =
      operatorRole === USER_ROLES.AGENT
        ? { agentId: operatorOid }
        : { branchStoreId: operatorOid };

    const enrolled = await Chit.exists({
      ...chitOwnerFilter,
      status: { $ne: CHIT_STATUS.DELETED },
      'members.bidderId': new Types.ObjectId(bidderId),
    });

    if (!enrolled) {
      throw badRequest(
        'You can only manage bidders you created or who are enrolled in your chits'
      );
    }

    return user;
  }

  async blockBidder(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    bidderId: string,
    input: OperatorBidderStatusActionInput
  ) {
    const user = await this.loadScopedBidder(operatorId, operatorRole, bidderId);

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
      ...formatBidder(user, { operatorId, chitCount: 1 }),
      revokedSessions,
    };
  }

  async unblockBidder(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    bidderId: string,
    input: OperatorBidderStatusActionInput
  ) {
    const user = await this.loadScopedBidder(operatorId, operatorRole, bidderId);

    if (user.status !== USER_STATUS.BLOCKED) {
      throw conflict('Bidder is not blocked');
    }

    user.status = USER_STATUS.ACTIVE;
    user.statusReason = input.reason.trim();
    user.statusChangedAt = new Date();
    user.statusChangedBy = new Types.ObjectId(operatorId);
    await user.save();

    return formatBidder(user, { operatorId, chitCount: 1 });
  }

  async updateBidder(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    bidderId: string,
    input: { name: string }
  ) {
    const user = await this.loadScopedBidder(operatorId, operatorRole, bidderId);
    user.name = input.name.trim();
    await user.save();
    return formatBidder(user, { operatorId, chitCount: 1 });
  }

  async listBidderReports(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    bidderId: string
  ) {
    await this.loadScopedBidder(operatorId, operatorRole, bidderId);

    const operatorOid = new Types.ObjectId(operatorId);
    const chitOwnerFilter =
      operatorRole === USER_ROLES.AGENT
        ? { agentId: operatorOid }
        : { branchStoreId: operatorOid };

    const chits = await Chit.find({
      ...chitOwnerFilter,
      status: { $ne: CHIT_STATUS.DELETED },
      'members.bidderId': new Types.ObjectId(bidderId),
    })
      .select('_id chitCode members')
      .lean();

    const items: Array<{
      chitId: string;
      chitCode: string;
      reason: string;
      note: string | null;
      reportedBy: string | null;
      reportedByName: string | null;
      createdAt: Date;
    }> = [];

    for (const chit of chits) {
      const member = (chit.members ?? []).find(
        (m) => m.bidderId.toString() === bidderId
      );
      if (!member || !Array.isArray(member.reports)) continue;
      for (const report of member.reports) {
        items.push({
          chitId: chit._id.toString(),
          chitCode: chit.chitCode,
          reason: report.reason,
          note: report.note ?? null,
          reportedBy: report.reportedBy
            ? report.reportedBy.toString()
            : null,
          reportedByName: null,
          createdAt: report.createdAt,
        });
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const reporterIds = items
      .map((item) => item.reportedBy)
      .filter((id): id is string => typeof id === 'string' && !!id);
    const uniqueReporterIds = [...new Set(reporterIds)];
    if (uniqueReporterIds.length > 0) {
      const reporters = await User.find({
        _id: { $in: uniqueReporterIds.map((id) => new Types.ObjectId(id)) },
      })
        .select('name')
        .lean();
      const nameById = new Map<string, string>();
      for (const user of reporters) {
        if (user.name) nameById.set(user._id.toString(), user.name);
      }
      for (const item of items) {
        if (item.reportedBy) {
          item.reportedByName = nameById.get(item.reportedBy) ?? null;
        }
      }
    }

    return {
      bidderId,
      total: items.length,
      items,
    };
  }
}

export const operatorBidderService = new OperatorBidderService();
