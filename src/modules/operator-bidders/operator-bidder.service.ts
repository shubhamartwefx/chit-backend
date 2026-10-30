import { Types, type PipelineStage } from 'mongoose';
import {
  fingerprintAadhaar,
  isValidAadhaar,
  isValidIndianPhone,
  normalizePhone,
} from '../../common/crypto';
import { aadhaarRevealFields } from '../../common/sensitive-data';
import { badRequest, conflict, notFound } from '../../common/errors';
import { env } from '../../config/env';
import {
  BIDDER_DEFAULT,
  USER_ROLES,
  USER_STATUS,
  UserRole,
} from '../../config/roles';
import { Chit, CHIT_STATUS } from '../chits/chit.model';
import {
  Installment,
  INSTALLMENT_STATUS,
} from '../installments/installment.model';
import { User } from '../users/user.model';
import { assertAadhaarFingerprintAvailable } from '../users/assert-aadhaar-unique';
import { toStoredAddress } from '../../common/address';
import {
  CreateOperatorBidderInput,
  ListOperatorBiddersQueryInput,
  ListOperatorReportsQueryInput,
  UpdateOperatorBidderInput,
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
    ticketCount?: number;
    paidMonths?: number;
    totalMonths?: number;
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
    chitCount: extras?.chitCount ?? 0,
    reportCount: extras?.reportCount ?? 0,
    chitIds: extras?.chitIds ?? [],
    ticketCount: extras?.ticketCount ?? 0,
    paidMonths: extras?.paidMonths ?? 0,
    totalMonths: extras?.totalMonths ?? 0,
  };
}

type BidderStats = {
  chitCount: number;
  reportCount: number;
  chitIds: string[];
  ticketCount: number;
  paidMonths: number;
  totalMonths: number;
};

async function loadBidderStatsForOperator(
  operatorId: string,
  operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
  bidderIds: string[]
): Promise<Map<string, BidderStats>> {
  const map = new Map<string, BidderStats>();
  for (const id of bidderIds) {
    map.set(id, {
      chitCount: 0,
      reportCount: 0,
      chitIds: [],
      ticketCount: 0,
      paidMonths: 0,
      totalMonths: 0,
    });
  }
  if (bidderIds.length === 0) return map;

  const operatorOid = new Types.ObjectId(operatorId);
  const bidderOids = bidderIds.map((id) => new Types.ObjectId(id));
  const chitOwnerFilter =
    operatorRole === USER_ROLES.AGENT
      ? { agentId: operatorOid }
      : { branchStoreId: operatorOid };

  const chits = await Chit.aggregate<{
    _id: Types.ObjectId;
    totalMonths: number;
    members: Array<{
      bidderId: Types.ObjectId;
      numberOfTickets?: number;
      reports?: unknown[];
    }>;
  }>([
    {
      $match: {
        ...chitOwnerFilter,
        status: { $ne: CHIT_STATUS.DELETED },
        'members.bidderId': { $in: bidderOids },
      },
    },
    {
      $project: {
        totalMonths: 1,
        members: {
          $filter: {
            input: '$members',
            as: 'm',
            cond: { $in: ['$$m.bidderId', bidderOids] },
          },
        },
      },
    },
  ]);

  const chitIds: Types.ObjectId[] = [];
  for (const chit of chits) {
    const chitId = chit._id.toString();
    const duration = Number(chit.totalMonths) || 0;
    chitIds.push(chit._id);
    for (const member of chit.members ?? []) {
      const bidderId = member.bidderId.toString();
      const entry = map.get(bidderId);
      if (!entry) continue;
      entry.chitCount += 1;
      entry.chitIds.push(chitId);
      entry.ticketCount += member.numberOfTickets ?? 1;
      entry.totalMonths += duration;
      entry.reportCount += Array.isArray(member.reports)
        ? member.reports.length
        : 0;
    }
  }

  if (chitIds.length > 0) {
    const paidRows = await Installment.aggregate<{
      _id: Types.ObjectId;
      paidMonths: number;
    }>([
      {
        $match: {
          chitId: { $in: chitIds },
          bidderId: { $in: bidderOids },
          status: INSTALLMENT_STATUS.PAID,
          kind: 'bidder_payment',
        },
      },
      {
        $group: {
          _id: '$bidderId',
          months: {
            $addToSet: {
              chitId: '$chitId',
              month: '$monthNumber',
            },
          },
        },
      },
      {
        $project: {
          paidMonths: { $size: '$months' },
        },
      },
    ]);

    for (const row of paidRows) {
      const entry = map.get(row._id.toString());
      if (entry) entry.paidMonths = row.paidMonths ?? 0;
    }
  }

  return map;
}

async function loadBidderStatsPlatform(
  bidderIds: string[]
): Promise<Map<string, BidderStats>> {
  const map = new Map<string, BidderStats>();
  for (const id of bidderIds) {
    map.set(id, {
      chitCount: 0,
      reportCount: 0,
      chitIds: [],
      ticketCount: 0,
      paidMonths: 0,
      totalMonths: 0,
    });
  }
  if (bidderIds.length === 0) return map;

  const bidderOids = bidderIds.map((id) => new Types.ObjectId(id));

  const chits = await Chit.aggregate<{
    _id: Types.ObjectId;
    totalMonths: number;
    members: Array<{
      bidderId: Types.ObjectId;
      numberOfTickets?: number;
      reports?: unknown[];
    }>;
  }>([
    {
      $match: {
        status: { $ne: CHIT_STATUS.DELETED },
        'members.bidderId': { $in: bidderOids },
      },
    },
    {
      $project: {
        totalMonths: 1,
        members: {
          $filter: {
            input: '$members',
            as: 'm',
            cond: { $in: ['$$m.bidderId', bidderOids] },
          },
        },
      },
    },
  ]);

  const chitIds: Types.ObjectId[] = [];
  for (const chit of chits) {
    const chitId = chit._id.toString();
    const duration = Number(chit.totalMonths) || 0;
    chitIds.push(chit._id);
    for (const member of chit.members ?? []) {
      const bidderId = member.bidderId.toString();
      const entry = map.get(bidderId);
      if (!entry) continue;
      entry.chitCount += 1;
      entry.chitIds.push(chitId);
      entry.ticketCount += member.numberOfTickets ?? 1;
      entry.totalMonths += duration;
      entry.reportCount += Array.isArray(member.reports)
        ? member.reports.length
        : 0;
    }
  }

  if (chitIds.length > 0) {
    const paidRows = await Installment.aggregate<{
      _id: Types.ObjectId;
      paidMonths: number;
    }>([
      {
        $match: {
          chitId: { $in: chitIds },
          bidderId: { $in: bidderOids },
          status: INSTALLMENT_STATUS.PAID,
          kind: 'bidder_payment',
        },
      },
      {
        $group: {
          _id: '$bidderId',
          months: {
            $addToSet: {
              chitId: '$chitId',
              month: '$monthNumber',
            },
          },
        },
      },
      {
        $project: {
          paidMonths: { $size: '$months' },
        },
      },
    ]);

    for (const row of paidRows) {
      const entry = map.get(row._id.toString());
      if (entry) entry.paidMonths = row.paidMonths ?? 0;
    }
  }

  return map;
}

/**
 * Peer-operator bidder APIs shared by branch_store and agent.
 * List = bidders created by the operator OR members of the operator's chits.
 * Blocking is super-admin only (see /super-admin/users/:userId/block).
 */
export class OperatorBidderService {
  /** Platform-wide bidder chit/report stats for super-admin lists. */
  async getPlatformStatsForBidders(bidderIds: string[]) {
    return loadBidderStatsPlatform(bidderIds);
  }

  async create(operatorId: string, input: CreateOperatorBidderInput) {
    const phone = normalizePhone(input.phone);
    const aadhaarFingerprint = assertIdentity(phone, input.aadhaarNumber);

    const phoneExisting = await User.findOne({
      phone,
      role: USER_ROLES.BIDDER,
    })
      .select('_id')
      .lean();
    if (phoneExisting) {
      throw conflict('A bidder with this phone number already exists');
    }

    await assertAadhaarFingerprintAvailable(aadhaarFingerprint);

    const user = await User.create({
      name: input.name,
      countryCode: input.countryCode,
      phone,
      aadhaarFingerprint,
      ...aadhaarRevealFields(input.aadhaarNumber),
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
    // Display id shown in the UI: "BD-XXXX-XXXX" = last 8 hex chars of _id.
    const displayIdMatch = /^(?:BD-?)?([a-fA-F0-9]{4})-?([a-fA-F0-9]{4})$/i.exec(qRaw);
    const looksLikeDisplayId = /^BD|-|[a-f]/i.test(qRaw);
    const displayIdSuffix =
      displayIdMatch && looksLikeDisplayId
        ? `${displayIdMatch[1]}${displayIdMatch[2]}`.toLowerCase()
        : null;

    /**
     * Exact phone / id lookup is global so an agent can enroll an existing
     * bidder created by another operator (create still enforces uniqueness).
     */
    if (qRaw && (isExactPhone || isObjectId || displayIdSuffix)) {
      const lookupFilter: Record<string, unknown> = {
        role: USER_ROLES.BIDDER,
      };
      if (query.status) {
        lookupFilter.status = query.status;
      }
      if (isObjectId) {
        lookupFilter._id = new Types.ObjectId(qRaw);
      } else if (displayIdSuffix) {
        lookupFilter.$expr = {
          $regexMatch: {
            input: { $toString: '$_id' },
            regex: `${displayIdSuffix}$`,
          },
        };
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
            ticketCount: s?.ticketCount ?? 0,
            paidMonths: s?.paidMonths ?? 0,
            totalMonths: s?.totalMonths ?? 0,
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

    const memberIdRows = await Chit.aggregate<{ _id: Types.ObjectId }>([
      {
        $match: {
          ...chitOwnerFilter,
          status: { $ne: CHIT_STATUS.DELETED },
        },
      },
      { $unwind: '$members' },
      { $group: { _id: '$members.bidderId' } },
    ]);

    const memberObjectIds = memberIdRows
      .map((row) => row._id)
      .filter((id): id is Types.ObjectId => Boolean(id));

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
          ticketCount: s?.ticketCount ?? 0,
          paidMonths: s?.paidMonths ?? 0,
          totalMonths: s?.totalMonths ?? 0,
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

  async getById(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    bidderId: string
  ) {
    const user = await this.loadScopedBidder(operatorId, operatorRole, bidderId);
    const statsMap = await loadBidderStatsForOperator(
      operatorId,
      operatorRole,
      [bidderId]
    );
    const stats = statsMap.get(bidderId) ?? {
      chitCount: 0,
      reportCount: 0,
      chitIds: [] as string[],
      ticketCount: 0,
      paidMonths: 0,
      totalMonths: 0,
    };

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
      .select('_id chitCode amountInLakhs members.bidderId members.numberOfTickets')
      .lean();

    const amountBuckets = new Map<
      number,
      { amountInLakhs: number; chitIds: string[]; chitCodes: string[]; ticketCount: number }
    >();

    for (const chit of chits) {
      const amount = chit.amountInLakhs;
      const member = (chit.members ?? []).find(
        (m) => m.bidderId.toString() === bidderId
      );
      const tickets = member?.numberOfTickets ?? 1;
      const existing = amountBuckets.get(amount) ?? {
        amountInLakhs: amount,
        chitIds: [],
        chitCodes: [],
        ticketCount: 0,
      };
      existing.chitIds.push(chit._id.toString());
      existing.chitCodes.push(chit.chitCode);
      existing.ticketCount += tickets;
      amountBuckets.set(amount, existing);
    }

    const nomineeIds = (user.nominees ?? []).map((n) => n.userId);
    const nomineeUsers =
      nomineeIds.length > 0
        ? await User.find({ _id: { $in: nomineeIds } })
            .select('name')
            .lean()
        : [];
    const nominees = (user.nominees ?? []).map((link) => {
      const nom = nomineeUsers.find(
        (u) => u._id.toString() === link.userId.toString()
      );
      return {
        id: link.userId.toString(),
        name: nom?.name ?? null,
        linkedAt: link.linkedAt,
      };
    });

    const address = user.currentAddress ?? user.aadhaarAddress ?? null;

    return {
      ...formatBidder(user, {
        operatorId,
        chitCount: stats.chitCount,
        reportCount: stats.reportCount,
        chitIds: stats.chitIds,
        ticketCount: stats.ticketCount,
        paidMonths: stats.paidMonths,
        totalMonths: stats.totalMonths,
      }),
      phone2: user.phone2 ?? null,
      aadhaarLast4: user.aadhaarLast4 ?? null,
      address: address
        ? {
            street: address.street ?? '',
            city: address.city ?? '',
            state: address.state ?? '',
            pincode: address.pincode ?? '',
            country: address.country ?? '',
          }
        : null,
      nominees,
      chits: chits.map((c) => ({
        id: c._id.toString(),
        chitCode: c.chitCode,
        amountInLakhs: c.amountInLakhs,
        numberOfTickets:
          (c.members ?? []).find((m) => m.bidderId.toString() === bidderId)
            ?.numberOfTickets ?? 1,
      })),
      chitsByAmount: Array.from(amountBuckets.values()).sort(
        (a, b) => b.amountInLakhs - a.amountInLakhs
      ),
    };
  }

  async updateBidder(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    bidderId: string,
    input: UpdateOperatorBidderInput
  ) {
    const user = await this.loadScopedBidder(operatorId, operatorRole, bidderId);
    if (input.name !== undefined) user.name = input.name.trim();
    if (input.phone2 !== undefined) {
      const raw = input.phone2.trim();
      if (!raw) {
        user.phone2 = null;
      } else {
        const phone2 = normalizePhone(raw);
        if (!isValidIndianPhone(phone2)) {
          throw badRequest('Enter a valid 10-digit Indian mobile number for phone2');
        }
        if (phone2 === user.phone) {
          throw badRequest('Second phone number must differ from the primary number');
        }
        user.phone2 = phone2;
      }
    }
    if (input.currentAddress !== undefined) {
      user.currentAddress = toStoredAddress(input.currentAddress);
    }
    await user.save();
    return this.getById(operatorId, operatorRole, bidderId);
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

  private async listReportsWithFacet(
    chitMatch: Record<string, unknown>,
    query: ListOperatorReportsQueryInput
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const qRaw = query.q?.trim() ?? '';
    const qDigits = qRaw.replace(/\D/g, '');
    const reporterFilter = new Set(
      (query.reportedBy ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    );

    type AggRow = {
      chitId: Types.ObjectId;
      chitCode: string;
      bidderId: Types.ObjectId;
      reportId: Types.ObjectId | null;
      reason: string;
      note: string | null;
      reportedBy: Types.ObjectId | null;
      createdAt: Date;
      bidderName: string | null;
      bidderPhone: string | null;
      reportedByName: string | null;
    };

    const pipeline: PipelineStage[] = [
      { $match: chitMatch },
      { $unwind: '$members' },
      { $unwind: '$members.reports' },
      {
        $project: {
          chitId: '$_id',
          chitCode: 1,
          bidderId: '$members.bidderId',
          reportId: '$members.reports._id',
          reason: '$members.reports.reason',
          note: '$members.reports.note',
          reportedBy: '$members.reports.reportedBy',
          createdAt: '$members.reports.createdAt',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'bidderId',
          foreignField: '_id',
          as: 'bidderDoc',
          pipeline: [{ $project: { name: 1, phone: 1 } }],
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'reportedBy',
          foreignField: '_id',
          as: 'reporterDoc',
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      {
        $addFields: {
          bidderName: {
            $ifNull: [{ $arrayElemAt: ['$bidderDoc.name', 0] }, null],
          },
          bidderPhone: {
            $ifNull: [{ $arrayElemAt: ['$bidderDoc.phone', 0] }, null],
          },
          reportedByName: {
            $ifNull: [{ $arrayElemAt: ['$reporterDoc.name', 0] }, null],
          },
        },
      },
    ];

    if (reporterFilter.size > 0) {
      pipeline.push({
        $match: {
          reportedBy: {
            $in: [...reporterFilter]
              .filter((id) => Types.ObjectId.isValid(id))
              .map((id) => new Types.ObjectId(id)),
          },
        },
      });
    }

    if (qRaw) {
      const or: Record<string, unknown>[] = [
        { bidderName: { $regex: qRaw, $options: 'i' } },
        { reportedByName: { $regex: qRaw, $options: 'i' } },
        { chitCode: { $regex: qRaw, $options: 'i' } },
      ];
      if (Types.ObjectId.isValid(qRaw) && qRaw.length === 24) {
        or.push({ bidderId: new Types.ObjectId(qRaw) });
      } else {
        or.push({
          $expr: {
            $regexMatch: {
              input: { $toString: '$bidderId' },
              regex: qRaw,
              options: 'i',
            },
          },
        });
      }
      if (qDigits.length > 0) {
        or.push({ bidderPhone: { $regex: qDigits } });
      }
      pipeline.push({ $match: { $or: or } });
    }

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({
      $facet: {
        total: [{ $count: 'count' }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    });

    const [facet] = await Chit.aggregate<{
      total: Array<{ count: number }>;
      items: AggRow[];
    }>(pipeline);

    const total = facet?.total?.[0]?.count ?? 0;
    const pageRows = facet?.items ?? [];

    const pageBidderOids = [
      ...new Set(pageRows.map((row) => row.bidderId.toString())),
    ].map((id) => new Types.ObjectId(id));

    const countByBidder = new Map<string, number>();
    if (pageBidderOids.length > 0) {
      const countRows = await Chit.aggregate<{
        _id: Types.ObjectId;
        reportCountForBidder: number;
      }>([
        { $match: chitMatch },
        { $unwind: '$members' },
        { $match: { 'members.bidderId': { $in: pageBidderOids } } },
        {
          $project: {
            bidderId: '$members.bidderId',
            n: { $size: { $ifNull: ['$members.reports', []] } },
          },
        },
        {
          $group: {
            _id: '$bidderId',
            reportCountForBidder: { $sum: '$n' },
          },
        },
      ]);
      for (const row of countRows) {
        countByBidder.set(row._id.toString(), row.reportCountForBidder);
      }
    }

    const items = pageRows.map((row) => {
      const bidderId = row.bidderId.toString();
      const reportId = row.reportId
        ? row.reportId.toString()
        : String(new Date(row.createdAt).getTime());
      const chitId = row.chitId.toString();
      return {
        id: `${chitId}-${bidderId}-${reportId}`,
        reportId,
        bidderId,
        bidderName: row.bidderName ?? null,
        bidderPhone: row.bidderPhone ?? null,
        chitId,
        chitCode: row.chitCode,
        reason: row.reason,
        note: row.note ?? null,
        reportedBy: row.reportedBy ? row.reportedBy.toString() : null,
        reportedByName: row.reportedByName ?? null,
        createdAt: row.createdAt,
        reportCountForBidder: countByBidder.get(bidderId) ?? 1,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit) || 1),
      },
    };
  }

  async listOperatorReports(
    operatorId: string,
    operatorRole: typeof USER_ROLES.AGENT | typeof USER_ROLES.BRANCH_STORE,
    query: ListOperatorReportsQueryInput
  ) {
    const operatorOid = new Types.ObjectId(operatorId);
    const chitOwnerFilter =
      operatorRole === USER_ROLES.AGENT
        ? { agentId: operatorOid }
        : { branchStoreId: operatorOid };

    return this.listReportsWithFacet(
      {
        ...chitOwnerFilter,
        status: { $ne: CHIT_STATUS.DELETED },
        'members.reports.0': { $exists: true },
      },
      query
    );
  }

  /** Platform-wide bidder detail (super-admin). No operator scoping. */
  async getByIdPlatform(bidderId: string) {
    const user = await User.findById(bidderId);
    if (!user || user.role !== USER_ROLES.BIDDER) {
      throw notFound('Bidder not found');
    }

    const statsMap = await loadBidderStatsPlatform([bidderId]);
    const stats = statsMap.get(bidderId) ?? {
      chitCount: 0,
      reportCount: 0,
      chitIds: [] as string[],
      ticketCount: 0,
      paidMonths: 0,
      totalMonths: 0,
    };

    const chits = await Chit.find({
      status: { $ne: CHIT_STATUS.DELETED },
      'members.bidderId': new Types.ObjectId(bidderId),
    })
      .select('_id chitCode amountInLakhs members.bidderId members.numberOfTickets')
      .lean();

    const amountBuckets = new Map<
      number,
      { amountInLakhs: number; chitIds: string[]; chitCodes: string[]; ticketCount: number }
    >();

    for (const chit of chits) {
      const amount = chit.amountInLakhs;
      const member = (chit.members ?? []).find(
        (m) => m.bidderId.toString() === bidderId
      );
      const tickets = member?.numberOfTickets ?? 1;
      const existing = amountBuckets.get(amount) ?? {
        amountInLakhs: amount,
        chitIds: [],
        chitCodes: [],
        ticketCount: 0,
      };
      existing.chitIds.push(chit._id.toString());
      existing.chitCodes.push(chit.chitCode);
      existing.ticketCount += tickets;
      amountBuckets.set(amount, existing);
    }

    const nomineeIds = (user.nominees ?? []).map((n) => n.userId);
    const nomineeUsers =
      nomineeIds.length > 0
        ? await User.find({ _id: { $in: nomineeIds } })
            .select('name role')
            .lean()
        : [];
    const nominees = (user.nominees ?? []).map((link) => {
      const nom = nomineeUsers.find(
        (u) => u._id.toString() === link.userId.toString()
      );
      return {
        id: link.userId.toString(),
        name: nom?.name ?? null,
        role: nom?.role ?? null,
        linkedAt: link.linkedAt,
      };
    });

    const address = user.currentAddress ?? user.aadhaarAddress ?? null;

    return {
      ...formatBidder(user, {
        chitCount: stats.chitCount,
        reportCount: stats.reportCount,
        chitIds: stats.chitIds,
        ticketCount: stats.ticketCount,
        paidMonths: stats.paidMonths,
        totalMonths: stats.totalMonths,
      }),
      phone2: user.phone2 ?? null,
      aadhaarLast4: user.aadhaarLast4 ?? null,
      address: address
        ? {
            street: address.street ?? '',
            city: address.city ?? '',
            state: address.state ?? '',
            pincode: address.pincode ?? '',
            country: address.country ?? '',
          }
        : null,
      nominees,
      chits: chits.map((c) => {
        const member = (c.members ?? []).find(
          (m) => m.bidderId.toString() === bidderId
        );
        return {
          id: c._id.toString(),
          chitCode: c.chitCode,
          amountInLakhs: c.amountInLakhs,
          numberOfTickets: member?.numberOfTickets ?? 1,
          bidderCount: (c.members ?? []).length,
        };
      }),
      chitsByAmount: Array.from(amountBuckets.values()).sort(
        (a, b) => b.amountInLakhs - a.amountInLakhs
      ),
    };
  }

  async listBidderReportsPlatform(bidderId: string) {
    const user = await User.findById(bidderId);
    if (!user || user.role !== USER_ROLES.BIDDER) {
      throw notFound('Bidder not found');
    }

    const chits = await Chit.find({
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
      for (const reporter of reporters) {
        if (reporter.name) nameById.set(reporter._id.toString(), reporter.name);
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

  /** Platform-wide member reports list (super-admin). */
  async listPlatformReports(query: ListOperatorReportsQueryInput) {
    return this.listReportsWithFacet(
      {
        status: { $ne: CHIT_STATUS.DELETED },
        'members.reports.0': { $exists: true },
      },
      query
    );
  }
}

export const operatorBidderService = new OperatorBidderService();
