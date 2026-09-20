import { FilterQuery, Types } from 'mongoose';
import {
  accessDenied,
  badRequest,
  conflict,
  notFound,
} from '../../common/errors';
import { USER_ROLES, USER_STATUS } from '../../config/constants';
import { JwtPayload } from '../../types/express';
import { User } from '../users/user.model';
import {
  CHIT_STATUS,
  Chit,
  ChitStatus,
  IChitDocument,
  IChitMember,
  IMemberReport,
  BidderReportReason,
} from './chit.model';
import {
  buildChitScopeFilter,
  buildScopedChitByIdFilter,
  ChitActor,
} from './chit.scope';
import {
  CreateChitInput,
  ListChitsQueryInput,
  MAX_TICKETS_PER_BIDDER,
  SummaryQueryInput,
  UpdateChitInput,
} from './chit.validation';
import {
  Installment,
  INSTALLMENT_KIND,
  INSTALLMENT_STATUS,
} from '../installments/installment.model';

type MemberInput = { bidderId: string; numberOfTickets: number };

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function generateChitCode(): string {
  const timePart = Date.now().toString().slice(-8);
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  return `${timePart}${randomPart}`;
}

async function createUniqueChitCode(maxAttempts = 8): Promise<string> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = generateChitCode();
    const exists = await Chit.exists({ chitCode: code });
    if (!exists) {
      return code;
    }
  }
  throw badRequest('Unable to generate a unique chit code. Please retry.');
}

async function resolveOwnership(
  actor: JwtPayload,
  input: { agentId?: string; branchStoreId?: string }
): Promise<{
  agentId: Types.ObjectId | null;
  branchStoreId: Types.ObjectId | null;
}> {
  // Peer operator: agent owns chits as self; no branch linkage required.
  if (actor.role === USER_ROLES.AGENT) {
    return {
      agentId: new Types.ObjectId(actor.sub),
      branchStoreId: null,
    };
  }

  // Peer operator: branch owns chits as self; no subordinate agent required.
  if (actor.role === USER_ROLES.BRANCH_STORE) {
    return {
      agentId: null,
      branchStoreId: new Types.ObjectId(actor.sub),
    };
  }

  // Super admin must target exactly one operator.
  if (input.agentId && input.branchStoreId) {
    throw badRequest('Provide either agentId or branchStoreId, not both');
  }

  if (input.agentId) {
    const agentId = new Types.ObjectId(input.agentId);
    const agent = await User.findById(agentId)
      .select('role status')
      .lean();
    if (!agent || agent.role !== USER_ROLES.AGENT) {
      throw badRequest('agentId must reference an agent user');
    }
    if (agent.status !== USER_STATUS.ACTIVE) {
      throw badRequest('Agent must be active');
    }
    return { agentId, branchStoreId: null };
  }

  if (input.branchStoreId) {
    const branchStoreId = new Types.ObjectId(input.branchStoreId);
    const branch = await User.findById(branchStoreId)
      .select('role status')
      .lean();
    if (!branch || branch.role !== USER_ROLES.BRANCH_STORE) {
      throw badRequest('branchStoreId must reference a branch store user');
    }
    if (branch.status !== USER_STATUS.ACTIVE) {
      throw badRequest('Branch store must be active');
    }
    return { agentId: null, branchStoreId };
  }

  throw badRequest(
    'Super admin must provide agentId or branchStoreId as the chit owner'
  );
}

async function validateAndBuildMembers(
  members: MemberInput[] | undefined,
  maxBidders: number
): Promise<IChitMember[]> {
  if (!members || members.length === 0) {
    return [];
  }

  const bidderIds = members.map((m) => m.bidderId);
  const uniqueIds = new Set(bidderIds);
  if (uniqueIds.size !== bidderIds.length) {
    throw badRequest('Duplicate bidder IDs are not allowed in members');
  }

  if (members.length > maxBidders) {
    throw badRequest(
      `members length (${members.length}) exceeds maxBidders (${maxBidders})`
    );
  }

  for (const m of members) {
    if (m.numberOfTickets > MAX_TICKETS_PER_BIDDER) {
      throw badRequest(
        `numberOfTickets cannot exceed ${MAX_TICKETS_PER_BIDDER} per bidder`
      );
    }
  }

  const ticketSum = members.reduce((s, m) => s + m.numberOfTickets, 0);
  if (ticketSum > maxBidders) {
    throw badRequest(
      `Total tickets (${ticketSum}) exceed chit capacity (${maxBidders})`
    );
  }

  const objectIds = bidderIds.map((id) => new Types.ObjectId(id));
  const bidders = await User.find({
    _id: { $in: objectIds },
    role: USER_ROLES.BIDDER,
    status: USER_STATUS.ACTIVE,
  })
    .select('_id')
    .lean();

  if (bidders.length !== objectIds.length) {
    throw badRequest(
      'Every members.bidderId must reference an active bidder user'
    );
  }

  const now = new Date();
  return members.map((m) => ({
    bidderId: new Types.ObjectId(m.bidderId),
    numberOfTickets: m.numberOfTickets,
    joinedAt: now,
  }));
}

function sumTickets(
  members: Array<{ numberOfTickets?: number }> | undefined
): number {
  if (!members?.length) return 0;
  return members.reduce((s, m) => s + (m.numberOfTickets ?? 1), 0);
}

function assertTicketCapacity(
  currentTickets: number,
  addingTickets: number,
  maxBidders: number
) {
  if (addingTickets > MAX_TICKETS_PER_BIDDER) {
    throw badRequest(
      `numberOfTickets cannot exceed ${MAX_TICKETS_PER_BIDDER} per bidder`
    );
  }
  if (currentTickets + addingTickets > maxBidders) {
    const remaining = Math.max(0, maxBidders - currentTickets);
    throw badRequest(
      remaining === 0
        ? `Chit ticket occupancy is full (${maxBidders}/${maxBidders}). No more enrollments can happen.`
        : `Not enough free tickets: ${remaining} remaining, requested ${addingTickets}`
    );
  }
}

interface PopulatedBidder {
  _id: Types.ObjectId;
  name?: string;
  phone?: string;
}

function toMemberDto(
  member: {
    bidderId: Types.ObjectId | PopulatedBidder;
    numberOfTickets: number;
    joinedAt: Date;
    reports?: IMemberReport[];
  },
  extras?: { paidMonths?: number }
) {
  const reports = Array.isArray(member.reports) ? member.reports : [];
  const latest = reports.length > 0 ? reports[reports.length - 1] : null;
  const latestReport = latest
    ? {
        reason: latest.reason,
        note: latest.note ?? null,
        createdAt: latest.createdAt,
      }
    : null;

  const bidder = member.bidderId;
  if (bidder && typeof bidder === 'object' && '_id' in bidder) {
    const populated = bidder as PopulatedBidder;
    return {
      bidderId: populated._id.toString(),
      name: populated.name ?? null,
      phone: populated.phone ?? null,
      numberOfTickets: member.numberOfTickets,
      joinedAt: member.joinedAt,
      paidMonths: extras?.paidMonths ?? 0,
      latestReport,
    };
  }
  return {
    bidderId: (bidder as Types.ObjectId).toString(),
    name: null,
    phone: null,
    numberOfTickets: member.numberOfTickets,
    joinedAt: member.joinedAt,
    paidMonths: extras?.paidMonths ?? 0,
    latestReport,
  };
}

function memberBidderIdString(
  bidderId: Types.ObjectId | PopulatedBidder
): string {
  if (bidderId && typeof bidderId === 'object' && '_id' in bidderId) {
    return (bidderId as PopulatedBidder)._id.toString();
  }
  return (bidderId as Types.ObjectId).toString();
}

function filterMembersForActor(
  members: IChitMember[],
  actor?: ChitActor
): IChitMember[] {
  if (actor?.role !== USER_ROLES.BIDDER) {
    return members;
  }
  return members.filter(
    (m) => memberBidderIdString(m.bidderId) === actor.sub
  );
}

async function resolveAgentNamesById(
  agentIds: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = [
    ...new Set(
      agentIds.filter((id): id is string => typeof id === 'string' && !!id)
    ),
  ];
  if (unique.length === 0) return new Map();

  const users = await User.find({
    _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
  })
    .select('name')
    .lean();

  const map = new Map<string, string>();
  for (const u of users) {
    if (u.name) map.set(u._id.toString(), u.name);
  }
  return map;
}

async function loadPaidMonthsByBidder(
  chitId: Types.ObjectId
): Promise<Map<string, number>> {
  const rows = await Installment.aggregate<{
    _id: Types.ObjectId;
    paidMonths: number;
  }>([
    {
      $match: {
        chitId,
        status: INSTALLMENT_STATUS.PAID,
        kind: INSTALLMENT_KIND.BIDDER_PAYMENT,
        bidderId: { $ne: null },
      },
    },
    {
      $group: {
        _id: '$bidderId',
        months: { $addToSet: '$monthNumber' },
      },
    },
    {
      $project: {
        paidMonths: { $size: '$months' },
      },
    },
  ]);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row._id) {
      map.set(row._id.toString(), row.paidMonths);
    }
  }
  return map;
}

function toChitDto(
  chit: IChitDocument | (IChitDocument & { members?: unknown }),
  options?: {
    includeMembers?: boolean;
    actor?: ChitActor;
    agentName?: string | null;
    paidMonthsByBidder?: Map<string, number>;
  }
) {
  const completedMonths = chit.completedMonths ?? 0;
  const pendingMonths = Math.max(0, chit.totalMonths - completedMonths);
  const allMembers = Array.isArray(chit.members) ? chit.members : [];
  const visibleMembers = filterMembersForActor(allMembers, options?.actor);
  const agentId = chit.agentId ? chit.agentId.toString() : null;
  const ticketCount = sumTickets(allMembers);
  const ticketsRemaining = Math.max(0, chit.maxBidders - ticketCount);

  const base = {
    id: chit._id.toString(),
    chitCode: chit.chitCode,
    type: chit.type,
    amountInLakhs: chit.amountInLakhs,
    govtBettingAmount: chit.govtBettingAmount,
    monthlyInstallment: chit.monthlyInstallment,
    maxBidders: chit.maxBidders,
    totalMonths: chit.totalMonths,
    govtBettingUnits: chit.govtBettingUnits,
    startDate: chit.startDate,
    endDate: chit.endDate,
    completedMonths,
    pendingMonths,
    bidderCount:
      options?.actor?.role === USER_ROLES.BIDDER
        ? visibleMembers.length
        : allMembers.length,
    ticketCount,
    ticketsRemaining,
    isTicketFull: ticketCount >= chit.maxBidders,
    status: chit.status,
    agentId,
    agentName: options?.agentName ?? null,
    branchStoreId: chit.branchStoreId
      ? chit.branchStoreId.toString()
      : null,
    createdBy: chit.createdBy?.toString?.() ?? String(chit.createdBy),
    createdAt: (chit as IChitDocument).createdAt,
    updatedAt: (chit as IChitDocument).updatedAt,
  };

  if (options?.includeMembers) {
    return {
      ...base,
      members: visibleMembers.map((m) => {
        const typed = m as {
          bidderId: Types.ObjectId | PopulatedBidder;
          numberOfTickets: number;
          joinedAt: Date;
          reports?: IMemberReport[];
        };
        const bidderKey = memberBidderIdString(typed.bidderId);
        return toMemberDto(typed, {
          paidMonths: options.paidMonthsByBidder?.get(bidderKey) ?? 0,
        });
      }),
    };
  }

  return base;
}

async function toEnrichedChitDto(
  chit: IChitDocument | (IChitDocument & { members?: unknown }),
  options?: { includeMembers?: boolean; actor?: ChitActor }
) {
  const agentId = chit.agentId ? chit.agentId.toString() : null;
  const agentNames = await resolveAgentNamesById([agentId]);
  let paidMonthsByBidder: Map<string, number> | undefined;
  if (options?.includeMembers) {
    const rawId = chit._id;
    const chitObjectId =
      rawId instanceof Types.ObjectId
        ? rawId
        : new Types.ObjectId(String(rawId));
    paidMonthsByBidder = await loadPaidMonthsByBidder(chitObjectId);
  }
  return toChitDto(chit, {
    ...options,
    agentName: agentId ? agentNames.get(agentId) ?? null : null,
    paidMonthsByBidder,
  });
}

function assertOperatorFilterAllowed(
  actor: ChitActor,
  filters: { agentId?: string; branchStoreId?: string }
): void {
  if (!filters.agentId && !filters.branchStoreId) {
    return;
  }
  if (actor.role !== USER_ROLES.SUPER_ADMIN) {
    throw accessDenied(
      'Only super admin can filter by agentId or branchStoreId'
    );
  }
}

export class ChitService {
  async list(actor: JwtPayload, query: ListChitsQueryInput) {
    assertOperatorFilterAllowed(actor, {
      agentId: query.agentId,
      branchStoreId: query.branchStoreId,
    });

    const includeDeleted =
      query.includeDeleted === true && actor.role === USER_ROLES.SUPER_ADMIN;

    const filter: FilterQuery<IChitDocument> = {
      ...buildChitScopeFilter(actor, { includeDeleted }),
    };

    if (query.amountInLakhs !== undefined) {
      filter.amountInLakhs = query.amountInLakhs;
    }

    if (query.status) {
      if (
        query.status === CHIT_STATUS.DELETED &&
        actor.role !== USER_ROLES.SUPER_ADMIN
      ) {
        throw accessDenied('Only super admin can list deleted chits');
      }
      filter.status = query.status;
    }

    if (query.agentId) {
      filter.agentId = new Types.ObjectId(query.agentId);
    }

    if (query.branchStoreId) {
      filter.branchStoreId = new Types.ObjectId(query.branchStoreId);
    }

    if (query.q) {
      filter.chitCode = { $regex: query.q.trim(), $options: 'i' };
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Chit.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Chit.countDocuments(filter),
    ]);

    const agentNames = await resolveAgentNamesById(
      items.map((doc) => (doc.agentId ? doc.agentId.toString() : null))
    );

    return {
      items: items.map((doc) => {
        const agentId = doc.agentId ? doc.agentId.toString() : null;
        return toChitDto(doc as unknown as IChitDocument, {
          includeMembers: false,
          actor,
          agentName: agentId ? agentNames.get(agentId) ?? null : null,
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

  async summary(actor: JwtPayload, query: SummaryQueryInput) {
    assertOperatorFilterAllowed(actor, {
      agentId: query.agentId,
      branchStoreId: query.branchStoreId,
    });

    const includeDeleted =
      query.includeDeleted === true && actor.role === USER_ROLES.SUPER_ADMIN;

    const match: FilterQuery<IChitDocument> = {
      ...buildChitScopeFilter(actor, { includeDeleted }),
    };

    if (query.agentId) {
      match.agentId = new Types.ObjectId(query.agentId);
    }

    if (query.branchStoreId) {
      match.branchStoreId = new Types.ObjectId(query.branchStoreId);
    }

    const rows = await Chit.aggregate<{
      _id: number;
      chitCount: number;
      bidderCount: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: '$amountInLakhs',
          chitCount: { $sum: 1 },
          bidderCount: { $sum: { $size: '$members' } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      tiers: rows.map((row) => ({
        amountInLakhs: row._id,
        chitCount: row.chitCount,
        bidderCount: row.bidderCount,
      })),
    };
  }

  async getById(actor: JwtPayload, id: string) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, id))
      .populate('members.bidderId', 'name phone')
      .lean();

    if (!chit) {
      throw notFound('Chit not found');
    }

    return toEnrichedChitDto(chit as unknown as IChitDocument, {
      includeMembers: true,
      actor,
    });
  }

  async create(actor: JwtPayload, input: CreateChitInput) {
    const { agentId, branchStoreId } = await resolveOwnership(actor, {
      agentId: input.agentId,
      branchStoreId: input.branchStoreId,
    });

    const maxBidders = input.maxBidders;
    const members = await validateAndBuildMembers(input.members, maxBidders);

    const completedMonths = input.completedMonths ?? 0;
    if (completedMonths > input.totalMonths) {
      throw badRequest('completedMonths cannot exceed totalMonths');
    }

    const startDate = input.startDate;
    const endDate = addMonths(startDate, input.totalMonths);
    const chitCode = await createUniqueChitCode();

    const status: ChitStatus = input.status ?? CHIT_STATUS.ACTIVE;

    const created = await Chit.create({
      chitCode,
      type: input.type,
      amountInLakhs: input.amountInLakhs,
      govtBettingAmount: input.govtBettingAmount,
      monthlyInstallment: input.monthlyInstallment,
      maxBidders,
      totalMonths: input.totalMonths,
      govtBettingUnits: input.govtBettingUnits,
      startDate,
      endDate,
      completedMonths,
      status,
      agentId,
      branchStoreId,
      members,
      createdBy: new Types.ObjectId(actor.sub),
    });

    const populated = await Chit.findById(created._id)
      .populate('members.bidderId', 'name phone')
      .lean();

    return toEnrichedChitDto(
      (populated ?? created) as unknown as IChitDocument,
      { includeMembers: true, actor }
    );
  }

  async update(actor: JwtPayload, id: string, input: UpdateChitInput) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, id));
    if (!chit) {
      throw notFound('Chit not found');
    }

    if (input.type !== undefined) chit.type = input.type;
    if (input.amountInLakhs !== undefined) {
      chit.amountInLakhs = input.amountInLakhs;
    }
    if (input.govtBettingAmount !== undefined) {
      chit.govtBettingAmount = input.govtBettingAmount;
    }
    if (input.monthlyInstallment !== undefined) {
      chit.monthlyInstallment = input.monthlyInstallment;
    }
    if (input.govtBettingUnits !== undefined) {
      chit.govtBettingUnits = input.govtBettingUnits;
    }
    if (input.status !== undefined) chit.status = input.status;

    if (input.maxBidders !== undefined) {
      chit.maxBidders = input.maxBidders;
    }

    if (input.totalMonths !== undefined) {
      chit.totalMonths = input.totalMonths;
    }

    if (input.startDate !== undefined) {
      chit.startDate = input.startDate;
    }

    if (input.completedMonths !== undefined) {
      chit.completedMonths = input.completedMonths;
    }

    if (chit.completedMonths > chit.totalMonths) {
      throw badRequest('completedMonths cannot exceed totalMonths');
    }

    if (
      input.startDate !== undefined ||
      input.totalMonths !== undefined
    ) {
      chit.endDate = addMonths(chit.startDate, chit.totalMonths);
    }

    if (input.members !== undefined) {
      chit.members = await validateAndBuildMembers(
        input.members,
        chit.maxBidders
      );
    } else if (chit.members.length > chit.maxBidders) {
      throw badRequest(
        `Current members (${chit.members.length}) exceed maxBidders (${chit.maxBidders}). Reduce members or raise maxBidders.`
      );
    }

    await chit.save();

    const populated = await Chit.findById(chit._id)
      .populate('members.bidderId', 'name phone')
      .lean();

    return toEnrichedChitDto(
      (populated ?? chit) as unknown as IChitDocument,
      { includeMembers: true, actor }
    );
  }

  async softDelete(actor: JwtPayload, id: string) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, id));
    if (!chit) {
      throw notFound('Chit not found');
    }

    chit.status = CHIT_STATUS.DELETED;
    await chit.save();

    return {
      id: chit._id.toString(),
      chitCode: chit.chitCode,
      status: chit.status,
    };
  }

  async addMember(
    actor: JwtPayload,
    chitId: string,
    input: { bidderId: string; numberOfTickets: number }
  ) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit) {
      throw notFound('Chit not found');
    }

    const exists = chit.members.some(
      (m) => m.bidderId.toString() === input.bidderId
    );
    if (exists) {
      throw badRequest('Bidder is already a member of this chit');
    }

    if (chit.members.length >= chit.maxBidders) {
      throw badRequest(
        `Cannot add member: chit already has maxBidders (${chit.maxBidders})`
      );
    }

    assertTicketCapacity(
      sumTickets(chit.members),
      input.numberOfTickets,
      chit.maxBidders
    );

    const built = await validateAndBuildMembers([input], chit.maxBidders);
    chit.members.push(built[0]);
    await chit.save();

    const populated = await Chit.findById(chit._id)
      .populate('members.bidderId', 'name phone')
      .lean();

    return toEnrichedChitDto(
      (populated ?? chit) as unknown as IChitDocument,
      { includeMembers: true, actor }
    );
  }

  async updateMember(
    actor: JwtPayload,
    chitId: string,
    bidderId: string,
    input: { numberOfTickets: number }
  ) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit) {
      throw notFound('Chit not found');
    }

    const member = chit.members.find((m) => m.bidderId.toString() === bidderId);
    if (!member) {
      throw notFound('Member not found on this chit');
    }

    const othersTickets = sumTickets(
      chit.members.filter((m) => m.bidderId.toString() !== bidderId)
    );
    assertTicketCapacity(othersTickets, input.numberOfTickets, chit.maxBidders);

    member.numberOfTickets = input.numberOfTickets;
    await chit.save();

    const populated = await Chit.findById(chit._id)
      .populate('members.bidderId', 'name phone')
      .lean();

    return toEnrichedChitDto(
      (populated ?? chit) as unknown as IChitDocument,
      { includeMembers: true, actor }
    );
  }

  async removeMember(actor: JwtPayload, chitId: string, bidderId: string) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit) {
      throw notFound('Chit not found');
    }

    const before = chit.members.length;
    chit.members = chit.members.filter(
      (m) => m.bidderId.toString() !== bidderId
    );
    if (chit.members.length === before) {
      throw notFound('Member not found on this chit');
    }

    await chit.save();

    const populated = await Chit.findById(chit._id)
      .populate('members.bidderId', 'name phone')
      .lean();

    return toEnrichedChitDto(
      (populated ?? chit) as unknown as IChitDocument,
      { includeMembers: true, actor }
    );
  }

  async reportMember(
    actor: JwtPayload,
    chitId: string,
    bidderId: string,
    input: { reason: BidderReportReason; note?: string }
  ) {
    const chit = await Chit.findOne(buildScopedChitByIdFilter(actor, chitId));
    if (!chit) {
      throw notFound('Chit not found');
    }

    const member = chit.members.find((m) => m.bidderId.toString() === bidderId);
    if (!member) {
      throw notFound('Member not found on this chit');
    }

    if (!Array.isArray(member.reports)) {
      member.reports = [];
    }

    member.reports.push({
      reason: input.reason,
      note: input.note?.trim() ? input.note.trim() : null,
      reportedBy: new Types.ObjectId(actor.sub),
      createdAt: new Date(),
    });

    await chit.save();

    const populated = await Chit.findById(chit._id)
      .populate('members.bidderId', 'name phone')
      .lean();

    return toEnrichedChitDto(
      (populated ?? chit) as unknown as IChitDocument,
      { includeMembers: true, actor }
    );
  }

  /**
   * Bidder self-join: add self as member on an active chit with spare capacity.
   * Chit must be visible as open (active, not deleted) — not scoped to membership yet.
   */
  async joinAsBidder(
    actor: JwtPayload,
    chitId: string,
    input: { numberOfTickets?: number }
  ) {
    if (actor.role !== USER_ROLES.BIDDER) {
      throw badRequest('Only bidders can self-join a chit');
    }

    const chit = await Chit.findOne({
      _id: new Types.ObjectId(chitId),
      status: CHIT_STATUS.ACTIVE,
    });
    if (!chit) {
      throw notFound('Chit not found or not open for joining');
    }

    const exists = chit.members.some(
      (m) => m.bidderId.toString() === actor.sub
    );
    if (exists) {
      throw conflict('You are already a member of this chit');
    }

    if (chit.members.length >= chit.maxBidders) {
      throw badRequest('This chit is full');
    }

    const tickets = input.numberOfTickets ?? 1;
    assertTicketCapacity(sumTickets(chit.members), tickets, chit.maxBidders);

    const built = await validateAndBuildMembers(
      [
        {
          bidderId: actor.sub,
          numberOfTickets: tickets,
        },
      ],
      chit.maxBidders
    );
    chit.members.push(built[0]);
    await chit.save();

    const populated = await Chit.findById(chit._id)
      .populate('members.bidderId', 'name phone')
      .lean();

    return toEnrichedChitDto(
      (populated ?? chit) as unknown as IChitDocument,
      { includeMembers: true, actor }
    );
  }
}

export const chitService = new ChitService();
